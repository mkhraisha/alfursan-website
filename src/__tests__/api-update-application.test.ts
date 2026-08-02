import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../lib/supabase-admin");
vi.mock("../lib/permissions");
vi.mock("../lib/request-user");

import { getAdminClient } from "../lib/supabase-admin";
import { can } from "../lib/permissions";
import { getRequestUser } from "../lib/request-user";
import type { RequestUser } from "../lib/request-user";
import { PATCH } from "../pages/api/admin/update-application";

// ── Constants ─────────────────────────────────────────────────────────────────

const APP_ID = "550e8400-e29b-41d4-a716-446655440000";

const VALID_BODY = {
  id:        APP_ID,
  full_name: "Jane Smith",
  email:     "jane@example.com",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, ip?: string): Request {
  return new Request("https://alfursanauto.ca/api/admin/update-application", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(ip ? { "x-forwarded-for": ip } : {}),
    },
    body: JSON.stringify(body),
  });
}

function makeUser(email = "admin@dealership.ca"): RequestUser {
  return { email, role: "manager", userId: "user-1" };
}

interface SupabaseMockOpts {
  updateError?: boolean;
}

function makeSupabaseMock({ updateError = false }: SupabaseMockOpts = {}) {
  const auditInsert = vi.fn().mockResolvedValue({ error: null });
  const eqUpdate    = vi.fn().mockResolvedValue({ error: updateError ? { message: "db error" } : null });
  const update      = vi.fn().mockReturnValue({ eq: eqUpdate });
  const from        = vi.fn().mockImplementation((table: string) => {
    if (table === "application_audit") return { insert: auditInsert };
    return { update };
  });
  return { client: { from }, from, update, eqUpdate, auditInsert };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PATCH /api/admin/update-application", () => {
  beforeEach(() => {
    // Default: authenticated with permission
    (getRequestUser as Mock).mockResolvedValue(makeUser());
    (can as Mock).mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Authorization ───────────────────────────────────────────────────────────

  describe("authorization", () => {
    it("returns 401 when unauthenticated", async () => {
      // This route lives under /api/**, which src/middleware.ts's /admin/**
      // session check does not cover, so it must authenticate itself via
      // getRequestUser() rather than relying on Astro.locals.
      (getRequestUser as Mock).mockResolvedValue(null);
      const res = await PATCH({ request: makeRequest(VALID_BODY) } as any);
      expect(res.status).toBe(401);
    });

    it("returns 403 when role lacks financing:write", async () => {
      (can as Mock).mockReturnValue(false);
      const res = await PATCH({ request: makeRequest(VALID_BODY) } as any);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/forbidden/i);
    });

    it("allows requests with financing:write", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await PATCH({ request: makeRequest(VALID_BODY) } as any);
      expect(res.status).toBe(200);
    });
  });

  // ── Body parsing ────────────────────────────────────────────────────────────

  describe("body parsing", () => {
    it("returns 400 for malformed JSON", async () => {
      const req = new Request("https://alfursanauto.ca/api/admin/update-application", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{{bad-json",
      });
      const res = await PATCH({ request: req } as any);
      expect(res.status).toBe(400);
    });
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe("schema validation", () => {
    it("returns 422 when id is missing", async () => {
      const { id: _, ...noId } = VALID_BODY;
      const res = await PATCH({ request: makeRequest(noId) } as any);
      expect(res.status).toBe(422);
    });

    it("returns 422 when id is not a valid UUID", async () => {
      const res = await PATCH({
        request: makeRequest({ ...VALID_BODY, id: "not-a-uuid" }),
      } as any);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors).toHaveProperty("id");
    });

    it("returns 422 when email is malformed", async () => {
      const res = await PATCH({
        request: makeRequest({ ...VALID_BODY, email: "not-an-email" }),
      } as any);
      expect(res.status).toBe(422);
    });

    it("returns 422 when full_name is a single character", async () => {
      const res = await PATCH({
        request: makeRequest({ ...VALID_BODY, full_name: "X" }),
      } as any);
      expect(res.status).toBe(422);
    });
  });

  // ── Empty patch guard ───────────────────────────────────────────────────────

  describe("empty patch guard", () => {
    it("returns 400 when only id is provided (no fields to update)", async () => {
      const res = await PATCH({ request: makeRequest({ id: APP_ID }) } as any);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/no fields/i);
    });
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe("happy path", () => {
    it("returns 200 and success:true", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await PATCH({ request: makeRequest(VALID_BODY) } as any);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("calls update with correct patch (strips undefined)", async () => {
      const { client, update } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await PATCH({
        request: makeRequest({ id: APP_ID, full_name: "Jane Smith" }),
      } as any);
      expect(update).toHaveBeenCalledWith({ full_name: "Jane Smith" });
    });

    it("inserts an application_updated audit row", async () => {
      (getRequestUser as Mock).mockResolvedValue(makeUser("admin@example.com"));
      const { client, auditInsert } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await PATCH({ request: makeRequest(VALID_BODY) } as any);
      expect(auditInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          application_id: APP_ID,
          action:         "application_updated",
          admin_email:    "admin@example.com",
        })
      );
    });
  });

  // ── DB error ────────────────────────────────────────────────────────────────

  describe("database errors", () => {
    it("returns 500 when DB update fails", async () => {
      const { client } = makeSupabaseMock({ updateError: true });
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await PATCH({ request: makeRequest(VALID_BODY) } as any);
      expect(res.status).toBe(500);
    });
  });
});
