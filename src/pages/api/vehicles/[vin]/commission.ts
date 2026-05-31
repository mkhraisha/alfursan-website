export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../../lib/supabase-admin";
import { getRequestUser } from "../../../../lib/request-user";
import { can } from "../../../../lib/permissions";
import {
  commissionAssignSchema,
  calcTotalCost,
  calcProfitLoss,
  calcCommission,
} from "../../../../lib/vehicles";
import { writeAudit } from "../../../../lib/audit";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── PATCH /api/vehicles/:vin/commission ───────────────────────────────────────
export const PATCH: APIRoute = async ({ params, request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "commission:assign")) return json({ error: "Forbidden" }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = commissionAssignSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Validation failed", errors: parsed.error.flatten().fieldErrors }, 422);
  }

  const db  = getAdminClient();
  const vin = params.vin!;
  const { commission_user_id } = parsed.data;

  // If assigning a user, validate they exist and are active
  if (commission_user_id !== null) {
    const { data: profile } = await db
      .from("user_profiles")
      .select("id, is_active, commission_percentage")
      .eq("id", commission_user_id)
      .single();

    if (!profile) return json({ error: "User not found" }, 422);
    if (!profile.is_active) return json({ error: "User is disabled" }, 422);
  }

  // Update the vehicle
  const { data: vehicle, error: updateError } = await db
    .from("vehicles")
    .update({ commission_user_id })
    .eq("vin", vin)
    .select("vin, purchase_price, sale_price")
    .single();

  if (updateError) {
    if (updateError.code === "PGRST116") return json({ error: "Vehicle not found" }, 404);
    console.error("[PATCH /api/vehicles/:vin/commission]", updateError);
    return json({ error: "Database error" }, 500);
  }

  // Fetch commission user's percentage
  let commissionPct: number | null = null;
  if (commission_user_id !== null) {
    const { data: profile } = await db
      .from("user_profiles")
      .select("commission_percentage")
      .eq("id", commission_user_id)
      .single();
    commissionPct = profile?.commission_percentage ?? null;
  }

  // Compute totals for the response
  const { data: expenses } = await db
    .from("vehicle_expenses")
    .select("amount")
    .eq("vin", vin);

  const expenseTotal  = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const totalCost     = calcTotalCost(vehicle.purchase_price as number | null, expenseTotal);
  const profitLoss    = calcProfitLoss(vehicle.sale_price as number | null, totalCost);
  const commission    = calcCommission(profitLoss, commissionPct);

  await writeAudit({
    action:     "commission_assigned",
    adminEmail: user.email,
    entityRef:  vin,
  });

  return json({
    vin,
    commission_user_id,
    commission_percentage: commissionPct,
    ...(can(user.role, "vehicles:financials:read")
      ? { total_cost: totalCost, profit_loss: profitLoss }
      : {}),
    commission,
  });
};
