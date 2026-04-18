export const prerender = false;

import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
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

function extOf(path: string): string {
  const m = path.match(/\.[^.]+$/);
  return m ? m[0] : "";
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
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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
  const supabase = getAdminClient();

  const { data: row, error: insertError } = await supabase
    .from("applications")
    .insert({
      full_name: d.fullName,
      dob: d.dob,
      address: d.address || null,
      postal_code: d.postalCode || null,
      time_at_address: d.timeAtAddress || null,
      prev_address: d.prevAddress || null,
      phone: d.phone || null,
      email: d.email,
      marital_status: d.maritalStatus || null,
      employment_status: d.employmentStatus || null,
      employer: d.employer || null,
      job_title: d.jobTitle || null,
      annual_income: d.annualIncome ? parseFloat(d.annualIncome) : null,
      time_at_employer: d.timeAtEmployer || null,
      prev_employer: d.prevEmployer || null,
      prev_time_at_employer: d.prevTimeAtEmployer || null,
      vehicle_year: d.vehicleYear || null,
      vehicle_make: d.vehicleMake || null,
      vehicle_model: d.vehicleModel || null,
      vehicle_price: d.vehiclePrice ? parseFloat(d.vehiclePrice) : null,
      down_payment: d.downPayment ? parseFloat(d.downPayment) : null,
      loan_term_months: d.loanTermMonths ? parseInt(d.loanTermMonths) : null,
      vin: d.vin || null,
      listing_slug: d.listingSlug || null,
      license_front_path: null, // finalized below
      license_back_path: null,
      license_uploaded_at: hasLicense ? new Date().toISOString() : null,
      license_consent: d.licenseConsent ?? false,
      consent_timestamp: new Date().toISOString(),
      ip_hash: ipHash,
    })
    .select("id")
    .single();

  if (insertError || !row) {
    console.error("[financing] DB insert error:", insertError);
    return json({ success: false, error: "Database error" }, 500);
  }

  const applicationId: string = row.id;

  // ── Finalize license uploads (move from tmp/ to applications/{id}/) ───────
  const moveFile = async (srcPath: string, side: "front" | "back") => {
    const destPath = `applications/${applicationId}/${side}${extOf(srcPath)}`;
    const { error } = await supabase.storage
      .from("license-documents")
      .move(srcPath, destPath);
    if (!error) {
      const col =
        side === "front" ? "license_front_path" : "license_back_path";
      await supabase
        .from("applications")
        .update({ [col]: destPath })
        .eq("id", applicationId);
    } else {
      console.error(`[financing] Failed to move ${side} license:`, error);
    }
  };

  if (d.draftId && d.licenseFrontPath)
    await moveFile(d.licenseFrontPath, "front");
  if (d.draftId && d.licenseBackPath) await moveFile(d.licenseBackPath, "back");

  // ── Notify dealer (non-fatal) ─────────────────────────────────────────────
  const resendKey = import.meta.env.RESEND_API_KEY;
  const dealerEmail = import.meta.env.RESEND_DEALER_EMAIL;
  const fromAddress = import.meta.env.RESEND_FROM_ADDRESS;

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
