export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../lib/supabase-admin";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
  "application/pdf",
];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

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

export const POST: APIRoute = async ({ request }) => {
  if (!isAllowedOrigin(request)) {
    return json({ error: "Forbidden" }, 403);
  }

  let body: {
    draftId?: string;
    side?: string;
    contentType?: string;
    fileSize?: number;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { draftId, side, contentType, fileSize } = body;

  if (!draftId || !side || !contentType || fileSize === undefined) {
    return json({ error: "Missing required fields" }, 400);
  }
  if (!["front", "back"].includes(side)) {
    return json({ error: "Invalid side — must be 'front' or 'back'" }, 400);
  }
  if (!ALLOWED_TYPES.includes(contentType)) {
    return json(
      { error: `File type not allowed. Accepted: ${ALLOWED_TYPES.join(", ")}` },
      400
    );
  }
  if (fileSize > MAX_BYTES) {
    return json({ error: "File exceeds the 8 MB limit" }, 400);
  }

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/heic": "heic",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  const storagePath = `tmp/${draftId}/${side}.${extMap[contentType]}`;

  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase.storage
      .from("license-documents")
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error("[upload-url] Supabase storage error:", JSON.stringify(error));
      return json(
        { error: error?.message ?? "Failed to create upload URL. Check that the 'license-documents' bucket exists in Supabase Storage." },
        500
      );
    }

    return json({ uploadUrl: data.signedUrl, storagePath }, 200);
  } catch (err) {
    console.error("[upload-url] Unexpected error:", err);
    return json({ error: "Internal server error" }, 500);
  }
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
