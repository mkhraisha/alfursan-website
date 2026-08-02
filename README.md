# Alfursan Auto — Website

[![CI](https://github.com/mkhraisha/alfursan-website/actions/workflows/ci.yml/badge.svg)](https://github.com/mkhraisha/alfursan-website/actions/workflows/ci.yml)
[![E2E report](https://img.shields.io/badge/e2e_report-latest-blue)](https://mkhraisha.github.io/alfursan-website/)

Toronto used car dealership website built with Astro v5, Supabase, Resend, and Upstash. Features public inventory browsing, a multi-step financing application form, and a private admin dashboard for the dealer.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Astro v5 (static + per-route SSR) |
| Database / Auth / Storage | Supabase |
| Email | Resend |
| Rate limiting | Upstash Redis (optional) |
| Deployment | Vercel |
| CMS / Inventory | WordPress REST API |

## Features

- **Inventory** — car listings from a WordPress backend with filtering by make, model, price, year
- **Financing form** — 4-step application with license photo uploads, draft auto-save, PIPEDA-compliant
- **Loan calculator** — interactive monthly payment estimator
- **Admin dashboard** — magic-link sign-in, applications list, status management, license viewer, audit log, JSON export, user management

## Project Structure

```
src/
├── components/
│   ├── FinancingForm.tsx       # Multi-step financing form (React island)
│   ├── InventoryFilters.tsx    # Search/filter bar (React island)
│   ├── LoanCalculator.tsx      # Payment calculator (React island)
│   └── PopularMakes.tsx        # Tabbed make carousel (React island)
├── layouts/
│   ├── Layout.astro            # Public site layout
│   └── AdminLayout.astro       # Admin dashboard layout
├── lib/
│   ├── financing-schema.ts     # Zod validation schema
│   ├── permissions.ts          # Admin role/permission definitions
│   ├── rate-limit.ts           # Upstash rate limiter (graceful fallback)
│   ├── supabase-admin.ts       # Server-only client (secret key)
│   ├── supabase-browser.ts     # Publishable client (auth flows)
│   ├── theme.ts                # CSS design tokens
│   └── wordpress.ts            # WordPress REST API helpers
├── pages/
│   ├── admin/                  # Private dashboard (SSR, auth-gated)
│   │   ├── index.astro         # Magic-link sign-in
│   │   ├── callback/           # Token exchange after magic-link click
│   │   ├── signout/            # Sign-out handler
│   │   ├── dashboard/          # Dashboard home
│   │   ├── applications/       # Applications list + detail
│   │   └── users/              # User management (owner only)
│   ├── api/
│   │   ├── financing.ts        # POST — submit application
│   │   ├── financing/upload-url.ts  # POST — signed upload URL
│   │   └── admin/export-application.ts  # GET — JSON export
│   ├── financing/              # Public financing form
│   ├── listing/[slug].astro    # Car listing detail
│   ├── search/                 # Inventory search
│   └── ...                     # About, blog, contact, FAQ
├── middleware.ts               # Auth guard for /admin/*
docs/
├── schema.sql                  # Supabase DDL + RLS + pg_cron jobs
├── financing-checklist.md      # Implementation checklist
└── privacy-policy.md           # PIPEDA-compliant privacy policy
```

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Same page → Publishable key |
| `SUPABASE_SECRET_KEY` | Same page → Secret key (click reveal) |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_FROM_ADDRESS` | A sender address on a verified Resend domain |
| `RESEND_DEALER_EMAIL` | Inbox that receives new application alerts |
| `UPSTASH_REDIS_REST_URL` | upstash.com → Redis → REST API (optional) |
| `UPSTASH_REDIS_REST_TOKEN` | Same page — use the read/write token (optional) |

### 3. Provision the database

All schema is managed via Supabase CLI migrations. See [Database Migrations](#database-migrations) below.

### 4. Configure Supabase Auth

Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://alfursanauto.ca`
- **Redirect URLs**: add both `http://localhost:4321/admin/callback/` and `https://alfursanauto.ca/admin/callback/`

### 5. Run

```bash
npm run dev
```

- Site: http://localhost:4321
- Admin: http://localhost:4321/admin/

### 6. Signing in locally (magic link + passkeys)

The local Supabase stack (`supabase start`) never sends real email — every magic-link email is captured by the local mail-testing tool instead of being delivered to your inbox:

- After clicking "Send Magic Link" on `/admin/`, open **http://127.0.0.1:54324** (or run `supabase status` and use the `MAILPIT_URL` value) and open the latest "Your sign-in link" message. Click the link inside it to complete sign-in.
- Passkey sign-in (`/admin/` → "Sign in with a passkey", or registering one from `/admin/account/`) needs WebAuthn enabled on the local GoTrue server — already configured in `supabase/config.toml` (`[auth.passkey]` + `[auth.webauthn]`). If you edit that file, restart the stack for the change to take effect: `supabase stop && supabase start`.
- No real authenticator hardware needed to test passkeys: Chrome DevTools → More tools → WebAuthn → "Enable virtual authenticator environment" simulates one. On macOS, Touch ID via Chrome/Safari also works directly.

## Commands

| Command | Action |
|---|---|
| `npm run dev` | Start dev server at localhost:4321 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npx astro check` | TypeScript type-check all .astro files |
| `npm run db:new -- <name>` | Create a new migration file |
| `npm run db:reset` | Re-apply all migrations to local DB |
| `npm run db:status` | Show applied vs pending migrations |
| `npm run db:push` | Push pending migrations to production (**run yourself**) |

## Testing

| Command | Action |
|---|---|
| `npm test` | Run unit tests (Vitest, `src/__tests__/`) |
| `npm run test:e2e` | Run Playwright e2e tests (`e2e/`) against a local dev server |
| `npm run test:e2e:ui` | Open the Playwright UI runner |
| `npm run test:e2e:report` | Open the last local HTML report |

**CI** (`.github/workflows/ci.yml`) runs on every pull request and push to `main`: it spins up a real local Supabase stack (`supabase start` + `supabase db reset` — schema-only, no production data involved), seeds manager/sales test users, builds, runs unit tests, then runs the full Playwright suite (including the RBAC/CRUD suite in `e2e/vehicles-api.spec.ts`) against a local dev server. No secrets to configure — the test users and their JWTs are minted fresh against the ephemeral local stack every run and thrown away with it.

The latest HTML report from `main` is published at **[mkhraisha.github.io/alfursan-website](https://mkhraisha.github.io/alfursan-website/)** — every run also uploads the report as a downloadable workflow artifact (Actions tab → run → Artifacts) for PR branches.

To run the full e2e suite locally, including RBAC/CRUD:

```bash
supabase start
supabase db reset
export SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=...  # from `supabase status -o env`
node scripts/e2e-seed-test-users.mjs   # prints E2E_SERVICE_TOKEN / E2E_MANAGER_TOKEN / E2E_SALES_TOKEN
export E2E_SERVICE_TOKEN=... E2E_MANAGER_TOKEN=... E2E_SALES_TOKEN=...       # from the seed script's output
npm run test:e2e
```

## Database Migrations

Schema is managed with the [Supabase CLI](https://supabase.com/docs/guides/cli). All migration files live in `supabase/migrations/`.

### Add a new migration

```bash
npm run db:new -- add_my_feature
# → creates supabase/migrations/TIMESTAMP_add_my_feature.sql
# Edit the file, then test locally:
npm run db:reset
```

### First-time setup (new environment)

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Start local Supabase stack (requires Docker Desktop)
supabase start

# Apply all migrations to local DB
npm run db:reset

# Seed your first admin user:
# 1. Go to http://localhost:4321/admin/ and sign in with your email via
#    magic link (see "Signing in locally" above for where the email lands).
#    Local signups are enabled (auth.enable_signup = true), so this
#    auto-creates the auth.users row on first sign-in.
# 2. Give that user a role by inserting into `user_profiles` (NOT `admin_users`
#    — that table was replaced by `user_profiles` in
#    supabase/migrations/20260517000001_create_user_profiles.sql). Run this SQL
#    in the local Studio (http://localhost:54323 → SQL Editor):
#    INSERT INTO user_profiles (id, email, role)
#    SELECT id, email, 'owner' FROM auth.users WHERE email = 'you@example.com';
#    (valid roles: owner, manager, staff, admin, sales — see the migration
#    above for the full CHECK constraint)
```

### Deploy to production

Production migrations are applied **by a human**, not automated:

```bash
# 1. Link CLI to your Supabase project (one-time)
supabase link --project-ref <YOUR_PROJECT_REF>
# Project ref is in your Supabase dashboard URL

# 2. Review what will be applied
npm run db:status

# 3. Push to production
npm run db:push
```

Alternatively, copy the SQL from `supabase/migrations/` and run it directly in the Supabase SQL Editor.

## Deployment

Deployed on Vercel. Set env vars **manually** in the Vercel dashboard — do not use the Supabase Vercel connector (it injects legacy key names).

| Variable | Sensitive | Environment |
|---|---|---|
| `SUPABASE_URL` | No | Production + Preview |
| `SUPABASE_PUBLISHABLE_KEY` | No | Production + Preview |
| `SUPABASE_SECRET_KEY` | Yes | Production only |
| `RESEND_API_KEY` | Yes | Production only |
| `RESEND_FROM_ADDRESS` | No | Production + Preview |
| `RESEND_DEALER_EMAIL` | No | Production + Preview |
| `UPSTASH_REDIS_REST_URL` | No | Production only (optional) |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Production only (optional) |
