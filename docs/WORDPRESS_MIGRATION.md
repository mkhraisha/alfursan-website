# WordPress Migration Plan

**Status:** Not Started
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

**Status: implemented — see PR `feat/wp-migration-part3-visibility`.**

**Rule, as clarified by the user (corrected from this doc's original draft — no "Sold" badge, status is never exposed):** a vehicle is publicly visible if photography is done, and it is not a sale older than 30 days. Every *other* status (`in_deal`, `bodyshop`, `pending_delivery`, no status set at all, etc.) shows on the website exactly like any other listing — the actual `status` value is purely a server-side filtering input and is never returned to the frontend, not even for sold vehicles (no "Sold" badge, no distinguishing marker). The public API only ever returns car specifications and what's needed to populate a listing.

- [x] **Define `isPubliclyVisible(vehicle)` + `soldVisibilityCutoff(now)` helpers**
  - **Description:** Added to `src/lib/vehicles.ts`:
    - Not visible if `photography_status !== 'done'`.
    - Visible if `status !== 'sold'` (this covers every non-sold status, and a `NULL` status too — nothing else is checked).
    - If `status === 'sold'`: visible only if `sale_date` is set AND `sale_date >= soldVisibilityCutoff(now)` (30 days before `now`); a sold vehicle with no `sale_date` on record is treated as not-recent (hidden), since recency can't be established.
  - **Validation:** Unit tests cover: every non-sold status (including `NULL`) + done photos → visible; sold 10/30 days ago → visible; sold 31/40 days ago → not visible; sold with no `sale_date` → not visible; `photography_status` pending/na → not visible regardless of status.
  - **Test:** `src/__tests__/vehicles-lib.test.ts` — table-driven, 17 cases.

- [x] **Apply the rule in `GET /api/vehicles` (list, unauthenticated branch)**
  - **Description:** `src/pages/api/vehicles/index.ts` previously returned *every* vehicle to unauthenticated callers regardless of status — a gap even before this migration. Now applies `.eq("photography_status", "done").or(\`status.is.null,status.neq.sold,sale_date.gte.${soldVisibilityCutoff()}\`)` as a DB-level filter (mirrors `isPubliclyVisible`, but expressed as SQL so pagination/count stay correct). `status.is.null` is listed explicitly because SQL's `<>` doesn't match `NULL` the way JS's `!==` does. `PUBLIC_COLUMNS` still excludes `status`/`photography_status`/`sale_date` entirely — they're filtered on, never selected.
  - **Validation:** Confirmed the exact `.eq`/`.or` calls via mocked query-builder assertions, and that the filter is skipped entirely for authenticated requests (staff always sees everything, unaffected by this rule).
  - **Test:** `src/__tests__/api-vehicles.test.ts`.

- [x] **Apply the same rule in `GET /api/vehicles/:vin` (single vehicle, unauthenticated branch) — gap found and fixed**
  - **Description:** This endpoint had **no visibility filter at all** — any vehicle was fetchable by VIN regardless of status/photography, bypassing the list endpoint's filtering entirely. Fixed: the unauthenticated query now also selects `status, photography_status, sale_date` (in addition to `PUBLIC_COLUMNS`) purely to evaluate `isPubliclyVisible()` in-process; if not visible, returns 404 (same as an unknown VIN, so visibility state isn't leaked by a 403-vs-404 distinction either); if visible, the three internal fields are stripped from the response object before it's returned.
  - **Validation:** Confirmed the response body never contains `status`/`photography_status`/`sale_date` for an unauthenticated request, and that 404 vs. 200 matches every case from the unit tests above (photography pending → 404 regardless of status; `in_deal`+done → 200; sold 10 days ago → 200; sold 40 days ago or with no `sale_date` → 404).
  - **Test:** `src/__tests__/api-vehicles.test.ts`.

---

## 7. Part 4 — Photo/asset migration

- [ ] **One-time image migration: WP media → `vehicle-images` bucket**
  - **Description:** For every migrated vehicle, download each `vehica_6673` image URL (already resolved to `media.alfursanauto.ca` via `toMediaUrl`) and upload it into the Supabase `vehicle-images` bucket (same path convention as `upload-url.ts` uses: `{vin}/{filename}.{ext}`), then set `images_json` to the resulting storage paths in VIN order (first image = featured, matching the existing admin convention).
  - **Validation:** Every migrated vehicle's `images_json` resolves to a working public URL via `buildStorageUrl(supabaseUrl, "vehicle-images", path)`— same helper the admin Media tab already uses. Zero remaining references to `media.alfursanauto.ca` in migrated data.
  - **Test:** Spot-check a sample of migrated vehicles' images render correctly on a staging `/listing/{vin}` page before cutover.

- [ ] **Confirm no public page references `media.alfursanauto.ca` after cutover**
  - **Description:** Final grep sweep (`grep -rn "media.alfursanauto.ca\|alfursanauto.ca/wp-json" src/`) after Part 8's rewiring is done.
  - **Validation:** Zero matches outside of this migration doc/scripts.
  - **Test:** N/A — grep-based check, run in CI or manually before decommission.

---

## 8. Part 5 — Public page rewiring

- [ ] **`GET /api/vehicles` becomes the public inventory source** — see Part 3's visibility filter; this endpoint (already unauthenticated-capable) replaces `getCars`/`getCarBySlug`.
- [ ] **`search/index.astro`** — replace `getCars(100)` with a call to the vehicles API/DB, map DMS fields to what `InventoryFilters.tsx` expects (or refactor the component to accept the DMS shape directly — preferred, avoids a translation layer).
- [ ] **`listing/[slug].astro` → `listing/[vin].astro`** — VIN-based routing. Add a redirect: since old WP slugs have no derivable VIN, keep a static slug→VIN lookup table generated during Part 2's migration (WP `slug` is known at import time) so old inbound links 301 to the new VIN URL instead of 404ing.
- [ ] **`sold/index.astro`** — becomes "Recently Sold," querying vehicles matching Part 3's "recently sold" branch (30-day window) instead of WP's `offerType === "sold"`.
- [ ] **`index.astro` (homepage)** — replace `getCars(100)` featured-vehicles section with the DMS query.
- [ ] **`InventoryFilters.tsx` / `PopularMakes.tsx`** — update to consume the DMS vehicle shape (`drive_type`, `transmission`, `fuel_type`, `features`, etc. from Part 4) instead of `CarSummary` from `wordpress.ts`.
- [ ] **Financing form / "Apply for Financing" links** — already tracked in `DMS_PHASE2_PLAN.md` Sprint 3; VIN-based listing URLs from this migration are a prerequisite, not duplicated here.

Each of the above:
- **Validation:** Page renders correctly from DMS data in local dev with seeded vehicles; no remaining `import ... from "../../lib/wordpress"` for inventory-related exports.
- **Test:** Extend/adjust existing Playwright e2e coverage (`test: add e2e coverage for the public conversion path` already covers listing/finance flows) to run against DMS-seeded data instead of live WordPress.

---

## 9. Part 6 — Static content: About Us & Contact Us

- [ ] **Rebuild `/about-us` as a native static Astro page**
  - **Description:** Pull the current published content from WP (`getAboutPageContent()` / `about-us` slug) one last time, and hardcode it directly into `src/pages/about-us/index.astro` (plain markup/content, no fetch). Remove the `getAboutPageContent` WP call.
  - **Validation:** Page renders identically (or intentionally updated copy, if desired) with zero runtime dependency on WordPress.
  - **Test:** `npm run build` passes; manual visual check against the current live page.

- [ ] **Rebuild `/contact-us` as a native static Astro page**
  - **Description:** `getContactPageContent()` currently regex-scrapes address/phone/email/map/social links out of WP's rendered HTML (`extractContactModel`) — replace with a small hardcoded config object (address, phone, email, map URL, social links) directly in the page or a `src/lib/contact-info.ts` constants file. Remove the WP call and the regex-extraction logic entirely.
  - **Validation:** All contact details (address, phone, email, map link, social links) render correctly and match current published values.
  - **Test:** `npm run build` passes; manual check that `tel:`/`mailto:` links and the map link are correct.

---

## 10. Part 7 — Decommission blog, team, FAQ

- [ ] **Delete blog routes** — `src/pages/blog/index.astro`, `src/pages/blog/[slug].astro`, and `getPosts`/`getPostBySlug`/`BlogPost` from `wordpress.ts`.
  - **Validation:** `npm run build` passes with no dangling references. Any nav/footer links to `/blog` are removed.
  - **Test:** Confirm no other page imports `getPosts`/`getPostBySlug` (`grep -rn "getPosts\|getPostBySlug" src/`) before deleting.
- [ ] **Delete Team page** — `getTeamPageContent`/`TeamPageContent` and any page using them.
  - **Validation/Test:** Same pattern as above.
- [ ] **Delete FAQ page** — `getFaqPageContent`/`FaqPageContent`/`extractFaqItems` and `src/pages/faq/index.astro`.
  - **Validation/Test:** Same pattern as above.
- [ ] **Quick backlink sanity check before deleting** (open item from Decision 6)
  - **Description:** Check Search Console / analytics (or just accept the risk, given confirmed low/no usage) for meaningful inbound traffic to `/blog/*`, `/faq/*`, team pages before removing them outright. If real inbound links exist, add simple 301s to `/` instead of letting them 404.
  - **Validation:** Decision recorded (redirect or plain removal) before merging.
  - **Test:** N/A — manual review.

---

## 11. Part 8 — Full `wordpress.ts` removal & cache invalidation

- [ ] **Delete `src/lib/wordpress.ts` and `src/__tests__/wordpress.test.ts`**
  - **Description:** Once Parts 5–7 are complete, nothing should import from `wordpress.ts`. Delete the file, its test, the `PUBLIC_WP_API_BASE` env var references, and the WordpressBuild-resilience-specific CHANGELOG context (historical — leave CHANGELOG entries as-is, just stop needing the code).
  - **Validation:** `grep -rn "wordpress" src/ --include="*.astro" --include="*.ts" --include="*.tsx"` returns nothing outside of this doc and `CHANGELOG.md`. `npm run build` passes.
  - **Test:** Full `npm run build` + `npm test` pass with the file removed.

- [ ] **Resolve ISR cache staleness for public inventory pages**
  - **Description:** `astro.config.mjs`'s `ISR_EXCLUDE` currently only excludes `/api/**` and `/admin/**` — `/search`, `/listing/**`, and `/` are still subject to Vercel's 3-hour edge cache. Once these pages read live DMS data (vehicle sold, new photos, price change), that staleness becomes directly customer-visible. Pick one: (a) add `/search`, `/listing`, `/` to `ISR_EXCLUDE` and rely on `GET /api/vehicles`'s own `Cache-Control: public, max-age=300` instead, or (b) trigger on-demand revalidation from the vehicle PATCH/POST handlers.
  - **Validation:** A vehicle status/price change in the admin is reflected on the public site within an acceptable window (≤5 min, matching the API's existing cache header, if option (a) is chosen).
  - **Test:** `src/__tests__/astro-config-isr-exclude.test.ts` extended to cover the new exclusions (if option (a)).

---

## 12. Completion criteria

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run test` passes with zero test failures
- [ ] Public site (`/`, `/search`, `/listing/{vin}`, "Recently Sold") reads entirely from the DMS — zero requests to `alfursanauto.ca`/`media.alfursanauto.ca`
- [ ] Sold vehicles remain visible for exactly 30 days post-`sale_date`, then disappear
- [ ] All historical vehicle photos migrated into the `vehicle-images` Supabase bucket
- [ ] About Us and Contact Us are static native Astro content
- [ ] Blog, Team, FAQ routes removed
- [ ] `src/lib/wordpress.ts` deleted
- [ ] ISR/cache staleness for public inventory pages resolved
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
