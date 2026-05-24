import { z } from "zod";

// VIN: 17 alphanumeric characters excluding I, O, Q (ISO 3779)
const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

export const vinSchema = z
  .string()
  .length(17, "VIN must be exactly 17 characters")
  .regex(VIN_REGEX, "VIN contains invalid characters (I, O, Q are not allowed)");

export const VALID_STATUSES = [
  "frontline_ready",
  "in_deal",
  "sold",
  "on_lot_work_needed",
  "pending_delivery",
  "pending_pickup",
  "bodyshop",
  "mechanic_ssc",
  "detailing_shop",
  "mechanic_repairs",
  "openlane_arbitration",
  "sale_cancelled_by_arbitration",
  "openlane_auction",
] as const;

export type VehicleStatus = (typeof VALID_STATUSES)[number];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

const positiveDecimal = z.number().min(0, "Must be ≥ 0");

// Base object without refinements — safe to call .partial()/.omit() on (Zod v4 restriction)
const vehicleBaseSchema = z.object({
  vin:              vinSchema,
  make:             z.string().min(1, "Make is required"),
  model:            z.string().min(1, "Model is required"),
  year:             z.number().int().min(1900).max(2100),
  trim:             z.string().optional(),
  series:           z.string().optional(),
  body_type:        z.string().optional(),
  colour:           z.string().optional(),
  odometer:         z.number().int().min(0).optional(),
  purchase_date:    isoDate.optional(),
  purchase_price:   positiveDecimal.optional(),
  purchaser_name:   z.string().optional(),
  purchaser_address: z.string().optional(),
  wholesale_price:  positiveDecimal.optional(),
  advertised_price_cargurus: positiveDecimal.optional(),
  advertised_price_facebook: positiveDecimal.optional(),
  sale_price:       positiveDecimal.nullable().optional(),
  sale_date:        isoDate.nullable().optional(),
  ownership_status: z.enum(["available", "en_route", "not_received"]).optional(),
  status:           z.enum(VALID_STATUSES).nullable().optional(),
  photography_status: z.enum(["pending", "done", "na"]).optional(),
  garage_register_number:  z.string().optional(),
  purchased_from_name:     z.string().optional(),
  purchased_from_address:  z.string().optional(),
  carfax_link:      z.string().url().optional().nullable(),
  internal_notes:   z.string().optional(),
  disclosures:      z.string().optional(),
  images_json:      z.array(z.string()).optional(),
  videos_json:      z.array(z.string()).optional(),
});

export const vehicleCreateSchema = vehicleBaseSchema.refine(
  (v) => {
    if (v.sale_date && v.purchase_date) {
      return v.sale_date >= v.purchase_date;
    }
    return true;
  },
  { message: "sale_date must be on or after purchase_date", path: ["sale_date"] }
).refine(
  (v) => {
    if (v.purchase_date) return v.purchase_date <= new Date().toISOString().slice(0, 10);
    return true;
  },
  { message: "purchase_date cannot be in the future", path: ["purchase_date"] }
).refine(
  (v) => {
    if (v.sale_date) return v.sale_date <= new Date().toISOString().slice(0, 10);
    return true;
  },
  { message: "sale_date cannot be in the future", path: ["sale_date"] }
);

// Derived from base (no refinements) so .partial()/.omit() work in Zod v4
export const vehicleUpdateSchema = vehicleBaseSchema
  .partial()
  .omit({ vin: true });

// ── Expense schemas ───────────────────────────────────────────────────────────

export const EXPENSE_CATEGORIES = ["repair", "detailing", "parts", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const expenseCreateSchema = z.object({
  category:          z.enum(EXPENSE_CATEGORIES),
  description:       z.string().min(1, "Description is required"),
  amount:            z.number().positive("Amount must be greater than 0"),
  receipt_file_path: z.string().optional(),
});

// ── Document schemas ──────────────────────────────────────────────────────────

export const documentCreateSchema = z.object({
  document_type: z.string().min(1, "Document type is required"),
  file_path:     z.string().min(1, "File path is required"),
  description:   z.string().optional(),
});

// ── Commission schema ─────────────────────────────────────────────────────────

export const commissionAssignSchema = z.object({
  commission_user_id: z.string().uuid().nullable(),
});

/** Columns returned for unauthenticated (public) requests */
export const PUBLIC_COLUMNS =
  "vin, make, model, trim, series, year, colour, odometer, advertised_price_cargurus, images_json, videos_json, carfax_link";

/**
 * Compute total cost = purchase_price + sum of expenses.
 * Returns null if purchase_price is unknown.
 */
export function calcTotalCost(
  purchasePrice: number | null,
  expenseTotal: number
): number | null {
  if (purchasePrice === null || purchasePrice === undefined) return null;
  return Number((purchasePrice + expenseTotal).toFixed(2));
}

/**
 * Compute profit/loss.
 * Uses sale_price if the car is sold, otherwise advertised_price as proxy.
 * Returns null if any required value is missing.
 */
export function calcProfitLoss(
  salePrice: number | null,
  advertisedPrice: number | null,
  totalCost: number | null
): number | null {
  if (totalCost === null) return null;
  const revenue = salePrice ?? advertisedPrice;
  if (revenue === null || revenue === undefined) return null;
  return Number((revenue - totalCost).toFixed(2));
}

/**
 * Compute commission.
 * - If profit >= 0: commission = profit × commissionPct
 * - If profit < 0: commission = $150 floor
 * - Returns null if commissionPct is not set on the user.
 */
export function calcCommission(
  profitLoss: number | null,
  commissionPct: number | null
): number | null {
  if (commissionPct === null || commissionPct === undefined) return null;
  if (profitLoss === null) return null;
  if (profitLoss < 0) return 150;
  return Number((profitLoss * commissionPct).toFixed(2));
}
