export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../lib/supabase-admin";
import { getRequestUser } from "../../../lib/request-user";
import { can } from "../../../lib/permissions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const DOC_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 50 * 1024 * 1024; // 50 MiB
const EXT_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// ── POST /api/expenses/upload-url ────────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!can(user.role, "business_expenses:manage")) {
    return json({ error: "Forbidden: cannot upload expense documents" }, 403);
  }

  let body: { contentType?: string; fileSize?: number; filename?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { contentType, fileSize } = body;
  if (!contentType || typeof fileSize !== "number" || !Number.isFinite(fileSize)) {
    return json({ error: "Missing or invalid required fields: contentType, fileSize" }, 400);
  }

  if (!DOC_TYPES.includes(contentType)) {
    return json({ error: `Content type '${contentType}' not allowed for expense document uploads` }, 400);
  }
  if (fileSize < 0 || fileSize > MAX_BYTES) {
    return json({ error: "File exceeds the 50 MiB limit" }, 400);
  }

  const ext = EXT_MAP[contentType] ?? "bin";
  const storagePath = `business-expenses/${crypto.randomUUID()}.${ext}`;

  const db = getAdminClient();
  const { data, error } = await db.storage
    .from("vehicle-documents")
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    console.error("[POST /api/expenses/upload-url]", error);
    return json({ error: "Failed to create upload URL" }, 500);
  }

  return json({ uploadUrl: data.signedUrl, storagePath, bucket: "vehicle-documents" });
};
