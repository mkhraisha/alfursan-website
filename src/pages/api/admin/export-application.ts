export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../lib/supabase-admin";
import { can } from "../../../lib/permissions";
import { createHash } from "node:crypto";

export const GET: APIRoute = async ({ locals, url, request }) => {
  const { adminRole, adminEmail } = locals;

  if (!can(adminRole!, "financing:export")) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = url.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = getAdminClient();
  const { data: app, error } = await supabase
    .from("applications")
    .select(
      "id, full_name, email, phone, address, postal_code, time_at_address, prev_address, " +
      "dob, marital_status, employment_status, employer, job_title, annual_income, " +
      "time_at_employer, prev_employer, prev_time_at_employer, " +
      "vehicle_year, vehicle_make, vehicle_model, vehicle_price, down_payment, " +
      "loan_term_months, vin, listing_slug, status, created_at, consent_timestamp, license_consent"
    )
    .eq("id", id)
    .single();

  if (error || !app) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Write audit row
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex");
  await supabase.from("application_audit").insert({
    application_id: id,
    application_ref: id,
    action: "exported",
    admin_email: adminEmail,
    ip_hash: ipHash,
  });

  const filename = `application-${id}.json`;
  return new Response(JSON.stringify(app, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};
