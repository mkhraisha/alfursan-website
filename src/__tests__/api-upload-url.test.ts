import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock("../lib/supabase-admin");
vi.mock("../lib/rate-limit");

import { getAdminClient } from "../lib/supabase-admin";
import { getFinancingRateLimit } from "../lib/rate-limit";

// upload-url.ts lives at pages/api/finance/upload-url.ts — one level deeper
import { POST } from "../pages/api/finance/upload-url";

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

const VALID_BODY = {
  draftId: VALID_UUID,
  side: "front",
  contentType: "image/jpeg",
  fileSize: 1024 * 1024, // 1 MB
};

function makeRequest(
  body: unknown,
  opts: { origin?: string; ip?: string } = {}
): Request {
  return new Request("https://alfursanauto.ca/api/finance/upload-url", {
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
  return new Request("https://alfursanauto.ca/api/finance/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://alfursanauto.ca" },
    body: "{{bad-json",
  });
}

function makeStorageMock({
  signedUrl = "https://supabase.co/storage/v1/upload/sign/license-documents/tmp/...",
  error = null as unknown,
} = {}) {
  const createSignedUploadUrl = vi.fn().mockResolvedValue({
    data: error ? null : { signedUrl },
    error,
  });
  const fromFn = vi.fn().mockReturnValue({ createSignedUploadUrl });
  const client = { storage: { from: fromFn } };
  return { client, fromFn, createSignedUploadUrl };
}

function makePassingRateLimiter() {
  return { limit: vi.fn().mockResolvedValue({ success: true }) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/finance/upload-url", () => {
  beforeEach(() => {
    (getFinancingRateLimit as Mock).mockReturnValue(makePassingRateLimiter());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── CSRF / origin ────────────────────────────────────────────────────────────

  describe("CSRF / origin check", () => {
    it("returns 403 for missing origin", async () => {
      const req = new Request("https://alfursanauto.ca/api/finance/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      });
      const res = await POST({ request: req } as never);
      expect(res.status).toBe(403);
    });

    it("returns 403 for external origin", async () => {
      const res = await POST({
        request: makeRequest(VALID_BODY, { origin: "https://malicious.io" }),
      } as never);
      expect(res.status).toBe(403);
    });

    it("allows localhost origins", async () => {
      const { client } = makeStorageMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({
        request: makeRequest(VALID_BODY, { origin: "http://localhost:4321" }),
      } as never);
      expect(res.status).toBe(200);
    });
  });

  // ── Rate limiting ────────────────────────────────────────────────────────────

  describe("rate limiting", () => {
    it("returns 429 when rate limit exceeded", async () => {
      (getFinancingRateLimit as Mock).mockReturnValue({
        limit: vi.fn().mockResolvedValue({ success: false }),
      });
      const res = await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("rate_limit");
    });

    it("passes through when rate limiter throws (not configured)", async () => {
      (getFinancingRateLimit as Mock).mockImplementation(() => {
        throw new Error("No Upstash config");
      });
      const { client } = makeStorageMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(res.status).toBe(200);
    });

    it("uses upload-prefixed key for rate limiting", async () => {
      const limiter = makePassingRateLimiter();
      (getFinancingRateLimit as Mock).mockReturnValue(limiter);
      const { client } = makeStorageMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await POST({ request: makeRequest(VALID_BODY, { ip: "9.8.7.6" }) } as never);
      expect(limiter.limit).toHaveBeenCalledWith("upload:9.8.7.6");
    });
  });

  // ── Body parsing ─────────────────────────────────────────────────────────────

  describe("body parsing", () => {
    it("returns 400 for invalid JSON", async () => {
      const res = await POST({ request: makeBadJsonRequest() } as never);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid request body/i);
    });
  });

  // ── Field validation ──────────────────────────────────────────────────────────

  describe("field validation", () => {
    it("returns 400 when draftId is missing", async () => {
      const { draftId: _, ...rest } = VALID_BODY;
      const res = await POST({ request: makeRequest(rest) } as never);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/missing required fields/i);
    });

    it("returns 400 when side is missing", async () => {
      const { side: _, ...rest } = VALID_BODY;
      const res = await POST({ request: makeRequest(rest) } as never);
      expect(res.status).toBe(400);
    });

    it("returns 400 when contentType is missing", async () => {
      const { contentType: _, ...rest } = VALID_BODY;
      const res = await POST({ request: makeRequest(rest) } as never);
      expect(res.status).toBe(400);
    });

    it("returns 400 when fileSize is missing", async () => {
      const { fileSize: _, ...rest } = VALID_BODY;
      const res = await POST({ request: makeRequest(rest) } as never);
      expect(res.status).toBe(400);
    });
  });

  // ── UUID / path-traversal protection ─────────────────────────────────────────

  describe("draftId UUID validation", () => {
    it("returns 400 for a path traversal draftId", async () => {
      const res = await POST({
        request: makeRequest({ ...VALID_BODY, draftId: "../../etc/passwd" }),
      } as never);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/invalid draftId/i);
    });

    it("returns 400 for a short non-UUID string", async () => {
      const res = await POST({
        request: makeRequest({ ...VALID_BODY, draftId: "abc123" }),
      } as never);
      expect(res.status).toBe(400);
    });

    it("accepts uppercase UUID", async () => {
      const { client } = makeStorageMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({
        request: makeRequest({ ...VALID_BODY, draftId: VALID_UUID.toUpperCase() }),
      } as never);
      expect(res.status).toBe(200);
    });
  });

  // ── Side validation ───────────────────────────────────────────────────────────

  describe("side validation", () => {
    it("returns 400 for invalid side value", async () => {
      const res = await POST({
        request: makeRequest({ ...VALID_BODY, side: "middle" }),
      } as never);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/front.*back/i);
    });

    it("accepts 'back' side", async () => {
      const { client } = makeStorageMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({
        request: makeRequest({ ...VALID_BODY, side: "back" }),
      } as never);
      expect(res.status).toBe(200);
    });
  });

  // ── Content type validation ───────────────────────────────────────────────────

  describe("content type validation", () => {
    const ALLOWED = ["image/jpeg", "image/png", "image/heic", "image/webp", "application/pdf"];

    it.each(ALLOWED)("allows %s", async (ct) => {
      const { client } = makeStorageMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({
        request: makeRequest({ ...VALID_BODY, contentType: ct }),
      } as never);
      expect(res.status).toBe(200);
    });

    it("rejects text/plain", async () => {
      const res = await POST({
        request: makeRequest({ ...VALID_BODY, contentType: "text/plain" }),
      } as never);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/not allowed/i);
    });

    it("rejects image/gif", async () => {
      const res = await POST({
        request: makeRequest({ ...VALID_BODY, contentType: "image/gif" }),
      } as never);
      expect(res.status).toBe(400);
    });
  });

  // ── File size validation ──────────────────────────────────────────────────────

  describe("file size validation", () => {
    it("returns 400 when file exceeds 8 MB", async () => {
      const res = await POST({
        request: makeRequest({ ...VALID_BODY, fileSize: 9 * 1024 * 1024 }),
      } as never);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/8 MB/i);
    });

    it("accepts exactly 8 MB", async () => {
      const { client } = makeStorageMock();
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({
        request: makeRequest({ ...VALID_BODY, fileSize: 8 * 1024 * 1024 }),
      } as never);
      expect(res.status).toBe(200);
    });
  });

  // ── Supabase storage ──────────────────────────────────────────────────────────

  describe("Supabase storage", () => {
    it("returns 500 when Supabase returns an error", async () => {
      const { client } = makeStorageMock({ error: { message: "Bucket not found" } });
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain("Bucket not found");
    });

    it("returns uploadUrl and storagePath on success", async () => {
      const signedUrl = "https://supabase.co/storage/v1/upload/sign/bucket/path?token=abc";
      const { client } = makeStorageMock({ signedUrl });
      (getAdminClient as Mock).mockReturnValue(client);
      const res = await POST({ request: makeRequest(VALID_BODY) } as never);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.uploadUrl).toBe(signedUrl);
      expect(body.storagePath).toBe(`tmp/${VALID_UUID}/front.jpg`);
    });

    it("constructs correct storage path for back/png", async () => {
      const { client, createSignedUploadUrl } = makeStorageMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await POST({
        request: makeRequest({ ...VALID_BODY, side: "back", contentType: "image/png" }),
      } as never);
      expect(createSignedUploadUrl).toHaveBeenCalledWith(`tmp/${VALID_UUID}/back.png`);
    });

    it("constructs correct storage path for front/pdf", async () => {
      const { client, createSignedUploadUrl } = makeStorageMock();
      (getAdminClient as Mock).mockReturnValue(client);
      await POST({
        request: makeRequest({ ...VALID_BODY, side: "front", contentType: "application/pdf" }),
      } as never);
      expect(createSignedUploadUrl).toHaveBeenCalledWith(`tmp/${VALID_UUID}/front.pdf`);
    });
  });
});
