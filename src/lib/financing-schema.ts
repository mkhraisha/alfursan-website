import { z } from "zod";

const PHONE_RE = /^[\d\s\-\+\(\)\.]+$|^$/;

export const financingSchema = z.object({
  // ── Step 1 — Personal ──────────────────────────────────────────────────────
  fullName: z.string().min(2, "Full name is required"),
  dob: z.string().min(1, "Date of birth is required"),
  address: z.string().min(3, "Address is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  addressSinceYear: z.string().min(1, "Required"),
  addressSinceMonth: z.string().min(1, "Required"),
  prevAddresses: z.array(z.object({
    address: z.string().min(3, "Address required"),
    postalCode: z.string().min(1, "Postal code required"),
    sinceYear: z.string(),
    sinceMonth: z.string(),
  })).optional(),
  phone: z.string()
    .min(10, "Phone number must be at least 10 digits")
    .refine((v) => PHONE_RE.test(v), "Phone number format invalid"),
  email: z.string().email({ message: "Enter a valid email address" }),
  maritalStatus: z.string().min(1, "Marital status is required"),

  // ── Step 2 — Employment ────────────────────────────────────────────────────
  employmentStatus: z.string().min(1, "Employment status is required"),
  employer: z.string().min(1, "Employer name is required"),
  employerAddress: z.string().min(3, "Employer address is required"),
  employerPhone: z.string()
    .min(10, "Employer phone must be at least 10 digits")
    .refine((v) => PHONE_RE.test(v), "Phone number format invalid"),
  jobTitle: z.string().min(1, "Job title is required"),
  annualIncome: z.string().min(1, "Annual income is required"),
  employerSinceYear: z.string().min(1, "Required"),
  employerSinceMonth: z.string().min(1, "Required"),
  prevEmployers: z.array(z.object({
    employer: z.string().min(1, "Employer name required"),
    address: z.string().min(3, "Employer address required"),
    postalCode: z.string().min(1, "Postal code required"),
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
  licenseFrontPath: z.string().min(1, "Front license upload is required"),
  licenseBackPath: z.string().min(1, "Back license upload is required"),

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
