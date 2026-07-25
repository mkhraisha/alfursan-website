# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Search by VIN on the public search page (matches the `vehica_6671` WordPress custom field, exposed as `CarSummary.vin`).
- Video previews in the admin vehicle Media tab — existing uploaded videos now render as playable `<video>` elements instead of a bare text label.
- `gas` expense category on vehicle expenses, alongside repair/detailing/parts/other.
- `lead_source` field on vehicles — mappable in the vehicle CSV importer and editable on the Purchase tab.
- CSV bulk import for vehicle expenses (`/admin/inventory/import-expenses`) — each row is matched to an existing vehicle by VIN; unmatched VINs are reported and skipped.
- `reimbursed` checkbox on vehicle expense line items, toggleable from the Expenses tab.
- `admin` expense category, alongside repair/cleaning/parts/gas/other.
- `vendor` and `expense_date` fields on vehicle expenses — mappable in the expense CSV importer and editable on the per-vehicle Expenses tab.
- General (non-vehicle) expenses — expense CSV rows with no VIN now import as standalone records instead of being rejected, for admin/business costs that don't relate to a specific car.
- "All Expenses" page (`/admin/inventory/expenses`) — a searchable, filterable list of every expense (vehicle-linked and general) with a reimbursed toggle and running total.

### Changed

- Redesigned the search page for mobile: the filter bar collapses into a 2-column grid, and inventory results switch from horizontal rows to stacked cards with a full-width image.
- Moved the Carfax link field from the admin vehicle Media tab to the Basics tab, alongside the rest of the vehicle's identifying details.
- Renamed the `detailing` expense category to `cleaning` (existing expense rows were migrated).
- The vehicle CSV importer now auto-maps a generic "Advertised Price" column to the CarGurus price field, and a "Notes" column to Internal Notes, by default.
- Vehicle expense amounts can now be negative, to record refunds/credits/adjustments that reduce total cost (previously only positive amounts were allowed).
- The expense CSV importer's "Car" column mapping now extracts the VIN from a combined "VIN (Year Make Model)" cell instead of requiring a bare VIN.
- Admin finance application view: replaced the raw storage-path fallback (shown when a signed document URL fails to generate) with a plain retry message, and surfaced the Phase 2 token/expiry in the Activity tab so it stays visible after the application status changes.

### Changed

- Updated dependencies to their latest compatible versions within the current major: astro 6.3.1 → 6.4.8 (fixes high-severity XSS/SSRF advisories), @supabase/supabase-js, resend, playwright, react/react-dom, @types/react, @sentry/astro, @astrojs/sitemap, vitest, @vitest/coverage-v8. Left `astro`, `@astrojs/react`, `@astrojs/vercel`, and `typescript` major versions untouched (6→7, 5→6, 10→11, 6→7 respectively) — those are coupled breaking changes that need a dedicated migration pass.
- Migrated the coupled Astro major versions: `astro` 6.4.8 → 7.1.3, `@astrojs/react` 5.0.4 → 6.0.1, `@astrojs/vercel` 10.0.6 → 11.0.3. No config or code changes were required — the Vercel ISR adapter config, `client:load` hydration directives, and middleware all continued to work unchanged. Removed the now-unused `uuid` entry from `package.json` `overrides` (no longer a transitive dependency of the updated adapter stack). `typescript` stays on 6 for now — that migration is deferred to a separate pass.
- Updated the remaining outdated dependencies to latest: @fontsource-variable/mulish, @fontsource/bebas-neue, @sentry/astro, @supabase/supabase-js, playwright (+ reinstalled browser binaries), react/react-dom, resend. `typescript` was left on 6.0.3 — `@astrojs/check` (the project's type-checking tool) still only supports `typescript ^5 || ^6`, and Astro 7.1.3 itself still pins `typescript ^6.0.3` in its own tooling, so a TS 7 bump isn't viable yet at the ecosystem level.

### Fixed

- Fixed the "Listing" link on the admin finance application view, which pointed at the non-existent `/listings/` route instead of `/listing/`.
- Fixed the homepage auto-scrolling ~2000px down on every load: the Popular Makes tab strip called `scrollIntoView` on mount instead of only on user-driven tab changes.
- Fixed the financing application form's two-column field rows (Full Legal Name / Date of Birth, Phone / Email, etc.) never collapsing to one column on mobile, which truncated placeholder text and cramped inputs on narrow screens.
- Fixed magic-link admin sign-in bouncing back to the login page: `/admin/**` responses (page renders and the middleware's own redirects) had no explicit `Cache-Control` header, so Vercel's edge could heuristically cache an anonymous login-redirect (e.g. from the daily smoke test hitting production unauthenticated) and serve it back to a freshly-authenticated user. The middleware now sets `Cache-Control: no-store` on every `/admin/**` response.
- Fixed admin sessions intermittently bouncing to `/admin/?error=invalid_token` on later-visited pages (most noticeably Garage Register and Users): the `sb-token-exp` cookie was accidentally marked `HttpOnly` on token refresh (in `middleware.ts` and `refresh-session.ts`), contradicting its intentional non-`HttpOnly` design in the initial login cookie writer. This silently broke the client-side proactive-refresh timer after the very first refresh of a session, letting the access token genuinely expire later on with no safety net beyond a single reactive refresh attempt. `sb-token-exp` is no longer marked `HttpOnly` on rotation.
