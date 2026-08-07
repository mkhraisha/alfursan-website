import { test, expect } from "playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loginAsTestUser } from "./helpers/admin-auth";

/**
 * Regression coverage for a production failure: vehicles seeded before
 * engine_type/num_keys existed have those columns as NULL. Saving the
 * Basics tab in VehicleDetail.tsx always resends the tab's full field set
 * (not a diff), converting a blank engine_type/num_keys input back to
 * `null` — see `fields.engine_type = form.engine_type || null` and
 * `fields.num_keys = form.num_keys !== "" ? parseInt(form.num_keys) : null`.
 * The PATCH handler validates the whole request body as one unit
 * (vehicleUpdateSchema in src/lib/vehicles.ts), so a status update on such a
 * vehicle 422'd the entire request until engine_type/num_keys were declared
 * `.nullable()` there, not just `.optional()`.
 *
 * Seeds a dedicated vehicle directly against the local Supabase stack with
 * the service-role key (same pattern as e2e/public-sold-visibility.spec.ts),
 * with engine_type/num_keys left unset (NULL), then PATCHes it exactly the
 * way the Basics tab would.
 */
const TEST_VIN = "1HGCM82633A004354";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

test.describe("PATCH /api/vehicles/[vin] — null engine_type/num_keys", () => {
  test.skip(!SUPABASE_URL || !SERVICE_KEY || !process.env.SUPABASE_PUBLISHABLE_KEY, "Supabase env vars not set — skipping");

  let admin: ReturnType<typeof createClient>;

  test.beforeAll(async () => {
    const host = new URL(SUPABASE_URL!).hostname;
    if (!["127.0.0.1", "localhost"].includes(host)) {
      throw new Error(`Refusing to seed against non-local SUPABASE_URL: ${SUPABASE_URL}`);
    }
    admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await admin.from("vehicles").delete().eq("vin", TEST_VIN);

    const rows = [
      {
        vin: TEST_VIN,
        make: "Honda",
        model: "E2eNoEngineType",
        year: 2020,
        body_type: "sedan",
        status: "frontline_ready",
        // engine_type / num_keys intentionally omitted -> NULL, mirroring a
        // vehicle seeded before these columns existed.
      },
    ] as never[];
    const { error } = await admin.from("vehicles").insert(rows);
    if (error) throw error;
  });

  test.afterAll(async () => {
    await admin.from("vehicles").delete().eq("vin", TEST_VIN);
  });

  test("updating status succeeds when engine_type/num_keys are null", async ({ browser }) => {
    const context = await browser.newContext();
    await loginAsTestUser(context, "manager");

    const res = await context.request.patch(`/api/vehicles/${TEST_VIN}`, {
      data: {
        status: "sold",
        sale_date: new Date().toISOString().slice(0, 10),
        // Exactly what VehicleDetail.tsx's Basics-tab submit handler sends
        // for a blank engine_type/num_keys input.
        engine_type: null,
        num_keys: null,
      },
    });

    expect(res.status(), await res.text().catch(() => "")).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("sold");

    await context.close();
  });
});
