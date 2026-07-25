export type ExpenseFieldOption = { value: string; label: string };

export const EXPENSE_IMPORT_FIELDS: ExpenseFieldOption[] = [
  { value: "",            label: "— Skip —" },
  { value: "vin",         label: "VIN" },
  { value: "category",    label: "Category" },
  { value: "description", label: "Description" },
  { value: "amount",      label: "Amount ($)" },
  { value: "reimbursed",  label: "Reimbursed" },
];

const TRUTHY_REIMBURSED = new Set(["true", "yes", "y", "1", "reimbursed", "paid"]);

/** Parse a free-text CSV cell into a boolean reimbursed flag. Defaults to false. */
export function parseReimbursedFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  return TRUTHY_REIMBURSED.has(raw.trim().toLowerCase());
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
      out[field] = raw.trim().toUpperCase();
    } else {
      out[field] = raw;
    }
  }
  return out;
}
