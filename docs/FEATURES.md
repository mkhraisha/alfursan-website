# Alfursan Auto — Feature Inventory

This document lists all user-facing and internal features of the site.
E2E test coverage status is tracked alongside each feature.

---

## Public Website

### Home Page (`/`)
- Hero section with CTA to financing
- Featured inventory grid (pulls from Supabase `vehicles` table)
- Popular makes carousel
- Loan calculator teaser

### Inventory / Listings
- **Search page** (`/search/`) — filter by make, model, year, price
- **Listing detail** (`/listing/[slug]/`) — vehicle photos, specs, Carfax link, "Apply for Financing" CTA
- **Sold inventory** (`/sold/`) — sold vehicles archive

### Financing (`/finance/`)
- Multi-step financing application form
- Phase 2 secure document upload (`/apply/phase2/`) — token-gated URL
- Rate limiting on form submission (Upstash Redis, 20 submissions/hour per IP)
- File upload to Supabase Storage (`vehicle-documents` bucket)

### Loan Calculator (`/loan-calculator/`)
- Client-side amortisation calculator (principal, rate, term)

### Blog (`/blog/`, `/blog/[slug]/`)
- Static blog posts rendered from content collections

### Info Pages
- About Us (`/about-us/`)
- FAQ (`/faq/`)
- Contact Us (`/contact-us/`)
- Privacy Policy (`/privacy-policy/`)

---

## Admin Portal (`/admin/`)

> Single portal for all staff. Requires magic-link auth.
> Accessible to roles: `owner`, `manager`, `staff`, `admin`, `sales`.

### Authentication
- Magic-link login at `/admin/`
- Session set via `/api/admin/set-session` (cookie: `sb-access-token`)
- Sign-out at `/admin/signout/`

### Dashboard (`/admin/dashboard/`)
- Financing application status overview (counts by status)
- Recent applications table

### Applications (`/admin/applications/`)
- Paginated list of financing applications with status badges
- Filter by status (pending / reviewing / approved / rejected)
- Application detail view (`/admin/applications/[id]/`)
- Update application status (`PATCH /api/admin/update-application`)
- Export application as PDF (`GET /api/admin/export-application`)

### Inventory Management (`/admin/inventory/`)
- List all vehicles with live filters (status, make, year)
- Create vehicle (POST `/api/vehicles/`)
- Edit vehicle inline (PATCH `/api/vehicles/[vin]/`)
- Delete vehicle (`admin`/`owner` only) (DELETE `/api/vehicles/[vin]/`)
- CSV bulk import with column mapping + preview (`POST /api/vehicles/import`)
- Per-vehicle computed fields: `expense_total`, `total_cost`, `profit_loss`, `commission`

### Vehicle Expenses & Documents
- Add/view/delete expenses (`/api/vehicles/[vin]/expenses/`)
- Upload/download/delete documents (`/api/vehicles/[vin]/documents/`)

### Commission Management
- Assign commission user to a vehicle (`admin`/`owner` only)
- Commission calculated as: % of profit, $150 floor if profit < 0

### Garage Register (`/admin/garage/`)
- Record garage register entries linked to vehicles

### User Management (`/admin/users/`) — `admin`/`owner` only
- List / invite / update / disable users
- Set commission percentage per user

---

## API Routes

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/vehicles/` | optional | List vehicles; public fields only if unauthenticated |
| POST | `/api/vehicles/` | required | Create vehicle |
| GET | `/api/vehicles/[vin]/` | optional | Get single vehicle |
| PATCH | `/api/vehicles/[vin]/` | required | Update vehicle fields |
| DELETE | `/api/vehicles/[vin]/` | admin only | Delete vehicle |
| POST | `/api/vehicles/import` | required | CSV bulk import |
| POST | `/api/finance` | none | Submit financing application |
| POST | `/api/finance/phase2` | token | Phase 2 document submission |
| POST | `/api/finance/upload-url` | token | Get signed upload URL |
| GET | `/api/admin/export-application` | admin | Export application PDF |
| PATCH | `/api/admin/update-application` | admin | Update application status |
| POST | `/api/admin/set-session` | none | Exchange Supabase token for session cookie |

---

## Role Matrix

| Feature | `owner` | `manager` | `staff` | `admin` | `sales` | Public |
|---------|---------|-----------|---------|---------|---------|--------|
| View public inventory | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View full vehicle data | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Create/edit vehicles | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Delete vehicles | ✓ | ✓ | — | ✓ | — | — |
| CSV import | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| Manage dealer users | ✓ | ✓ | — | ✓ | — | — |
| Assign commission | ✓ | ✓ | — | ✓ | — | — |
| View admin applications | ✓ | ✓ | ✓ | ✓ | — | — |
