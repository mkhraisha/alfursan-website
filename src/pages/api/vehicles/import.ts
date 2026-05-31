export const prerender = false;

/**
 * POST /api/vehicles/import
 *
 * Accepts multipart/form-data:
 *   file     — CSV file (text/csv or text/plain)
 *   mapping  — JSON string: { "CSV Column Name": "vehicle_field", ... }
 *   preview  — optional "true" to return parsed rows without inserting
 *
 * Returns:
 *   { created, failed, errors: [{ row, vin?, error }] }
 *   or { preview: [...rows] } when preview=true
 */

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../lib/supabase-admin";
import { getRequestUser } from "../../../lib/request-user";
import { can } from "../../../lib/permissions";
import { vehicleCreateSchema } from "../../../lib/vehicles";
import { writeAudit } from "../../../lib/audit";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Parse a CSV string into rows of { [header]: value } objects */
function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCSVRow(lines[0]);
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCSVRow(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }
  return rows;
}

/** Split a single CSV row respecting double-quoted fields */
function splitCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

const PRICE_FIELDS = new Set([
  "purchase_price", "wholesale_price", "sale_price",
  "advertised_price_cargurus", "advertised_price_facebook",
]);

/**
 * Normalize a raw CSV string to snake_case for enum validation.
 * "Frontline Ready" → "frontline_ready", "SOLD" → "sold", etc.
 */
function normalizeEnum(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s\-]+/g, "_");
}

/**
 * Normalize ownership_status.
 * Handles "En Route from OpenLane", "en-route", "En Route" → "en_route".
 */
function normalizeOwnershipStatus(raw: string): string {
  const norm = normalizeEnum(raw);
  if (norm.startsWith("en_route") || norm.startsWith("en route")) return "en_route";
  return norm;
}

/** Apply column mapping and coerce types for Supabase insert */
function applyMapping(
  row: Record<string, string>,
  mapping: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [csvCol, vehicleField] of Object.entries(mapping)) {
    const raw = row[csvCol];
    if (raw === undefined || raw === "") continue;

    if (["year", "odometer"].includes(vehicleField)) {
      // Strip everything except digits (handles commas like 123,456)
      const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(n)) out[vehicleField] = n;
    } else if (PRICE_FIELDS.has(vehicleField)) {
      // Strip currency symbols, locale prefixes, and thousands separators
      // Handles: CA$1,234.56 / $1,234.56 / 1,234.56 / 1234.56
      const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
      if (!isNaN(n)) out[vehicleField] = n;
    } else if (vehicleField === "ownership_status") {
      out[vehicleField] = normalizeOwnershipStatus(raw);
    } else if (vehicleField === "status" || vehicleField === "photography_status") {
      out[vehicleField] = normalizeEnum(raw);
    } else if (vehicleField === "body_type") {
      out[vehicleField] = raw.trim().toLowerCase();
    } else if (vehicleField === "num_keys") {
      const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(n)) out[vehicleField] = n;
    } else {
      out[vehicleField] = raw;
    }
  }
  return out;
}

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

  const file    = formData.get("file");
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

  // body_type is required by vehicleCreateSchema — fail early if it is not mapped
  // rather than silently failing every single row with a cryptic validation error.
  const mappedFields = new Set(Object.values(mapping));
  if (!mappedFields.has("body_type")) {
    return json({
      error: "body_type is required but not mapped. Map a CSV column to 'Body Type' (accepted values: sedan, van, coupe, convertible).",
    }, 422);
  }

  const csvText = await file.text();
  const rows    = parseCSV(csvText);

  if (rows.length === 0) {
    return json({ error: "CSV file is empty or has no data rows" }, 422);
  }

  // Apply mapping + validate each row
  type RowError = { row: number; vin?: string; column?: string; error: string };
  const valid: Array<{ rowIndex: number; data: Record<string, unknown> }> = [];
  const errors: RowError[] = [];

  rows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed + header row
    const mapped = applyMapping(row, mapping);
    const parsed = vehicleCreateSchema.safeParse(mapped);

    if (parsed.success) {
      valid.push({ rowIndex: rowNum, data: parsed.data });
    } else {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const firstField = Object.keys(fieldErrors)[0];
      const firstMsg   = (fieldErrors[firstField as keyof typeof fieldErrors] ?? [])[0];
      errors.push({
        row:    rowNum,
        vin:    typeof mapped.vin === "string" ? mapped.vin : undefined,
        column: firstField ?? undefined,
        error:  firstMsg ?? "Validation failed",
      });
    }
  });

  // Preview mode — return parsed rows without inserting
  if (isPreview) {
    return json({
      preview: valid.slice(0, 10).map((r) => r.data),
      total_rows: rows.length,
      valid_count: valid.length,
      error_count: errors.length,
      errors: errors.slice(0, 20),
    });
  }

  if (valid.length === 0) {
    return json({ created: 0, failed: errors.length, errors });
  }

  const db = getAdminClient();
  let created = 0;
  const insertErrors: RowError[] = [...errors];

  // Insert row-by-row — skip duplicates, collect errors per row
  for (const { rowIndex, data } of valid) {
    const { error } = await db.from("vehicles").insert(data);
    if (error) {
      const isDuplicate = error.code === "23505";
      insertErrors.push({
        row: rowIndex,
        vin: typeof data.vin === "string" ? data.vin : undefined,
        error: isDuplicate ? "Duplicate VIN" : error.message,
      });
    } else {
      created++;
    }
  }

  if (created > 0) {
    await writeAudit({
      action:     "csv_import",
      adminEmail: user.email,
      entityRef:  `${created} vehicles imported`,
    });
  }

  return json({ created, failed: insertErrors.length, errors: insertErrors });
};
