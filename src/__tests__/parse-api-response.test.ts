import { describe, it, expect } from "vitest";
import { parseApiResponse } from "../lib/api/parseApiResponse";

describe("parseApiResponse", () => {
  it("returns the parsed body for a successful JSON response", async () => {
    const res = new Response(JSON.stringify({ foo: "bar" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const result = await parseApiResponse<{ foo: string }>(res);
    expect(result).toEqual({ data: { foo: "bar" }, error: undefined });
  });

  it("surfaces a JSON body's own error field", async () => {
    const res = new Response(JSON.stringify({ error: "rate_limit" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    });
    const result = await parseApiResponse(res);
    expect(result.error).toBe("rate_limit");
    expect(result.data).toEqual({ error: "rate_limit" });
  });

  it("also matches a JSON content-type with a charset suffix", async () => {
    const res = new Response(JSON.stringify({ foo: "bar" }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
    const result = await parseApiResponse<{ foo: string }>(res);
    expect(result.data).toEqual({ foo: "bar" });
  });

  it("returns a cleaned, truncated error message for a non-JSON body", async () => {
    const longText = "x".repeat(220);
    const res = new Response(`  ${longText}\n\nmore   text  `, {
      status: 500,
      headers: { "content-type": "text/plain" },
    });
    const result = await parseApiResponse(res);
    expect(result.data).toBeNull();
    expect(result.error).toBe(`Request failed (500): ${`${longText} more text`.slice(0, 180)}`);
    expect(result.error?.length).toBeLessThanOrEqual("Request failed (500): ".length + 180);
  });

  it("returns a bare status message for an empty non-JSON body", async () => {
    const res = new Response("", { status: 502 });
    const result = await parseApiResponse(res);
    expect(result).toEqual({ data: null, error: "Request failed (502)" });
  });

  it("treats a missing content-type header as non-JSON", async () => {
    const res = new Response("Internal Server Error", { status: 500 });
    const result = await parseApiResponse(res);
    expect(result.data).toBeNull();
    expect(result.error).toBe("Request failed (500): Internal Server Error");
  });
});
