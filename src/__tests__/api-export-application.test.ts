import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock("../lib/supabase-admin");

import { getAdminClient } from "../lib/supabase-admin";
import { GET } from "../pages/api/admin/export-application";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SAMPLE_APP = {
  id: "app-abc-123",
  full_name: "Jane Smith",
  email: "jane@example.com",
  phone: "4165551234",
  address: "123 Main St",
  postal_code: "M1A 1A1",
  dob: "1990-05-15",
  marital_status: "single",
  employment_status: "employed",
  employer: "ACME Corp",
  job_title: "Engineer",
  annual_income: 90000,
  vin: "1HGCM82633A004352",
  status: "new",
  created_at: "2026-01-01T00:00:00Z",
  consent_timestamp: "2026-01-01T00:00:00Z",
  license_consent: true,
};

/** Build a mock Astro GET context */
function makeContext({
  role = "owner" as string | undefined,
  email = "admin@alfursanauto.ca",
  id = "app-abc-123",
  ip = "1.2.3.4",
} = {}) {
  return {
    locals: { adminRole: role, adminEmail: email },
    url: new URL(`https://alfursanauto.ca/api/admin/export-application?id=${id}`),
    request: new Request("https://alfursanauto.ca/api/admin/export-application", {
      headers: { "x-forwarded-for": ip },
    }),
  };
}

/** Build a Supabase mock for the export route */
function makeSupabaseMock({
  selectData = SAMPLE_APP as Record<string, unknown> | null,
  selectError = null as unknown,
} = {}) {
  const singleFn = vi.fn().mockResolvedValue({ data: selectData, error: selectError });
  const eqFn = vi.fn().mockReturnValue({ single: singleFn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
  const auditInsertFn = vi.fn().mockResolvedValue({ error: null });

  const fromFn = vi.fn().mockImplementation((table: string) => {
    if (table === "applications") return { select: selectFn };
    return { insert: auditInsertFn }; // application_audit
  });

  return { client: { from: fromFn }, auditInsertFn, selectFn, eqFn };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/admin/export-application", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Authorization ─────────────────────────────────────────────────────────────

  describe("authorization", () => {
    it("returns 403 for staff role (no financing:export permission)", async () => {
      const res = await GET(makeContext({ role: "staff" }) as never);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/forbidden/i);
    });

    it("returns 403 when adminRole is undefined", async () => {
      // Cannot pass undefined through the helper (destructuring default kicks in),
      // so build the context manually.
      const ctx = {
        locals: { adminRole: undefined as string | undefined, adminEmail: "admin@test.com" },
        url: new URL("https://alfursanauto.ca/api/admin/export-application?id=app-abc-123"),
        request: new Request("https://alfursanauto.ca/"),
      };
      const res = await GET(ctx as never);
      expect(res.status).toBe(403);
    });

    it("allows owner role", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await GET(makeContext({ role: "owner" }) as never);
      expect(res.status).toBe(200);
    });

    it("allows manager role", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await GET(makeContext({ role: "manager" }) as never);
      expect(res.status).toBe(200);
    });
  });

  // ── Input validation ──────────────────────────────────────────────────────────

  describe("input validation", () => {
    it("returns 400 when id param is missing", async () => {
      const ctx = {
        locals: { adminRole: "owner", adminEmail: "admin@test.com" },
        url: new URL("https://alfursanauto.ca/api/admin/export-application"),
        request: new Request("https://alfursanauto.ca/"),
      };
      const res = await GET(ctx as never);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing id/i);
    });
  });

  // ── Not found ─────────────────────────────────────────────────────────────────

  describe("not found", () => {
    it("returns 404 when DB returns null (no such application)", async () => {
      const { client } = makeSupabaseMock({ selectData: null, selectError: { code: "PGRST116" } });
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await GET(makeContext() as never);
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toMatch(/not found/i);
    });

    it("returns 404 when DB returns an error", async () => {
      const { client } = makeSupabaseMock({ selectData: null, selectError: { message: "Not found" } });
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await GET(makeContext() as never);
      expect(res.status).toBe(404);
    });
  });

  // ── Happy path ────────────────────────────────────────────────────────────────

  describe("happy path", () => {
    it("returns 200 with application JSON on success", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await GET(makeContext() as never);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe("app-abc-123");
      expect(body.full_name).toBe("Jane Smith");
    });

    it("sets Content-Disposition header with correct filename", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await GET(makeContext() as never);
      expect(res.headers.get("Content-Disposition")).toContain("application-app-abc-123.json");
    });

    it("sets Content-Type to application/json", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await GET(makeContext() as never);
      expect(res.headers.get("Content-Type")).toContain("application/json");
    });
  });

  // ── Audit trail ───────────────────────────────────────────────────────────────

  describe("audit trail", () => {
    it("inserts an audit row with action=exported on success", async () => {
      const { client, auditInsertFn } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await GET(makeContext({ email: "boss@alfursanauto.ca", ip: "5.5.5.5" }) as never);
      expect(auditInsertFn).toHaveBeenCalledOnce();
      const auditPayload = auditInsertFn.mock.calls[0][0];
      expect(auditPayload.action).toBe("exported");
      expect(auditPayload.admin_email).toBe("boss@alfursanauto.ca");
      expect(auditPayload.application_id).toBe("app-abc-123");
    });

    it("stores a hashed IP (not plain text) in the audit row", async () => {
      const { client, auditInsertFn } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await GET(makeContext({ ip: "10.0.0.1" }) as never);
      const auditPayload = auditInsertFn.mock.calls[0][0];
      // Should be a 64-char hex SHA-256 hash, not the raw IP
      expect(auditPayload.ip_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(auditPayload.ip_hash).not.toBe("10.0.0.1");
    });

    it("uses 'unknown' as IP when header is absent", async () => {
      const { client, auditInsertFn } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const ctx = {
        locals: { adminRole: "owner", adminEmail: "admin@test.com" },
        url: new URL("https://alfursanauto.ca/api/admin/export-application?id=app-abc-123"),
        request: new Request("https://alfursanauto.ca/"),
      };
      await GET(ctx as never);
      expect(auditInsertFn).toHaveBeenCalledOnce();
      // ip_hash should be the SHA-256 of "unknown"
      const { createHash } = await import("node:crypto");
      const expectedHash = createHash("sha256").update("unknown").digest("hex");
      expect(auditInsertFn.mock.calls[0][0].ip_hash).toBe(expectedHash);
    });
  });
});
