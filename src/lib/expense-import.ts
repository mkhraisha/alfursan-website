import { TAX_TYPES, DEFAULT_TAX_TYPE, DEFAULT_TAX_RATE, rateForTaxType } from "./vehicles";

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
  { value: "tax_amount",   label: "Tax Amount ($)" },
  { value: "tax_type",     label: "Tax Type" },
  { value: "tax_rate",     label: "Tax Rate (%)" },
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

/**
 * Parse a currency-formatted cell (handles $, CA$, commas, negative amounts).
 * Rounds to the nearest cent — spreadsheet tax formulas often leave sub-cent
 * floating-point residue (e.g. -0.0000000000004) that displays as "$0.00"
 * but would otherwise fail a `>= 0` check on tax_amount.
 */
function parseCurrency(raw: string): number | null {
  const n = parseFloat(raw.replace(/[^0-9.-]/g, ""));
  if (isNaN(n)) return null;
  // `|| 0` normalizes -0 (e.g. from rounding a tiny negative residue) to 0.
  return Math.round(n * 100) / 100 || 0;
}

/**
 * Parse a tax rate cell into a fraction. Accepts "13%", "13", or "0.13" —
 * anything greater than 1 is assumed to be a whole-number percentage.
 */
export function parseTaxRate(raw: string): number | null {
  const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
  if (isNaN(n)) return null;
  return n > 1 ? n / 100 : n;
}

const TAX_TYPE_ALIASES: Record<string, string> = {
  hst: "HST_ON",
  gst: "GST_ONLY",
  "no tax": "NONE",
  exempt: "NONE",
};

/** Parse a free-text tax type cell into a known tax type code, matching by code, label, or common alias. */
export function parseTaxType(raw: string): string | null {
  const norm = raw.trim().toLowerCase();
  const match = TAX_TYPES.find((t) => t.code.toLowerCase() === norm || t.label.toLowerCase() === norm);
  if (match) return match.code;
  return TAX_TYPE_ALIASES[norm] ?? null;
}

/**
 * Fill in the default tax type/rate for rows where neither was mapped/provided,
 * and derive tax_rate from tax_type when only a type was given.
 */
export function applyDefaultTax(data: Record<string, unknown>): Record<string, unknown> {
  if (data.tax_type !== undefined) {
    if (data.tax_rate === undefined) {
      const rate = rateForTaxType(data.tax_type as string);
      if (rate !== undefined) return { ...data, tax_rate: rate };
    }
    return data;
  }
  if (data.tax_rate !== undefined) return data;
  return { ...data, tax_type: DEFAULT_TAX_TYPE, tax_rate: DEFAULT_TAX_RATE };
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

    if (field === "amount" || field === "tax_amount") {
      const n = parseCurrency(raw);
      if (n !== null) out[field] = n;
    } else if (field === "tax_rate") {
      const n = parseTaxRate(raw);
      if (n !== null) out[field] = n;
    } else if (field === "tax_type") {
      const t = parseTaxType(raw);
      if (t) out[field] = t;
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
