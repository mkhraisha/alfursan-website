export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../../lib/supabase-admin";
import { getRequestUser } from "../../../../lib/request-user";
import { can } from "../../../../lib/permissions";
import { businessExpenseCreateSchema } from "../../../../lib/vehicles";
import { writeAudit } from "../../../../lib/audit";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// ── GET /api/expenses/business ───────────────────────────────────────────────
export const GET: APIRoute = async ({ request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "business_expenses:manage")) return json({ error: "Forbidden" }, 403);

  const db = getAdminClient();
  const { data, error } = await db
    .from("business_expenses")
    .select("id, category, vendor, description, amount, expense_date, tax_amount, tax_type, tax_rate, receipt_file_path, created_at, updated_at")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/expenses/business]", error);
    return json({ error: "Database error" }, 500);
  }

  return json(data ?? []);
};

// ── POST /api/expenses/business ──────────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "business_expenses:manage")) return json({ error: "Forbidden" }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = businessExpenseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Validation failed", errors: parsed.error.flatten().fieldErrors }, 422);
  }

  const db = getAdminClient();
  const { data, error } = await db
    .from("business_expenses")
    .insert(parsed.data)
    .select("id, category, vendor, description, amount, expense_date, tax_amount, tax_type, tax_rate, receipt_file_path, created_at, updated_at")
    .single();

  if (error || !data) {
    console.error("[POST /api/expenses/business]", error);
    return json({ error: "Database error" }, 500);
  }

  await writeAudit({
    action: "business_expense_created",
    adminEmail: user.email,
    entityRef: data.id,
  });

  return json(data, 201);
};
