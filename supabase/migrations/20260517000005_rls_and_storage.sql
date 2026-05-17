-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies for vehicles, vehicle_expenses, vehicle_documents.
-- All data access goes through server-side API routes using the service role
-- client, so policies are simple service-role-only guards (same pattern as
-- applications and application_audit in the baseline migration).
--
-- Storage buckets for vehicle assets:
--   vehicle-images   (public)  — photos and videos served to the website
--   vehicle-documents (private) — bills of sale, inspection docs, receipts
-- ─────────────────────────────────────────────────────────────────────────────

-- ── vehicles RLS ──────────────────────────────────────────────────────────────
CREATE POLICY "service role only" ON vehicles
  USING (auth.role() = 'service_role');

-- ── vehicle_expenses RLS ──────────────────────────────────────────────────────
CREATE POLICY "service role only" ON vehicle_expenses
  USING (auth.role() = 'service_role');

-- ── vehicle_documents RLS ─────────────────────────────────────────────────────
CREATE POLICY "service role only" ON vehicle_documents
  USING (auth.role() = 'service_role');


-- ── Storage buckets ───────────────────────────────────────────────────────────

-- Public bucket: vehicle images and videos served to the public website.
-- Objects live at: vehicles/{vin}/{filename}
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-images',
  'vehicle-images',
  true,
  52428800,  -- 50 MiB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Private bucket: bills of sale, inspections, ownership pictures, expense receipts.
-- Objects live at: vehicles/{vin}/docs/{filename}
-- Access requires a signed URL generated server-side.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-documents',
  'vehicle-documents',
  false,
  52428800,  -- 50 MiB
  NULL       -- allow any mime type for documents
)
ON CONFLICT (id) DO NOTHING;


-- ── Storage RLS: vehicle-images (public read, service-role write) ─────────────
CREATE POLICY "public read vehicle images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vehicle-images');

CREATE POLICY "service role manage vehicle images"
  ON storage.objects FOR ALL
  USING (bucket_id = 'vehicle-images' AND auth.role() = 'service_role');


-- ── Storage RLS: vehicle-documents (private, service-role only) ───────────────
CREATE POLICY "service role manage vehicle documents"
  ON storage.objects FOR ALL
  USING (bucket_id = 'vehicle-documents' AND auth.role() = 'service_role');
