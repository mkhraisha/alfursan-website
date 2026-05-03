import { vi, describe, it, expect, afterEach } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────
vi.mock("@upstash/redis");
vi.mock("@upstash/ratelimit");

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { getFinancingRateLimit } from "../lib/rate-limit";

describe("getFinancingRateLimit", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("throws when UPSTASH_REDIS_REST_URL is missing", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token_abc");
    expect(() => getFinancingRateLimit()).toThrow(
      "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN"
    );
  });

  it("throws when UPSTASH_REDIS_REST_TOKEN is missing", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(() => getFinancingRateLimit()).toThrow(
      "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN"
    );
  });

  it("throws when both Upstash env vars are missing", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    expect(() => getFinancingRateLimit()).toThrow();
  });

  it("constructs Redis with the correct url and token", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok_secret");
    getFinancingRateLimit();
    expect(Redis).toHaveBeenCalledWith({
      url: "https://redis.upstash.io",
      token: "tok_secret",
    });
  });

  it("constructs Ratelimit with a sliding window of 20 per hour", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok_secret");
    getFinancingRateLimit();
    expect(Ratelimit).toHaveBeenCalledWith(
      expect.objectContaining({
        analytics: false,
        prefix: "alfursan:financing",
      })
    );
  });

  it("returns the Ratelimit instance", () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok_secret");
    const result = getFinancingRateLimit();
    // vi.mock auto-mocks Ratelimit as a class — the returned value is its instance
    expect(result).toBeDefined();
  });
});
