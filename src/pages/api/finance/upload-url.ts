export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminClient } from "../../../lib/supabase-admin";
import { getFinancingRateLimit } from "../../../lib/rate-limit";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/webp",
  "application/pdf",
];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PHASE2_TYPES = ["void_cheque", "proof_insurance", "payslip"];

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

  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    const limiter = getFinancingRateLimit();
    const { success } = await limiter.limit(`upload:${ip}`);
    if (!success) {
      return json({ error: "rate_limit" }, 429);
    }
  } catch {
    console.warn("[upload-url] Rate limiter not configured; skipping");
  }

  let body: {
    // Phase 1 fields
    draftId?: string;
    side?: string;
    // Phase 2 fields
    phase2Token?: string;
    appId?: string;
    docType?: string;
    // Shared
    contentType?: string;
    fileSize?: number;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { contentType, fileSize } = body;

  if (!contentType || fileSize === undefined) {
    return json({ error: "Missing required fields" }, 400);
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
  const ext = extMap[contentType];

  // ── Route: Phase 2 upload ──────────────────────────────────────────────────
  if (body.phase2Token || body.appId || body.docType) {
    const { phase2Token, appId, docType } = body;

    if (!phase2Token || !appId || !docType) {
      return json({ error: "Missing phase2Token, appId, or docType" }, 400);
    }
    if (!UUID_RE.test(phase2Token)) return json({ error: "Invalid phase2Token" }, 400);
    if (!UUID_RE.test(appId))       return json({ error: "Invalid appId" }, 400);
    if (!PHASE2_TYPES.includes(docType)) {
      return json({ error: `Invalid docType. Must be one of: ${PHASE2_TYPES.join(", ")}` }, 400);
    }

    // Validate token against DB
    const supabase = getAdminClient();
    const { data: app, error: tokenErr } = await supabase
      .from("applications")
      .select("id, status")
      .eq("id", appId)
      .eq("phase2_token", phase2Token)
      .single();

    if (tokenErr || !app) {
      return json({ error: "Invalid or expired token" }, 403);
    }
    if (app.status === "documents_submitted") {
      return json({ error: "Documents have already been submitted" }, 409);
    }

    const storagePath = `phase2/${appId}/${docType}.${ext}`;
    const { data, error } = await supabase.storage
      .from("license-documents")
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error("[upload-url] Phase 2 storage error:", JSON.stringify(error));
      return json({ error: error?.message ?? "Failed to create upload URL" }, 500);
    }

    return json({ uploadUrl: data.signedUrl, storagePath }, 200);
  }

  // ── Route: Phase 1 upload ──────────────────────────────────────────────────
  const { draftId, side } = body;

  if (!draftId || !side) {
    return json({ error: "Missing required fields" }, 400);
  }
  if (!UUID_RE.test(draftId)) {
    return json({ error: "Invalid draftId" }, 400);
  }
  if (!["front", "back"].includes(side)) {
    return json({ error: "Invalid side — must be 'front' or 'back'" }, 400);
  }

  const storagePath = `tmp/${draftId}/${side}.${ext}`;

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
