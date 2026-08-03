export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../../lib/supabase-admin";
import { getRequestUser } from "../../../../lib/request-user";
import { can } from "../../../../lib/permissions";
import { getDescriptionRateLimit } from "../../../../lib/rate-limit";
import { generateVehicleDescription, type VehicleDescriptionInput } from "../../../../lib/vehicle-description";

const SPEC_COLUMNS =
  "make, model, year, trim, series, body_type, colour, odometer, drive_type, transmission, fuel_type, cylinders, doors, engine_type, features";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// ── POST /api/vehicles/:vin/generate-description ───────────────────────────────
// Generates a car-specific public description via the Gemini API. Does NOT
// write to the database — the caller (the admin edit UI) is expected to
// review the text and save it through the existing PATCH /api/vehicles/:vin
// endpoint, exactly like a hand-typed description.
export const POST: APIRoute = async ({ params, request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "vehicles:write")) return json({ error: "Forbidden" }, 403);

  try {
    const limiter = getDescriptionRateLimit();
    const { success } = await limiter.limit(user.userId);
    if (!success) return json({ error: "rate_limit" }, 429);
  } catch {
    // Upstash not configured (local dev) — allow through
    console.warn("[generate-description] Rate limiter not configured; skipping");
  }

  const apiKey = import.meta.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json({ error: "Description generation is not configured (missing GEMINI_API_KEY)" }, 500);
  }

  const db = getAdminClient();
  const vin = params.vin!;

  const { data, error } = await db
    .from("vehicles")
    .select(SPEC_COLUMNS)
    .eq("vin", vin)
    .single();

  if (error || !data) return json({ error: "Vehicle not found" }, 404);

  try {
    const description = await generateVehicleDescription(data as VehicleDescriptionInput, {
      apiKey,
      model: import.meta.env.GEMINI_MODEL || undefined,
    });
    return json({ description });
  } catch (err) {
    console.error("[POST /api/vehicles/:vin/generate-description]", err);
    return json({ error: "Failed to generate description" }, 500);
  }
};
