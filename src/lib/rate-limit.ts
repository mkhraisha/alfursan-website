import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Server-only rate limiter using Upstash Redis.
 * Limits financing form submissions to 5 requests per IP per hour.
 *
 * Usage in an API route:
 *   const ip = request.headers.get("x-forwarded-for") ?? "unknown";
 *   const { success } = await financingRateLimit.limit(ip);
 *   if (!success) return new Response(JSON.stringify({ error: "rate_limit" }), { status: 429 });
 */
export function getFinancingRateLimit() {
  const url = import.meta.env.UPSTASH_REDIS_REST_URL;
  const token = import.meta.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN env vars");
  }

  const redis = new Redis({ url, token });

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    analytics: false,
    prefix: "alfursan:financing",
  });
}
