export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../../../lib/supabase-admin";
import { getRequestUser } from "../../../../../lib/request-user";
import { writeAudit } from "../../../../../lib/audit";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── DELETE /api/vehicles/:vin/expenses/:expenseId ─────────────────────────────
export const DELETE: APIRoute = async ({ params, request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const db        = getAdminClient();
  const vin       = params.vin!;
  const expenseId = params.expenseId!;

  // Confirm expense belongs to this VIN before deleting
  const { data: existing } = await db
    .from("vehicle_expenses")
    .select("id")
    .eq("id", expenseId)
    .eq("vin", vin)
    .single();

  if (!existing) return json({ error: "Expense not found" }, 404);

  const { error } = await db
    .from("vehicle_expenses")
    .delete()
    .eq("id", expenseId);

  if (error) {
    console.error("[DELETE /api/vehicles/:vin/expenses/:expenseId]", error);
    return json({ error: "Database error" }, 500);
  }

  await writeAudit({
    action:     "expense_deleted",
    adminEmail: user.email,
    entityRef:  vin,
  });

  return new Response(null, { status: 204 });
};
