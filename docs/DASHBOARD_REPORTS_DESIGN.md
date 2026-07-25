# Dashboard Enhancements & Reporting Suite — Design Document

**Status:** Validated (brainstorming complete, ready for implementation planning)
**Date:** 2026-07-25
**Depends on:** Phase 1 (Inventory Management) — see `docs/DEALER_MANAGEMENT_DESIGN.md`
**Related:** `docs/DEALER_MANAGEMENT_DECISIONS.md`, `docs/DMS_PHASE2_PLAN.md`

---

## 1. Understanding Summary

- The admin dashboard (`/admin/dashboard/`) currently shows only "Units Sold This Month" and "P/L This Month." There's no visibility into how much inventory is currently available/ready to sell.
- The Reports section (`/admin/reports/`) currently has one report: Sales Report (units/revenue/P/L by month). There's no inventory-aging view, no lead-source performance view, no sales-tax (HST) remittance view, and no way to see *true* business profitability (vehicle profit minus overhead).
- Overhead costs (rent, salaries, insurance, utilities) and general dealership-level variable costs (gas, transportation, supplies, marketing) are not tracked anywhere in the system today — only *per-vehicle* expenses exist (`vehicle_expenses`).
- Vehicle sales have no tax data captured at all today (`vehicles.sale_price` is a bare number) — only `vehicle_expenses` recently gained tax fields (`tax_type`, `tax_rate`, `tax_amount`).
- **Who this is for:** the dealership owner and managers (financial visibility is manager/owner-gated throughout; sales reps get non-financial counts only).
- **Non-goals:** no per-vehicle allocation of overhead costs (netted at the aggregate/period level only); no backfilling of tax data logic beyond a one-time default backfill (see §4); no proration of overhead across partial months.

---

## 2. Assumptions

1. "Available inventory" has two useful readings — total not-yet-sold, and frontline-ready-right-now — so the dashboard shows both rather than picking one.
2. Historical sold vehicles (sold before this change shipped) get their tax fields **backfilled** as Ontario HST (`HST_ON`, 13%) since the dealership's sales have overwhelmingly been in Ontario. The user will manually correct the handful of exceptions afterward.
3. Lead Source Report mirrors the Sales Report's shape (units, revenue, P/L) grouped by `lead_source` instead of by month, with the same monthly + custom-date-range toggle as the Profitability Report.
4. Inventory Aging Report only covers currently-unsold vehicles (no historical "how long did sold cars sit" trend).
5. Overhead line items are a flat monthly recurring figure — no daily proration if a range starts/ends mid-month; the item counts fully for any month it overlaps.

---

## 3. Decision Log

| # | Decision | Alternatives considered | Why |
|---|----------|--------------------------|-----|
| 1 | Dashboard shows **two** availability stats: total unsold count + frontline-ready count | Pick just one definition | `ownership_status` (arrived/in-transit) and `status` (frontline_ready/in_deal/etc.) answer different questions; both are useful and cheap to show |
| 2 | Overhead costs get a **dedicated recurring table** (`overhead_expenses`) with effective date ranges | Single "monthly overhead total" setting; no persistence, manual entry per report view | Persistence + history needed (e.g. rent increases mid-year); a single number can't be broken down or audited |
| 3 | Variable dealership costs get a **separate table** (`business_expenses`), not folded into `overhead_expenses` | One unified overhead table using start=end date for one-off entries | The two have fundamentally different shapes: recurring items need no vendor/tax, one-off receipts do (vendor, tax type/rate/amount) — mixing them would mean nullable columns everywhere and unclear query semantics |
| 4 | Category split: `overhead_expenses` = rent, salaries, insurance, utilities. `business_expenses` = gas, transportation, supplies, marketing, other | Keep marketing/insurance/utilities all in one bucket | User confirmed insurance and utilities are fixed recurring premiums/bills; marketing, gas, transportation, and supplies are variable, vendor-driven, entered monthly with actual receipts |
| 5 | Sale-side tax is captured via **new columns on `vehicles`** (`tax_type`, `tax_rate`, `tax_amount`), entered in the existing Pricing tab | Back-calculate tax from `sale_price` at a fixed default rate; skip sales-side tax entirely for v1 | User confirmed `sale_price` is pre-tax (not tax-inclusive), so back-calculation isn't viable; the HST report needs accurate per-sale tax type since rates could vary by province |
| 6 | Existing sold vehicles get **backfilled** with `tax_type = HST_ON`, `tax_rate = 0.13`, `tax_amount = sale_price × 0.13` | Leave historical rows null; require manual entry for every past sale | Few vehicles are affected and nearly all are Ontario sales; backfilling with the common case and letting the user fix exceptions is far less work than forcing manual entry on every historical row |
| 7 | Overhead & business expense management restricted to **manager + owner** (`overhead:manage`, `business_expenses:manage`) | Owner-only | Consistent with how `vehicles:financials:read` and `reports:read` are already scoped — managers already see and manage money-related data elsewhere |
| 8 | Profitability Report supports **both** monthly rows (default) and a custom date-range filter | Monthly-only; date-range-only | Matches the existing Sales Report pattern for consistency, while still allowing ad-hoc period analysis (e.g. quarter-end) |
| 9 | HST Report defaults its date range to the **dealership's fiscal year (May 1 – Apr 30)** | Calendar year; calendar quarter; no default | Matches the dealership's actual filing period |
| 10 | HST Report combines **three sources** (`vehicle_expenses`, `business_expenses`, `vehicles` sales) into one date-sorted table | Separate reports per source | A remittance report needs one reconciled view of all tax collected/paid in the period, not three disconnected tables |

---

## 4. Final Design

### 4.1 Data Model Changes

**New table: `overhead_expenses`** — fixed recurring costs.
```sql
CREATE TABLE overhead_expenses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category              TEXT NOT NULL CHECK (category IN ('rent', 'salaries', 'insurance', 'utilities')),
  description           TEXT NOT NULL,
  amount                DECIMAL(10, 2) NOT NULL CHECK (amount > 0),  -- monthly recurring figure
  effective_start_date  DATE NOT NULL,
  effective_end_date    DATE,  -- NULL = still active/ongoing
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT overhead_end_after_start CHECK (effective_end_date IS NULL OR effective_end_date >= effective_start_date)
);
```

**New table: `business_expenses`** — dealership-level, one-off dated transactions (same shape as `vehicle_expenses`, no VIN).
```sql
CREATE TABLE business_expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category          TEXT NOT NULL CHECK (category IN ('gas', 'transportation', 'supplies', 'marketing', 'other')),
  vendor            TEXT,
  description       TEXT NOT NULL,
  amount            DECIMAL(10, 2) NOT NULL CHECK (amount <> 0),  -- negative = refund/credit, same convention as vehicle_expenses
  expense_date      DATE NOT NULL,
  tax_amount        DECIMAL(10, 2) CHECK (tax_amount IS NULL OR tax_amount >= 0),
  tax_rate          DECIMAL(6, 5)  CHECK (tax_rate IS NULL OR tax_rate >= 0),
  tax_type          TEXT CHECK (tax_type IS NULL OR tax_type IN ('HST_ON','HST_15','GST_ONLY','NONE')),
  receipt_file_path TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_expenses_tax_rate_matches_type CHECK (
    tax_type IS NULL OR tax_rate IS NULL OR tax_rate = CASE tax_type
      WHEN 'HST_ON' THEN 0.13 WHEN 'HST_15' THEN 0.15 WHEN 'GST_ONLY' THEN 0.05
      WHEN 'NONE' THEN 0
    END
  )
);
```

**`vehicles` additions** — sale-side tax, mirroring `vehicle_expenses`:
```sql
ALTER TABLE vehicles
  ADD COLUMN tax_amount DECIMAL(10, 2) CHECK (tax_amount IS NULL OR tax_amount >= 0),
  ADD COLUMN tax_rate   DECIMAL(6, 5)  CHECK (tax_rate IS NULL OR tax_rate >= 0),
  ADD COLUMN tax_type   TEXT CHECK (tax_type IS NULL OR tax_type IN ('HST_ON','HST_15','GST_ONLY','NONE'));
-- same tax_rate/tax_type consistency constraint as vehicle_expenses/business_expenses

-- One-time backfill for existing sold vehicles:
UPDATE vehicles
SET tax_type = 'HST_ON', tax_rate = 0.13, tax_amount = ROUND(sale_price * 0.13, 2)
WHERE sale_price IS NOT NULL AND tax_type IS NULL;
```
`sale_price` remains pre-tax (the "Pre-tax Amount" in the HST report); `tax_amount` is the dollar tax charged on top.

**Permissions** (`src/lib/permissions.ts`):
```ts
"overhead:manage":          ["manager"],  // create/edit overhead_expenses
"business_expenses:manage": ["manager"],  // create/edit business_expenses
```
Viewing overhead/business-expense data inside reports reuses existing `"reports:read"` / `"vehicles:financials:read"` — no new "view" permission needed. Owner bypasses everything as usual.

**Audit log** — extend `application_audit.action` CHECK constraint with:
`overhead_created`, `overhead_updated`, `overhead_deleted`, `business_expense_created`, `business_expense_updated`, `business_expense_deleted`.

### 4.2 Dashboard (`/admin/dashboard/`)

Two new stat cards, visible to all roles with `vehicles:read` (no financials gating — plain counts, no dollars):
- **Available Inventory** — count where `sale_date IS NULL`.
- **Frontline Ready** — count where `ownership_status = 'available' AND status = 'frontline_ready'`.

### 4.3 Inventory Aging Report (`/admin/reports/aging/`)

- Table of all currently-unsold vehicles with days-on-lot (reuses existing `calcDaysOnLot`), sorted longest-on-lot first.
- Summary cards: average days on lot overall, and average grouped by `status`.

### 4.4 Lead Source Report (`/admin/reports/lead-source/`)

- Same shape as the Sales Report (units sold, revenue, P/L), grouped by `lead_source` instead of by month.
- Same monthly-rows + custom-date-range pattern as the Profitability Report.

### 4.5 Overhead & Business Expense Management

- `/admin/settings/overhead/` — CRUD list for `overhead_expenses` (category dropdown, description, amount, start/end date). Gated by `overhead:manage`.
- `/admin/expenses/business-expenses/` — CRUD list for `business_expenses` (date, vendor, category, description, amount, tax type) with optional receipt/document upload (`receipt_file_path`). Gated by `business_expenses:manage`.

### 4.6 Profitability Report (`/admin/reports/profitability/`)

For a given month:
```
Net Profit = Σ(vehicle gross P/L for vehicles sold that month)
           − Σ(business_expenses dated that month)
           − Σ(overhead_expenses whose date range includes that month; full monthly amount, no proration)
```
- Default view: monthly rows (Month | Vehicle Revenue | COGS | Gross P/L | Business Expenses | Overhead | Net Profit), trailing 12 months.
- Custom date-range filter recomputes one aggregated total for an arbitrary period.
- Gated by `reports:read` / `vehicles:financials:read` (manager + owner).

### 4.7 Sale Tax Capture (VehicleDetail Pricing tab)

- Add a **Tax Type** dropdown (reusing `TAX_TYPES` from `src/lib/vehicles.ts`) next to Sale Price/Sale Date, shown once a sale price is entered.
- `tax_rate` auto-fills from the selected `tax_type`.
- `tax_amount` computed server-side as `sale_price × tax_rate` on save (not user-entered, to avoid drift — same principle already enforced for expense tax fields).

### 4.8 HST Report (`/admin/reports/hst/`)

- Date-range picker, defaulting to the current fiscal year (May 1 – Apr 30) via a new `getFiscalYearDateRange()` helper in `src/lib/vehicles.ts`.
- Combines three sources into one date-sorted table:
  - `vehicle_expenses` (Type: Expense, Vendor column populated from `vehicle_expenses.vendor`)
  - `business_expenses` (Type: Expense, Vendor column populated)
  - `vehicles` sales where `sale_date` in range (Type: Sale, Customer: `purchaser_name`)
- Columns: Date | Type | Vendor/Customer | Description | Pre-tax Amount | Tax Type | Tax Collected.
- Totals row at the bottom (sum of Pre-tax Amount, sum of Tax Collected).
- Gated by `reports:read` (manager + owner).

---

## 5. Open Items / Follow-ups (non-blocking)

- None currently.

---

## 6. Implementation Notes

- New permission checks and audit actions should follow the exact same patterns already used for `vehicles:financials:read` and `expense_added`/`vehicle_updated` respectively — no new architecture, just extension of existing enums/maps.
- Per `AGENTS.md`: any functional change here needs tests in `src/__tests__/` (Vitest) — in particular the profitability calc, fiscal-year date-range helper, and the tax-rate-matches-type validation should be pure functions/schemas covered directly, following the existing pattern in `src/lib/vehicles.ts`.
- `CHANGELOG.md` must be updated under `[Unreleased]` before merging any of this work to `main`.
