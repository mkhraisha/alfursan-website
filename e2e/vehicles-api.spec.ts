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

// Role-specific tokens for RBAC tests.
// To run: set up Supabase users with the relevant roles, then:
//   E2E_MANAGER_TOKEN=<jwt>  E2E_SALES_TOKEN=<jwt>  npx playwright test
const MANAGER_TOKEN = process.env.E2E_MANAGER_TOKEN;
const SALES_TOKEN   = process.env.E2E_SALES_TOKEN;

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
    // The API uses offset+limit, not page+limit
    const res = await request.get(`${BASE}?offset=0&limit=5`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
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
        body_type: "sedan",
        purchase_price: 15000,
        advertised_price_cargurus: 18000,
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
    // body_type is required — must be included in the CSV and mapped
    const csv = [
      "VIN,Make,Model,Year,Purchase Price,Body Type",
      "CSVTEST0000000002,Toyota,Camry,2023,22000,sedan",
    ].join("\n");

    const mapping = JSON.stringify({
      "VIN":            "vin",
      "Make":           "make",
      "Model":          "model",
      "Year":           "year",
      "Purchase Price": "purchase_price",
      "Body Type":      "body_type",
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
      data: { vin: TEST_VIN, make: "TestMake", model: "E2EModel", year: 2024, body_type: "sedan" },
    });
    // Create again — same VIN
    const dupRes = await request.post(BASE, {
      headers: authHeaders,
      data: { vin: TEST_VIN, make: "TestMake", model: "E2EModel", year: 2024, body_type: "sedan" },
    });
    expect(dupRes.status()).toBe(409);
  });
});

// ── RBAC e2e tests ────────────────────────────────────────────────────────────
//
// These require real Supabase JWTs for users with specific roles.
// Skip automatically when the env vars are absent.
//
// Setup:
//   1. Create a "manager" user in Supabase Auth + user_profiles (role=manager).
//   2. Create a "sales" user in Supabase Auth + user_profiles (role=sales).
//   3. Sign in as each and export their access tokens as:
//      E2E_MANAGER_TOKEN=<jwt>  E2E_SALES_TOKEN=<jwt>

test.describe("RBAC — sales role restrictions", () => {
  test.skip(!SALES_TOKEN || !MANAGER_TOKEN,
    "E2E_SALES_TOKEN and E2E_MANAGER_TOKEN not set — skipping RBAC e2e tests");

  const managerAuth = () => ({ Authorization: `Bearer ${MANAGER_TOKEN}` });
  const salesAuth   = () => ({ Authorization: `Bearer ${SALES_TOKEN}` });
  const RBAC_VIN    = "RBACE2ETEST000001";

  test.beforeAll(async () => {
    // Create a vehicle as manager so sales tests have something to work with
    const ctx = await newRequest.newContext({ baseURL: BASE_URL });
    await ctx.post(BASE, {
      headers: managerAuth(),
      data: { vin: RBAC_VIN, make: "RbacMake", model: "RbacModel", year: 2024, body_type: "sedan",
              purchase_price: 10000, advertised_price_cargurus: 14000 },
    });
    await ctx.dispose();
  });

  test.afterAll(async () => {
    const ctx = await newRequest.newContext({ baseURL: BASE_URL });
    await ctx.delete(`${BASE}/${RBAC_VIN}`, { headers: managerAuth() });
    await ctx.dispose();
  });

  test("sales role cannot create a vehicle (403)", async ({ request }) => {
    const res = await request.post(BASE, {
      headers: salesAuth(),
      data: { vin: "RBACBLOCKED000002", make: "X", model: "Y", year: 2024, body_type: "sedan" },
    });
    expect(res.status()).toBe(403);
  });

  test("sales role can read vehicles but profit_loss and total_cost are absent", async ({ request }) => {
    const res = await request.get(BASE, { headers: salesAuth() });
    expect(res.status()).toBe(200);
    const { data } = await res.json();
    if (data.length > 0) {
      expect(data[0]).not.toHaveProperty("profit_loss");
      expect(data[0]).not.toHaveProperty("total_cost");
      expect(data[0]).toHaveProperty("expense_total"); // still visible
    }
  });

  test("sales role cannot set sale_date on a vehicle (403)", async ({ request }) => {
    const res = await request.patch(`${BASE}/${RBAC_VIN}`, {
      headers: salesAuth(),
      data: { sale_date: "2026-01-01" },
    });
    expect(res.status()).toBe(403);
  });

  test("sales role cannot change status to sold (403)", async ({ request }) => {
    const res = await request.patch(`${BASE}/${RBAC_VIN}`, {
      headers: salesAuth(),
      data: { status: "sold" },
    });
    expect(res.status()).toBe(403);
  });

  test("sales role can update non-restricted fields (colour, odometer)", async ({ request }) => {
    const res = await request.patch(`${BASE}/${RBAC_VIN}`, {
      headers: salesAuth(),
      data: { colour: "Red", odometer: 42000 },
    });
    expect(res.status()).toBe(200);
  });

  test("sales role cannot get a signed upload URL for vehicle images (403)", async ({ request }) => {
    const res = await request.post(`${BASE}/upload-url`, {
      headers: salesAuth(),
      data: { context: "vehicle-image", vin: RBAC_VIN, contentType: "image/jpeg", fileSize: 1000 },
    });
    expect(res.status()).toBe(403);
  });

  test("manager can create and delete a vehicle", async ({ request }) => {
    const TEMP_VIN = "RBACMGR0000000003";
    const createRes = await request.post(BASE, {
      headers: managerAuth(),
      data: { vin: TEMP_VIN, make: "MgrMake", model: "MgrModel", year: 2024, body_type: "van" },
    });
    expect(createRes.status()).toBe(201);

    const deleteRes = await request.delete(`${BASE}/${TEMP_VIN}`, { headers: managerAuth() });
    expect(deleteRes.status()).toBe(204);
  });

  test("manager GET response includes profit_loss and total_cost", async ({ request }) => {
    const res = await request.get(`${BASE}/${RBAC_VIN}`, { headers: managerAuth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("total_cost");
    expect(body).toHaveProperty("profit_loss");
  });
});
