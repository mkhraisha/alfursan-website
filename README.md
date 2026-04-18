# Alfursan Auto — Website

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

Run `docs/schema.sql` in the Supabase SQL editor, then seed your admin user:

```sql
INSERT INTO admin_users (id, email, role)
SELECT id, email, 'owner'
FROM auth.users
WHERE email = 'you@example.com';
```

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

## Commands

| Command | Action |
|---|---|
| `npm run dev` | Start dev server at localhost:4321 |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npx astro check` | TypeScript type-check all .astro files |

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
