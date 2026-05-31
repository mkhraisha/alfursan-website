import { test, expect, request as newRequest } from "playwright/test";

/**
 * Vehicles API E2E tests — hit the running dev server's actual API endpoints
 * and verify they return correct shapes against the real Supabase database.
 *
 * These run unauthenticated (public endpoints) and spot-check authenticated
 * behaviour using an env-provided service token when available.
 *
 * Set E2E_SERVICE_TOKEN=<supabase-service-role-token> to enable auth tests.
 *
 * Note: "auth required" tests use a fresh isolated request context (not the
 * shared test fixture) to guarantee no cookies or tokens leak from other tests.
 */

const BASE = "/api/vehicles";
const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:4321";
const SERVICE_TOKEN = process.env.E2E_SERVICE_TOKEN;

test.describe("GET /api/vehicles (public)", () => {
  test("returns 200 with an array", async ({ request }) => {
    const res = await request.get(BASE);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("returns only public columns for unauthenticated requests", async ({ request }) => {
    const res = await request.get(BASE);
    const body = await res.json();
    if (body.data.length === 0) return; // empty inventory — skip column check

    const vehicle = body.data[0];
    // Public fields MUST be present
    expect(vehicle).toHaveProperty("vin");
    expect(vehicle).toHaveProperty("make");
    expect(vehicle).toHaveProperty("model");
    expect(vehicle).toHaveProperty("year");
    // Private financial fields must NOT be present
    expect(vehicle).not.toHaveProperty("purchase_price");
    expect(vehicle).not.toHaveProperty("sale_price");
    expect(vehicle).not.toHaveProperty("profit_loss");
    expect(vehicle).not.toHaveProperty("commission");
  });

  test("returns a Cache-Control header for unauthenticated requests", async ({ request }) => {
    const res = await request.get(BASE);
    const cc = res.headers()["cache-control"];
    expect(cc).toMatch(/public/);
  });

  test("accepts pagination params without erroring", async ({ request }) => {
    const res = await request.get(`${BASE}?page=1&limit=5`);
    expect(res.status()).toBe(200);
  });
});

test.describe("GET /api/vehicles/:vin (public)", () => {
  test("returns 404 for a clearly invalid VIN", async ({ request }) => {
    const res = await request.get(`${BASE}/DOESNOTEXIST00000`);
    expect(res.status()).toBe(404);
  });

  test("returns vehicle data when VIN exists", async ({ request }) => {
    // First fetch the list to get a real VIN
    const listRes = await request.get(BASE);
    const { data } = await listRes.json();
    if (!data || data.length === 0) {
      test.skip(); // no vehicles in DB — skip
      return;
    }

    const vin = data[0].vin;
    const res  = await request.get(`${BASE}/${vin}`);
    expect(res.status()).toBe(200);
    const vehicle = await res.json();
    expect(vehicle.vin).toBe(vin);
  });
});

// Each auth-required test uses a *fresh* isolated APIRequestContext (not the
// shared test fixture) to guarantee no cookies or tokens from other tests leak in.

test.describe("POST /api/vehicles (auth required)", () => {
  test("returns 401 when unauthenticated", async () => {
    const ctx = await newRequest.newContext({ baseURL: BASE_URL });
    const res = await ctx.post(BASE, {
      data: { vin: "1HGCM82633A004352", make: "Honda", model: "Civic", year: 2020 },
    });
    await ctx.dispose();
    expect(res.status()).toBe(401);
  });
});

test.describe("PATCH /api/vehicles/:vin (auth required)", () => {
  test("returns 401 when unauthenticated", async () => {
    const ctx = await newRequest.newContext({ baseURL: BASE_URL });
    const res = await ctx.patch(`${BASE}/1HGCM82633A004352`, {
      data: { colour: "Red" },
    });
    await ctx.dispose();
    expect(res.status()).toBe(401);
  });
});

test.describe("DELETE /api/vehicles/:vin (auth required)", () => {
  test("is rejected without sufficient permissions", async () => {
    // Expects 401 (no auth) or 403 (auth present but role lacks vehicles:delete).
    // Both are correct: the endpoint must not return 2xx without admin credentials.
    const ctx = await newRequest.newContext({ baseURL: BASE_URL });
    const res = await ctx.delete(`${BASE}/1HGCM82633A004352`);
    await ctx.dispose();
    expect([401, 403]).toContain(res.status());
  });
});

test.describe("POST /api/vehicles/import (auth required)", () => {
  test("is rejected without sufficient permissions", async () => {
    // Same rationale as DELETE: 401 or 403 both confirm access is denied.
    const csv = "vin,make,model,year\n1HGCM82633A004352,Honda,Civic,2020";
    const mapping = JSON.stringify({ vin: "vin", make: "make", model: "model", year: "year" });
    const ctx = await newRequest.newContext({ baseURL: BASE_URL });
    const res = await ctx.post(`${BASE}/import`, {
      multipart: {
        file: { name: "test.csv", mimeType: "text/csv", buffer: Buffer.from(csv) },
        mapping,
      },
    });
    await ctx.dispose();
    expect([401, 403]).toContain(res.status());
  });
});

// ── Authenticated tests (only run when E2E_SERVICE_TOKEN is set) ────────────

test.describe("Authenticated vehicle CRUD", () => {
  test.skip(!SERVICE_TOKEN, "E2E_SERVICE_TOKEN not set — skipping authenticated tests");

  const authHeaders = { Authorization: `Bearer ${SERVICE_TOKEN}` };
  const TEST_VIN = "E2ETEST0000000001"; // safe test VIN (17 chars, no I/O/Q) — cleaned up after

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup
    await request.delete(`${BASE}/${TEST_VIN}`, { headers: authHeaders });
  });

  test("creates, reads, updates, and deletes a vehicle", async ({ request }) => {
    // CREATE
    const createRes = await request.post(BASE, {
      headers: authHeaders,
      data: {
        vin: TEST_VIN,
        make: "TestMake",
        model: "E2EModel",
        year: 2024,
        purchase_price: 15000,
        advertised_price: 18000,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created.vin).toBe(TEST_VIN);

    // READ
    const getRes = await request.get(`${BASE}/${TEST_VIN}`, { headers: authHeaders });
    expect(getRes.status()).toBe(200);
    const fetched = await getRes.json();
    expect(fetched.make).toBe("TestMake");
    expect(fetched).toHaveProperty("total_cost");
    expect(fetched).toHaveProperty("profit_loss");

    // UPDATE
    const patchRes = await request.patch(`${BASE}/${TEST_VIN}`, {
      headers: authHeaders,
      data: { colour: "E2E Blue" },
    });
    expect(patchRes.status()).toBe(200);
    const updated = await patchRes.json();
    expect(updated.colour).toBe("E2E Blue");

    // DELETE
    const deleteRes = await request.delete(`${BASE}/${TEST_VIN}`, { headers: authHeaders });
    expect(deleteRes.status()).toBe(204);

    // CONFIRM GONE
    const goneRes = await request.get(`${BASE}/${TEST_VIN}`, { headers: authHeaders });
    expect(goneRes.status()).toBe(404);
  });

  test("CSV import — preview mode returns parsed rows without inserting", async ({ request }) => {
    const csv = [
      "VIN,Make,Model,Year,Purchase Price",
      "CSVTEST0000000002,Toyota,Camry,2023,22000",
    ].join("\n");

    const mapping = JSON.stringify({
      "VIN": "vin",
      "Make": "make",
      "Model": "model",
      "Year": "year",
      "Purchase Price": "purchase_price",
    });

    const res = await request.post(`${BASE}/import`, {
      headers: authHeaders,
      multipart: {
        file: { name: "import.csv", mimeType: "text/csv", buffer: Buffer.from(csv) },
        mapping,
        preview: "true",
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.preview).toBeDefined();
    expect(body.valid_count).toBeGreaterThanOrEqual(1);
    // preview=true must NOT insert — verify vehicle doesn't exist
    const checkRes = await request.get(`${BASE}/CSVTEST0000000002`);
    expect(checkRes.status()).toBe(404);
  });

  test("POST duplicate VIN returns 409", async ({ request }) => {
    // Create once
    await request.post(BASE, {
      headers: authHeaders,
      data: { vin: TEST_VIN, make: "TestMake", model: "E2EModel", year: 2024 },
    });
    // Create again — same VIN
    const dupRes = await request.post(BASE, {
      headers: authHeaders,
      data: { vin: TEST_VIN, make: "TestMake", model: "E2EModel", year: 2024 },
    });
    expect(dupRes.status()).toBe(409);
  });
});
