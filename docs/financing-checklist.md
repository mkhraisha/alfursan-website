# Financing Implementation Checklist

Use this file as the source of truth for financing work across sessions.
Whenever a task is completed, mark it `[x]` here in the same change set.

## Completed Setup

- [x] Retire migration planning docs and switch repo focus to financing work.
- [x] Finalize financing architecture plan in `docs/financing-architecture.md`.
- [x] Ignore local Vercel output and dev-server logs in git.

## Platform And Configuration

- [x] Update `astro.config.mjs` to `output: "static"` (Astro v5 — `hybrid` was removed; `static` now behaves identically). Site URL kept as `https://alfursan-website.vercel.app` until domain cutover.
- [x] Update `.env.example` with all financing-related variables; annotate which are public (`PUBLIC_`) vs server-only, and add `RESEND_FROM_ADDRESS` and `RESEND_DEALER_EMAIL`.
- [x] Add `docs/privacy-policy.md` for the financing consent flow.
- [x] Create `docs/schema.sql` with the full `applications`, `application_audit`, and `admin_users` DDL so the DB can be reprovisioned without reading the architecture doc.

## Supabase Foundation

- [ ] Create the Supabase project and run `docs/schema.sql` to provision all tables.
- [ ] Configure the private `license-documents` storage bucket with no public access.
- [ ] Insert the initial `owner` record into `admin_users`.
- [ ] Set up abandoned-upload cleanup: Supabase scheduled Edge Function (or pg_cron) that deletes `license-documents/tmp/` objects older than 24 hours.

## Shared Server Utilities

- [x] Create `src/lib/supabase-browser.ts` (anon key, browser auth/session flows only).
- [x] Create `src/lib/supabase-admin.ts` (service key, server-only; never imported by client code).
- ~~`src/lib/crypto.ts`~~ — not needed; SIN is not collected.
- [x] Create `src/lib/rate-limit.ts` using Upstash (5 submissions / IP / hour on financing routes).
- [x] Create `src/lib/permissions.ts` with the `owner | manager | staff` RBAC map and `can()` helper.
- [x] Create `src/middleware.ts`: validate Supabase session → look up email in `admin_users` → check `is_active` → attach `role` to `Astro.locals`; reject any request that fails.

## API Contracts

Document these before building; update if they change.

**POST `/api/financing`** — submit completed application
- Request: JSON body matching the Zod schema (all 4 steps merged); `draftId` string for staged uploads.
- Success: `{ success: true, applicationId: string }`
- Validation error: `{ success: false, errors: Record<string, string> }` (HTTP 422)
- Rate-limited: `{ success: false, error: "rate_limit" }` (HTTP 429)

**POST `/api/financing/upload-url`** — get presigned PUT URL for license image
- Request: `{ draftId: string, side: "front" | "back", contentType: string, fileSize: number }`
- Success: `{ uploadUrl: string, storagePath: string }` (client PUTs file directly to storage)
- Error: `{ error: string }` (HTTP 400 if file type/size invalid)

## Financing Applicant Flow

Form is a static Astro page with a **React island** (`client:load`) handling the multi-step UI and draft state in `sessionStorage`. API routes opt in to SSR via `export const prerender = false`.

- [x] Build `src/pages/financing/index.astro` (shell + React island mount).
- [x] Build `src/components/FinancingForm.tsx` — 4-step React form (Personal → Employment → Vehicle/Loan → Review & Submit).
- [x] Implement draft recovery from `sessionStorage` on mount; URL params prefill vehicle/loan fields.
- [x] Implement `src/pages/api/financing/upload-url.ts` — issues presigned PUT URL, validates file type/size.
- [x] Implement `src/pages/api/financing.ts` — CSRF + rate-limit + Zod → insert → finalize uploads → Resend email → return `applicationId`.
- [x] Fix `@astrojs/vercel` adapter: downgraded from v10 (requires Astro 6) to v9.0.5 (requires Astro 5).
- [x] Wire listing-page CTA to `/financing/?slug={slug}&year={year}&make={make}&model={model}&price={price}` so Step 3 pre-fills.
- [x] Wire search-results "Calculate financing" link to `/financing/` with same URL params (no longer goes to listing page).

## Admin Dashboard

- [x] Build `src/pages/admin/index.astro` — magic-link sign-in form.
- [x] Build `src/layouts/AdminLayout.astro` — shared layout with role-aware nav.
- [x] Build `src/pages/admin/callback/index.astro` — exchange token → set cookie → redirect.
- [x] Build `src/pages/admin/signout/index.astro` — clear cookie + sign out.
- [x] Build `src/pages/admin/dashboard/index.astro` — stats: new/reviewing/approved/declined counts + recent 5 applications.
- [x] Build `src/pages/admin/applications/index.astro` — paginated list with status badges and filter tabs.
- [x] Build `src/pages/admin/applications/[id].astro` — full detail; write `viewed_license` audit row when generating signed license URL.
- [x] Add status-change action on detail page (`new → reviewing → approved | declined`); write `status_changed` audit row.
- [x] Add delete action (owner only); write `deleted` audit row; verify audit row survives DELETE via `ON DELETE SET NULL`.
- [x] Add single-record export (owner/manager) via `GET /api/admin/export-application?id=`; write `exported` audit row.
- [x] Build `src/pages/admin/users/index.astro` — list, add, deactivate admin users (owner only).

## Notifications And Security

- [x] Wire Resend: send `"New application REF-{uuid} received"` to `RESEND_DEALER_EMAIL` from `RESEND_FROM_ADDRESS`; no PII in subject or body.
- [x] Enforce `Origin`/`Referer` header validation on `/api/financing` and `/api/financing/upload-url`.
- [x] Apply Upstash rate limiter to both API routes.
- [x] Audit that `SUPABASE_SERVICE_ROLE_KEY` is never imported by any client-side file — only in `src/middleware.ts` and `src/lib/supabase-admin.ts`; confirmed absent from `dist/client/` bundles.
- [x] Add signed-URL generation for license image views in admin detail; write `viewed_license` audit row.

## QA Acceptance Criteria

Each item below must pass before launch.

**Financing form**
- [ ] Submitting with all required fields creates a row in `applications`.
- [ ] Uploading a license creates files under `tmp/{draftId}/`; successful submit moves them to `applications/{id}/`.
- [ ] Abandoned draft files under `tmp/` are deleted within 24 hours by the cleanup job.
- [ ] Arriving from a listing page pre-fills year/make/model/price in Step 3.
- [ ] Submitting 6 times from the same IP within an hour returns HTTP 429 on the 6th.

**Admin dashboard**
- [ ] Magic-link sign-in with a non-`admin_users` email is rejected (no dashboard access).
- [ ] Deactivated admin user is rejected even with a valid Supabase session.
- [ ] `staff` role cannot access `/admin/users/`.
- [ ] Viewing license image writes a `viewed_license` row to `application_audit`.
- [ ] Deleting an application removes the `applications` row but the `application_audit` rows survive.

**Operational**
- [ ] All env vars are set in Vercel production dashboard before first deploy.
- [ ] `SUPABASE_SERVICE_KEY` does not appear in any client bundle (verify with `npm run build` + bundle inspection).
