import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

/**
 * Direct coverage for getRequestUser's real implementation. Every API-route
 * test in this suite mocks this module rather than exercising it, so its
 * env-var short-circuit, bearer/cookie token extraction, anon-session
 * lookup, and user_profiles/is_active gating were previously untested.
 */

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
      auth: { getUser: mockGetUser },
    };
  }),
}));

import { getRequestUser } from "../lib/request-user";

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://alfursanauto.ca/api/vehicles", { headers });
}

beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-service-role-key");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-anon-key");
  mockGetUser.mockResolvedValue({
    data: { user: { email: "dealer@alfursanauto.ca" } },
    error: null,
  });
  mockSingle.mockResolvedValue({
    data: { id: "u1", role: "manager", is_active: true },
    error: null,
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("getRequestUser", () => {
  it("returns null if a Supabase env var is missing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
    // SUPABASE_SECRET_KEY / SUPABASE_PUBLISHABLE_KEY left unset.
    const result = await getRequestUser(req());
    expect(result).toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("returns null when neither an Authorization header nor a cookie is present", async () => {
    const result = await getRequestUser(req());
    expect(result).toBeNull();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("extracts the token from an Authorization: Bearer header", async () => {
    const result = await getRequestUser(req({ authorization: "Bearer my-token" }));
    expect(mockGetUser).toHaveBeenCalledWith("my-token");
    expect(result).toEqual({ email: "dealer@alfursanauto.ca", role: "manager", userId: "u1" });
  });

  it("extracts and URL-decodes the token from the sb-access-token cookie", async () => {
    const result = await getRequestUser(
      req({ cookie: "other=1; sb-access-token=abc%3Ddef; more=2" }),
    );
    expect(mockGetUser).toHaveBeenCalledWith("abc=def");
    expect(result).toEqual({ email: "dealer@alfursanauto.ca", role: "manager", userId: "u1" });
  });

  it("prefers the Authorization header over a cookie when both are present", async () => {
    await getRequestUser(
      req({ authorization: "Bearer header-token", cookie: "sb-access-token=cookie-token" }),
    );
    expect(mockGetUser).toHaveBeenCalledWith("header-token");
  });

  it("returns null when the anon client's getUser call errors", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "invalid token" } });
    const result = await getRequestUser(req({ authorization: "Bearer bad-token" }));
    expect(result).toBeNull();
  });

  it("returns null when getUser resolves without an email", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: null } }, error: null });
    const result = await getRequestUser(req({ authorization: "Bearer my-token" }));
    expect(result).toBeNull();
  });

  it("returns null when no matching user_profiles row exists", async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });
    const result = await getRequestUser(req({ authorization: "Bearer my-token" }));
    expect(result).toBeNull();
  });

  it("returns null when the matched profile is inactive", async () => {
    mockSingle.mockResolvedValue({
      data: { id: "u1", role: "manager", is_active: false },
      error: null,
    });
    const result = await getRequestUser(req({ authorization: "Bearer my-token" }));
    expect(result).toBeNull();
  });

  it("returns the RequestUser shape on the happy path", async () => {
    const result = await getRequestUser(req({ authorization: "Bearer my-token" }));
    expect(result).toEqual({ email: "dealer@alfursanauto.ca", role: "manager", userId: "u1" });
  });
});
