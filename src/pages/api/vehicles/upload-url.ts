export const prerender = false;

/**
 * POST /api/vehicles/upload-url
 *
 * Returns a Supabase signed upload URL for vehicle images or documents.
 * Requires dealer authentication (any role).
 *
 * Body:
 *   context     — "vehicle-image" | "vehicle-document"
 *   vin         — 17-char VIN string
 *   contentType — MIME type of the file being uploaded (used to derive the storage extension via EXT_MAP, regardless of the extension in filename)
 *   fileSize    — byte size of the file (enforced ≤ 50 MiB)
 *   filename    — original filename (informational only; extension is derived from contentType)
 */

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../lib/supabase-admin";
import { getRequestUser } from "../../../lib/request-user";
import { vinSchema } from "../../../lib/vehicles";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const IMAGE_TYPES  = ["image/jpeg", "image/png", "image/webp", "image/heic", "video/mp4", "video/quicktime"];
const DOC_TYPES    = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_BYTES    = 50 * 1024 * 1024; // 50 MiB

const EXT_MAP: Record<string, string> = {
  "image/jpeg":       "jpg",
  "image/png":        "png",
  "image/webp":       "webp",
  "image/heic":       "heic",
  "video/mp4":        "mp4",
  "video/quicktime":  "mov",
  "application/pdf":  "pdf",
};

export const POST: APIRoute = async ({ request }) => {
  const user = await getRequestUser(request);
  if (!user) return json({ error: "Unauthorized" }, 401);

  let body: {
    context?:     string;
    vin?:         string;
    contentType?: string;
    fileSize?:    number;
    filename?:    string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { context, vin, contentType, fileSize } = body;

  if (!context || !vin || !contentType || fileSize === undefined) {
    return json({ error: "Missing required fields: context, vin, contentType, fileSize" }, 400);
  }

  if (!["vehicle-image", "vehicle-document"].includes(context)) {
    return json({ error: "context must be 'vehicle-image' or 'vehicle-document'" }, 400);
  }

  if (!vinSchema.safeParse(vin).success) {
    return json({ error: "Invalid VIN" }, 400);
  }

  if (fileSize > MAX_BYTES) {
    return json({ error: "File exceeds the 50 MiB limit" }, 400);
  }

  const isImage = context === "vehicle-image";
  const allowed = isImage ? IMAGE_TYPES : DOC_TYPES;

  if (!allowed.includes(contentType)) {
    return json({ error: `Content type '${contentType}' not allowed for ${context}` }, 400);
  }

  const ext         = EXT_MAP[contentType] ?? "bin";
  const uniquePart  = crypto.randomUUID();
  const bucket      = isImage ? "vehicle-images" : "vehicle-documents";
  const storagePath = isImage
    ? `vehicles/${vin}/${uniquePart}.${ext}`
    : `vehicles/${vin}/docs/${uniquePart}.${ext}`;

  const db = getAdminClient();
  const { data, error } = await db.storage
    .from(bucket)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    console.error("[POST /api/vehicles/upload-url]", error);
    return json({ error: "Failed to create upload URL" }, 500);
  }

  return json({ uploadUrl: data.signedUrl, storagePath, bucket });
};
