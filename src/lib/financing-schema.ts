import { z } from "zod";

export const financingSchema = z.object({
  // ── Step 1 — Personal ──────────────────────────────────────────────────────
  fullName: z.string().min(2, "Full name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  address: z.string().min(3, "Address is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  timeAtAddress: z.string().min(1, "Required"),
  prevAddress: z.string().optional(),
  phone: z.string().min(7, "Phone number is required"),
  email: z.string().email({ message: "Enter a valid email address" }),
  maritalStatus: z.string().optional(),

  // ── Step 2 — Employment ────────────────────────────────────────────────────
  employmentStatus: z.string().min(1, "Employment status is required"),
  employer: z.string().optional(),
  jobTitle: z.string().optional(),
  annualIncome: z.string().optional(),
  timeAtEmployer: z.string().optional(),
  prevEmployer: z.string().optional(),
  prevTimeAtEmployer: z.string().optional(),

  // ── Step 3 — Vehicle & Loan ────────────────────────────────────────────────
  vehicleYear: z.string().optional(),
  vehicleMake: z.string().optional(),
  vehicleModel: z.string().optional(),
  vehiclePrice: z.string().optional(),
  downPayment: z.string().optional(),
  loanTermMonths: z.string().optional(),
  vin: z.string().optional(),
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
  licenseConsent: z.boolean().optional(),
});

export type FinancingFormData = z.infer<typeof financingSchema>;
