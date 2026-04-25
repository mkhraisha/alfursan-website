export const prerender = false;

import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
import { getAdminClient } from "../../../lib/supabase-admin";
import { getFinancingRateLimit } from "../../../lib/rate-limit";
import { phase2Schema } from "../../../lib/phase2-schema";

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
  if (!isAllowedOrigin(request)) {
    return json({ success: false, error: "Forbidden" }, 403);
  }

  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    const limiter = getFinancingRateLimit();
    const { success } = await limiter.limit(`phase2:${ip}`);
    if (!success) {
      return json({ success: false, error: "rate_limit" }, 429);
    }
  } catch {
    console.warn("[phase2] Rate limiter not configured; skipping");
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, errors: { _: "Invalid request body" } }, 400);
  }

  // ── Validate ───────────────────────────────────────────────────────────────
  const result = phase2Schema.safeParse(body);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (path) errors[path] = issue.message;
    }
    return json({ success: false, errors }, 422);
  }

  const d = result.data;
  const supabase = getAdminClient();

  // ── Validate token — find matching app ─────────────────────────────────────
  const { data: app, error: lookupErr } = await supabase
    .from("applications")
    .select("id, status, email, full_name")
    .eq("id", d.appId)
    .eq("phase2_token", d.phase2Token)
    .single();

  if (lookupErr || !app) {
    return json({ success: false, error: "Invalid or expired token" }, 403);
  }
  if (app.status === "documents_submitted") {
    return json({ success: false, error: "Documents have already been submitted" }, 409);
  }
  if (app.status !== "document_incomplete") {
    return json({ success: false, error: "This application is not awaiting documents" }, 409);
  }

  // ── Upsert Phase 2 fields ──────────────────────────────────────────────────
  const ipHash = createHash("sha256").update(ip).digest("hex");

  const { error: updateErr } = await supabase
    .from("applications")
    .update({
      void_cheque_path:     d.voidChequePath,
      proof_insurance_path: d.proofInsurancePath,
      payslip_path:         d.payslipPath,
      dealertrack_consent:  d.dealertrackConsent,
      references:           d.references,
      status:               "documents_submitted",
      phase2_submitted_at:  new Date().toISOString(),
    })
    .eq("id", d.appId);

  if (updateErr) {
    console.error("[phase2] DB update error:", updateErr);
    return json({ success: false, error: "Database error" }, 500);
  }

  // ── Audit trail ────────────────────────────────────────────────────────────
  await supabase.from("application_audit").insert({
    application_id:  d.appId,
    application_ref: d.appId,
    action:          "phase2_submitted",
    admin_email:     app.email ?? "applicant",
    ip_hash:         ipHash,
  });

  return json({ success: true }, 200);
};
