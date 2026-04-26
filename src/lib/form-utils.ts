// ── Shared types ──────────────────────────────────────────────────────────────

export type PrevAddress = {
  address: string;
  postalCode: string;
  sinceYear: string;
  sinceMonth: string;
  untilYear?: string;
  untilMonth?: string;
};

export type PrevEmployer = {
  employer: string;
  address: string;
  postalCode: string;
  sinceYear: string;
  sinceMonth: string;
  untilYear?: string;
  untilMonth?: string;
};

export type FormData = {
  // Step 1
  fullName: string;
  dob: string;
  address: string;
  postalCode: string;
  addressSinceYear: string;
  addressSinceMonth: string;
  prevAddresses: PrevAddress[];
  phone: string;
  email: string;
  maritalStatus: string;
  // Step 2
  employmentStatus: string;
  employer: string;
  employerAddress: string;
  employerPhone: string;
  jobTitle: string;
  annualIncome: string;
  employerSinceYear: string;
  employerSinceMonth: string;
  prevEmployers: PrevEmployer[];
  // Step 3
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehiclePrice: string;
  downPayment: string;
  loanTermMonths: string;
  vin: string;
  listingSlug: string;
  draftId: string;
  licenseFrontPath: string;
  licenseBackPath: string;
  // Step 4
  consentAccurate: boolean;
  consentPrivacy: boolean;
  licenseConsent: boolean;
};

export type Errors = Record<string, string>;

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Strips thousand-separator commas before numeric parsing. */
export const stripCommas = (v: string): string => v.replace(/,/g, "");

/**
 * Returns how many months ago the given year+month was relative to today.
 * Returns Infinity if year or month are missing/invalid.
 */
export function monthsSince(year: string, month: string): number {
  const y = parseInt(year);
  const m = parseInt(month); // 1-based
  if (!y || !m) return Infinity;
  const now = new Date();
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
}

const POSTAL_CODE_RE = /^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s\-\+\(\)\.]+$/;

// ── Step validator ────────────────────────────────────────────────────────────

export function validateStep(step: number, data: FormData): Errors {
  const e: Errors = {};

  if (step === 1) {
    if (!data.fullName.trim()) e.fullName = "Full name is required";
    if (!data.dob) e.dob = "Date of birth is required";
    if (!data.address.trim()) e.address = "Address is required";
    if (!data.postalCode.trim()) e.postalCode = "Postal code is required";
    else if (!POSTAL_CODE_RE.test(data.postalCode))
      e.postalCode = "Enter a valid Canadian postal code (e.g. M5V 3A8)";
    if (!data.addressSinceMonth || !data.addressSinceYear)
      e.addressSinceYear = "Required";
    else if (monthsSince(data.addressSinceYear, data.addressSinceMonth) < 0)
      e.addressSinceYear = "Date cannot be in the future";
    else if (monthsSince(data.addressSinceYear, data.addressSinceMonth) < 24) {
      data.prevAddresses.forEach((entry, i) => {
        if (!entry.address.trim())
          e[`prevAddresses_${i}_address`] = "Address is required";
        if (!entry.postalCode.trim())
          e[`prevAddresses_${i}_postalCode`] = "Postal code is required";
        else if (!POSTAL_CODE_RE.test(entry.postalCode))
          e[`prevAddresses_${i}_postalCode`] = "Enter a valid Canadian postal code";
        if (!entry.sinceYear || !entry.sinceMonth)
          e[`prevAddresses_${i}_since`] = "Required";
        else if (monthsSince(entry.sinceYear, entry.sinceMonth) < 0)
          e[`prevAddresses_${i}_since`] = "Date cannot be in the future";
      });
      if (data.prevAddresses.length === 0) {
        e.prevAddresses = "Please add at least one previous address";
      } else {
        const last = data.prevAddresses[data.prevAddresses.length - 1];
        if (
          last.sinceYear &&
          last.sinceMonth &&
          monthsSince(last.sinceYear, last.sinceMonth) < 24
        ) {
          e.prevAddresses =
            "Please add more address history to cover at least 2 years total";
        }
      }
    }
    if (!data.maritalStatus) e.maritalStatus = "Marital status is required";
    if (!data.phone.trim()) e.phone = "Phone number is required";
    else if (data.phone.trim().replace(/\D/g, "").length < 10)
      e.phone = "Phone number must be at least 10 digits";
    else if (!PHONE_RE.test(data.phone))
      e.phone = "Phone must contain only digits, spaces, hyphens, parentheses, and plus signs";
    if (!data.email.trim()) e.email = "Email is required";
    else if (!EMAIL_RE.test(data.email))
      e.email = "Enter a valid email address";
  }

  if (step === 2) {
    if (!data.employmentStatus) e.employmentStatus = "Required";
    const isEmployed = ["full-time", "part-time", "self-employed"].includes(
      data.employmentStatus
    );
    if (isEmployed) {
      if (!data.employer.trim()) e.employer = "Employer name is required";
      if (!data.employerAddress.trim()) e.employerAddress = "Employer address is required";
      if (!data.employerPhone.trim()) e.employerPhone = "Employer phone is required";
      else if (data.employerPhone.trim().replace(/\D/g, "").length < 10)
        e.employerPhone = "Phone must be at least 10 digits";
      else if (!PHONE_RE.test(data.employerPhone))
        e.employerPhone = "Phone must contain only digits, spaces, hyphens, parentheses, and plus signs";
      if (!data.jobTitle.trim()) e.jobTitle = "Job title is required";
      if (!data.annualIncome.trim()) e.annualIncome = "Annual income is required";
      if (!data.employerSinceYear || !data.employerSinceMonth)
        e.employerSinceYear = "Required";
      else if (monthsSince(data.employerSinceYear, data.employerSinceMonth) < 0)
        e.employerSinceYear = "Date cannot be in the future";
      else if (
        monthsSince(data.employerSinceYear, data.employerSinceMonth) < 24
      ) {
        data.prevEmployers.forEach((entry, i) => {
          if (!entry.employer.trim())
            e[`prevEmployers_${i}_employer`] = "Employer name is required";
          if (!entry.address.trim())
            e[`prevEmployers_${i}_address`] = "Address is required";
          if (!entry.postalCode.trim())
            e[`prevEmployers_${i}_postalCode`] = "Postal code is required";
          else if (!POSTAL_CODE_RE.test(entry.postalCode))
            e[`prevEmployers_${i}_postalCode`] = "Enter a valid Canadian postal code";
          if (!entry.sinceYear || !entry.sinceMonth)
            e[`prevEmployers_${i}_since`] = "Required";
          else if (monthsSince(entry.sinceYear, entry.sinceMonth) < 0)
            e[`prevEmployers_${i}_since`] = "Date cannot be in the future";
        });
        if (data.prevEmployers.length === 0) {
          e.prevEmployers = "Please add at least one previous employer";
        } else {
          const last = data.prevEmployers[data.prevEmployers.length - 1];
          if (
            last.sinceYear &&
            last.sinceMonth &&
            monthsSince(last.sinceYear, last.sinceMonth) < 24
          ) {
            e.prevEmployers =
              "Please add more employment history to cover at least 2 years total";
          }
        }
      }
    }
  }

  if (step === 3) {
    if (!data.vin.trim()) e.vin = "VIN is required";
    else if (data.vin.trim().length !== 17)
      e.vin = "VIN must be exactly 17 characters";
    if (!data.licenseFrontPath) e.licenseFrontPath = "Front license upload is required";
    if (!data.licenseBackPath) e.licenseBackPath = "Back license upload is required";
  }

  if (step === 4) {
    if (!data.consentAccurate)
      e.consentAccurate = "You must confirm the information is accurate";
    if (!data.consentPrivacy)
      e.consentPrivacy = "You must accept the Privacy Policy";
    if (!data.licenseConsent)
      e.licenseConsent = "You must consent to the collection of your ID";
  }

  return e;
}
