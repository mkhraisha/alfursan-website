export const prerender = false;

import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
import { getAdminClient } from "../../../lib/supabase-admin";
import { can } from "../../../lib/permissions";
import type { Role } from "../../../lib/permissions";
import { z } from "zod";

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Allowed Phase 1 fields the admin may update inline.
const updateSchema = z.object({
  id: z.string().uuid("Invalid application ID"),

  // Personal
  full_name:      z.string().min(2).optional(),
  dob:            z.string().optional(),
  address:        z.string().optional(),
  postal_code:    z.string().optional(),
  phone:          z.string().optional(),
  email:          z.string().email().optional(),
  marital_status: z.string().optional(),

  // Employment
  employment_status: z.string().optional(),
  employer:          z.string().optional(),
  employer_address:  z.string().optional(),
  employer_phone:    z.string().optional(),
  job_title:         z.string().optional(),
  annual_income:     z.number().nullable().optional(),
  time_at_employer:  z.string().optional(),

  // Vehicle & Loan
  vehicle_year:      z.string().optional(),
  vehicle_make:      z.string().optional(),
  vehicle_model:     z.string().optional(),
  vehicle_price:     z.number().nullable().optional(),
  down_payment:      z.number().nullable().optional(),
  loan_term_months:  z.number().int().nullable().optional(),
  vin:               z.string().optional(),
});

export const PATCH: APIRoute = async ({ request, locals }) => {
  const { adminRole, adminEmail } = locals as { adminRole: Role | undefined; adminEmail: string };

  if (!can(adminRole, "financing:write")) {
    return json({ error: "Forbidden" }, 403);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const result = updateSchema.safeParse(body);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".");
      if (path) errors[path] = issue.message;
    }
    return json({ errors }, 422);
  }

  const { id, ...fields } = result.data;

  // Strip undefined values — only send fields that were actually provided.
  const patch = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined)
  );

  if (Object.keys(patch).length === 0) {
    return json({ error: "No fields to update" }, 400);
  }

  const supabase = getAdminClient();

  const { error: updateErr } = await supabase
    .from("applications")
    .update(patch)
    .eq("id", id);

  if (updateErr) {
    console.error("[update-application] DB update error:", updateErr);
    return json({ error: "Database error" }, 500);
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex");

  await supabase.from("application_audit").insert({
    application_id:  id,
    application_ref: id,
    action:          "application_updated",
    admin_email:     adminEmail,
    ip_hash:         ipHash,
  });

  return json({ success: true }, 200);
};
