export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../lib/supabase-admin";
import { getRequestUser } from "../../../lib/request-user";
import { can } from "../../../lib/permissions";
import { userCreateSchema } from "../../../lib/users";
import { writeAudit } from "../../../lib/audit";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── GET /api/dealer/users ─────────────────────────────────────────────────────
export const GET: APIRoute = async ({ request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "dealer:users:manage")) return json({ error: "Forbidden" }, 403);

  const db = getAdminClient();
  const { data, error } = await db
    .from("user_profiles")
    .select("id, email, role, commission_percentage, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/dealer/users]", error);
    return json({ error: "Database error" }, 500);
  }

  return json(data);
};

// ── POST /api/dealer/users ────────────────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "dealer:users:manage")) return json({ error: "Forbidden" }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = userCreateSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Validation failed", errors: parsed.error.flatten().fieldErrors }, 422);
  }

  const { email, role, commission_percentage } = parsed.data;
  const db = getAdminClient();

  // Check for duplicate email — only treat "no rows" (PGRST116) as non-fatal
  const { data: existing, error: existingError } = await db
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (existingError && existingError.code !== "PGRST116") {
    console.error("[POST /api/dealer/users] email check error", existingError);
    return json({ error: "Database error" }, 500);
  }
  if (existing) return json({ error: "A user with this email already exists" }, 409);

  // Invite via Supabase Auth (sends magic-link invite email)
  const { data: authData, error: inviteError } = await db.auth.admin.inviteUserByEmail(email);
  if (inviteError || !authData?.user) {
    console.error("[POST /api/dealer/users] invite error", inviteError);
    return json({ error: "Failed to invite user" }, 500);
  }

  // Insert into user_profiles
  const { data: profile, error: insertError } = await db
    .from("user_profiles")
    .insert({
      id:                   authData.user.id,
      email,
      role,
      commission_percentage: commission_percentage ?? null,
      is_active:            true,
    })
    .select("id, email, role, commission_percentage, is_active, created_at")
    .single();

  if (insertError || !profile) {
    console.error("[POST /api/dealer/users] insert error", insertError);
    return json({ error: "Failed to create user profile" }, 500);
  }

  await writeAudit({
    action:     "user_created",
    adminEmail: user.email,
    entityRef:  profile.id,
  });

  return json(profile, 201);
};
