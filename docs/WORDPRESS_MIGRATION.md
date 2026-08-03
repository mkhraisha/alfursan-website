# WordPress Migration Plan

**Status:** Parts 1-8 done — all completion criteria met. The public site has zero remaining code or asset dependencies on `alfursanauto.ca`/`media.alfursanauto.ca` (the one-time migration scripts in `scripts/` and their support modules are the sole intentional exception — historical tooling, not a live dependency). WordPress can be taken offline.
**Date:** 2026-08-02
**Supersedes/details:** `docs/DMS_PHASE2_PLAN.md` Sprint 2 ("Website Integration — Replace WordPress Inventory") — that sprint now just points here.
**Related:** `docs/DEALER_MANAGEMENT_DECISIONS.md`, `docs/DEALER_MANAGEMENT_DESIGN.md`

---

## 1. Scope

WordPress (`alfursanauto.ca` WP install + its `media.alfursanauto.ca` media subdomain, via the Vehica plugin) is being fully decommissioned. Today it is the source of truth for:

- Vehicle inventory listings (Vehica `cars` custom post type) and all vehicle photos/videos
- Blog posts
- Static pages: About Us, Contact Us, Team, FAQ

That content splits into three buckets going forward:

| Content | Disposition |
|---|---|
| Vehicle listings, status, photos | **Migrate** into the DMS (`vehicles` table + `vehicle-images` Supabase Storage bucket) — already the system of record for inventory operationally |
| About Us, Contact Us | **Rebuild natively** as static Astro content — rarely changes, doesn't need a CMS round-trip |
| Blog, Team, FAQ | **Delete, no replacement** — confirmed unused |

End state: nothing on the public site fetches from `alfursanauto.ca`/`media.alfursanauto.ca`, `src/lib/wordpress.ts` is deleted, and WordPress can be safely taken offline.

---

## 2. Key decisions

1. **No `condition` field.** The dealership only sells used vehicles, so WordPress's new/used taxonomy (`vehica_6654`) is dropped entirely, not migrated.
2. **New vehicle spec fields are required in the DMS schema**: `drive_type`, `transmission`, `fuel_type`, `cylinders`, `doors`, `features` (list), and a public-facing `description`. None of these exist on the `vehicles` table today — `InventoryFilters.tsx` filters/renders on exactly these fields, so Sprint 2 cannot reach parity with the current public site without them. See Part 4.
3. **Sold vehicles stay visible on the public site for 30 days after `sale_date`**, then disappear from all public views. See Part 5 for the exact visibility rule.
4. **Photo uploads happen only through the DMS going forward** (already true today via the admin Media tab → `vehicle-images` bucket). Because WordPress/media subdomain will be decommissioned, every historically WordPress-hosted photo must be copied into Supabase Storage before cutover — the public site must never depend on `media.alfursanauto.ca`, not even temporarily. See Part 6.
5. **About Us / Contact Us are rebuilt as static native Astro pages** — hardcoded content (or a small local config/JSON, not a CMS fetch). See Part 7.
6. **Blog, Team, and FAQ are deleted outright.** Confirmed unused; no migration, no redirects planned. (Open item: do a quick check for any inbound backlinks to `/blog/*` before deleting, in case a 301-to-home is worth adding — see Part 8.)

---

## 3. Current-state gap summary (for context)

`src/lib/wordpress.ts` → `getCars`/`getCarBySlug` feeds: `index.astro`, `search/index.astro`, `sold/index.astro`, `listing/[slug].astro`, `InventoryFilters.tsx`, `PopularMakes.tsx`.

| WordPress field (`CarSummary`) | DMS `vehicles` equivalent |
|---|---|
| make, model, year, mileage, price, colour, VIN, images | Already exist (`make`, `model`, `year`, `odometer`, `advertised_price_cargurus`, `colour`, `vin`, `images_json`) |
| vehicleType (body type) | `body_type` (already exists, constrained to sedan/van/coupe/convertible) |
| condition | **Dropped** — used cars only (Decision 1) |
| driveType, transmission, fuelType, cylinders, doors, features | **Missing — must be added** (Decision 2, Part 4) |
| htmlDescription / excerpt | **Missing** — need a public `description` column (Decision 2, Part 4) |
| offerType = "sold" | Derived from `status @> ARRAY['sold']` + `sale_date` (Part 5) |
| slug (routing) | Replaced by VIN-based routing (Part 8) |

---

## 4. Part 1 — Schema: new vehicle fields

**Status: implemented — see PR #58 (`feat/wp-migration-part1-schema`).**

- [x] **Add `drive_type`, `transmission`, `fuel_type`, `cylinders`, `doors`, `features`, `description` to `vehicles`**
  - **Description:** New migration `supabase/migrations/<timestamp>_add_public_listing_fields.sql`. Suggested types/constraints, following the existing `body_type` pattern (`20260531000002_add_vehicle_fields.sql`):
    - `drive_type TEXT CHECK (drive_type IS NULL OR drive_type IN ('fwd','rwd','awd','4wd'))`
    - `transmission TEXT CHECK (transmission IS NULL OR transmission IN ('automatic','manual','cvt'))`
    - `fuel_type TEXT CHECK (fuel_type IS NULL OR fuel_type IN ('gasoline','diesel','hybrid','electric'))`
    - `cylinders SMALLINT CHECK (cylinders IS NULL OR cylinders > 0)`
    - `doors SMALLINT CHECK (doors IS NULL OR doors BETWEEN 2 AND 6)`
    - `features TEXT[] NOT NULL DEFAULT '{}'`
    - `description TEXT` (public marketing copy — distinct from `internal_notes`/`disclosures`, which stay internal-only)
  - **Validation:** `supabase db reset` (local) applies cleanly. Inserting a vehicle with an invalid `drive_type`/`transmission`/`fuel_type` value is rejected with a check-constraint error (`23514`).
  - **Test:** Vitest coverage in `src/__tests__/vehicles.test.ts` (or new file) asserting `vehicleCreateSchema` accepts valid enum values and rejects invalid ones for each new field.

- [x] **Add new fields to `PUBLIC_COLUMNS` and `vehicleCreateSchema` in `src/lib/vehicles.ts`**
  - **Description:** Extend `PUBLIC_COLUMNS` to include `drive_type, transmission, fuel_type, cylinders, doors, features, description` so the public API can return them. Extend the Zod schema so admin create/update validates the new fields.
  - **Validation:** `npm run build` passes. `GET /api/vehicles` (unauthenticated) response includes the new fields.
  - **Test:** Existing `src/__tests__/vehicles-api.test.ts`-style integration test extended to assert the new fields round-trip through POST → GET.
  - **Note:** `body_type` was also missing from `PUBLIC_COLUMNS` (pre-existing gap, unrelated to this migration) — added alongside the new fields since it's needed for the same public-listing purpose.

- [x] **Add fields to admin `VehicleDetail.tsx` (Basics tab)**
  - **Description:** Add form inputs for drive type, transmission, fuel type, cylinders, doors (selects/number inputs matching the new CHECK constraints), a features list editor (add/remove chips), and a multiline public description textarea.
  - **Validation:** Editing and saving each field persists correctly and reloads with the saved value.
  - **Test:** Manual E2E per existing convention (Decision 12 in `DEALER_MANAGEMENT_DECISIONS.md`) — edit each field, save, reload page, confirm value present.

- [x] **Do NOT map these fields in the vehicle CSV importer** (corrected from the original plan)
  - **Description:** The OpenLane CSV sheet used for vehicle import does not carry drive type, transmission, fuel type, cylinders, doors, features, or a marketing description — only WordPress has this data. Mapping these as CSV columns would be dead weight (nothing to map them from) and was reverted from the first pass at this sprint. These fields get populated by the one-time WordPress data migration instead (Part 2).
  - **Validation:** `VEHICLE_FIELDS` in `CSVImport.tsx` and the coercion branches in `src/pages/api/vehicles/import.ts` do not reference these 7 fields.

---

## 5. Part 2 — Data migration (WordPress → `vehicles`)

**Status: implemented, fixed post-review, and validated end-to-end against a real local Supabase stack — see PR `feat/wp-migration-part2-data-import`.**

- [x] **One-time import script: WP `cars` → `vehicles`**
  - **Description:** `scripts/migrate-wordpress-inventory.mjs` fetches all WP `cars` posts + taxonomy terms, maps each field via the pure functions in `src/lib/wordpress-migration.ts` onto the schema added in Part 1. For a VIN that doesn't exist yet, it INSERTs a new row. For a VIN that already exists (e.g. imported earlier via the CSV importer, which never carries `drive_type`/`transmission`/`fuel_type`/`cylinders`/`doors`/`features`/`description`), it **fills in only the fields that are currently empty** on that row (`buildFillPatch`) — it never overwrites a field the DMS already has a value for, and never touches `status` (staff-managed operational state, not vehicle spec data). Vehicles with a missing/invalid VIN, make, model, year, or body type are reported and skipped, not silently dropped. `images_json`/`videos_json`/`photography_status` are deliberately left untouched — Part 4 migrates photos separately, and a vehicle with no photos yet should stay non-public under Part 3's visibility rule. Defaults to local/staging only — writing to a non-local `SUPABASE_URL` requires `--allow-production` plus an interactive typed confirmation (`assertLocalSupabaseOrDryRun`), so a real production run can't happen by accident or via a copy-pasted/scripted command.
  - **Validation:** Every mapped row is re-validated against `vehicleCreateSchema` before insert as a safety net. Skipped rows are written to `skipped.json` with a reason; existing vehicles that got fields filled in are written to `filled.json` with exactly which fields changed.
  - **Test:** `src/__tests__/wordpress-migration.test.ts` covers the pure mapping/validation/fill-patch logic (58 tests). `--dry-run` was run against the live WordPress site: 43 cars fetched, 38 candidates, 5 skipped (real WP data-quality gaps, not bugs). A real write-mode run against a local Supabase stack confirmed: all 38 candidates already existed (this dev DB has real dealership inventory seeded via CSV import), all 38 got 1+ empty field filled in, zero errors; a second run confirmed idempotency (0 filled, 38 already complete). Spot-checked a filled row directly against the DB — pre-existing `make`/`model`/`colour` untouched, new `drive_type`/`transmission`/`fuel_type`/`cylinders`/`doors`/`description` correctly populated.

- [x] **Fix: `description` lost all formatting, and the Carfax report link was dropped entirely**
  - **Description:** WP post bodies wrap each paragraph/section in its own `<p>`/`<div>`/`<h*>` (with `<p>&nbsp;</p>` spacer paragraphs between sections) and embed the Carfax vehicle history link as an `<a href="https://vhr.carfax.ca/...">` inside the body text — confirmed against real production WP content (`media.alfursanauto.ca/wp-json/wp/v2/cars`). The original `stripHtmlToPlainText` flattened every tag to a single space, so the mapped `description` came out as one run-on line and the Carfax link's `href` was discarded along with the tag, leaving only dead link text ("Carfax Report", "[Carfax Link here]") behind. Fixed in `src/lib/wordpress-migration.ts`: `stripHtmlToPlainText` now turns block-level tag boundaries (and `<br>`) into blank lines instead of spaces, and drops now-empty spacer paragraphs; a new `extractCarfaxLink()` pulls the first `<a href>` whose domain matches `carfax.ca` out of the raw HTML, and `removeCarfaxAnchors()` strips that anchor (and only that one) out of the HTML before it's flattened to plain text, so no dead link text remains. `mapWpCarToVehicleRow` now sets `row.carfax_link` when found. `carfax_link` was added to `FILLABLE_FIELDS` so an existing DMS vehicle (e.g. from the CSV importer) with no `carfax_link` yet gets it filled in on re-run, same as the other WP-only fields — never overwrites one that's already set.
  - **Validation:** Verified against three real WP posts fetched live from `media.alfursanauto.ca` — all three embed the Carfax link as an in-body `<a>` with no dedicated ACF field, confirming there was no existing structured source for `carfax_link` this migration was missing.
  - **Test:** `src/__tests__/wordpress-migration.test.ts` — new coverage for `extractCarfaxLink` (finds the link, case-insensitive domain match, decodes HTML entities in the href, ignores non-Carfax links), `stripHtmlToPlainText` (preserves paragraph/`<br>` breaks as blank lines, drops empty spacer paragraphs), `mapWpCarToVehicleRow` (sets `carfax_link` and produces a clean multi-line description when a Carfax link is present, omits `carfax_link` when absent), and `buildFillPatch` (fills an empty `carfax_link`, never overwrites an existing one).

- [x] **Fix: repair descriptions already corrupted by a prior (buggy) run — `--refresh-description`**
  - **Description:** Both the local dev Supabase stack and production had already been migrated once with the buggy `stripHtmlToPlainText` above, so their `description` columns are no longer empty — `buildFillPatch`'s normal fill-only-if-empty rule will never revisit them, meaning the fix above alone wouldn't repair anything already written. Added a `--refresh-description` flag to `scripts/migrate-wordpress-inventory.mjs`. For an already-existing vehicle, if its current `description` matches byte-for-byte what the *old, buggy* migration would have produced from the current WP content (`isUnrefreshedLegacyDescription()`, backed by `legacyStripHtmlToPlainTextV1()` — a frozen, intentionally-buggy reproduction of the original algorithm, kept only for this comparison), it's safe to assume no one has touched it since, and the description is replaced with the corrected version. If it doesn't match — an admin may have hand-edited the public description since, or the WP content itself changed — the row is left untouched and reported in `description-needs-review.json` instead of being silently overwritten.
  - **Validation:** Ran `--refresh-description` against the local dev Supabase stack (the same one confirmed to have the old buggy data): 37 of 38 existing vehicles had their description safely repaired (paragraph breaks restored, Carfax link extracted into `carfax_link`); 1 was correctly flagged in `description-needs-review.json` instead of being overwritten — its current description already had real paragraph breaks the old buggy algorithm could never have produced, consistent with a staff member having manually cleaned it up in the admin UI after the original bad migration ran. That vehicle's empty `carfax_link` was still safely backfilled via the normal fill-patch path, since that check is independent of the description-refresh logic.
  - **Test:** `src/__tests__/wordpress-migration.test.ts` covers `legacyStripHtmlToPlainTextV1` (reproduces the old flattening, including its lack of `&nbsp;` decoding) and `isUnrefreshedLegacyDescription` (true only on an exact match; false when empty, hand-edited, or already in the new corrected format).

- [x] **Map `vehicleType`/taxonomy terms → new enum values**
  - **Description:** `src/lib/wordpress-migration.ts` has an alias table per field (body type, drive type, transmission, fuel type) translating WP's free-text taxonomy terms to the new constrained enum values, plus digit-extraction for cylinders/doors. Unmapped terms produce a warning and leave that one field `null` — they never fail the whole row.
  - **Validation:** Confirmed via the dry run above: real WP data uses a combined `"AWD/4WD"` drive-type term the initial alias table didn't cover — found via the actual dry run, added as an alias (defaults to `awd`), verified the warning count dropped from 15 to 0 on re-run. No unmapped terms are silently dropped without logging.
  - **Test:** Dry-run reviewed against production WP data (read-only fetch, no DB write) — see above. Real output is not committed (`docs/migration/` is gitignored — it contains real inventory data).

- [x] **Reconciliation report**
  - **Description:** The script writes `report.md`/`report.json` (counts, warnings, insert/update errors), `skipped.json` (every skipped row with its reason), `filled.json` (every existing vehicle that got fields populated, and which ones), and `slug-to-vin.json` (old WP slug → VIN, feeding Part 5's redirect table) to `docs/migration/wordpress-inventory/<timestamp>/`.
  - **Validation:** Reviewed against real WordPress + a real local Supabase stack — see above.
  - **Test:** N/A (manual review step).

---

## 6. Part 3 — Public visibility rules (status & "sold" window)

**Status: implemented — see PR `feat/wp-migration-part3-visibility`, revised post-launch (see note below).**

**Rule, as clarified by the user (corrected from this doc's original draft — no "Sold" badge, status is never exposed):** a vehicle is publicly visible if it has at least one photo uploaded, and it is not a sale older than 30 days. Every *other* status (`in_deal`, `bodyshop`, `pending_delivery`, no status set at all, etc.) shows on the website exactly like any other listing — the actual `status` value is purely a server-side filtering input and is never returned to the frontend, not even for sold vehicles (no "Sold" badge, no distinguishing marker). The public API only ever returns car specifications and what's needed to populate a listing.

**Revision (post-Part 4/5 launch):** the rule originally gated on `photography_status === 'done'` instead of `images_json` directly. That broke in practice: `photography_status` is a staff-managed operational flag ("have we physically photographed this car"), often set from the CSV/OpenLane import sheet independently of whether those photos were ever uploaded into the DMS — so a vehicle could be `'done'` with zero photos on file, making it publicly visible with nothing to show (found via a real production data audit: 37 of 96 vehicles were in exactly this state). The rule now checks `images_json` non-empty directly. `photography_status` still exists and is still staff-editable on the vehicle detail page — it's just no longer part of the visibility decision, matching its intended purpose as a pure tracking field, not a publish gate.

- [x] **Define `isPubliclyVisible(vehicle)` + `soldVisibilityCutoff(now)` helpers**
  - **Description:** Added to `src/lib/vehicles.ts`:
    - Not visible if `images_json` is empty or null.
    - Visible if `status !== 'sold'` (this covers every non-sold status, and a `NULL` status too — nothing else is checked).
    - If `status === 'sold'`: visible only if `sale_date` is set AND `sale_date >= soldVisibilityCutoff(now)` (30 days before `now`); a sold vehicle with no `sale_date` on record is treated as not-recent (hidden), since recency can't be established.
  - **Validation:** Unit tests cover: every non-sold status (including `NULL`) + at least one photo → visible; sold 10/30 days ago → visible; sold 31/40 days ago → not visible; sold with no `sale_date` → not visible; empty/null `images_json` → not visible regardless of status.
  - **Test:** `src/__tests__/vehicles-lib.test.ts` — table-driven.

- [x] **Apply the rule in `GET /api/vehicles` (list, unauthenticated branch)**
  - **Description:** `src/pages/api/vehicles/index.ts` previously returned *every* vehicle to unauthenticated callers regardless of status — a gap even before this migration. Now applies `.neq("images_json", "[]").or(\`status.is.null,status.neq.sold,sale_date.gte.${soldVisibilityCutoff()}\`)` as a DB-level filter (mirrors `isPubliclyVisible`, but expressed as SQL so pagination/count stay correct) — `images_json` is `JSONB NOT NULL DEFAULT '[]'`, so comparing against the empty-array literal correctly matches "has at least one photo." `status.is.null` is listed explicitly because SQL's `<>` doesn't match `NULL` the way JS's `!==` does. `PUBLIC_COLUMNS` still excludes `status`/`sale_date` entirely — they're filtered on, never selected. `images_json` *is* in `PUBLIC_COLUMNS` (it's meant to be public) and stays in the response.
  - **Validation:** Confirmed the exact `.neq`/`.or` calls via mocked query-builder assertions, and that the filter is skipped entirely for authenticated requests (staff always sees everything, unaffected by this rule). Confirmed directly against a local Supabase stack: a vehicle with real photos and `photography_status = 'pending'` is visible; a vehicle with `photography_status = 'done'` and empty `images_json` is not — on both the list and single-vehicle endpoints.
  - **Test:** `src/__tests__/api-vehicles.test.ts`.

- [x] **Apply the same rule in `GET /api/vehicles/:vin` (single vehicle, unauthenticated branch) — gap found and fixed**
  - **Description:** This endpoint had **no visibility filter at all** — any vehicle was fetchable by VIN regardless of status/photos, bypassing the list endpoint's filtering entirely. Fixed: the unauthenticated query selects `PUBLIC_COLUMNS` (which already includes `images_json`) plus `status, sale_date` purely to evaluate `isPubliclyVisible()` in-process; if not visible, returns 404 (same as an unknown VIN, so visibility state isn't leaked by a 403-vs-404 distinction either); if visible, the two internal fields are stripped from the response object before it's returned. `photography_status` isn't fetched by this query at all anymore, since it no longer factors into the decision.
  - **Validation:** Confirmed the response body never contains `status`/`sale_date` for an unauthenticated request (and that `photography_status` isn't even selected), and that 404 vs. 200 matches every case from the unit tests above.
  - **Test:** `src/__tests__/api-vehicles.test.ts`.

---

## 7. Part 4 — Photo/asset migration

**Status: done — run against production. See `scripts/migrate-wordpress-photos.mjs` / `src/lib/wordpress-photo-migration.ts` (PRs #71, #75, #76).**

- [x] **One-time image migration: WP media → `vehicle-images` bucket**
  - **Description:** `scripts/migrate-wordpress-photos.mjs` fetches every WP `cars` post's `vehica_6673` image URLs, and for each DMS vehicle whose `images_json` is still empty (`planVehiclePhotoMigration` in `src/lib/wordpress-photo-migration.ts`), downloads each URL (resolved to `media.alfursanauto.ca` via `toMediaUrl`) and uploads it into the Supabase `vehicle-images` bucket at `vehicles/{vin}/wp-NN.{ext}` — same bucket and `vehicles/{vin}/...` prefix convention `upload-url.ts` uses for admin-uploaded photos. `images_json` is then set to the uploaded paths in WP order (index 0 = featured, matching the existing admin convention), and `photography_status` flips from `pending`/unset to `done` (`buildPhotographyStatusPatch`) to reflect that photos now genuinely exist — a staff-set `na` or already-`done` value is never overridden. (Part 3's visibility rule was later revised to key off `images_json` directly rather than `photography_status` — see Part 3 — so this flip is no longer *required* for visibility, but it's still correct: successfully uploading real photos is exactly what `photography_status` is meant to track.) A vehicle whose `images_json` contains a path this script wouldn't itself generate is skipped entirely (admin-curated photos, since photo uploads happen only through the DMS going forward — decision 4). A vehicle with no WP images at all is also skipped. Every download and upload gets up to 4 attempts with backoff (real WordPress/Supabase runs do see transient `fetch failed`/timeout errors under concurrency), and an upload that comes back "already exists" after a retry is treated as success rather than a failure — a prior attempt's write can succeed server-side even when its response times out client-side, and re-uploading identical, deterministically-named content is pointless to fail on. **Partial migrations are resumable**: a vehicle whose `images_json` is a subset of what this script would generate for it (the result of an earlier run where some images kept failing) is picked up on the next run and only the still-missing images are attempted — already-uploaded ones are never re-fetched, and the final `images_json` preserves correct WP order regardless of which subset succeeded this time (`buildFinalImagesJson`). Same `--dry-run`/`--allow-production` local-only safety guard as Part 2's script, plus `--vin=X` to spot-check a single vehicle and `--concurrency=N` (default 4) to bound parallel downloads/uploads — worth lowering if a run reports many transient errors.
  - **Validation:** Every migrated vehicle's `images_json` resolves to a working public URL via `buildStorageUrl(supabaseUrl, "vehicle-images", path)` — same helper the admin Media tab already uses. Confirmed directly against a local Supabase stack: a real WP vehicle's 15 images uploaded successfully end to end, with the first path's public storage URL returning `200 image/jpeg` with real image bytes; re-running the same vehicle was a no-op (idempotent). Separately reproduced the exact partial-failure/resume scenario found during a real run: seeded a vehicle with 2 of 15 images already uploaded, ran the script — it correctly fetched only the 13 missing ones, and a genuine timeout on one image surfaced the "already exists on retry" case for real (a first attempt's write completed server-side despite a client-side timeout on the response); the fix treats that as success instead of exhausting retries and reporting a false failure. A second run then picked up the one image that had genuinely failed every attempt, reaching 15/15, in correct WP order throughout. `--dry-run` against live WordPress: 43 cars fetched, 37 candidates with a DMS-matching VIN and photos, 373 images total, 0 candidates missing from the DMS.
  - **Test:** `src/__tests__/wordpress-photo-migration.test.ts` covers the pure planning/decision logic (28 tests): media-URL rewriting, extension detection/fallback, ordered storage-path construction, skip-if-admin-curated / skip-if-no-images / skip-if-already-fully-migrated, resume-with-only-missing-paths, `buildFinalImagesJson`'s order-preserving merge of existing + newly-uploaded paths (including when some still fail), URL dedup, and the photography_status patch rules (done-on-pending, done-on-null, never-overrides-done-or-na).

- [x] **Run the migration for real against production**
  - **Description:** First production attempt surfaced a real bug: uploads intermittently failed with a bare `upload failed: fetch failed`, leaving some vehicles with no `images_json` written at all. Root-caused across two fixes (PRs #75, #76):
    1. None of the download/upload/DB-update steps were retried, and a retried upload could legitimately come back `"the resource already exists"` (a prior attempt's write can succeed server-side even when its response errors client-side) — this was being counted as a fresh failure. Added retries with backoff to all three steps, treated "already exists" as success, and made partial migrations resumable (a vehicle with some-but-not-all images already uploaded picks up only what's missing on the next run — see `planVehiclePhotoMigration`'s `resume` action and `buildFinalImagesJson`).
    2. Once error messages were improved to surface the underlying cause instead of just "fetch failed", the real culprit showed up: `ERR_SSL_ALERT_BAD_RECORD_MAC` / `ERR_HTTP2_INVALID_SESSION` — Node-core HTTP/2 stack error codes, not rate limiting and not anything about the files (confirmed directly: ordinary sub-500KB JPEGs). This is a known class of bug where Node's `fetch` (undici) misbehaves over HTTP/2 connection reuse under concurrent requests to the same host. Fixed by forcing plain HTTP/1.1 for every request the script makes (WP downloads and the Supabase client) via `undici`'s own `fetch` + `new Agent({ allowH2: false })`.
  - **Validation:** After the HTTP/1.1 fix, a full production run completed with **zero errors**: 31 vehicles newly migrated (310 images uploaded) plus 6 already fully migrated from an earlier partial run — all 37 WP candidates with a DMS-matching VIN accounted for. Separately confirmed with the user that none of the 31 needed `photography_status` flipped to `done` because they were already `done` (or, where legitimately `na`, correctly left untouched per the user's confirmation that `na` is a deliberate staff exclusion, not an import artifact) — not a bug, working as designed.
  - **Test:** N/A for the production run itself (one-time, not repeatable in CI); see the automated test coverage listed above, which covers the resume/retry/final-order logic exercised by this run.

- [ ] **Confirm no public page references `media.alfursanauto.ca` after cutover**
  - **Description:** Final grep sweep (`grep -rn "media.alfursanauto.ca\|alfursanauto.ca/wp-json" src/`) after Part 8's rewiring is done.
  - **Validation:** Zero matches outside of this migration doc/scripts.
  - **Test:** N/A — grep-based check, run in CI or manually before decommission.

---

## 8. Part 5 — Public page rewiring

**Status: implemented — homepage, search, sold, and the individual listing page all read from the DMS now. See `src/lib/public-vehicles.ts`, `src/lib/public-vehicle-view.ts`.**

- [x] **`GET /api/vehicles` becomes the public inventory source** — the pages don't self-fetch this endpoint over HTTP (avoids an extra network hop from SSR that already has direct DB access); instead `src/lib/public-vehicles.ts` runs the same query server-side (`fetchPublicVehicles`, `fetchRecentlySoldVehicles`, `fetchPublicVehicleByVin`), reusing `PUBLIC_COLUMNS`/`isPubliclyVisible`/`soldVisibilityCutoff` from `src/lib/vehicles.ts` so the visibility rule has one source of truth either way. The endpoint itself gained a `?sold=true` param so the public "Recently Sold" page has something to query — `status`/`sale_date` are never in the response body, so there was no other way to ask for just that slice.
- [x] **`search/index.astro`** — now calls `fetchPublicVehicles()` and maps each row through `toDisplayVehicle()` (`src/lib/public-vehicle-view.ts`). `InventoryFilters.tsx` was refactored to consume the DMS shape (`DisplayVehicle`) directly instead of going through a `CarSummary`-shaped translation layer, per this doc's own preference.
- [x] **`listing/[slug].astro` → `listing/[vin].astro`** — VIN-based routing via `fetchPublicVehicleByVin(vin)`; a non-visible/nonexistent VIN redirects to `/404` exactly like the old slug lookup did. Old WP slugs 301 to their VIN via a static lookup table (`src/data/wp-listing-redirects.json`, the real slug→VIN mapping captured during Part 2's production migration run) merged into `astro.config.mjs`'s existing static `redirects` map — a slug not covered by the table just 404s, same as any other unknown path.
- [x] **`sold/index.astro`** — becomes "Recently Sold," calling `fetchRecentlySoldVehicles()` (the new `?sold=true` API query) instead of WP's `offerType === "sold"`.
- [x] **`index.astro` (homepage)** — featured-vehicles section now calls `fetchPublicVehicles()`.
- [x] **`InventoryFilters.tsx` / `PopularMakes.tsx`** — both consume `DisplayVehicle` (`drive_type`→`driveType`, etc., all display-labeled via `public-vehicle-view.ts`'s label helpers) instead of `CarSummary` from `wordpress.ts`. The "Sold" badge and sold-cars-sort-to-bottom logic were removed entirely — Part 3's decision was that `status` is never exposed to the public site at all, so there's nothing to badge. The body-type filter now offers all 8 `BODY_TYPES` (was hardcoded to WP's original 4) and the removed `condition` filter is gone (Decision 1 — used cars only, no condition field exists anymore).
- [x] **Financing form / "Apply for Financing" links** — the query param the listing/search pages pass changed from `?slug=` to `?vin=` (matching the new routing), but `FinancingForm.tsx` still stores it in the existing `listingSlug` field/DB column unchanged — the admin application view's link (`/listing/${app.listing_slug}/`) still resolves correctly either way, since the route pattern is identical and only the value's meaning changed from slug to VIN. Actually auto-filling the applicant's own "Vehicle VIN" field from this remains tracked separately in `DMS_PHASE2_PLAN.md` Sprint 3, not duplicated here.

Each of the above:
- **Validation:** Manually verified against a local Supabase stack with real migrated vehicle data (including real photos from Part 4) via the dev server: homepage featured cards, search results (20 results, all filters including the new 8-way body-type dropdown), sold page (7 recently-sold results), an individual listing page (real title/price/16 real images/attributes with no Condition row/plain-text description with paragraph breaks preserved), a 301 redirect from a real old WP slug to its VIN URL, a redirect-to-404 for a nonexistent VIN, and confirmed `GET /api/vehicles?sold=true` never includes `status` in its response body. No remaining `import ... from "../../lib/wordpress"` in any of the touched files.
- **Test:** `src/__tests__/public-vehicle-view.test.ts` (new), `src/__tests__/astro-config-listing-redirects.test.ts` (new), `api-vehicles.test.ts` extended for `?sold=true`, `inventory-sort.test.ts`/`inventory-filters.test.ts` rewritten for the `DisplayVehicle` shape and the removed sold-sorting behavior, `e2e/public-listing-and-blog.spec.ts` updated for VIN-shaped listing URLs.

---

## 9. Part 6 — Static content: About Us & Contact Us

**Status: implemented — see PR `worktree-wp-migration-part6-static-pages` (Part 6).**

- [x] **Rebuild `/about-us` as a native static Astro page**
  - **Description:** `src/pages/about-us/index.astro` already hardcoded its intro/CEO copy in an earlier pass, but still called the live `getFaqPageContent()` WP endpoint for its on-page FAQ preview, with a try/catch fallback to a hardcoded copy of the same 11 items. Fetched the live WordPress `about-us` and `faq` pages via the REST API to diff word-for-word against the hardcoded copy: content matched except several straight `'` apostrophes that WordPress renders as curly `'` (`&#8217;`). Removed the `getFaqPageContent` import/call and the fetch-state/error-banner logic entirely — the page now always renders the local `faqLeft`/`faqRight` arrays, corrected to match WordPress's exact typography. `getAboutPageContent` was already dead code (never imported anywhere) and has been deleted from `wordpress.ts`.
  - **Validation:** Page renders identically to the live WordPress page (content diffed via the WP REST API — see PR description) with zero runtime dependency on WordPress. `npm run build` produces `/about-us/index.html` with no network call.
  - **Test:** `npm run build`/`npm run astro:check`/`npm test` pass. Manual diff against `https://media.alfursanauto.ca/wp-json/wp/v2/pages?slug=about-us` and `?slug=faq` content confirmed exact text match.

- [x] **Rebuild `/contact-us` as a native static Astro page**
  - **Description:** Added `src/lib/contact-info.ts` as the single source of truth for address, phone (display + digits-only `tel:` href), email, map URL, and social links. Fetched the live WordPress `contact-us` page via the REST API and confirmed the existing hardcoded fallback values (address, phone, email, map URL, Facebook/Instagram links) were already byte-for-byte correct — they were just previously discarded whenever the live WP fetch succeeded, since `getContactPageContent()`'s raw `tel:` extraction returned an unformatted digit string that would silently override the nicely formatted fallback. `getContactPageContent`, `extractContactModel`, `ContactModel`, and the now-unused `extractFirstMatch` helper were deleted from `wordpress.ts`.
  - **Validation:** All contact details render correctly and match the live published WordPress values (confirmed via REST API fetch, not just visual inspection). `tel:` href now uses the digits-only number while the visible text stays human-formatted.
  - **Test:** `src/__tests__/contact-info.test.ts` (new) locks in the exact address/phone/email/social-link values as a regression guard. `npm run build`/`npm run astro:check`/`npm test` pass.

---

## 10. Part 7 — Decommission blog, team, FAQ

**Status: done.**

- [x] **Delete blog routes** — `src/pages/blog/index.astro`, `src/pages/blog/[slug].astro`, and `getPosts`/`getPostBySlug`/`BlogPost` from `wordpress.ts`.
  - **Validation:** `npm run build` passes with no dangling references. No nav/footer links to `/blog` existed (confirmed via grep before deleting).
  - **Test:** Confirmed no other page imported `getPosts`/`getPostBySlug` before deleting. Removed the corresponding `getPosts` describe block from `src/__tests__/wordpress.test.ts`.
- [x] **Delete Team page** — `getTeamPageContent`/`TeamPageContent` and any page using them.
  - **Description:** No Team page was ever built (`src/pages` has no `team`/`our-team` route) — `getTeamPageContent`/`TeamPageContent` were unused dead code from the start. Deleted both from `wordpress.ts`.
  - **Validation/Test:** Confirmed via grep that nothing imported these two exports before deleting.
- [x] **Delete FAQ page** — `getFaqPageContent`/`FaqPageContent`/`extractFaqItems` and `src/pages/faq/index.astro`.
  - **Description:** `/about-us/` has its own independent, already-static FAQ preview (`faqLeft`/`faqRight` local arrays, added in Part 6) that does not call `wordpress.ts` — deleting the standalone FAQ page does not affect it. That preview's "Learn more" CTA (which linked to `/faq/`) was removed since there's no longer a fuller list to link out to.
  - **Validation/Test:** `npm run build`/`npm test` pass with the page and exports removed. Removed the "FAQ page" describe block from `e2e/public-pages.spec.ts`.
- [x] **Quick backlink sanity check before deleting** (open item from Decision 6, resolved)
  - **Description:** `astro.config.mjs` and `public/_redirects` both already had specific legacy 301s for two individual blog post slugs and several category/tag URLs pointing at `/blog/` — concrete evidence that these particular old paths had real inbound links worth preserving, even though the destination is being deleted. Applied the "if real inbound links exist, add simple 301s to `/`" branch of this open item: changed every legacy blog-post/category/tag redirect target, plus `/meet-the-team/` (which chained to `/our-team/`, a page that was never built), to redirect straight to `/` instead of to a now-nonexistent page.
  - **Validation:** Redirect targets extracted into an exported `LEGACY_HOME_REDIRECTS` object in `astro.config.mjs` (same pattern as `LISTING_REDIRECTS`) so they're directly testable.
  - **Test:** `src/__tests__/astro-config-legacy-home-redirects.test.ts` — asserts every legacy path redirects to `/` and none point at `/blog/` or `/our-team/`.

---

## 11. Part 8 — Full `wordpress.ts` removal & cache invalidation

**Status: done.**

- [x] **Delete `src/lib/wordpress.ts` and `src/__tests__/wordpress.test.ts`**
  - **Description:** Confirmed nothing imported `getCars`/`getCarBySlug`/`CarSummary`/`formatPrice`/`clearWordpressCache` (Part 5 had already replaced every caller) before deleting both files. A few comments elsewhere (`wordpress-migration.ts`, `wordpress-photo-migration.ts`, `public-vehicles.ts`, `public-vehicle-view.ts`) that referenced `src/lib/wordpress.ts` by path were updated so they don't point at a deleted file. The `PUBLIC_WP_API_BASE` env var references in `scripts/migrate-wordpress-inventory.mjs`/`scripts/migrate-wordpress-photos.mjs` are untouched — those are the standalone one-time migration scripts (Parts 2/4), which stay in the repo as historical tooling and are not part of this deletion.
  - **Validation:** `grep -rn "wordpress" src/ --include="*.astro" --include="*.ts" --include="*.tsx"` now only matches the migration scripts' own support files (`wordpress-migration.ts`, `wordpress-photo-migration.ts`) and historical "WordPress migration Part N" comments — no reference to the deleted `wordpress.ts` module itself. `npm run build` passes.
  - **Test:** Full `npm run build` + `npm test` pass with the file removed.

- [x] **Resolve ISR cache staleness for public inventory pages**
  - **Description:** Chose option (a): added `/` (home), `/search`, `/listing`, and `/sold` to `ISR_EXCLUDE` in `astro.config.mjs` — all four are already SSR'd (`prerender = false`) against the live DMS `vehicles` table (Part 5), so excluding them from Vercel's edge cache and relying on `GET /api/vehicles`'s own `Cache-Control: public, max-age=300, stale-while-revalidate=60` bounds staleness to 5 minutes instead of 3 hours. (`/sold` wasn't named explicitly in this item's original description, but it's the "Recently Sold" page referenced in the Completion criteria and has the exact same staleness exposure, so it's included for consistency.)
  - **Validation:** All four routes now match `ISR_EXCLUDE`; unrelated static paths (`/administrator-guide/`, near-miss prefixes like `/searching-tips/`, `/soldier-discount/`) do not.
  - **Test:** `src/__tests__/astro-config-isr-exclude.test.ts` extended with a `publicInventoryPaths` table covering `/`, `/search`, `/search/`, `/listing/{vin}/`, `/sold`, `/sold/`, plus a negative test for near-miss prefixes.

- [x] **Migrate remaining decorative asset URLs off `media.alfursanauto.ca`**
  - **Description:** Downloaded all 11 hardcoded decorative images (site logo x2, hero background, hero mascot, UCDA member badge, CEO photo, two About Us banner images, three homepage feature icons) from the live `media.alfursanauto.ca` and committed them to `public/brand/`, served same-origin. Updated every reference in `Layout.astro` (header/footer logo, hero background preload, default OG image), `index.astro` (hero mascot/background, UCDA badge, feature icons, `AutoDealer` JSON-LD `logo`/`image`), and `about-us/index.astro` (CEO photo, two banner backgrounds) to the local `/brand/...` path (absolute `https://alfursanauto.ca/brand/...` for the two JSON-LD fields, which require an absolute URL). Also removed `media.alfursanauto.ca` from the CORS-style origin allowlist in `src/pages/api/finance.ts`/`finance/phase2.ts`/`finance/upload-url.ts` — that subdomain never served the site's own pages (it was WordPress's media-only subdomain), so it was never a legitimate request origin; leaving it allow-listed after WordPress goes offline would just be dead surface area.
  - **Validation:** `grep -rn "media.alfursanauto.ca\|alfursanauto.ca/wp-json" src/` now returns matches only inside `wordpress-photo-migration.ts`/its test (the standalone one-time Part 4 photo-migration script, which legitimately still fetches from WordPress and stays in the repo as historical tooling). `npm run build` succeeds and confirmed all 11 files land in `dist/client/brand/`.
  - **Test:** No new test needed — this is a static-asset/URL swap, not new logic. Existing `npm run build`/`npm test` cover regressions.

---

## 12. Completion criteria

- [x] `npm run build` passes with zero TypeScript errors
- [x] `npm run test` passes with zero test failures
- [x] Vehicle data on the public site (`/`, `/search`, `/listing/{vin}`, "Recently Sold") reads entirely from the DMS (Part 5) — no vehicle-data requests to `alfursanauto.ca`/`media.alfursanauto.ca`
- [x] Public site has zero remaining references to `media.alfursanauto.ca`/`alfursanauto.ca/wp-json` — decorative assets re-hosted at `public/brand/`, origin allowlist entry removed (see Part 8's asset-migration item above)
- [x] Sold vehicles remain visible for exactly 30 days post-`sale_date`, then disappear (rule implemented in Part 3, now end-to-end reachable via the public "Recently Sold" page and general listings as of Part 5)
- [x] All historical vehicle photos migrated into the `vehicle-images` Supabase bucket
- [x] About Us and Contact Us are static native Astro content
- [x] Blog, Team, FAQ routes removed
- [x] `src/lib/wordpress.ts` deleted
- [x] ISR/cache staleness for public inventory pages resolved
- [x] `CHANGELOG.md` updated under `[Unreleased]`
