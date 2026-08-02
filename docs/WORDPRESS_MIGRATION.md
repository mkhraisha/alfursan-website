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

- [ ] **One-time import script: WP `cars` → `vehicles`**
  - **Description:** Script (Node, run manually, not part of the app) that fetches all WP `cars` posts + taxonomy terms (reusing the mapping logic already in `wordpress.ts`), maps each field to the new schema (Part 4's table), and inserts/upserts into the local/staging `vehicles` table by VIN. Vehicles with a missing/invalid VIN (WP data isn't always clean) are reported and skipped, not silently dropped.
  - **Validation:** Row counts reconcile — every WP car with a valid 17-character VIN produces exactly one `vehicles` row. Skipped rows are logged with a reason.
  - **Test:** Run against the local Supabase stack (never production — see CLAUDE.md database migration safety rules) with a sample export; verify a handful of known cars migrate with correct field values.

- [ ] **Map `vehicleType`/taxonomy terms → new enum values**
  - **Description:** WP's free-text taxonomy terms (e.g. drive type "All Wheel Drive") need a translation table to the new constrained enum values (`awd`, etc.). Build this mapping as part of the import script; log any WP term that doesn't map to a known enum value instead of failing the row.
  - **Validation:** No unmapped terms silently become `NULL` without being logged.
  - **Test:** Dry-run the script against production WP data (read-only fetch, not a DB write) and review the unmapped-terms log before doing the real import.

- [ ] **Reconciliation report**
  - **Description:** After import, produce a simple report: total WP cars, total migrated, total skipped (with reasons), and a diff of any VINs that exist in both WP and the DMS already (collision — decide manually whether WP or DMS data wins per vehicle).
  - **Validation:** Report reviewed and signed off before cutover.
  - **Test:** N/A (manual review step).

---

## 6. Part 3 — Public visibility rules (status & "sold" window)

- [ ] **Define `isPubliclyVisible(vehicle)` helper**
  - **Description:** Add to `src/lib/vehicles.ts`. Proposed rule (confirm before implementing, since it encodes new business logic):
    - Visible as **active listing** if `photography_status = 'done'` AND `status @> ARRAY['frontline_ready']` AND `status` does not contain any of `sold`, `in_deal`, `pending_delivery`, `pending_pickup`, `bodyshop`, `mechanic_ssc`, `mechanic_repairs`, `detailing_shop`, `on_lot_work_needed`, `openlane_arbitration`, `sale_cancelled_by_arbitration`, `openlane_auction`.
    - Visible as **recently sold** (read-only, no financing CTA, "Sold" badge) if `status @> ARRAY['sold']` AND `sale_date >= CURRENT_DATE - INTERVAL '30 days'`.
    - Otherwise not publicly visible.
  - **Validation:** Unit tests cover: frontline-ready+done photos → visible; sold 10 days ago → visible as sold; sold 40 days ago → not visible; `in_deal` → not visible; `photography_status = 'pending'` → not visible.
  - **Test:** `src/__tests__/vehicles.test.ts` — table-driven test over the status/date combinations above.

- [ ] **Apply the rule in `GET /api/vehicles` (unauthenticated branch)**
  - **Description:** `src/pages/api/vehicles/index.ts` currently returns *every* vehicle to unauthenticated callers regardless of status — that's a gap even before this migration. Add the `isPubliclyVisible` filter to the unauthenticated query path.
  - **Validation:** Unauthenticated request never returns a vehicle mid-deal, in the shop, or sold >30 days ago. Sold-within-30-days vehicles are still returned (with `status`/`sale_date` present so the UI can render the "Sold" badge — these two fields need to move from `PUBLIC_COLUMNS`-excluded to included, since they're needed to render sold state, but stay screened by the filter above).
  - **Test:** Integration test seeding vehicles in each status and asserting the unauthenticated response set matches expectations.

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
