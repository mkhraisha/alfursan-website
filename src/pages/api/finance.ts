export const prerender = false;

import type { APIRoute } from "astro";
import { createHash, randomUUID } from "node:crypto";
import { Resend } from "resend";
import { getAdminClient } from "../../lib/supabase-admin";
import { getFinancingRateLimit } from "../../lib/rate-limit";
import { financingSchema } from "../../lib/financing-schema";

function isAllowedOrigin(request: Request): boolean {
  const check =
    request.headers.get("origin") ?? request.headers.get("referer") ?? "";
  if (check.startsWith("http://localhost:")) return true;
  return (
    check.startsWith("https://alfursanauto.ca") ||
    check.startsWith("https://alfursan-website.vercel.app") ||
    (check.includes(".vercel.app") && !check.includes("://vercel.app"))
  );
}


function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  // ── CSRF ──────────────────────────────────────────────────────────────────
  if (!isAllowedOrigin(request)) {
    return json({ success: false, error: "Forbidden" }, 403);
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    // Fallback: unique per-request key so anonymous traffic never shares a bucket.
    // In production (Vercel), x-forwarded-for is always present.
    crypto.randomUUID();
  try {
    const limiter = getFinancingRateLimit();
    const { success } = await limiter.limit(ip);
    if (!success) {
      return json({ success: false, error: "rate_limit" }, 429);
    }
  } catch {
    // Upstash not configured (local dev) — allow through
    console.warn("[financing] Rate limiter not configured; skipping");
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, errors: { _: "Invalid request body" } }, 400);
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const result = financingSchema.safeParse(body);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (path) errors[path] = issue.message;
    }
    return json({ success: false, errors }, 422);
  }

  const d = result.data;

  // ── Insert application ────────────────────────────────────────────────────
  const ipHash = createHash("sha256").update(ip).digest("hex");
  const hasLicense = !!(d.licenseFrontPath || d.licenseBackPath);
  const phase2Token = randomUUID();
  const phase2TokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = getAdminClient();

  const { data: row, error: insertError } = await supabase
    .from("applications")
    .insert({
      full_name: d.fullName,
      dob: d.dob,
      address: d.address || null,
      postal_code: d.postalCode || null,
      time_at_address: d.addressSinceYear && d.addressSinceMonth
        ? `${d.addressSinceYear}-${String(d.addressSinceMonth).padStart(2, "0")}${
            d.addressUntilYear && d.addressUntilMonth
              ? ` – ${d.addressUntilYear}-${String(d.addressUntilMonth).padStart(2, "0")}`
              : ""
          }`
        : null,
      prev_addresses: d.prevAddresses && d.prevAddresses.length > 0 ? d.prevAddresses : null,
      phone: d.phone || null,
      email: d.email,
      marital_status: d.maritalStatus || null,
      employment_status: d.employmentStatus || null,
      employer: d.employer || null,
      employer_address: d.employerAddress || null,
      employer_phone: d.employerPhone || null,
      job_title: d.jobTitle || null,
  annual_income: d.annualIncome ? parseFloat(d.annualIncome.replace(/,/g, "")) : null,
      time_at_employer: d.employerSinceYear && d.employerSinceMonth
        ? `${d.employerSinceYear}-${String(d.employerSinceMonth).padStart(2, "0")}${
            d.employerUntilYear && d.employerUntilMonth
              ? ` – ${d.employerUntilYear}-${String(d.employerUntilMonth).padStart(2, "0")}`
              : ""
          }`
        : null,
      prev_employers: d.prevEmployers && d.prevEmployers.length > 0 ? d.prevEmployers : null,
      vehicle_year: d.vehicleYear || null,
      vehicle_make: d.vehicleMake || null,
      vehicle_model: d.vehicleModel || null,
      vehicle_price: d.vehiclePrice ? parseFloat(d.vehiclePrice.replace(/,/g, "")) : null,
      down_payment: d.downPayment ? parseFloat(d.downPayment.replace(/,/g, "")) : null,
      loan_term_months: d.loanTermMonths ? parseInt(d.loanTermMonths.replace(/,/g, "")) : null,
      vin: d.vin || null,
      listing_slug: d.listingSlug || null,
      license_front_path: null, // finalized below
      license_back_path: null,
      license_uploaded_at: hasLicense ? new Date().toISOString() : null,
      license_consent: d.licenseConsent ?? false,
      consent_timestamp: new Date().toISOString(),
      ip_hash: ipHash,
      phase2_token: phase2Token,
      phase2_token_expires_at: phase2TokenExpiresAt,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    console.error("[financing] DB insert error:", insertError);
    return json({ success: false, error: "Database error" }, 500);
  }

  const applicationId: string = row.id;

  // ── Email configuration ────────────────────────────────────────────────────
  const resendKey = import.meta.env.RESEND_API_KEY;
  const fromAddress = import.meta.env.RESEND_FROM_ADDRESS;
  const dealerEmail = import.meta.env.RESEND_DEALER_EMAIL;

  // ── Send confirmation email to applicant (non-fatal) ─────────────────────────
  if (resendKey && fromAddress && d.email) {
    try {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: fromAddress,
        to: d.email,
        subject: "Application Received — Alfursan Auto",
        text: [
          `Hi ${d.fullName},`,
          "",
          "Thank you for submitting your financing application with Alfursan Auto.",
          "",
          "We have received your application and will review it shortly. You can expect to hear from us within 1-2 business days.",
          "",
          `Your application reference number is: ${applicationId}`,
          "Please save this for your records.",
          "",
          "If you have any questions, please contact us:",
          "Email: support@alfursanauto.ca",
          "Phone: 1-888-ALFURSAN",
          "",
          "— Alfursan Auto",
        ].join("\n"),
      });
    } catch (emailErr) {
      console.error("[financing] Confirmation email error (non-fatal):", emailErr);
    }
  }

  // ── Store license paths (validated to prevent path confusion attacks) ────────
  // Paths must match the tmp/<draftId>/<side>.<ext> pattern the upload endpoint creates.
  const LICENSE_PATH_RE = /^tmp\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/(front|back)\.[a-z]+$/i;
  const licenseUpdates: Record<string, string> = {};
  if (d.draftId && d.licenseFrontPath) {
    if (LICENSE_PATH_RE.test(d.licenseFrontPath) && d.licenseFrontPath.includes(d.draftId)) {
      licenseUpdates.license_front_path = d.licenseFrontPath;
    } else {
      console.warn("[financing] Rejected suspicious licenseFrontPath");
    }
  }
  if (d.draftId && d.licenseBackPath) {
    if (LICENSE_PATH_RE.test(d.licenseBackPath) && d.licenseBackPath.includes(d.draftId)) {
      licenseUpdates.license_back_path = d.licenseBackPath;
    } else {
      console.warn("[financing] Rejected suspicious licenseBackPath");
    }
  }

  if (Object.keys(licenseUpdates).length > 0) {
    const { error: pathErr } = await supabase
      .from("applications")
      .update(licenseUpdates)
      .eq("id", applicationId);
    if (pathErr) console.error("[financing] Failed to store license paths:", pathErr);
  }

  // ── Notify dealer (non-fatal) ─────────────────────────────────────────────
  if (resendKey && dealerEmail && fromAddress) {
    try {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: fromAddress,
        to: dealerEmail,
        subject: `New Financing Application — REF-${applicationId}`,
        text: [
          "A new financing application has been submitted to Alfursan Auto.",
          "",
          `Reference:  ${applicationId}`,
          `Submitted:  ${new Date().toUTCString()}`,
          "",
          "Log in to the admin dashboard to review the application.",
          "No personal information is included in this notification.",
        ].join("\n"),
      });
    } catch (emailErr) {
      console.error("[financing] Resend error (non-fatal):", emailErr);
    }
  }

  return json({ success: true, applicationId }, 200);
};
