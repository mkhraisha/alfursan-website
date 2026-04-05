# Financing Application Form — Architecture Plan

## Problem

Build a secure financing application form that collects PII (including SIN) from customers, stores it safely, and lets the dealer review submissions in a private dashboard. No third party should have access to customer data.

---

## Architecture Decision Records

**ADR-001: Hybrid SSR over full SSR**
Use `output: 'hybrid'`. Static pages stay static; only `/api/*` and `/admin/*` routes opt into SSR with `export const prerender = false`. Preserves performance of all 40 existing pages, reduces Vercel function costs.

**ADR-002: Application-layer encryption over DB-layer**
Encrypt SIN in `src/lib/crypto.ts` before the Supabase insert — not via pgcrypto inside the DB. DB-layer encryption still exposes plaintext to the DB superuser (Supabase staff). Application-layer means the ciphertext is all Supabase ever sees.

**ADR-003: No draft persistence for SIN field**
SIN is never written to `localStorage`, `sessionStorage`, or any storage mechanism until the final server-side submission. All other form fields may use `sessionStorage` for draft recovery between steps. Rationale: PIPEDA minimization principle — collect only when necessary, only for the stated purpose.

---

## Hosting Decision

### Short term: Vercel _(recommended to start)_

- **Free tier** — zero cost to start
- Zero setup — deploys automatically from GitHub (same as current workflow)
- Native Astro SSR support via `@astrojs/vercel` adapter
- Serverless API routes handle all form processing server-side
- Auto-provisioned HTTPS on your custom domain
- **Note**: The `base: '/alfursan-website'` setting in `astro.config.mjs` was added for GitHub Pages and must be removed when deploying to Vercel with a custom domain. All `import.meta.env.BASE_URL` href prefixes in `.astro` and `.tsx` files will need to revert to plain `/` paths.

### Long term: Hostinger VPS _(when you want to consolidate)_

- You're already paying — makes sense once the site is stable
- Install Node.js + PM2 on your VPS, use `@astrojs/node` adapter in standalone mode
- More ops work (you manage the server) but lower ongoing cost long-term
- **Migration is easy**: swap the adapter in `astro.config.mjs`, redeploy — no application code changes needed

---

## Architecture Overview

```
Customer Browser
    │
    │  HTTPS POST /api/financing
    │  (with CSRF token + rate limit check)
    ▼
Astro API Route  ──────────────────────────────────────────────
    │  1. Validate all fields with Zod schema                  │
    │  2. Encrypt SIN with AES-256-GCM                         │
    │     (encryption key lives in env var, never in code)     │
    │  3. INSERT encrypted record into Supabase                 │
    │  4. Send "New application received" email via Resend      │
    │     (email contains NO PII — just applicant name + date) │
    └──────────────────────────────────────────────────────────
              │                          │
              ▼                          ▼
        Supabase DB                   Resend
    (encrypted at rest)          (notification only)
              │
              │  (admin reads — SIN decrypted server-side)
              ▼
Admin Dashboard /admin/applications
    - Magic link login (only your email)
    - List all applications with status
    - Click to view full details
    - SIN decrypted on-demand, never sent to browser in bulk
```

---

## Components to Build

### 1. Infrastructure Setup

| Service | Purpose | Cost |
|---------|---------|------|
| Vercel | Hosting + serverless functions | Free |
| Supabase | Postgres database + Auth | Free (500MB) |
| Resend | Dealer notification emails | Free (3,000/mo) |
| Upstash Redis | Rate limiting | Free (10,000 req/day) |

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
- Social Insurance Number (SIN) ← encrypted immediately on server
- Current address + postal code
- Time at current address
- Phone number
- Email address

**Step 2 — Employment**
- Employment status (Full-time / Part-time / Self-employed / Other)
- Employer name
- Job title
- Gross annual income
- Time at current employer

**Step 3 — Vehicle & Loan Details**
- Vehicle year / make / model (pre-filled if coming from a listing page)
- Purchase price
- Down payment amount
- Preferred loan term (24 / 36 / 48 / 60 / 72 / 84 months)

**Step 4 — Consent & Authorization**
- ☐ I authorize Alfursan Auto to pull my credit report for financing purposes
- ☐ I confirm the information provided is accurate
- ☐ I have read and accept the [Privacy Policy]
- Submit button

---

### 3. API Route — `src/pages/api/financing.ts`

Server-side only. Add `export const prerender = false` at the top. Runs on Vercel, never exposed to the browser.

```
POST /api/financing
  ├── Validate Origin header matches alfursanauto.ca (CSRF protection)
  ├── Check rate limit (5 submissions / IP / hour via Upstash)
  ├── Validate all fields with Zod (types, formats, required)
  ├── Encrypt SIN → "v1:<base64-ciphertext>" (AES-256-GCM, key version prefixed)
  ├── INSERT into Supabase `applications` table (using api_writer role — INSERT only)
  ├── Send Resend email to dealer: "New application REF-[UUID] received at [timestamp]"
  │   (NO name, NO PII — reference number only)
  └── Return { success: true } or structured error
```

**CSRF protection**: Validate `Origin` / `Referer` header server-side + `SameSite=Strict` on admin session cookie. No hidden token fields needed — stateless and works with multi-step React forms.

**What is NOT in server logs:**
- SIN (never logged anywhere)
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

  -- Personal (SIN encrypted with key version prefix, rest plaintext)
  full_name       TEXT NOT NULL,
  dob             DATE NOT NULL,
  sin_encrypted   TEXT NOT NULL,  -- format: "v1:<base64-AES-256-GCM-ciphertext>"
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
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  action         TEXT NOT NULL,  -- 'viewed_sin' | 'status_changed' | 'deleted' | 'exported'
  admin_email    TEXT NOT NULL,
  ip_hash        TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
```

The admin detail page writes a row to `application_audit` every time it decrypts a SIN server-side.

#### Database users — do NOT use service_role in application code

> ⚠️ Supabase's `service_role` key bypasses RLS unconditionally — it is a superuser credential. RLS policies cannot restrict it. Do not use it in API routes or admin pages.

Create restricted Postgres roles instead:

```sql
-- API route: write-only, cannot read any data back
CREATE ROLE api_writer WITH LOGIN PASSWORD '<strong-random-password>';
GRANT INSERT ON applications TO api_writer;

-- Admin dashboard: read applications + update status + write audit log
CREATE ROLE admin_reader WITH LOGIN PASSWORD '<strong-random-password>';
GRANT SELECT ON applications TO admin_reader;
GRANT UPDATE (status) ON applications TO admin_reader;
GRANT INSERT, SELECT ON application_audit TO admin_reader;
```

Use connection strings with these restricted roles in the respective modules:
- `src/lib/supabase.ts` → exports two clients: `dbWriter` (api_writer) and `dbAdmin` (admin_reader)
- `service_role` key is never used in application code

**Row Level Security:**
- Enable RLS on both tables as a secondary layer
- `api_writer` role: INSERT policy on `applications` only
- `admin_reader` role: SELECT/UPDATE policy scoped to authenticated admin session

---

### 5. Admin Dashboard — `/admin/`

Protected by Supabase Auth magic link — only your email address can log in.

| Page | Path | What it shows |
|------|------|---------------|
| Login | `/admin/` | "Send magic link" form |
| Applications list | `/admin/applications/` | Name, date, vehicle, status badge, action button |
| Application detail | `/admin/applications/[id]/` | All fields; SIN decrypted server-side on demand |

Status workflow: `new` → `reviewing` → `approved` / `declined`

---

## Security Summary

| Threat | Mitigation |
|--------|-----------|
| SIN stolen from database breach | AES-256-GCM encryption — ciphertext is useless without the key |
| Encryption key rotation breaks records | Key version prefix `"v1:<ciphertext>"` — rotate gracefully, old keys kept until all records re-encrypted |
| SIN stolen from server logs | Never logged — stripped before any log statement |
| Spam / bot submissions | Rate limiting (5/IP/hour) + Origin header validation + Zod validation |
| CSRF attacks on form submission | Origin/Referer header check server-side + `SameSite=Strict` on admin cookie |
| SIN exposed in browser storage | SIN field never written to `localStorage` or `sessionStorage` — React state only |
| Unauthorized dashboard access | Supabase Auth magic link — only your email |
| Over-privileged DB access | Restricted Postgres roles (`api_writer`, `admin_reader`) — `service_role` never used in app code |
| Data in transit intercepted | HTTPS everywhere (Vercel enforces) |
| Malicious input / SQL injection | Zod validation + Supabase parameterized queries |
| Third party reading submissions | No FormSubmit or similar — data goes directly to your DB |
| No record of who viewed PII | `application_audit` table — logs every SIN decrypt, status change, delete |
| DB outage from project pause | Supabase keep-alive cron (daily ping) or Pro tier when live |

---

## PIPEDA Compliance (Canadian Privacy Law)

- ☑ Explicit consent checkboxes with stated purpose before submission
- ☑ Privacy policy link on form
- ☑ `consent_timestamp` recorded with every application
- ☑ Data used only for stated purpose (financing) — not marketing
- ☑ On deletion request: admin can DELETE row from Supabase (cascades to audit log)
- ☑ On access request: admin can export single record
- ☑ Audit log (`application_audit`) tracks every access to PII — demonstrable on request
- ☑ IP address stored as SHA-256 hash only — raw IP is considered PII in Canada

## Encryption Key Management

`SIN_ENCRYPTION_KEY` is a 32-byte random hex value generated once and stored only in Vercel environment variables (never in code or git).

The ciphertext format includes a version prefix: `"v1:<base64-ciphertext>"`

**Key rotation procedure** (when needed):
1. Add `SIN_ENCRYPTION_KEY_V2` to Vercel env vars
2. Update `crypto.ts` to encrypt new records with `v2`, decrypt old `v1` records with `KEY_V1`
3. Run a one-time migration script to re-encrypt all `v1` rows as `v2`
4. Remove `KEY_V1` from env vars once all rows are migrated

**Backup strategy**: Weekly `pg_dump` of the `applications` table exported to encrypted storage (Backblaze B2 or S3). Upgrade to Supabase Pro ($25/mo) in production for automatic daily backups.

---

## Files to Create / Modify

### New files
```
src/pages/financing/index.astro          # Multi-step form (prerender = false)
src/pages/api/financing.ts               # Server-side API route (prerender = false)
src/pages/admin/index.astro              # Magic link login (prerender = false)
src/pages/admin/applications/index.astro # List view (prerender = false)
src/pages/admin/applications/[id].astro  # Detail view — writes to audit log on SIN decrypt (prerender = false)
src/lib/supabase.ts                      # Two DB clients: dbWriter (api_writer role), dbAdmin (admin_reader role)
src/lib/crypto.ts                        # AES-256-GCM encrypt/decrypt with key version prefix
src/lib/rate-limit.ts                    # Upstash rate limiter
src/middleware.ts                        # Auth guard for /admin/* routes
.env.example                             # Documents required env vars
docs/privacy-policy.md                   # Draft privacy policy
```

### Modified files
```
astro.config.mjs    # Add @astrojs/vercel adapter, set output: 'hybrid' (NOT 'server' — keeps all existing pages static)
package.json        # Add @astrojs/vercel, @supabase/supabase-js, resend, zod, @upstash/ratelimit, @upstash/redis
```

> ⚠️ **Do not use `output: 'server'`** — this would force all 40 existing static pages through serverless functions on every request, eliminating performance benefits and increasing Vercel function costs. Use `output: 'hybrid'` and add `export const prerender = false` only to API routes and admin pages.

---

## Deployment Steps (Vercel)

1. `npm install @astrojs/vercel @supabase/supabase-js resend zod @upstash/ratelimit @upstash/redis`
2. Update `astro.config.mjs`: add Vercel adapter, set `output: 'hybrid'`, **remove `base: '/alfursan-website'`**
3. Revert all `import.meta.env.BASE_URL` href prefixes in `.astro` and `.tsx` files back to plain `/` paths
4. Create Supabase project → run schema SQL (applications + application_audit) → create `api_writer` and `admin_reader` roles → configure RLS
5. Create Resend account → verify `alfursanauto.ca` domain
6. Create Upstash Redis database
7. Add all env vars to Vercel dashboard (including `SIN_ENCRYPTION_KEY` — generate with `openssl rand -hex 32`)
8. Connect Vercel to GitHub repo → auto-deploy on push
9. Point `alfursanauto.ca` DNS to Vercel

---

## Migration to Hostinger VPS (when ready)

1. `npm uninstall @astrojs/vercel && npm install @astrojs/node`
2. Change adapter in `astro.config.mjs`: `adapter: node({ mode: 'standalone' })`
3. Run `npm run build` → upload `dist/` to VPS
4. Start with PM2: `pm2 start dist/server/entry.mjs`
5. Set up Nginx as reverse proxy
6. Copy env vars from Vercel to VPS `.env`
7. No changes to application code needed
