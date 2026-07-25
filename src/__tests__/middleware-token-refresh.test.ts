import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Regression test for the "admin session silently stops proactively
 * refreshing, then bounces to /admin/?error=invalid_token later in the
 * session" bug: `sb-token-exp` must stay readable by client-side JS
 * (AdminLayout's proactive refresh timer) across every cookie rotation, not
 * just the initial login. It must never be marked HttpOnly.
 */

vi.mock("astro:middleware", () => ({
  defineMiddleware: (fn: unknown) => fn,
}));

const mockGetUser       = vi.fn();
const mockRefreshSession = vi.fn();
const mockSingle        = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn((_url: string, key: string) => {
    if (key === "test-service-role-key") {
      return {
        from: () => ({
          select: () => ({
            eq: () => ({ single: mockSingle }),
          }),
        }),
      };
    }
    return {
      auth: { getUser: mockGetUser, refreshSession: mockRefreshSession },
    };
  }),
}));

import { onRequest } from "../middleware";

function makeContext(path: string, cookie = "") {
  const url = new URL(`https://alfursanauto.ca${path}`);
  const request = new Request(url, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  return {
    locals: {} as Record<string, unknown>,
    request,
    url,
    redirect: (location: string) =>
      new Response(null, { status: 302, headers: { Location: location } }),
  };
}

const next = vi.fn(async () => new Response("ok", { status: 200 }));

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-service-role-key");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-anon-key");
  mockSingle.mockResolvedValue({ data: { id: "u1", role: "manager", is_active: true }, error: null });
  next.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("admin middleware — transparent token refresh cookies", () => {
  it("rotates sb-access-token and sb-refresh-token as HttpOnly, but keeps sb-token-exp readable by JS", async () => {
    // Expired access token → middleware falls through to the refresh path.
    mockGetUser
      .mockResolvedValueOnce({ data: { user: null }, error: { message: "expired" } })
      .mockResolvedValueOnce({ data: { user: { email: "dealer@alfursanauto.ca" } }, error: null });

    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token:  "new-access-token",
          refresh_token: "new-refresh-token",
          expires_in:    3600,
          expires_at:    1893456000,
        },
      },
      error: null,
    });

    const res = await onRequest(
      makeContext(
        "/admin/dashboard/",
        "sb-access-token=expired-token; sb-refresh-token=valid-refresh-token"
      ),
      next
    );

    expect(res.status).toBe(200);

    const setCookies = res.headers.getSetCookie();
    const accessCookie  = setCookies.find((c) => c.startsWith("sb-access-token="));
    const refreshCookie = setCookies.find((c) => c.startsWith("sb-refresh-token="));
    const expCookie      = setCookies.find((c) => c.startsWith("sb-token-exp="));

    expect(accessCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("HttpOnly");

    expect(expCookie).toBeDefined();
    expect(expCookie).not.toContain("HttpOnly");
  });
});
