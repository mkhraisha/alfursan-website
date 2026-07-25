export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../../lib/supabase-admin";
import { getRequestUser } from "../../../../lib/request-user";
import { writeAudit } from "../../../../lib/audit";
import { expenseUpdateSchema } from "../../../../lib/vehicles";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// ── PATCH /api/vehicles/expenses/:expenseId ───────────────────────────────────
// Vin-agnostic — works for both vehicle-linked and general (no-VIN) expenses.
export const PATCH: APIRoute = async ({ params, request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = expenseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Validation failed", errors: parsed.error.flatten().fieldErrors }, 422);
  }

  const db        = getAdminClient();
  const expenseId = params.expenseId!;

  const { data, error } = await db
    .from("vehicle_expenses")
    .update(parsed.data)
    .eq("id", expenseId)
    .select("id, vin, category, description, amount, receipt_file_path, reimbursed, vendor, expense_date, created_at")
    .single();

  if (error || !data) {
    if (error?.code === "PGRST116") return json({ error: "Expense not found" }, 404);
    console.error("[PATCH /api/vehicles/expenses/:expenseId]", error);
    return json({ error: "Database error" }, 500);
  }

  await writeAudit({
    action:     "expense_updated",
    adminEmail: user.email,
    entityRef:  data.vin ?? "general",
  });

  return json(data);
};
