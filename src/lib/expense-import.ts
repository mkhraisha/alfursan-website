export type ExpenseFieldOption = { value: string; label: string };

export const EXPENSE_IMPORT_FIELDS: ExpenseFieldOption[] = [
  { value: "",             label: "— Skip —" },
  { value: "vin",          label: "VIN" },
  { value: "category",     label: "Category" },
  { value: "description",  label: "Description" },
  { value: "amount",       label: "Amount ($)" },
  { value: "reimbursed",   label: "Reimbursed" },
  { value: "vendor",       label: "Vendor" },
  { value: "expense_date", label: "Date" },
];

const TRUTHY_REIMBURSED = new Set(["true", "yes", "y", "1", "reimbursed", "paid"]);

/** Parse a free-text CSV cell into a boolean reimbursed flag. Defaults to false. */
export function parseReimbursedFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  return TRUTHY_REIMBURSED.has(raw.trim().toLowerCase());
}

/**
 * Extract a bare VIN from a cell that may carry a trailing description,
 * e.g. "1HGCM82633A123456 (Honda Accord 2020)" -> "1HGCM82633A123456".
 */
export function extractVin(raw: string): string {
  return raw.split("(")[0].trim().toUpperCase();
}

/**
 * Parse a free-text date cell into YYYY-MM-DD.
 * Accepts M/D/YYYY (and M/D/YY) as well as already-ISO input.
 * Returns null if the value can't be parsed.
 */
export function parseExpenseDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;

  const [, m, d, y] = match;
  const year = y.length === 2 ? `20${y}` : y;
  return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

/** Apply a CSV column → expense field mapping and coerce types for insert. */
export function applyExpenseMapping(
  row: Record<string, string>,
  mapping: Record<string, string>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [csvCol, field] of Object.entries(mapping)) {
    const raw = row[csvCol];
    if (raw === undefined || raw === "") continue;

    if (field === "amount") {
      const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
      if (!isNaN(n)) out[field] = n;
    } else if (field === "category") {
      out[field] = raw.trim().toLowerCase();
    } else if (field === "reimbursed") {
      out[field] = parseReimbursedFlag(raw);
    } else if (field === "vin") {
      out[field] = extractVin(raw);
    } else if (field === "expense_date") {
      const parsed = parseExpenseDate(raw);
      if (parsed) out[field] = parsed;
    } else {
      out[field] = raw.trim();
    }
  }
  return out;
}
