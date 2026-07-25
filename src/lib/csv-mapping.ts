export type FieldOption = { value: string; label: string };

/**
 * Aliases for CSV headers that don't literally match a field's value/label
 * but should still auto-map by default (e.g. a generic "Advertised Price"
 * column defaults to the CarGurus listing price).
 */
export const AUTO_MAP_ALIASES: Record<string, string> = {
  advertised_price: "advertised_price_cargurus",
  notes: "internal_notes",
};

/**
 * Best-effort auto-mapping of CSV column headers to field values.
 * Checks alias overrides first, then falls back to exact value/label match.
 */
export function resolveAutoMapping(
  headers: string[],
  fields: FieldOption[]
): Record<string, string> {
  const auto: Record<string, string> = {};
  for (const col of headers) {
    const trimmed = col.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase().replace(/\s+/g, "_");

    if (AUTO_MAP_ALIASES[lower]) {
      auto[trimmed] = AUTO_MAP_ALIASES[lower];
      continue;
    }

    const match = fields.find(
      (f) => f.value === lower || f.label.toLowerCase() === trimmed.toLowerCase()
    );
    if (match?.value) auto[trimmed] = match.value;
  }
  return auto;
}
