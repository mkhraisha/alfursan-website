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

  it("sets cookie and defaults Max-Age to 3600 when expiresIn is missing", async () => {
    const res = await POST({
      request: makeRequest({ token: "token-12345-long" }),
    } as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("sb-access-token=token-12345-long");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=3600");
  });

  it("uses provided positive expiresIn as Max-Age", async () => {
    const res = await POST({
      request: makeRequest({ token: "token-12345-long", expiresIn: 1200 }),
    } as never);
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("Max-Age=1200");
  });

  it("falls back to Max-Age=3600 when expiresIn is non-positive", async () => {
    const res = await POST({
      request: makeRequest({ token: "token-12345-long", expiresIn: 0 }),
    } as never);
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("Max-Age=3600");
  });

  it("URL-encodes token value in cookie", async () => {
    const token = "token with spaces/and?chars";
    const res = await POST({ request: makeRequest({ token }) } as never);
    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain(
      `sb-access-token=${encodeURIComponent(token)}`
    );
  });
});
