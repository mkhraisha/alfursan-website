import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

vi.mock("../lib/supabase-admin");
vi.mock("../lib/rate-limit");

import { getAdminClient } from "../lib/supabase-admin";
import { getFinancingRateLimit } from "../lib/rate-limit";
import { POST } from "../pages/api/finance/phase2";

// ── Constants ─────────────────────────────────────────────────────────────────

const TOKEN  = "550e8400-e29b-41d4-a716-446655440000";
const APP_ID = "660e8400-e29b-41d4-a716-446655440001";

const VALID_BODY = {
  phase2Token:        TOKEN,
  appId:              APP_ID,
  voidChequePath:     "phase2/abc/void_cheque.pdf",
  proofInsurancePath: "phase2/abc/proof_insurance.pdf",
  payslipPath:        "phase2/abc/payslip.pdf",
  dealertrackConsent: true,
  references: [
    { name: "Alice Brown",  phone: "4165550001", relationship: "Friend"    },
    { name: "Bob Johnson",  phone: "4165550002", relationship: "Colleague" },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown, opts: { origin?: string; ip?: string } = {}): Request {
  return new Request("https://alfursanauto.ca/api/finance/phase2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: opts.origin ?? "https://alfursanauto.ca",
      ...(opts.ip ? { "x-forwarded-for": opts.ip } : {}),
    },
    body: JSON.stringify(body),
  });
}

function makeBadJsonRequest(): Request {
  return new Request("https://alfursanauto.ca/api/finance/phase2", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://alfursanauto.ca" },
    body: "{{bad-json",
  });
}

interface SupabaseMockOpts {
  appRow?: { id: string; status: string; email: string; full_name: string; phase2_token_expires_at?: string | null } | null;
  tokenLookupError?: boolean;
  updateError?: boolean;
}

function makeSupabaseMock({
  appRow = { id: APP_ID, status: "document_incomplete", email: "jane@example.com", full_name: "Jane Smith", phase2_token_expires_at: null },
  tokenLookupError = false,
  updateError = false,
}: SupabaseMockOpts = {}) {
  const auditInsert = vi.fn().mockResolvedValue({ error: null });

  // update().eq() chain
  const eqUpdate = vi.fn().mockResolvedValue({ error: updateError ? { message: "db error" } : null });
  const update   = vi.fn().mockReturnValue({ eq: eqUpdate });

  // from("application_audit").insert()
  const auditFrom = { insert: auditInsert };

  // from("applications").select().eq().eq().single() — token lookup
  const single = vi.fn().mockResolvedValue({
    data:  tokenLookupError ? null : appRow,
    error: tokenLookupError ? { message: "not found" } : null,
  });
  const eqToken2 = vi.fn().mockReturnValue({ single });
  const eqToken1 = vi.fn().mockReturnValue({ eq: eqToken2 });
  const select   = vi.fn().mockReturnValue({ eq: eqToken1 });

  const from = vi.fn().mockImplementation((table: string) => {
    if (table === "application_audit") return auditFrom;
    // applications: may be called for select (lookup) or update
    return { select, update };
  });

  const client = { from };
  return { client, from, select, update, eqUpdate, single, auditInsert };
}

function makePassingRateLimiter() {
  return { limit: vi.fn().mockResolvedValue({ success: true }) };
}

function makeBlockingRateLimiter() {
  return { limit: vi.fn().mockResolvedValue({ success: false }) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/finance/phase2", () => {
  beforeEach(() => {
    (getFinancingRateLimit as Mock).mockReturnValue(makePassingRateLimiter());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── CSRF ───────────────────────────────────────────────────────────────────

  describe("CSRF / origin check", () => {
    it("returns 403 for missing origin", async () => {
      const req = new Request("https://alfursanauto.ca/api/finance/phase2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      });
      const res = await POST({ request: req } as any);
      expect(res.status).toBe(403);
    });

    it("returns 403 for unknown origin", async () => {
      const res = await POST({ request: makeRequest(VALID_BODY, { origin: "https://evil.com" }) } as any);
      expect(res.status).toBe(403);
    });

    it("allows alfursanauto.ca origin", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY, { origin: "https://alfursanauto.ca" }) } as any);
      expect(res.status).not.toBe(403);
    });

    it("allows localhost origin", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY, { origin: "http://localhost:4321" }) } as any);
      expect(res.status).not.toBe(403);
    });
  });

  // ── Rate limit ─────────────────────────────────────────────────────────────

  describe("rate limiting", () => {
    it("returns 429 when rate limit is exceeded", async () => {
      (getFinancingRateLimit as Mock).mockReturnValue(makeBlockingRateLimiter());
      const res = await POST({ request: makeRequest(VALID_BODY) } as any);
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("rate_limit");
    });

    it("allows through when rate limiter throws (not configured)", async () => {
      (getFinancingRateLimit as Mock).mockImplementation(() => { throw new Error("no upstash"); });
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as any);
      expect(res.status).not.toBe(429);
    });
  });

  // ── Request body ───────────────────────────────────────────────────────────

  describe("request body parsing", () => {
    it("returns 400 for malformed JSON", async () => {
      const res = await POST({ request: makeBadJsonRequest() } as any);
      expect(res.status).toBe(400);
    });
  });

  // ── Zod validation ─────────────────────────────────────────────────────────

  describe("schema validation", () => {
    it("returns 422 for invalid phase2Token", async () => {
      const res = await POST({ request: makeRequest({ ...VALID_BODY, phase2Token: "not-uuid" }) } as any);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors).toHaveProperty("phase2Token");
    });

    it("returns 422 for invalid appId", async () => {
      const res = await POST({ request: makeRequest({ ...VALID_BODY, appId: "bad" }) } as any);
      expect(res.status).toBe(422);
    });

    it("returns 422 for empty voidChequePath", async () => {
      const res = await POST({ request: makeRequest({ ...VALID_BODY, voidChequePath: "" }) } as any);
      expect(res.status).toBe(422);
    });

    it("returns 422 when dealertrackConsent is false", async () => {
      const res = await POST({ request: makeRequest({ ...VALID_BODY, dealertrackConsent: false }) } as any);
      expect(res.status).toBe(422);
    });

    it("returns 422 with fewer than 2 references", async () => {
      const res = await POST({ request: makeRequest({ ...VALID_BODY, references: [VALID_BODY.references[0]] }) } as any);
      expect(res.status).toBe(422);
    });
  });

  // ── Token validation ───────────────────────────────────────────────────────

  describe("token validation", () => {
    it("returns 403 when token not found in DB", async () => {
      const { client } = makeSupabaseMock({ tokenLookupError: true });
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as any);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/invalid or expired/i);
    });

    it("returns 409 when status is already documents_submitted", async () => {
      const { client } = makeSupabaseMock({
        appRow: { id: APP_ID, status: "documents_submitted", email: "jane@example.com", full_name: "Jane" },
      });
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as any);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/already been submitted/i);
    });

    it("returns 409 when status is not document_incomplete", async () => {
      const { client } = makeSupabaseMock({
        appRow: { id: APP_ID, status: "new", email: "jane@example.com", full_name: "Jane" },
      });
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as any);
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/not awaiting documents/i);
    });
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe("happy path", () => {
    it("returns 200 on valid submission", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as any);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it("calls supabase.update with correct Phase 2 fields", async () => {
      const { client, update } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await POST({ request: makeRequest(VALID_BODY) } as any);
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          void_cheque_path:     VALID_BODY.voidChequePath,
          proof_insurance_path: VALID_BODY.proofInsurancePath,
          payslip_path:         VALID_BODY.payslipPath,
          dealertrack_consent:  true,
          status:               "documents_submitted",
        })
      );
    });

    it("writes a phase2_submitted audit row", async () => {
      const { client, auditInsert } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await POST({ request: makeRequest(VALID_BODY) } as any);
      expect(auditInsert).toHaveBeenCalledWith(
        expect.objectContaining({ action: "phase2_submitted", application_id: APP_ID })
      );
    });
  });

  // ── DB error ───────────────────────────────────────────────────────────────

  describe("database errors", () => {
    it("returns 500 when DB update fails", async () => {
      const { client } = makeSupabaseMock({ updateError: true });
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as any);
      expect(res.status).toBe(500);
    });
  });
});
