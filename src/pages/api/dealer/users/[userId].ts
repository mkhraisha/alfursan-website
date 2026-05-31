export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../../lib/supabase-admin";
import { getRequestUser } from "../../../../lib/request-user";
import { can } from "../../../../lib/permissions";
import { userUpdateSchema } from "../../../../lib/users";
import { writeAudit } from "../../../../lib/audit";

// Higher rank = more privilege. A caller may only assign roles strictly below their own.
const ROLE_RANK: Record<string, number> = { owner: 2, manager: 1, sales: 0 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── PATCH /api/dealer/users/[userId] ─────────────────────────────────────────
export const PATCH: APIRoute = async ({ params, request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "dealer:users:manage")) return json({ error: "Forbidden" }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = userUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Validation failed", errors: parsed.error.flatten().fieldErrors }, 422);
  }

  const db     = getAdminClient();
  const userId = params.userId!;
  const update = parsed.data;

  // ── Guard: role escalation ────────────────────────────────────────────────
  // A caller may only assign roles strictly below their own rank.
  // This prevents a manager from promoting anyone (including themselves) to owner.
  if (update.role !== undefined) {
    const callerRank = ROLE_RANK[user.role] ?? 0;
    const targetRank = ROLE_RANK[update.role] ?? 0;
    if (targetRank >= callerRank) {
      return json({ error: "Cannot assign a role equal to or higher than your own" }, 403);
    }
  }

  // ── Guard: self-disable ───────────────────────────────────────────────────
  if (update.is_active === false && userId === user.userId) {
    return json({ error: "Cannot disable your own account" }, 400);
  }

  // ── Guard: last active manager/owner ─────────────────────────────────────
  // Prevent the system from being left with zero active privileged users.
  if (update.is_active === false) {
    const { count } = await db
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .in("role", ["owner", "manager"])
      .eq("is_active", true)
      .neq("id", userId);

    if ((count ?? 0) === 0) {
      return json({ error: "Cannot disable the last active manager or owner" }, 400);
    }
  }

  // Build the DB update object
  const dbUpdate: Record<string, unknown> = {};
  if (update.role !== undefined)                  dbUpdate.role                  = update.role;
  if (update.commission_percentage !== undefined) dbUpdate.commission_percentage = update.commission_percentage;

  if (update.is_active !== undefined) {
    dbUpdate.is_active   = update.is_active;
    dbUpdate.disabled_at = update.is_active ? null : new Date().toISOString();
  }

  const { data: profile, error: updateError } = await db
    .from("user_profiles")
    .update(dbUpdate)
    .eq("id", userId)
    .select("id, email, role, commission_percentage, is_active, disabled_at, created_at")
    .single();

  if (updateError) {
    if (updateError.code === "PGRST116") return json({ error: "User not found" }, 404);
    console.error("[PATCH /api/dealer/users/:userId]", updateError);
    return json({ error: "Database error" }, 500);
  }

  const action = update.is_active === false ? "user_disabled" : "user_updated";
  await writeAudit({
    action,
    adminEmail: user.email,
    entityRef:  userId,
  });

  return json(profile);
};
