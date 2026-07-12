export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../../../lib/supabase-admin";
import { getRequestUser } from "../../../../../lib/request-user";
import { documentCreateSchema } from "../../../../../lib/vehicles";
import { writeAudit } from "../../../../../lib/audit";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// ── GET /api/vehicles/:vin/documents ──────────────────────────────────────────
export const GET: APIRoute = async ({ params, request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const db  = getAdminClient();
  const vin = params.vin!;

  const { data, error } = await db
    .from("vehicle_documents")
    .select("id, document_type, file_path, description, uploaded_by, created_at")
    .eq("vin", vin)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[GET /api/vehicles/:vin/documents]", error);
    return json({ error: "Database error" }, 500);
  }

  return json(data ?? []);
};

// ── POST /api/vehicles/:vin/documents ─────────────────────────────────────────
export const POST: APIRoute = async ({ params, request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = documentCreateSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Validation failed", errors: parsed.error.flatten().fieldErrors }, 422);
  }

  const db  = getAdminClient();
  const vin = params.vin!;

  const { data, error } = await db
    .from("vehicle_documents")
    .insert({ vin, uploaded_by: user.userId, ...parsed.data })
    .select("id, document_type, file_path, description, uploaded_by, created_at")
    .single();

  if (error) {
    if (error.code === "23503") return json({ error: "Vehicle not found" }, 404);
    console.error("[POST /api/vehicles/:vin/documents]", error);
    return json({ error: "Database error" }, 500);
  }

  await writeAudit({
    action:     "document_uploaded",
    adminEmail: user.email,
    entityRef:  vin,
  });

  return json(data, 201);
};
