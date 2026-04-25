import { z } from "zod";

export const financingSchema = z.object({
  // ── Step 1 — Personal ──────────────────────────────────────────────────────
  fullName: z.string().min(2, "Full name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  address: z.string().min(3, "Address is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  addressSinceYear: z.string().min(1, "Required"),
  addressSinceMonth: z.string().min(1, "Required"),
  prevAddresses: z.array(z.object({
    address: z.string(),
    postalCode: z.string(),
    sinceYear: z.string(),
    sinceMonth: z.string(),
  })).optional(),
  phone: z.string().min(7, "Phone number is required"),
  email: z.string().email({ message: "Enter a valid email address" }),
  maritalStatus: z.string().min(1, "Marital status is required"),

  // ── Step 2 — Employment ────────────────────────────────────────────────────
  employmentStatus: z.string().min(1, "Employment status is required"),
  employer: z.string().optional(),
  employerAddress: z.string().optional(),
  employerPhone: z.string().optional(),
  jobTitle: z.string().optional(),
  annualIncome: z.string().optional(),
  employerSinceYear: z.string().optional(),
  employerSinceMonth: z.string().optional(),
  prevEmployers: z.array(z.object({
    employer: z.string(),
    sinceYear: z.string(),
    sinceMonth: z.string(),
  })).optional(),

  // ── Step 3 — Vehicle & Loan ────────────────────────────────────────────────
  vehicleYear: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehiclePrice: z.string().optional(),
  downPayment: z.string().optional(),
  loanTermMonths: z.string().optional(),
  vin: z.string().length(17, "VIN must be exactly 17 characters"),
  listingSlug: z.string().optional(),
  draftId: z.string().optional(),
  licenseFrontPath: z.string().optional(),
  licenseBackPath: z.string().optional(),

  // ── Step 4 — Consent ──────────────────────────────────────────────────────
  consentAccurate: z
    .boolean()
    .refine((v) => v, "You must confirm the information is accurate"),
  consentPrivacy: z
    .boolean()
    .refine((v) => v, "You must accept the Privacy Policy"),
  licenseConsent: z.boolean().refine((v) => v, "You must consent to the collection of your ID"),
});

export type FinancingFormData = z.infer<typeof financingSchema>;
