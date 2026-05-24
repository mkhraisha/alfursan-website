import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ── Mock Supabase client ───────────────────────────────────────────────────────

const mockRefreshSession = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { refreshSession: mockRefreshSession },
  })),
}));

import { POST } from "../pages/api/admin/refresh-session";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(cookie = "", extraHeaders: Record<string, string> = {}) {
  return new Request("https://alfursanauto.ca/api/admin/refresh-session", {
    method: "POST",
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...extraHeaders,
    },
  });
}

function getCookies(res: Response): string {
  return res.headers.get("Set-Cookie") ?? "";
}

const VALID_COOKIE   = "sb-refresh-token=valid-refresh-token";
const VALID_SESSION  = {
  access_token:  "new-access-token-xyz",
  refresh_token: "new-refresh-token-xyz",
  expires_in:    3600,
  expires_at:    1_717_171_717,
};

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL",             "https://test.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-anon-key");
  mockRefreshSession.mockResolvedValue({ data: { session: VALID_SESSION }, error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/admin/refresh-session", () => {
  it("returns 403 for cross-origin request", async () => {
    const res = await POST({
      request: makeRequest(VALID_COOKIE, {
        Origin: "https://evil.com",
        Host:   "alfursanauto.ca",
      }),
    } as never);
    expect(res.status).toBe(403);
  });

  it("returns 401 when sb-refresh-token cookie is absent", async () => {
    const res = await POST({ request: makeRequest("") } as never);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "No refresh token" });
  });

  it("returns 500 when SUPABASE_URL is missing", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    const res = await POST({ request: makeRequest(VALID_COOKIE) } as never);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Server misconfiguration" });
  });

  it("returns 500 when SUPABASE_PUBLISHABLE_KEY is missing", async () => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    const res = await POST({ request: makeRequest(VALID_COOKIE) } as never);
    expect(res.status).toBe(500);
  });

  it("returns 401 when Supabase refreshSession fails", async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: "invalid refresh token" },
    });
    const res = await POST({ request: makeRequest(VALID_COOKIE) } as never);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Refresh failed" });
  });

  it("returns 401 when session is null even without an error object", async () => {
    mockRefreshSession.mockResolvedValue({ data: { session: null }, error: null });
    const res = await POST({ request: makeRequest(VALID_COOKIE) } as never);
    expect(res.status).toBe(401);
  });

  it("returns 200 with ok:true and expiresAt on success", async () => {
    const res = await POST({ request: makeRequest(VALID_COOKIE) } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.expiresAt).toBe(VALID_SESSION.expires_at);
  });

  it("sets all three session cookies on success", async () => {
    const res = await POST({ request: makeRequest(VALID_COOKIE) } as never);
    const c = getCookies(res);
    expect(c).toContain("sb-access-token=");
    expect(c).toContain("sb-refresh-token=");
    expect(c).toContain("sb-token-exp=");
  });

  it("access-token cookie is HttpOnly and uses expires_in as Max-Age", async () => {
    const res = await POST({ request: makeRequest(VALID_COOKIE) } as never);
    const c = getCookies(res);
    expect(c).toContain("HttpOnly");
    expect(c).toContain(`Max-Age=${VALID_SESSION.expires_in}`);
  });

  it("falls back to Max-Age=28800 when expires_in is zero or absent", async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: { ...VALID_SESSION, expires_in: 0 } },
      error: null,
    });
    const res = await POST({ request: makeRequest(VALID_COOKIE) } as never);
    expect(getCookies(res)).toContain("Max-Age=28800");
  });

  it("omits sb-token-exp cookie when expires_at is absent", async () => {
    mockRefreshSession.mockResolvedValue({
      data: { session: { ...VALID_SESSION, expires_at: undefined } },
      error: null,
    });
    const res = await POST({ request: makeRequest(VALID_COOKIE) } as never);
    expect(getCookies(res)).not.toContain("sb-token-exp");
  });

  it("URL-decodes the refresh token from the cookie before passing to Supabase", async () => {
    const raw     = "token/with?special=chars&more";
    const encoded = encodeURIComponent(raw);
    const res = await POST({
      request: makeRequest(`sb-refresh-token=${encoded}`),
    } as never);
    expect(res.status).toBe(200);
    expect(mockRefreshSession).toHaveBeenCalledWith({ refresh_token: raw });
  });

  it("allows same-origin requests (no Origin header)", async () => {
    const res = await POST({ request: makeRequest(VALID_COOKIE) } as never);
    expect(res.status).toBe(200);
  });

  it("allows same-origin requests when Origin matches Host", async () => {
    const res = await POST({
      request: makeRequest(VALID_COOKIE, {
        Origin: "https://alfursanauto.ca",
        Host:   "alfursanauto.ca",
      }),
    } as never);
    expect(res.status).toBe(200);
  });
});
