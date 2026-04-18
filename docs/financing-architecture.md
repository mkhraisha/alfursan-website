# Financing Application Form — Architecture Plan

## Problem

Build a secure financing application form that collects PII (including SIN) from customers, stores it safely, and lets the dealer review submissions in a private dashboard. No third party should have access to customer data.

---

## Architecture Decision Records

**ADR-001: Static output mode (Astro v5 hybrid behaviour)**
Use `output: 'static'`. In Astro v5, `hybrid` was removed — `static` is now the hybrid mode: pages are pre-rendered by default; API routes and admin pages opt into SSR with `export const prerender = false`. Static pages stay static; only `/api/*` and `/admin/*` routes opt into SSR. Preserves performance of all 40 existing pages, reduces Vercel function costs.

**ADR-002: No SIN collection**
SIN is not collected by this form. It can be added in a future phase if required by a lender partner, at which point application-layer AES-256-GCM encryption should be introduced (encrypt before insert; DB only ever sees ciphertext).

**ADR-003: No draft persistence for sensitive fields**
All non-sensitive form fields may use `sessionStorage` for draft recovery between steps.

**ADR-004: Presigned URL upload for driver's license — never relay files through Vercel**
Vercel serverless functions cap request body at 4.5 MB. Phone camera license photos are 3–10 MB per side. The API route issues a presigned PUT URL from Supabase Storage; the client uploads directly to storage (bypassing Vercel entirely). The API route never handles file bytes — only validates intent, issues the URL, and records the resulting storage path in the DB.

**ADR-005: Staged upload lifecycle for license documents**
Driver's license images are uploaded to a private Supabase Storage bucket (`license-documents`) under a temporary `tmp/{draftId}/...` prefix first. On successful form submission, the server finalizes them under `applications/{applicationId}/...`; abandoned uploads are deleted by a scheduled cleanup job after 24 hours. This prevents orphaned files when users drop off mid-flow.

**ADR-006: RBAC with `admin_users` allowlist table — required for DMS expansion**
Replace the single-email magic link gate with a Supabase `admin_users` table (email, role, is_active). Supabase Auth handles identity (magic link); `admin_users` handles authorization. Middleware looks up the authenticated user's email in `admin_users`, checks `is_active`, and attaches `role` to `Astro.locals`. Every admin page checks one permission using `can(locals.role, 'permission:action')`. Rationale: adding a second user without this requires a code change and redeploy; retrofitting RBAC after financing is live requires a production DB migration against real applicant data.

**ADR-007: Permission map defined in `src/lib/permissions.ts`**
A single source-of-truth permission matrix maps permission keys to allowed roles. Roles: `owner | manager | staff`. Adding a new DMS module (vehicles, leads, settings) only requires: (1) add permission keys to the map, (2) add one `can()` check at the top of each new route. No middleware changes needed for future modules.

**ADR-008: Supabase-native server access model**
Use Supabase the way its platform features expect: browser auth uses the anon key; server-side routes, signed Storage URLs, and privileged admin reads use a server-only admin client. The service-role credential is allowed only in server routes/modules and is never exposed to the browser, serialized into HTML, or imported by shared client code.

**ADR-009: DMS route namespace — build incrementally within `/admin/`**
Phase 1: `/admin/` (home), `/admin/applications/`, `/admin/users/`. Future phases add `/admin/vehicles/`, `/admin/leads/`, `/admin/settings/` without restructuring. Each module is self-contained: its own pages, permission keys, and query layer.

**ADR-010: Vehicle data migration path — plan now, build in Phase 2**
Public site currently reads inventory from WordPress API (`src/lib/wordpress.ts`). When vehicle management is added to the DMS, a `vehicles` Supabase table will be created matching the current data shape. A `src/lib/inventory.ts` abstraction will be introduced as the single data-source interface for public pages. Swapping from WordPress to Supabase only changes `inventory.ts` — no public page changes. The WordPress API remains read-only until Phase 2 is complete and validated.

---

## Hosting Decision

### Short term: Vercel _(recommended to start)_

- **Free tier** — zero cost to start
- Zero setup — deploys automatically from GitHub (same as current workflow)
- Native Astro SSR support via `@astrojs/vercel` adapter
- Serverless API routes handle all form processing server-side
- Auto-provisioned HTTPS on your custom domain
- **Current repo alignment**: the Vercel adapter is already installed and the old GitHub Pages base-path work is already gone. The pending config changes are switching `output` from `static` to `hybrid` and aligning `astro.config.mjs` `site` with the production domain used by layout canonicals (`https://alfursanauto.ca`).

---

## Architecture Overview

```
Customer Browser
    │
    │  HTTPS POST /api/financing
    │  (with Origin/Referer validation + rate limit check)
    ▼
Astro API Route  ──────────────────────────────────────────────
    │  1. Validate all fields with Zod schema                  │
    │  2. Encrypt SIN with AES-256-GCM                         │
    │     (encryption key lives in env var, never in code)     │
    │  3. INSERT encrypted record into Supabase                │
    │  4. Send "New application received" email via Resend     │
    │     (email contains NO PII — reference ID only)          │
    └──────────────────────────────────────────────────────────
              │                          │
              ▼                          ▼
        Supabase DB                   Resend
    (encrypted at rest)          (notification only)
              │
              │  (admin reads — SIN decrypted server-side)
              ▼
Admin Dashboard /admin/applications
    - Magic link login + `admin_users` allowlist
    - List all applications with status
    - Click to view full details
    - SIN decrypted on-demand, never sent to browser in bulk
```

---

## Components to Build

### 1. Infrastructure Setup

| Service       | Purpose                            | Cost                          |
| ------------- | ---------------------------------- | ----------------------------- |
| Vercel        | Hosting + serverless functions     | Free                          |
| Supabase      | Postgres database + Auth + Storage | Free (500MB DB + 1GB Storage) |
| Resend        | Dealer notification emails         | Free (3,000/mo)               |
| Upstash Redis | Rate limiting                      | Free (10,000 req/day)         |

Required environment variables (never committed to git):

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=      # write-only from API route
SUPABASE_ANON_KEY=         # for admin auth flow
SIN_ENCRYPTION_KEY=        # 32-byte random hex — generated once, stored only in Vercel env
RESEND_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

---

### 2. Financing Form — `/financing/`

Multi-step form (4 steps, progress indicator at top):

**Step 1 — Personal Information**

- Full legal name
- Date of birth
- Current address + postal code
- Time at current address
- Phone number
- Email address
- Marital status
- Old address (if < 2 years at current)

**Step 2 — Employment**

- Employment status (Full-time / Part-time / Self-employed / Other)
- Employer name
- Job title
- Gross annual income
- Time at current employer
- Previous employer + time there (if < 2 years at current)

**Step 3 — Vehicle & Loan Details**

- Vehicle year / make / model (pre-filled if coming from a listing page)
- Purchase price
- Down payment amount
- Preferred loan term (24 / 36 / 48 / 60 / 72 / 84 months)
- VIN
- Driver's License — Front _(optional — image/jpeg, image/png, image/heic, application/pdf, max 8 MB)_
- Driver's License — Back _(optional — same file constraints)_

> Files upload directly to Supabase Storage via presigned PUT URL — never pass through the Vercel function (see ADR-004). Client-side preview shown after selection.
> Upload flow: `/api/financing/upload-url` issues signed PUT URLs under `tmp/{draftId}/...`; final submission promotes approved files to `applications/{applicationId}/...`; a scheduled cleanup deletes abandoned `tmp/` uploads older than 24 hours.

**Step 4 — Consent & Authorization**

- ☐ I confirm the information provided is accurate
- ☐ I have read and accept the [Privacy Policy]
- ☐ I authorize Alfursan Auto to collect and retain a copy of my driver's license for identity verification and regulatory audit purposes _(shown only if license was uploaded)_
- Submit button

---

### 3. API Route — `src/pages/api/financing.ts`

Server-side only. Add `export const prerender = false` at the top. Runs on Vercel, never exposed to the browser.

```
POST /api/financing
  ├── Validate Origin header matches site domain (CSRF protection)
  ├── Check rate limit (5 submissions / IP / hour via Upstash)
  ├── Validate all fields with Zod (types, formats, required)
  ├── INSERT into Supabase `applications` table (server-only admin client)
  ├── Finalize any staged license uploads into `applications/{applicationId}/...`
  ├── Send Resend email to dealer: "New application REF-[UUID] received at [timestamp]"
  │   (NO name, NO PII — reference number only)
  └── Return { success: true } or structured error
```

**CSRF protection**: Validate `Origin` / `Referer` header server-side + `SameSite=Strict` on admin session cookie. No hidden token fields needed — stateless and works with multi-step React forms.

**What is NOT in server logs:**

- Full name
- Date of birth
- Any financial data

---

### 4. Database Schema — Supabase

#### `applications` table

```sql
CREATE TABLE applications (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at      TIMESTAMPTZ DEFAULT now(),
  status          TEXT DEFAULT 'new',  -- new | reviewing | approved | declined

  -- Personal
  full_name       TEXT NOT NULL,
  dob             DATE NOT NULL,
  address         TEXT,
  postal_code     TEXT,
  time_at_address TEXT,
  phone           TEXT,
  email           TEXT NOT NULL,

  -- Employment
  employment_status TEXT,
  employer          TEXT,
  job_title         TEXT,
  annual_income     NUMERIC,
  time_at_employer  TEXT,

  -- Vehicle & Loan
  vehicle_year    TEXT,
  vehicle_make    TEXT,
  vehicle_model   TEXT,
  vehicle_price   NUMERIC,
  down_payment    NUMERIC,
  loan_term_months INT,
  listing_slug    TEXT,  -- link back to the listing if applicable
  vin             TEXT,

  -- Identity Documents (stored in Supabase Storage private bucket, paths only)
  license_front_path  TEXT,   -- e.g. "licenses/{uuid}/front.jpg" — NULL if not uploaded
  license_back_path   TEXT,   -- e.g. "licenses/{uuid}/back.jpg"  — NULL if not uploaded
  license_uploaded_at TIMESTAMPTZ,  -- timestamp of upload, NULL if not uploaded
  license_consent     BOOLEAN DEFAULT false,  -- explicit consent for license collection

  -- Compliance / Audit
  consent_timestamp TIMESTAMPTZ NOT NULL,
  ip_hash           TEXT  -- SHA-256 hashed, not stored raw
);
```

#### `application_audit` table — required for PIPEDA

Records every admin action on sensitive data. Required to demonstrate compliance on request.

```sql
CREATE TABLE application_audit (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
  application_ref TEXT NOT NULL, -- stable application UUID captured at write time
  action         TEXT NOT NULL,  -- 'viewed_license' | 'status_changed' | 'deleted' | 'exported'
  admin_email    TEXT NOT NULL,
  ip_hash        TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

The admin detail page writes a row to `application_audit` every time it decrypts a SIN server-side, and every time it generates a signed URL for a license image. Audit rows must survive application deletion.

#### Supabase access model

Use two distinct clients:

- `src/lib/supabase-browser.ts` — anon client for browser login/session flows only
- `src/lib/supabase-admin.ts` — server-only admin client for form inserts, Storage signed URLs, admin SSR reads, and audit writes

> ⚠️ `SUPABASE_SERVICE_KEY` is a privileged secret. It is allowed only in server-only modules, API routes, and middleware. It must never be imported into client bundles, rendered into page props, or exposed in public env vars.

**Row Level Security and authorization:**

- Enable RLS on both tables as a secondary layer
- Browser-facing auth/session flows use the anon key and standard Supabase Auth
- Server-only routes verify the authenticated user and then enforce `admin_users` + permission checks in application code before using the admin client
- Storage bucket remains private; all reads use short-lived signed URLs issued server-side

---

### 5. Admin Dashboard — `/admin/`

Protected by Supabase Auth (magic link) + `admin_users` allowlist table (see ADR-006). Any email not in `admin_users` is rejected even if Supabase Auth issues them a token.

#### Route map (Phase 1 — build now)

| Page               | Path                        | Permission                  | What it shows                         |
| ------------------ | --------------------------- | --------------------------- | ------------------------------------- |
| Login              | `/admin/`                   | public                      | Send magic link form                  |
| Dashboard home     | `/admin/dashboard/`         | any role                    | Stats overview (new apps count, etc.) |
| Applications list  | `/admin/applications/`      | `financing:read`            | Name, date, vehicle, status badge     |
| Application detail | `/admin/applications/[id]/` | `financing:read`            | All fields; SIN decrypted on demand   |
| User management    | `/admin/users/`             | `users:manage` (owner only) | List/add/deactivate authorized users  |

#### Route map (future phases — namespace reserved, not built)

| Phase | Path               | Module                                       |
| ----- | ------------------ | -------------------------------------------- |
| 2     | `/admin/vehicles/` | Inventory management (CRUD for car listings) |
| 3     | `/admin/leads/`    | CRM / lead tracking                          |
| 4     | `/admin/settings/` | Site config, business hours, pricing rules   |

#### Role definitions

| Role      | Who                     | Can do                                               |
| --------- | ----------------------- | ---------------------------------------------------- |
| `owner`   | Dealer principal        | Everything — all modules, user management, deletions |
| `manager` | Finance/sales manager   | Read + write all data modules; cannot manage users   |
| `staff`   | Reception / floor staff | Read-only access to assigned modules                 |

Status workflow: `new` → `reviewing` → `approved` / `declined`

#### `admin_users` table

```sql
CREATE TABLE admin_users (
  id         UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  role       TEXT NOT NULL DEFAULT 'staff'  CHECK (role IN ('owner', 'manager', 'staff')),
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: browser-authenticated reads can be allowed selectively if needed later;
-- for Phase 1, server code remains the enforcement point for role checks.
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
```

---

## Security Summary

| Threat                                 | Mitigation                                                                                                                       |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Spam / bot submissions                 | Rate limiting (5/IP/hour) + Origin header validation + Zod validation                                                            |
| CSRF attacks on form submission        | Origin/Referer header check server-side + `SameSite=Strict` on admin cookie                                                      |
| Unauthorized dashboard access          | `admin_users` allowlist + RBAC roles — magic link alone is not sufficient; email must exist in allowlist with `is_active = true` |
| Over-privileged DB access              | Privileged Supabase key stays server-only; browser uses anon key; all admin actions require `admin_users` + permission checks    |
| Data in transit intercepted            | HTTPS everywhere (Vercel enforces)                                                                                               |
| Malicious input / SQL injection        | Zod validation + Supabase parameterized queries                                                                                  |
| Third party reading submissions        | No FormSubmit or similar — data goes directly to your DB                                                                         |
| No record of who accessed data         | `application_audit` table — logs every license view, status change, delete                                                       |
| DB outage from project pause           | Supabase keep-alive cron (daily ping) or Pro tier when live                                                                      |

---

## PIPEDA Compliance (Canadian Privacy Law)

- ☑ Explicit consent checkboxes with stated purpose before submission
- ☑ Privacy policy link on form
- ☑ `consent_timestamp` recorded with every application
- ☑ Data used only for stated purpose (financing) — not marketing
- ☑ On deletion request: admin can DELETE row from Supabase while retaining non-PII audit history
- ☑ On access request: admin can export single record
- ☑ Audit log (`application_audit`) tracks every access to applicant data — demonstrable on request
- ☑ IP address stored as SHA-256 hash only — raw IP is considered PII in Canada

---

## Files to Create / Modify

### New files

```
src/pages/financing/index.astro               # Multi-step form (prerender = false)
src/pages/api/financing.ts                    # Server-side POST handler (prerender = false)
src/pages/api/financing/upload-url.ts         # Issues presigned PUT URL for license upload (prerender = false)
src/pages/admin/index.astro                   # Magic link login (prerender = false)
src/pages/admin/dashboard/index.astro         # Dashboard home — stats overview (prerender = false)
src/pages/admin/applications/index.astro      # List view (prerender = false)
src/pages/admin/applications/[id].astro       # Detail view — writes to audit log on license view (prerender = false)
src/pages/admin/users/index.astro             # User management — owner only (prerender = false)
src/lib/supabase-browser.ts                   # Browser anon client for auth/session flows
src/lib/supabase-admin.ts                     # Server-only admin client for privileged Supabase calls
src/lib/rate-limit.ts                         # Upstash rate limiter
src/lib/permissions.ts                        # RBAC permission map + can() helper
src/middleware.ts                             # Auth guard: Supabase session + admin_users allowlist + role attach
.env.example                                  # Documents required env vars
docs/privacy-policy.md                        # Draft privacy policy
```

### Modified files

```
astro.config.mjs    # output: 'static' (Astro v5 hybrid), site URL
package.json        # Dependencies already added; keep Supabase/Resend/Upstash/Zod set
.env.example        # Keep server-only vs public env usage explicit
```

> ⚠️ **Do not use `output: 'server'`** — this would force all 40 existing static pages through serverless functions on every request, eliminating performance benefits and increasing Vercel function costs. Use `output: 'static'` (Astro v5 default, which behaves like the old `hybrid`) and add `export const prerender = false` only to API routes and admin pages.

---

## Deployment Steps (Vercel)

1. Verify the current dependency set is installed (`@astrojs/vercel`, Supabase, Resend, Upstash, Zod are already present in the repo).
2. Update `astro.config.mjs`: change `output` to `hybrid` and set `site` to `https://alfursanauto.ca`.
3. Create Supabase project → run schema SQL (`applications`, `application_audit`, `admin_users`) → configure private `license-documents` bucket → insert first owner row into `admin_users`.
4. Create Resend account → verify `alfursanauto.ca` domain.
5. Create Upstash Redis database.
6. Add all env vars to Vercel dashboard (including `SIN_ENCRYPTION_KEY` — generate with `openssl rand -hex 32`).
7. Add a scheduled cleanup job for `license-documents/tmp/` objects older than 24 hours.
8. Connect Vercel to GitHub repo → auto-deploy on push.
9. Point `alfursanauto.ca` DNS to Vercel.

---

## Migration to Hostinger VPS (when ready)

1. `npm uninstall @astrojs/vercel && npm install @astrojs/node`
2. Change adapter in `astro.config.mjs`: `adapter: node({ mode: 'standalone' })`
3. Run `npm run build` → upload `dist/` to VPS
4. Start with PM2: `pm2 start dist/server/entry.mjs`
5. Set up Nginx as reverse proxy
6. Copy env vars from Vercel to VPS `.env`
7. No changes to application code needed
