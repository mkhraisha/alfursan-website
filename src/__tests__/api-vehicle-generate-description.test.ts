import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { Mock } from "vitest";

// ── Module mocks (hoisted before imports) ─────────────────────────────────────
vi.mock("../lib/supabase-admin");
vi.mock("../lib/request-user");
vi.mock("../lib/rate-limit");
vi.mock("../lib/vehicle-description");

import { getAdminClient } from "../lib/supabase-admin";
import { getRequestUser } from "../lib/request-user";
import type { RequestUser } from "../lib/request-user";
import { getDescriptionRateLimit } from "../lib/rate-limit";
import { generateVehicleDescription } from "../lib/vehicle-description";
import { POST } from "../pages/api/vehicles/[vin]/generate-description";

const MANAGER: RequestUser = { email: "manager@example.com", role: "manager", userId: "user-1" };
const SALES: RequestUser = { email: "sales@example.com", role: "sales", userId: "user-2" };

const VEHICLE_SPEC = { make: "Honda", model: "Civic", year: 2020 };

function makeRequest() {
  return new Request("http://localhost/api/vehicles/1HGCM82633A004352/generate-description", {
    method: "POST",
  });
}

function mockVehicleLookup(data: Record<string, unknown> | null) {
  const singleFn = vi.fn().mockResolvedValue({ data, error: data ? null : { code: "PGRST116" } });
  const eqFn = vi.fn().mockReturnValue({ single: singleFn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
  (getAdminClient as Mock).mockReturnValue({ from: vi.fn().mockReturnValue({ select: selectFn }) });
}

function mockRateLimit(success: boolean) {
  (getDescriptionRateLimit as Mock).mockReturnValue({
    limit: vi.fn().mockResolvedValue({ success }),
  });
}

describe("POST /api/vehicles/:vin/generate-description", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    mockRateLimit(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 401 when unauthenticated", async () => {
    (getRequestUser as Mock).mockResolvedValue(null);
    const res = await POST({ params: { vin: "1HGCM82633A004352" }, request: makeRequest() } as never);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a role without vehicles:write", async () => {
    (getRequestUser as Mock).mockResolvedValue({ email: "x@example.com", role: "unknown_role", userId: "u" });
    const res = await POST({ params: { vin: "1HGCM82633A004352" }, request: makeRequest() } as never);
    expect(res.status).toBe(403);
  });

  it("returns 429 when the rate limit is exceeded", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES);
    mockRateLimit(false);
    const res = await POST({ params: { vin: "1HGCM82633A004352" }, request: makeRequest() } as never);
    expect(res.status).toBe(429);
  });

  it("allows the request through when the rate limiter throws (Upstash not configured)", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER);
    (getDescriptionRateLimit as Mock).mockImplementation(() => {
      throw new Error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN env vars");
    });
    mockVehicleLookup(VEHICLE_SPEC);
    (generateVehicleDescription as Mock).mockResolvedValue("A great Civic.");
    const res = await POST({ params: { vin: "1HGCM82633A004352" }, request: makeRequest() } as never);
    expect(res.status).toBe(200);
  });

  it("returns 500 when GEMINI_API_KEY is not configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    (getRequestUser as Mock).mockResolvedValue(MANAGER);
    const res = await POST({ params: { vin: "1HGCM82633A004352" }, request: makeRequest() } as never);
    expect(res.status).toBe(500);
  });

  it("returns 404 when the vehicle doesn't exist", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER);
    mockVehicleLookup(null);
    const res = await POST({ params: { vin: "1HGCM82633A004352" }, request: makeRequest() } as never);
    expect(res.status).toBe(404);
  });

  it("returns { description } on success without touching the database write path", async () => {
    (getRequestUser as Mock).mockResolvedValue(SALES);
    mockVehicleLookup(VEHICLE_SPEC);
    (generateVehicleDescription as Mock).mockResolvedValue("A tidy 2020 Honda Civic.");

    const res = await POST({ params: { vin: "1HGCM82633A004352" }, request: makeRequest() } as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ description: "A tidy 2020 Honda Civic." });
    expect(generateVehicleDescription).toHaveBeenCalledWith(
      VEHICLE_SPEC,
      expect.objectContaining({ apiKey: "test-key" })
    );
  });

  it("returns 500 when generation fails", async () => {
    (getRequestUser as Mock).mockResolvedValue(MANAGER);
    mockVehicleLookup(VEHICLE_SPEC);
    (generateVehicleDescription as Mock).mockRejectedValue(new Error("Gemini exploded"));
    const res = await POST({ params: { vin: "1HGCM82633A004352" }, request: makeRequest() } as never);
    expect(res.status).toBe(500);
  });
});
