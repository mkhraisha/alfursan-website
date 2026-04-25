import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

// ── Module mocks (hoisted before imports) ─────────────────────────────────────
vi.mock("../lib/supabase-admin");
vi.mock("../lib/rate-limit");
vi.mock("resend");

import { getAdminClient } from "../lib/supabase-admin";
import { getFinancingRateLimit } from "../lib/rate-limit";
import { Resend } from "resend";
import { POST } from "../pages/api/finance";

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_BODY = {
  fullName: "Jane Smith",
  dob: "1990-05-15",
  address: "123 Main St",
  postalCode: "M1A 1A1",
  addressSinceYear: "2020",
  addressSinceMonth: "3",
  phone: "4165551234",
  email: "jane@example.com",
  maritalStatus: "single",
  employmentStatus: "employed",
  vin: "1HGCM82633A004352",
  consentAccurate: true,
  consentPrivacy: true,
  licenseConsent: true,
};

function makeRequest(
  body: unknown,
  opts: { origin?: string; ip?: string } = {}
): Request {
  return new Request("https://alfursanauto.ca/api/finance", {
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
  return new Request("https://alfursanauto.ca/api/finance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://alfursanauto.ca",
    },
    body: "not-valid-json{{{",
  });
}

/** Build a minimal supabase mock that handles insert→select→single and update→eq chains */
function makeSupabaseMock({
  insertData = { id: "app-123" } as Record<string, unknown> | null,
  insertError = null as unknown,
  updateError = null as unknown,
} = {}) {
  const insertSingleFn = vi.fn().mockResolvedValue({ data: insertData, error: insertError });
  const insertSelectFn = vi.fn().mockReturnValue({ single: insertSingleFn });
  const insertFn = vi.fn().mockReturnValue({ select: insertSelectFn });

  const updateEqFn = vi.fn().mockResolvedValue({ data: null, error: updateError });
  const updateFn = vi.fn().mockReturnValue({ eq: updateEqFn });

  const fromFn = vi.fn().mockReturnValue({ insert: insertFn, update: updateFn });

  return { client: { from: fromFn }, insertFn, updateFn, updateEqFn };
}

function makePassingRateLimiter() {
  return { limit: vi.fn().mockResolvedValue({ success: true }) };
}

function makeBlockedRateLimiter() {
  return { limit: vi.fn().mockResolvedValue({ success: false }) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/finance", () => {
  beforeEach(() => {
    // Default: rate limiter passes, no Resend env vars (email skipped)
    (getFinancingRateLimit as Mock).mockReturnValue(makePassingRateLimiter());
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("RESEND_DEALER_EMAIL", "");
    vi.stubEnv("RESEND_FROM_ADDRESS", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  // ── CSRF / origin ────────────────────────────────────────────────────────────

  describe("CSRF / origin check", () => {
    it("returns 403 for missing origin", async () => {
      const req = new Request("https://alfursanauto.ca/api/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(403);
    });

    it("returns 403 for an external origin", async () => {
      const res = await POST({
        request: makeRequest(VALID_BODY, { origin: "https://evil.com" }),
      } as never);
      expect(res.status).toBe(403);
    });

    it("allows localhost origins", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({
        request: makeRequest(VALID_BODY, { origin: "http://localhost:4321" }),
      } as never);
      expect(res.status).toBe(200);
    });

    it("allows alfursanauto.ca", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(res.status).toBe(200);
    });

    it("allows Vercel preview subdomains", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({
        request: makeRequest(VALID_BODY, {
          origin: "https://alfursan-website-git-feature.vercel.app",
        }),
      } as never);
      expect(res.status).toBe(200);
    });

    it("blocks vercel.app itself (no subdomain)", async () => {
      const res = await POST({
        request: makeRequest(VALID_BODY, { origin: "https://vercel.app" }),
      } as never);
      expect(res.status).toBe(403);
    });
  });

  // ── Rate limiting ────────────────────────────────────────────────────────────

  describe("rate limiting", () => {
    it("returns 429 when rate limit is exceeded", async () => {
      (getFinancingRateLimit as Mock).mockReturnValue(makeBlockedRateLimiter());
      const res = await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("rate_limit");
    });

    it("passes through when rate limiter throws (not configured)", async () => {
      (getFinancingRateLimit as Mock).mockImplementation(() => {
        throw new Error("Upstash not configured");
      });
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(res.status).toBe(200);
    });

    it("uses x-forwarded-for IP for rate limit key", async () => {
      const limiter = makePassingRateLimiter();
      (getFinancingRateLimit as Mock).mockReturnValue(limiter);
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await POST({
        request: makeRequest(VALID_BODY, { ip: "1.2.3.4" }),
      } as never);
      expect(limiter.limit).toHaveBeenCalledWith("1.2.3.4");
    });
  });

  // ── Body parsing ─────────────────────────────────────────────────────────────

  describe("body parsing", () => {
    it("returns 400 for invalid JSON", async () => {
      const res = await POST({ request: makeBadJsonRequest() } as never);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.errors._).toMatch(/invalid request body/i);
    });
  });

  // ── Validation ───────────────────────────────────────────────────────────────

  describe("Zod validation", () => {
    it("returns 422 for empty body", async () => {
      const res = await POST({ request: makeRequest({}) } as never);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(Object.keys(body.errors).length).toBeGreaterThan(0);
    });

    it("returns 422 when fullName is missing", async () => {
      const { fullName: _, ...rest } = VALID_BODY;
      const res = await POST({ request: makeRequest(rest) } as never);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors.fullName).toBeTruthy();
    });

    it("returns 422 when consentAccurate is false", async () => {
      const res = await POST({
        request: makeRequest({ ...VALID_BODY, consentAccurate: false }),
      } as never);
      expect(res.status).toBe(422);
    });

    it("returns 422 when VIN is wrong length", async () => {
      const res = await POST({
        request: makeRequest({ ...VALID_BODY, vin: "TOOSHORT" }),
      } as never);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.errors.vin).toBeTruthy();
    });
  });

  // ── DB insert ─────────────────────────────────────────────────────────────────

  describe("database insert", () => {
    it("returns 500 when DB insert fails", async () => {
      const { client } = makeSupabaseMock({ insertError: { message: "DB down" } });
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it("returns 500 when DB returns null row", async () => {
      const { client } = makeSupabaseMock({ insertData: null });
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(res.status).toBe(500);
    });

    it("includes the application ID in the response on success", async () => {
      const { client } = makeSupabaseMock({ insertData: { id: "abc-999" } });
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.applicationId).toBe("abc-999");
    });
  });

  // ── License path update ───────────────────────────────────────────────────────

  describe("license path update", () => {
    it("does NOT call update when no draftId is provided", async () => {
      const { client, updateFn } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(updateFn).not.toHaveBeenCalled();
    });

    it("calls update when draftId + licenseFrontPath are provided", async () => {
      const { client, updateFn } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await POST({
        request: makeRequest({
          ...VALID_BODY,
          draftId: "550e8400-e29b-41d4-a716-446655440000",
          licenseFrontPath: "tmp/550e8400-e29b-41d4-a716-446655440000/front.jpg",
        }),
      } as never);
      expect(updateFn).toHaveBeenCalledWith(
        expect.objectContaining({ license_front_path: "tmp/550e8400-e29b-41d4-a716-446655440000/front.jpg" })
      );
    });

    it("still returns 200 even if the license path update fails", async () => {
      const { client } = makeSupabaseMock({ updateError: { message: "path update failed" } });
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({
        request: makeRequest({
          ...VALID_BODY,
          draftId: "550e8400-e29b-41d4-a716-446655440000",
          licenseFrontPath: "tmp/550e8400-e29b-41d4-a716-446655440000/front.jpg",
        }),
      } as never);
      expect(res.status).toBe(200);
    });
  });

  // ── Email notification ────────────────────────────────────────────────────────

  describe("email notification", () => {
    it("does not call Resend when env vars are absent", async () => {
      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(Resend).not.toHaveBeenCalled();
    });

    it("calls Resend when all email env vars are present", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("RESEND_DEALER_EMAIL", "dealer@alfursanauto.ca");
      vi.stubEnv("RESEND_FROM_ADDRESS", "noreply@alfursanauto.ca");

      const mockSend = vi.fn().mockResolvedValue({ data: { id: "email-1" } });
      (Resend as unknown as Mock).mockImplementation(function() {
        return { emails: { send: mockSend } };
      });

      const { client } = makeSupabaseMock({ insertData: { id: "app-777" } });
      (getAdminClient as Mock).mockReturnValue(client);

      const res = await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(res.status).toBe(200);
      expect(mockSend).toHaveBeenCalledOnce();
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain("app-777");
    });

    it("still returns 200 when Resend throws", async () => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("RESEND_DEALER_EMAIL", "dealer@alfursanauto.ca");
      vi.stubEnv("RESEND_FROM_ADDRESS", "noreply@alfursanauto.ca");

      (Resend as unknown as Mock).mockImplementation(function() {
        return { emails: { send: vi.fn().mockRejectedValue(new Error("SMTP error")) } };
      });

      const { client } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(res.status).toBe(200);
    });
  });

  // ── Data handling ─────────────────────────────────────────────────────────────

  describe("data handling", () => {
    it("strips commas from annualIncome before inserting", async () => {
      const { client, insertFn } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await POST({
        request: makeRequest({ ...VALID_BODY, annualIncome: "75,000" }),
      } as never);
      const insertPayload = insertFn.mock.calls[0][0];
      expect(insertPayload.annual_income).toBe(75000);
    });

    it("strips commas from vehiclePrice before inserting", async () => {
      const { client, insertFn } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await POST({
        request: makeRequest({ ...VALID_BODY, vehiclePrice: "25,999" }),
      } as never);
      const insertPayload = insertFn.mock.calls[0][0];
      expect(insertPayload.vehicle_price).toBe(25999);
    });

    it("stores employer_address and employer_phone", async () => {
      const { client, insertFn } = makeSupabaseMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await POST({
        request: makeRequest({
          ...VALID_BODY,
          employerAddress: "456 Bay St",
          employerPhone: "4165559999",
        }),
      } as never);
      const insertPayload = insertFn.mock.calls[0][0];
      expect(insertPayload.employer_address).toBe("456 Bay St");
      expect(insertPayload.employer_phone).toBe("4165559999");
    });
  });
});
