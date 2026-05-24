import { describe, it, expect } from "vitest";
import { POST } from "../pages/api/admin/set-session";

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {}
): Request {
  return new Request("https://alfursanauto.ca/api/admin/set-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/** Collect all Set-Cookie values from a response (headers.get joins with ", ") */
function cookies(res: Response): string {
  return res.headers.get("Set-Cookie") ?? "";
}

describe("POST /api/admin/set-session", () => {
  it("returns 403 for cross-origin request", async () => {
    const req = makeRequest(
      { token: "very-long-valid-token", expiresIn: 1800 },
      { Origin: "https://evil.com", Host: "alfursanauto.ca" }
    );
    const res = await POST({ request: req } as never);
    expect(res.status).toBe(403);
  });

  it("returns 400 for malformed JSON", async () => {
    const req = new Request("https://alfursanauto.ca/api/admin/set-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{{bad-json",
    });
    const res = await POST({ request: req } as never);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns 400 when token is missing", async () => {
    const res = await POST({ request: makeRequest({ expiresIn: 1200 }) } as never);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid token" });
  });

  it("returns 400 when token is not a string", async () => {
    const res = await POST({
      request: makeRequest({ token: 12345, expiresIn: 1200 }),
    } as never);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid token" });
  });

  it("returns 400 when token is too short", async () => {
    const res = await POST({
      request: makeRequest({ token: "short", expiresIn: 1200 }),
    } as never);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid token" });
  });

  it("sets access token cookie and defaults Max-Age to 28800 when expiresIn is missing", async () => {
    const res = await POST({
      request: makeRequest({ token: "token-12345-long" }),
    } as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const c = cookies(res);
    expect(c).toContain("sb-access-token=token-12345-long");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Path=/");
    expect(c).toContain("Max-Age=28800");
  });

  it("uses provided positive expiresIn as Max-Age on access token", async () => {
    const res = await POST({
      request: makeRequest({ token: "token-12345-long", expiresIn: 1200 }),
    } as never);
    expect(cookies(res)).toContain("Max-Age=1200");
  });

  it("falls back to Max-Age=28800 when expiresIn is non-positive", async () => {
    const res = await POST({
      request: makeRequest({ token: "token-12345-long", expiresIn: 0 }),
    } as never);
    expect(cookies(res)).toContain("Max-Age=28800");
  });

  it("URL-encodes token value in cookie", async () => {
    const token = "token with spaces/and?chars";
    const res = await POST({ request: makeRequest({ token }) } as never);
    expect(cookies(res)).toContain(`sb-access-token=${encodeURIComponent(token)}`);
  });

  it("sets sb-refresh-token cookie when refreshToken is provided", async () => {
    const res = await POST({
      request: makeRequest({
        token: "token-12345-long",
        refreshToken: "refresh-token-abcdef",
      }),
    } as never);
    const c = cookies(res);
    expect(c).toContain("sb-refresh-token=refresh-token-abcdef");
    expect(c).toContain("Max-Age=2592000");
  });

  it("does not set sb-refresh-token cookie when refreshToken is absent", async () => {
    const res = await POST({
      request: makeRequest({ token: "token-12345-long" }),
    } as never);
    expect(cookies(res)).not.toContain("sb-refresh-token");
  });

  it("sets sb-token-exp cookie when expiresAt is provided", async () => {
    const exp = 1717171717;
    const res = await POST({
      request: makeRequest({ token: "token-12345-long", expiresAt: exp }),
    } as never);
    expect(cookies(res)).toContain(`sb-token-exp=${exp}`);
  });

  it("does not set sb-token-exp cookie when expiresAt is absent", async () => {
    const res = await POST({
      request: makeRequest({ token: "token-12345-long" }),
    } as never);
    expect(cookies(res)).not.toContain("sb-token-exp");
  });

  it("sets all three cookies when all fields are provided", async () => {
    const res = await POST({
      request: makeRequest({
        token: "token-12345-long",
        expiresIn: 28800,
        refreshToken: "refresh-token-abcdef",
        expiresAt: 1717171717,
      }),
    } as never);
    const c = cookies(res);
    expect(c).toContain("sb-access-token=token-12345-long");
    expect(c).toContain("sb-refresh-token=refresh-token-abcdef");
    expect(c).toContain("sb-token-exp=1717171717");
  });
});
