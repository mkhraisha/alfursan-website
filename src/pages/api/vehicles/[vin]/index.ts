export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../../lib/supabase-admin";
import { getRequestUser } from "../../../../lib/request-user";
import { can } from "../../../../lib/permissions";
import {
  vehicleUpdateSchema,
  PUBLIC_COLUMNS,
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

async function enrichVehicle(db: ReturnType<typeof getAdminClient>, vehicle: Record<string, unknown>) {
  const { data: expenses } = await db
    .from("vehicle_expenses")
    .select("amount")
    .eq("vin", vehicle.vin as string);

  const expenseTotal = (expenses ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
  const totalCost    = calcTotalCost(vehicle.purchase_price as number | null, expenseTotal);
  const profitLoss   = calcProfitLoss(vehicle.sale_price as number | null, vehicle.advertised_price as number | null, totalCost);
  const commissionPct = (vehicle.commission_user as { commission_percentage?: number } | null)?.commission_percentage ?? null;
  const commission   = calcCommission(profitLoss, commissionPct);

  return {
    ...vehicle,
    commission_user: undefined,
    expense_total: expenseTotal,
    total_cost:    totalCost,
    profit_loss:   profitLoss,
    commission,
  };
}

// ── GET /api/vehicles/:vin ─────────────────────────────────────────────────────
export const GET: APIRoute = async ({ params, request }) => {
  const user = await getRequestUser(request);
  const db   = getAdminClient();
  const vin  = params.vin!;

  const { data, error } = await db
    .from("vehicles")
    .select(
      user
        ? "*, commission_user:user_profiles!commission_user_id(commission_percentage)"
        : PUBLIC_COLUMNS
    )
    .eq("vin", vin)
    .single();

  if (error || !data) return json({ error: "Vehicle not found" }, 404);

  if (!user) return json(data);

  return json(await enrichVehicle(db, data as Record<string, unknown>));
};

// ── PATCH /api/vehicles/:vin ───────────────────────────────────────────────────
export const PATCH: APIRoute = async ({ params, request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "vehicles:write")) return json({ error: "Forbidden" }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = vehicleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Validation failed", errors: parsed.error.flatten().fieldErrors }, 422);
  }

  const db  = getAdminClient();
  const vin = params.vin!;

  const { data, error } = await db
    .from("vehicles")
    .update(parsed.data)
    .eq("vin", vin)
    .select("*, commission_user:user_profiles!commission_user_id(commission_percentage)")
    .single();

  if (error) {
    if (error.code === "PGRST116") return json({ error: "Vehicle not found" }, 404);
    if (error.code === "23514") return json({ error: "Invalid field value" }, 422);
    console.error("[PATCH /api/vehicles/:vin]", error);
    return json({ error: "Database error" }, 500);
  }

  await writeAudit({
    action:     "vehicle_updated",
    adminEmail: user.email,
    entityRef:  vin,
  });

  return json(await enrichVehicle(db, data as Record<string, unknown>));
};

// ── DELETE /api/vehicles/:vin ─────────────────────────────────────────────────
export const DELETE: APIRoute = async ({ params, request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "vehicles:delete")) return json({ error: "Forbidden" }, 403);

  const db  = getAdminClient();
  const vin = params.vin!;

  // Cascade handled by FK ON DELETE CASCADE on expenses + documents
  const { error } = await db.from("vehicles").delete().eq("vin", vin);

  if (error) {
    if (error.code === "PGRST116") return json({ error: "Vehicle not found" }, 404);
    console.error("[DELETE /api/vehicles/:vin]", error);
    return json({ error: "Database error" }, 500);
  }

  await writeAudit({
    action:     "vehicle_deleted",
    adminEmail: user.email,
    entityRef:  vin,
  });

  return new Response(null, { status: 204 });
};
