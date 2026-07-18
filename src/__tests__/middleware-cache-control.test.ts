import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Regression test for the "magic link signs in but dashboard bounces back
 * to login" bug: Vercel's edge heuristically caches GET responses without an
 * explicit Cache-Control header, so an anonymous hit against /admin/** (e.g.
 * the daily smoke test) could cache a login redirect and serve it back to a
 * freshly-authenticated user. Every response under /admin/** must set
 * Cache-Control: no-store, while the rest of the site is left untouched.
 */

vi.mock("astro:middleware", () => ({
  defineMiddleware: (fn: unknown) => fn,
}));

const mockGetUser = vi.fn();
const mockSingle  = vi.fn();

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
      auth: { getUser: mockGetUser, refreshSession: vi.fn() },
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
  mockGetUser.mockResolvedValue({ data: { user: { email: "dealer@alfursanauto.ca" } }, error: null });
  mockSingle.mockResolvedValue({ data: { id: "u1", role: "admin", is_active: true }, error: null });
  next.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("admin middleware — Cache-Control", () => {
  it("sets no-store on the public login page", async () => {
    const res = await onRequest(makeContext("/admin/"), next);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets no-store on the token-missing redirect", async () => {
    const res = await onRequest(makeContext("/admin/dashboard/"), next);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/admin/?error=no_token");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets no-store on a successful authenticated page render", async () => {
    const res = await onRequest(
      makeContext("/admin/dashboard/", "sb-access-token=valid-token"),
      next
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets no-store on the unauthorized redirect", async () => {
    mockSingle.mockResolvedValue({ data: { id: "u1", role: "admin", is_active: false }, error: null });
    const res = await onRequest(
      makeContext("/admin/dashboard/", "sb-access-token=valid-token"),
      next
    );
    expect(res.headers.get("Location")).toBe("/admin/?error=unauthorized");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not force no-store on non-admin routes", async () => {
    const res = await onRequest(makeContext("/"), next);
    expect(res.headers.get("Cache-Control")).not.toBe("no-store");
  });
});
