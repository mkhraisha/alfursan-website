import { describe, it, expect, vi, afterEach } from "vitest";
import { buildPurgeRequest, purgeVercelCache, PUBLIC_VEHICLES_CACHE_TAG } from "../lib/vercel-cache";

describe("buildPurgeRequest", () => {
  it("builds the invalidate-by-tags URL with projectIdOrName and auth header", () => {
    const req = buildPurgeRequest({
      tags: ["public-vehicles"],
      token: "test-token",
      projectId: "prj_123",
    });

    expect(req.url).toBe(
      "https://api.vercel.com/v1/edge-cache/invalidate-by-tags?projectIdOrName=prj_123"
    );
    expect(req.headers.Authorization).toBe("Bearer test-token");
    expect(req.body).toEqual({ tags: ["public-vehicles"] });
  });

  it("includes teamId when provided", () => {
    const req = buildPurgeRequest({
      tags: ["public-vehicles"],
      token: "t",
      projectId: "prj_123",
      teamId: "team_456",
    });
    const url = new URL(req.url);
    expect(url.searchParams.get("teamId")).toBe("team_456");
  });

  it("includes target in the body when provided", () => {
    const req = buildPurgeRequest({
      tags: ["a", "b"],
      token: "t",
      projectId: "prj_123",
      target: "production",
    });
    expect(req.body).toEqual({ tags: ["a", "b"], target: "production" });
  });

  it("omits target from the body when not provided", () => {
    const req = buildPurgeRequest({ tags: ["a"], token: "t", projectId: "prj_123" });
    expect("target" in req.body).toBe(false);
  });
});

describe("purgeVercelCache", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("reports not_configured when VERCEL_API_TOKEN/VERCEL_PROJECT_ID are missing", async () => {
    delete process.env.CI;
    delete process.env.VERCEL_API_TOKEN;
    delete process.env.VERCEL_PROJECT_ID;

    const result = await purgeVercelCache([PUBLIC_VEHICLES_CACHE_TAG]);
    expect(result).toEqual({ ok: false, reason: "not_configured" });
  });

  it("returns ok: true on a successful purge", async () => {
    delete process.env.CI;
    process.env.VERCEL_API_TOKEN = "tok";
    process.env.VERCEL_PROJECT_ID = "prj_1";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const result = await purgeVercelCache([PUBLIC_VEHICLES_CACHE_TAG]);
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("invalidate-by-tags?projectIdOrName=prj_1"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("returns request_failed with status/body when Vercel responds with an error", async () => {
    delete process.env.CI;
    process.env.VERCEL_API_TOKEN = "tok";
    process.env.VERCEL_PROJECT_ID = "prj_1";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 403, text: () => Promise.resolve("forbidden") })
    );

    const result = await purgeVercelCache([PUBLIC_VEHICLES_CACHE_TAG]);
    expect(result).toEqual({ ok: false, reason: "request_failed", status: 403, body: "forbidden" });
  });

  it("returns disabled_in_ci when CI is set, regardless of credentials", async () => {
    process.env.CI = "true";
    process.env.VERCEL_API_TOKEN = "tok";
    process.env.VERCEL_PROJECT_ID = "prj_1";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await purgeVercelCache([PUBLIC_VEHICLES_CACHE_TAG]);
    expect(result).toEqual({ ok: false, reason: "disabled_in_ci" });
    // Must short-circuit before ever calling out to Vercel's API.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
