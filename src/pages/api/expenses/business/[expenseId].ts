export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../../lib/supabase-admin";
import { getRequestUser } from "../../../../lib/request-user";
import { can } from "../../../../lib/permissions";
import { writeAudit } from "../../../../lib/audit";
import { businessExpenseUpdateSchema } from "../../../../lib/vehicles";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// ── PATCH /api/expenses/business/:expenseId ──────────────────────────────────
export const PATCH: APIRoute = async ({ params, request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "business_expenses:manage")) return json({ error: "Forbidden" }, 403);

  const expenseId = params.expenseId!;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = businessExpenseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Validation failed", errors: parsed.error.flatten().fieldErrors }, 422);
  }

  const db = getAdminClient();
  const { data, error } = await db
    .from("business_expenses")
    .update(parsed.data)
    .eq("id", expenseId)
    .select("id, category, vendor, description, amount, expense_date, tax_amount, tax_type, tax_rate, receipt_file_path, created_at, updated_at")
    .single();

  if (error || !data) {
    if (error?.code === "PGRST116") return json({ error: "Business expense not found" }, 404);
    console.error("[PATCH /api/expenses/business/:expenseId]", error);
    return json({ error: "Database error" }, 500);
  }

  await writeAudit({
    action: "business_expense_updated",
    adminEmail: user.email,
    entityRef: expenseId,
  });

  return json(data);
};

// ── DELETE /api/expenses/business/:expenseId ─────────────────────────────────
export const DELETE: APIRoute = async ({ params, request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "business_expenses:manage")) return json({ error: "Forbidden" }, 403);

  const expenseId = params.expenseId!;
  const db = getAdminClient();

  const { data: existing } = await db
    .from("business_expenses")
    .select("id")
    .eq("id", expenseId)
    .single();

  if (!existing) return json({ error: "Business expense not found" }, 404);

  const { error } = await db
    .from("business_expenses")
    .delete()
    .eq("id", expenseId);

  if (error) {
    console.error("[DELETE /api/expenses/business/:expenseId]", error);
    return json({ error: "Database error" }, 500);
  }

  await writeAudit({
    action: "business_expense_deleted",
    adminEmail: user.email,
    entityRef: expenseId,
  });

  return new Response(null, { status: 204 });
};
