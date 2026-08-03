/**
 * AI-generated vehicle description support.
 *
 * Kept separate from Astro-runtime code (no `import.meta.env` in here) so
 * this module has zero Astro dependency, mirroring src/lib/wordpress-migration.ts —
 * it can be imported directly by the standalone script in
 * scripts/clean-vehicle-descriptions.mjs as well as the admin API route.
 * Network I/O (the Gemini API call) is the one exception, since that's the
 * whole point of generateVehicleDescription(); everything else here is pure
 * and unit-testable without a network connection.
 */

import { GoogleGenAI } from "@google/genai";
import { CONTACT_INFO } from "./contact-info.ts";

// ── Fact sheet — turns a vehicle's structured fields into the model's input ────

export interface VehicleDescriptionInput {
  make: string | null;
  model: string | null;
  year: number | null;
  trim?: string | null;
  series?: string | null;
  body_type?: string | null;
  colour?: string | null;
  odometer?: number | null;
  drive_type?: string | null;
  transmission?: string | null;
  fuel_type?: string | null;
  cylinders?: number | null;
  doors?: number | null;
  engine_type?: string | null;
  features?: string[] | null;
}

/**
 * Turns a vehicle's non-null fields into a compact bullet-point fact sheet —
 * the only thing the model is told about the car. Omitting anything null/empty
 * (rather than sending "Trim: null") is what guarantees two different cars
 * produce two different prompts instead of one generic template.
 */
export function buildVehicleFactSheet(vehicle: VehicleDescriptionInput): string {
  const lines: string[] = [];
  const add = (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined) return;
    if (typeof value === "string" && value.trim() === "") return;
    lines.push(`- ${label}: ${value}`);
  };

  add("Year", vehicle.year);
  add("Make", vehicle.make);
  add("Model", vehicle.model);
  add("Trim", vehicle.trim);
  add("Series", vehicle.series);
  add("Body type", vehicle.body_type);
  add("Colour", vehicle.colour);
  add("Odometer", vehicle.odometer != null ? `${vehicle.odometer.toLocaleString("en-CA")} km` : undefined);
  add("Drive type", vehicle.drive_type);
  add("Transmission", vehicle.transmission);
  add("Fuel type", vehicle.fuel_type);
  add("Cylinders", vehicle.cylinders);
  add("Doors", vehicle.doors);
  add("Engine", vehicle.engine_type);
  if (vehicle.features && vehicle.features.length > 0) {
    add("Features", vehicle.features.join(", "));
  }

  return lines.join("\n");
}

// ── Generation ──────────────────────────────────────────────────────────────

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export const DESCRIPTION_SYSTEM_PROMPT = `You write short public listing descriptions for a used car dealership (Alfursan Auto).

Rules:
- Write 3-5 sentences of plain text. No markdown, no headings, no bullet points, no preamble like "Here's a description:" — output the description text only.
- Reference the specific year, make, and model, plus at least two other attributes you were given (trim, colour, odometer, drive type, transmission, fuel type, features, etc.) so the description is clearly about this exact car, not a generic template.
- Never state anything that isn't in the supplied facts. Do not invent condition, history, warranty, price, or certification claims.
- Do not mention dealership contact info, location, financing, safety certification pricing, OMVIC/legal disclosures, or any "our promise"/transparency statements — those are shown elsewhere on the page, not part of this text.
- Avoid generic filler ("well maintained", "must see", "great deal") unless it's tied to a fact you were given.`;

/**
 * Calls the Gemini API to write a description for one vehicle. Pure w.r.t.
 * this module's own state — apiKey/model are passed in explicitly rather than
 * read from `import.meta.env` here, so this function works identically from
 * an Astro API route and from the standalone Node cleanup script.
 */
export async function generateVehicleDescription(
  vehicle: VehicleDescriptionInput,
  opts: { apiKey: string; model?: string }
): Promise<string> {
  const factSheet = buildVehicleFactSheet(vehicle);
  const ai = new GoogleGenAI({ apiKey: opts.apiKey });

  const response = await ai.models.generateContent({
    model: opts.model ?? DEFAULT_GEMINI_MODEL,
    contents: factSheet,
    config: {
      systemInstruction: DESCRIPTION_SYSTEM_PROMPT,
      temperature: 0.8,
      maxOutputTokens: 300,
    },
  });

  const text = response.text?.trim();
  if (!text) {
    throw new Error("Gemini returned an empty description (possibly safety-filtered)");
  }
  return text;
}

// ── Duplicate detection — the literal "reads the same" signal ─────────────────

export function normalizeDescriptionForDedup(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface DuplicateDescriptionGroup {
  description: string;
  vins: string[];
}

/**
 * Groups vehicles whose description is (whitespace/case normalized)
 * byte-identical to at least one other vehicle's — the concrete signal for
 * "most of our car descriptions read the same", found without guessing at a
 * legacy-bug fingerprint the way wordpress-migration.ts's
 * isUnrefreshedLegacyDescription does. Ignores null/empty descriptions and
 * singleton (non-duplicated) ones.
 */
export function findDuplicateDescriptionGroups(
  vehicles: Array<{ vin: string; description: string | null }>
): DuplicateDescriptionGroup[] {
  const groups = new Map<string, DuplicateDescriptionGroup>();

  for (const v of vehicles) {
    if (!v.description) continue;
    const normalized = normalizeDescriptionForDedup(v.description);
    if (!normalized) continue;

    const existing = groups.get(normalized);
    if (existing) {
      existing.vins.push(v.vin);
    } else {
      groups.set(normalized, { description: v.description, vins: [v.vin] });
    }
  }

  return Array.from(groups.values()).filter((g) => g.vins.length > 1);
}

// ── Dealer boilerplate cleanup ─────────────────────────────────────────────────
//
// A one-time repair for descriptions migrated from WordPress: most end with a
// dealership-wide "Visit Us" / certification-price / "Our Promise" section,
// reworded slightly across listings but otherwise identical — the biggest
// single source of "reads the same". That content now lives once, statically,
// on the listing page template (src/pages/listing/[vin].astro), sourced from
// CONTACT_INFO/ALFURSAN_PROMISE — so it should be removed from `description`.
//
// Some descriptions interleave a *mandatory OMVIC disclosure* ("this vehicle
// is being sold as unfit...") with that same trailing section. That sentence
// is per-vehicle legal content, not generic marketing copy, and must never be
// silently dropped — so stripping works paragraph-by-paragraph rather than
// truncating at the first boilerplate marker, and any paragraph mentioning
// OMVIC/"sold as unfit" is always preserved untouched, even if it also
// mentions certification pricing.

const BOILERPLATE_PARAGRAPH_PATTERNS: RegExp[] = [
  /visit us at alfursan auto/i,
  /the alfursan promise/i,
  /\bour promise\b/i,
  /at alfursan auto,?\s+we\s+(?:are|believe)/i,
  /financing available with flexible options/i,
  /certification\s+(?:is\s+)?available for \$800/i,
  /certification and pricing/i,
  /light wear consistent with age and mileage/i,
];

/** True if `text` contains the mandatory OMVIC "sold as unfit" disclosure — per-vehicle legal content that must never be stripped. */
export function containsMandatoryDisclosure(text: string): boolean {
  return /\bomvic\b/i.test(text) || /\bsold as unfit\b/i.test(text);
}

function paragraphMentionsDealerContact(paragraph: string): boolean {
  if (paragraph.includes(CONTACT_INFO.address)) return true;
  const dealerDigits = CONTACT_INFO.phone.replace(/\D/g, "").slice(-10);
  const paragraphDigits = paragraph.replace(/\D/g, "");
  return dealerDigits.length === 10 && paragraphDigits.includes(dealerDigits);
}

function isGenericBoilerplateParagraph(paragraph: string): boolean {
  if (containsMandatoryDisclosure(paragraph)) return false;
  if (paragraphMentionsDealerContact(paragraph)) return true;
  return BOILERPLATE_PARAGRAPH_PATTERNS.some((re) => re.test(paragraph));
}

/**
 * Removes only the paragraphs that are the recurring dealership-wide "Visit
 * Us" / certification-price / "Our Promise" section, leaving every other
 * paragraph — including car-specific content and any OMVIC disclosure —
 * exactly as-is. Also drops a trailing dangling "Carfax:" label left over
 * from the WordPress migration's HTML flattening, if that's the last
 * remaining paragraph.
 */
export function stripDealerBoilerplate(text: string): string {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  let kept = paragraphs.filter((p) => !isGenericBoilerplateParagraph(p));

  while (kept.length > 0 && /^carfax:?$/i.test(kept[kept.length - 1])) {
    kept = kept.slice(0, -1);
  }

  return kept.join("\n\n").trim();
}
