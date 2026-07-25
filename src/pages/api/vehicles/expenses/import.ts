export const prerender = false;

/**
 * POST /api/vehicles/expenses/import
 *
 * Accepts multipart/form-data:
 *   file     — CSV file (text/csv or text/plain)
 *   mapping  — JSON string: { "CSV Column Name": "expense_field", ... }
 *   preview  — optional "true" to return parsed rows without inserting
 *
 * Each row must map to an existing vehicle by VIN. Rows referencing an
 * unknown VIN are reported as errors and skipped.
 *
 * Returns:
 *   { created, failed, errors: [{ row, vin?, error }] }
 *   or { preview: [...rows], total_rows, valid_count, error_count, errors } when preview=true
 */

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../../lib/supabase-admin";
import { getRequestUser } from "../../../../lib/request-user";
import { can } from "../../../../lib/permissions";
import { expenseCreateSchema } from "../../../../lib/vehicles";
import { writeAudit } from "../../../../lib/audit";
import { parseCSV } from "../../../../lib/csv-parse";
import { applyExpenseMapping } from "../../../../lib/expense-import";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type RowError = { row: number; vin?: string; column?: string; error: string };

export const POST: APIRoute = async ({ request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "vehicles:import")) return json({ error: "Forbidden" }, 403);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: "Expected multipart/form-data" }, 400);
  }

  const file       = formData.get("file");
  const mappingRaw = formData.get("mapping");
  const isPreview  = formData.get("preview") === "true";

  if (!(file instanceof File)) return json({ error: "Missing file field" }, 400);
  if (!mappingRaw || typeof mappingRaw !== "string") return json({ error: "Missing mapping field" }, 400);

  let mapping: Record<string, string>;
  try {
    mapping = JSON.parse(mappingRaw);
  } catch {
    return json({ error: "mapping must be valid JSON" }, 400);
  }

  const mappedFields = new Set(Object.values(mapping));
  const REQUIRED = ["vin", "category", "description", "amount"];
  const missing = REQUIRED.filter((f) => !mappedFields.has(f));
  if (missing.length > 0) {
    return json({
      error: `Missing required mapping(s): ${missing.join(", ")}. VIN, Category, Description, and Amount must all be mapped.`,
    }, 422);
  }

  const csvText = await file.text();
  const rows    = parseCSV(csvText);

  if (rows.length === 0) {
    return json({ error: "CSV file is empty or has no data rows" }, 422);
  }

  const valid: Array<{ rowIndex: number; vin: string; data: Record<string, unknown> }> = [];
  const errors: RowError[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed + header row
    const mapped = applyExpenseMapping(row, mapping);
    const vin = typeof mapped.vin === "string" ? mapped.vin : "";

    if (!vin) {
      errors.push({ row: rowNum, column: "vin", error: "VIN is required" });
      return;
    }

    const { vin: _vin, ...expenseFields } = mapped;
    const parsed = expenseCreateSchema.safeParse(expenseFields);

    if (parsed.success) {
      valid.push({ rowIndex: rowNum, vin, data: parsed.data });
    } else {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstField = Object.keys(fieldErrors)[0];
      const firstMsg   = (fieldErrors[firstField as keyof typeof fieldErrors] ?? [])[0];
      errors.push({
        row: rowNum,
        vin,
        column: firstField ?? undefined,
        error: firstMsg ?? "Validation failed",
      });
    }
  });

  const db = getAdminClient();

  // Confirm every referenced VIN actually exists before inserting
  const distinctVins = Array.from(new Set(valid.map((r) => r.vin)));
  const { data: existingVehicles } = distinctVins.length > 0
    ? await db.from("vehicles").select("vin").in("vin", distinctVins)
    : { data: [] as { vin: string }[] };
  const knownVins = new Set((existingVehicles ?? []).map((v) => v.vin));

  const matched: Array<{ rowIndex: number; vin: string; data: Record<string, unknown> }> = [];
  for (const r of valid) {
    if (knownVins.has(r.vin)) {
      matched.push(r);
    } else {
      errors.push({ row: r.rowIndex, vin: r.vin, column: "vin", error: `No vehicle found with VIN ${r.vin}` });
    }
  }

  if (isPreview) {
    return json({
      preview: matched.slice(0, 10).map((r) => ({ vin: r.vin, ...r.data })),
      total_rows: rows.length,
      valid_count: matched.length,
      error_count: errors.length,
      errors: errors.slice(0, 20),
    });
  }

  if (matched.length === 0) {
    return json({ created: 0, failed: errors.length, errors });
  }

  let created = 0;
  const insertErrors: RowError[] = [...errors];

  for (const { rowIndex, vin, data } of matched) {
    const { error } = await db.from("vehicle_expenses").insert({ vin, ...data });
    if (error) {
      insertErrors.push({ row: rowIndex, vin, error: error.message });
    } else {
      created++;
    }
  }

  if (created > 0) {
    await writeAudit({
      action:     "csv_import",
      adminEmail: user.email,
      entityRef:  `${created} expenses imported`,
    });
  }

  return json({ created, failed: insertErrors.length, errors: insertErrors });
};
