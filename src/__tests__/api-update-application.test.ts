import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../lib/supabase-admin");
vi.mock("../lib/permissions");

import { getAdminClient } from "../lib/supabase-admin";
import { can } from "../lib/permissions";
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

function makeLocals(role: string | undefined = "admin", email = "admin@dealership.ca") {
  return { adminRole: role, adminEmail: email };
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
    // Default: `can` returns true (has permission)
    (can as Mock).mockReturnValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Authorization ───────────────────────────────────────────────────────────

  describe("authorization", () => {
    it("returns 403 when role lacks financing:write", async () => {
      (can as Mock).mockReturnValue(false);
      const res = await PATCH({
        request: makeRequest(VALID_BODY),
        locals: makeLocals("viewer"),
      } as any);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/forbidden/i);
    });

    it("returns 403 when role is undefined", async () => {
      (can as Mock).mockReturnValue(false);
      const res = await PATCH({
        request: makeRequest(VALID_BODY),
        locals: makeLocals(undefined),
      } as any);
      expect(res.status).toBe(403);
    });

    it("allows requests with financing:write", async () => {
      (can as Mock).mockReturnValue(true);
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await PATCH({
        request: makeRequest(VALID_BODY),
        locals: makeLocals("admin"),
      } as any);
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
      const res = await PATCH({ request: req, locals: makeLocals() } as any);
      expect(res.status).toBe(400);
    });
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  describe("schema validation", () => {
    it("returns 422 when id is missing", async () => {
      const { id: _, ...noId } = VALID_BODY;
      const res = await PATCH({ request: makeRequest(noId), locals: makeLocals() } as any);
      expect(res.status).toBe(422);
    });

    it("returns 422 when id is not a valid UUID", async () => {
      const res = await PATCH({
        request: makeRequest({ ...VALID_BODY, id: "not-a-uuid" }),
        locals: makeLocals(),
      } as any);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors).toHaveProperty("id");
    });

    it("returns 422 when email is malformed", async () => {
      const res = await PATCH({
        request: makeRequest({ ...VALID_BODY, email: "not-an-email" }),
        locals: makeLocals(),
      } as any);
      expect(res.status).toBe(422);
    });

    it("returns 422 when full_name is a single character", async () => {
      const res = await PATCH({
        request: makeRequest({ ...VALID_BODY, full_name: "X" }),
        locals: makeLocals(),
      } as any);
      expect(res.status).toBe(422);
    });
  });

  // ── Empty patch guard ───────────────────────────────────────────────────────

  describe("empty patch guard", () => {
    it("returns 400 when only id is provided (no fields to update)", async () => {
      const res = await PATCH({
        request: makeRequest({ id: APP_ID }),
        locals: makeLocals(),
      } as any);
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
      const res = await PATCH({ request: makeRequest(VALID_BODY), locals: makeLocals() } as any);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("calls update with correct patch (strips undefined)", async () => {
      const { client, update } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await PATCH({
        request: makeRequest({ id: APP_ID, full_name: "Jane Smith" }),
        locals: makeLocals(),
      } as any);
      expect(update).toHaveBeenCalledWith({ full_name: "Jane Smith" });
    });

    it("inserts an application_updated audit row", async () => {
      const { client, auditInsert } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await PATCH({ request: makeRequest(VALID_BODY), locals: makeLocals("admin", "admin@example.com") } as any);
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
      const res = await PATCH({ request: makeRequest(VALID_BODY), locals: makeLocals() } as any);
      expect(res.status).toBe(500);
    });
  });
});
