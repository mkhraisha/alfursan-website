# Financing Implementation Checklist

Use this file as the source of truth for financing work across sessions.
Whenever a task is completed, mark it `[x]` here in the same change set.

## Completed Setup

- [x] Retire migration planning docs and switch repo focus to financing work.
- [x] Finalize financing architecture plan in `docs/financing-architecture.md`.

## Platform And Configuration

- [ ] Update `astro.config.mjs` to `output: "hybrid"` and set `site` to `https://alfursanauto.ca`.
- [ ] Update `.env.example` with all financing-related variables and clear public/server-only usage notes.
- [ ] Add `docs/privacy-policy.md` for the financing consent flow.

## Supabase Foundation

- [ ] Create the Supabase project and provision the `applications`, `application_audit`, and `admin_users` schema.
- [ ] Configure the private `license-documents` storage bucket.
- [ ] Insert the initial `owner` record into `admin_users`.
- [ ] Add cleanup for abandoned `license-documents/tmp/` uploads older than 24 hours.

## Shared Server Utilities

- [ ] Create `src/lib/supabase-browser.ts`.
- [ ] Create `src/lib/supabase-admin.ts`.
- [ ] Create `src/lib/crypto.ts` for SIN encryption/decryption with key versioning.
- [ ] Create `src/lib/rate-limit.ts` using Upstash.
- [ ] Create `src/lib/permissions.ts` with the RBAC permission map.
- [ ] Create `src/middleware.ts` for admin auth and role attachment.

## Financing Applicant Flow

- [ ] Build `src/pages/financing/index.astro`.
- [ ] Implement draft handling for non-SIN fields only.
- [ ] Implement `src/pages/api/financing/upload-url.ts` for staged license uploads.
- [ ] Implement `src/pages/api/financing.ts` for validation, encryption, persistence, file finalization, and dealer notification.
- [ ] Validate listing-prefill behavior when entering financing from a vehicle detail page.

## Admin Dashboard

- [ ] Build `src/pages/admin/index.astro` for magic-link sign-in.
- [ ] Build `src/pages/admin/dashboard/index.astro`.
- [ ] Build `src/pages/admin/applications/index.astro`.
- [ ] Build `src/pages/admin/applications/[id].astro` with audit logging for SIN and license access.
- [ ] Build `src/pages/admin/users/index.astro`.

## Notifications And Security

- [ ] Wire Resend notification emails with no PII in the payload.
- [ ] Enforce Origin/Referer validation and rate limiting on financing submission routes.
- [ ] Verify privileged Supabase access stays server-only.

## QA And Launch Readiness

- [ ] Test the full financing submission flow end to end.
- [ ] Test admin authentication, authorization, and role restrictions.
- [ ] Test license upload, finalization, signed access, and abandoned-upload cleanup.
- [ ] Verify audit-log retention after application deletion.
- [ ] Verify production env vars and deployment settings in Vercel.
