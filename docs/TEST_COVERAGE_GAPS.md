# Test Suite & Coverage Gap Report

**Date:** 2026-08-08
**Scope:** Full scan of `src/__tests__/` (Vitest) and `e2e/` (Playwright) against the application's functional surface, plus a `vitest run --coverage` pass over `src/lib/**` and `src/pages/api/**` (the only paths currently included in the coverage config).

This report reflects the **current state of the repo** — it is not a changelog. See `CHANGELOG.md` for what changed and when.

## 1. Summary

| Metric | Result |
|---|---|
| Unit test files | 67 (`src/__tests__/**/*.test.ts` + `*.test.tsx`) |
| Unit tests | 1,177 passing / 0 failing |
| E2E spec files | 12 (`e2e/*.spec.ts`), Playwright, not run as part of this scan (requires a live dev server + browser install) |
| Coverage scope | `src/lib/**` and `src/pages/api/**` only — components, pages, and middleware are **excluded from the coverage metric** in `vitest.config.ts` even where tests exist for them |
| **Statements** | **89.66%** (1788/1994) |
| **Branches** | **82.50%** (1212/1469) |
| **Functions** | **92.09%** (233/253) |
| **Lines** | **90.72%** (1604/1768) |

Coverage was produced by running `npm run test:coverage` (`vitest run --coverage`, provider `v8`) against a fresh `npm run build` output. Component-test infra (`@testing-library/react` + jsdom) is now in place — see §5 — but component/page files still aren't part of the `coverage.include` glob, so their tests don't move the numbers above.

## 2. Modules with 0% coverage (`src/lib/**`, `src/pages/api/**`)

| File | % Stmts | Why | Risk |
|---|---|---|---|
| `src/lib/audit.ts` | 0 | `audit-log.test.ts` calls `vi.mock("../lib/audit")` — it tests call-sites, not `writeAudit()` itself. The real DB-insert logic and its error-swallowing branch (`console.error` on failure) are never executed. | Medium — silent audit-log failures would go unnoticed by tests. |
| `src/lib/public-vehicles.ts` | 0 | No direct unit test; `public-vehicle-view.ts` (a related module) is tested instead, but this file's own query/filter logic is not. | Medium — feeds public listing pages. |
| `src/lib/supabase-admin.ts` | 0 | Thin client-factory wrapper; commonly mocked (`getAdminClient`) rather than executed. | Low — but the factory itself (env var handling, singleton behavior) is unverified. |
| `src/lib/supabase-browser.ts` | 0 stmts / 0 lines | Thin client wrapper; same pattern. | Low. |
| `src/lib/theme.ts` | 0 stmts / 0 lines | No test references found. | Low — likely static theme tokens. |
| `src/pages/api/admin/refresh-cache.ts` | 0 | New since the last pass (admin "Refresh Public Cache" button's endpoint) — no test yet for the Vercel edge-cache purge call, its 401/403 gating, or the "not configured" fallback when `VERCEL_API_TOKEN`/`VERCEL_PROJECT_ID` are unset. | Medium — cache-purge failures would silently no-op; the "not configured" message is the only signal an admin gets. |

**Closed since the last pass:** `src/lib/request-user.ts` (0% → 100% stmts/100% lines, 92.59% branch) and `src/lib/api/parseApiResponse.ts` (0% → 100% stmts/lines, 83.33% branch) — see `src/__tests__/request-user.test.ts` and `src/__tests__/parse-api-response.test.ts`.

## 3. Modules with low/partial coverage (worth targeted tests)

| File | % Stmts | % Branch | Notes |
|---|---|---|---|
| `src/lib/csv-export.ts` | 55 | 100 | Branches are fully covered but half the statements aren't — dead code or an untested export path. |
| `src/pages/api/expenses/upload-url.ts` | 75.86 | 72.72 | Error/validation branches under-tested. |
| `src/pages/api/expenses/business/index.ts` | 78.78 | 73.68 | List/create endpoint for business expenses — the sibling mutation endpoint (`[expenseId].ts`) is now fully covered (see §2 closed items), but this index/list file itself isn't. |
| `src/pages/api/vehicles/[vin]/documents/index.ts` | 78.78 | 66.66 | Document upload/list error paths partially untested. |
| `src/pages/api/vehicles/[vin]/expenses/index.ts` | 78.78 | 66.66 | Same pattern — the sibling `[expenseId].ts` mutation endpoint is now fully covered, but this list endpoint isn't. |
| `src/pages/api/vehicles/expenses/import.ts` | 87.34 | 76.36 | Improved from 63.29/40 — per-row validation-failure and unknown-VIN branches now covered; remaining gaps are around partial insert-failure bookkeeping (lines 56,70,77,86). |
| `src/pages/api/vehicles/import.ts` | 81 | 65.33 | Bulk vehicle-inventory CSV import — edge cases (bad rows, partial failures) likely under-tested. |
| `src/pages/api/vehicles/[vin]/commission.ts` | 80.48 | 68 | Error/validation branches under-tested. |
| `src/pages/api/vehicles/index.ts` | 89.79 | 68.35 | Mostly covered; a few branches remain. |

**Closed since the last pass:** all three expense-mutation `[expenseId].ts` endpoints are now at **100%** statements/branches/functions — `src/pages/api/expenses/business/[expenseId].ts`, `src/pages/api/vehicles/[vin]/expenses/[expenseId].ts`, and `src/pages/api/vehicles/expenses/[expenseId].ts` (was 0% — the single largest gap in the previous report).

## 4. Currently-failing tests

None. `src/__tests__/vercel-output-trailing-slash.test.ts` self-skips unless a build artifact (`.vercel/output/config.json`) is present; run `npm run build` before `npm test` (as CI does — see `.github/workflows/ci.yml`) to exercise it locally.

- [x] Verified `npm run build && npm test` is clean with no stale-artifact false failures.

## 5. Component/UI-level test coverage

`@testing-library/react` + jsdom infrastructure is now set up (`src/__tests__/setup.ts` registers `afterEach(cleanup)` since this repo doesn't enable `test.globals`; individual `.test.tsx` files opt into the jsdom environment via a `/** @vitest-environment jsdom */` docblock, since this Vitest version has no working `environmentMatchGlobs`). Component files still aren't part of the `coverage.include` glob, so these tests don't move the numbers in §1, but they close real behavioral gaps.

**Covered:**
- `CSVImport.tsx` / `ExpenseCSVImport.tsx` — file-type/size validation messaging, drag-state UI class toggling (`src/__tests__/csv-import.test.tsx`, `src/__tests__/expense-csv-import.test.tsx`).
- `UsersPage.tsx` — user list load, empty state, error toast on failed load, invite-new-user flow (`src/__tests__/users-page.test.tsx`).
- `AddVehicleForm.tsx` — required-field rendering, VIN counter, validation-blocks-submission, successful-submission toast (`src/__tests__/add-vehicle-form-render.test.tsx`). Its pure `validateVehicleForm`/`buildVehiclePayload` logic has separate, dedicated unit coverage (`src/__tests__/add-vehicle-form.test.ts`).
- `InventoryTable.tsx` — row rendering, default sold-hidden filter, search filtering, empty state, Export-CSV-disabled-when-empty (`src/__tests__/inventory-table-render.test.tsx`). Its pure `compareInventoryRows`/`matchesInventoryFilters` logic has separate, dedicated unit coverage (`src/__tests__/inventory-table-filters.test.ts`).
- `BusinessExpenses.tsx` — list rendering with totals, empty state, search filtering, add-form toggle, Save-button-disabled-until-valid, add-new-expense-on-success (`src/__tests__/business-expenses.test.tsx`).
- `PopularMakes.tsx` / inventory filter rendering — Sold-badge markup, via `react-dom/server` render (not RTL) in `src/__tests__/popular-makes.test.tsx` and `src/__tests__/inventory-filters-rendering.test.tsx`.

None of the above six admin components call `can()` from `src/lib/permissions.ts` directly — permission gating lives at the Astro page/route layer above them — so there was nothing to mock there; the tests focus on render/behavior instead.

**Still open:**

- [ ] **`VehicleDetail.tsx` — "Generate Description" AI button** — the feature (`feat/ai-vehicle-descriptions`) is now merged to `main` with solid lib/API coverage (`src/__tests__/vehicle-description.test.ts`, `src/__tests__/api-vehicle-generate-description.test.ts`), but there is still no component-level test for the button's loading/error/toast states inside `VehicleDetail.tsx` itself.
  - **Validation:** a Testing Library test renders the component, mocks a rate-limited/error API response, and asserts the toast shows a user-friendly message
  - **Test:** `npm test -- VehicleDetail` after adding `src/__tests__/vehicle-detail.test.tsx`

- [ ] **`FinancingForm.tsx` / `Phase2Form.tsx`** — multi-step forms with draft auto-save; only the API layer (`financing-schema.test.ts`, `phase2-schema.test.ts`, `api-finance.test.ts`) and one e2e happy-path (`public-finance-submission.spec.ts`) exist. Step navigation, draft persistence, and client-side validation-error rendering are untested.
  - **Validation:** render tests covering step transitions and the draft-restore-on-reload behavior
  - **Test:** `npm test -- FinancingForm`

- [ ] **Vehicle-inventory CSV import e2e** — `e2e/admin-expense-csv-import.spec.ts` covers the expense-CSV flow end-to-end; there's still no e2e equivalent for the vehicle-inventory importer (`CSVImport.tsx`'s unit test now covers its render/validation logic, but not a full browser-driven import against a live dev server).
  - **Validation:** add an e2e spec mirroring `admin-expense-csv-import.spec.ts` for `/admin/inventory/import`
  - **Test:** `npx playwright test admin-inventory-csv-import`

## 6. Functional areas with no dedicated test file at all

- [x] **Reports (`/admin/reports/`, `reports:read` permission)** — `aggregateMonthlySales` and `computeCompletenessReport` in `src/lib/vehicles.ts` are pure exported functions with direct unit coverage in `src/__tests__/vehicles-lib.test.ts` and `src/__tests__/vehicles-completeness.test.ts`. No further action needed.

- [ ] **`scripts/clean-vehicle-descriptions.mjs`** and **`scripts/migrate-wordpress-photos.mjs`** — the underlying lib functions (`wordpress-migration.ts`, `wordpress-photo-migration.ts`, `vehicle-description.ts`) have unit tests, but the scripts' own orchestration (argument parsing, `--seed-file`/`--dry-run` mode, batching/retry behavior) don't. Lower priority — WordPress migration is complete and these scripts are only invoked for one-off backfills.
  - **Validation:** if these scripts are still actively run, add a smoke test that invokes them against a fixture directory/mock Supabase client
  - **Test:** manual dry-run against a local Supabase stack, or a Vitest test importing the script's exported functions if refactored to be testable

- [ ] **`src/pages/api/admin/refresh-cache.ts`** — new endpoint, 0% covered (see §2). No test for the 401/403 gating, the Vercel cache-purge call itself, or the "not configured" fallback when the Vercel env vars are unset.
  - **Validation:** mock the Vercel cache-invalidation client the same way other API-route tests mock Supabase; assert 401 (no session), 403 (non-manager/owner), success, and the "not configured" branch
  - **Test:** `npm test -- refresh-cache`

## 7. Recommended priority order

1. `src/pages/api/admin/refresh-cache.ts` (0% coverage, new since the last pass, mutating/permission-gated)
2. `src/lib/audit.ts` and `src/lib/public-vehicles.ts` (0% coverage, feed public-facing/audit-trail paths)
3. Remaining low-branch endpoints: `expenses/business/index.ts`, `vehicles/[vin]/expenses/index.ts`, `vehicles/[vin]/documents/index.ts`, `vehicles/import.ts`, `vehicles/[vin]/commission.ts`
4. `VehicleDetail.tsx` Generate Description component-level test (feature is live and lib/API-tested, but the UI toast/loading states aren't)
5. `FinancingForm.tsx` / `Phase2Form.tsx` step-navigation and draft-persistence tests; vehicle-inventory CSV import e2e spec

## Appendix: full coverage table

```
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   89.66 |     82.5 |   92.09 |   90.72 |
 lib               |   90.23 |    85.87 |   91.76 |   90.86 |
  audit.ts         |       0 |        0 |       0 |       0 | 17-27
  csv-export.ts    |      55 |      100 |   83.33 |      50 | 32-40
  csv-mapping.ts   |   93.33 |     87.5 |     100 |     100 | 25
  csv-parse.ts     |   83.87 |       50 |     100 |   85.18 | 10-14
  expense-import.ts|   98.52 |    91.37 |     100 |     100 | 60,98,118,121,124
  form-utils.ts    |   86.95 |     87.7 |     100 |   91.75 | 155,157,167,171
  origin.ts        |   81.81 |       75 |     100 |   88.88 | 20
  public-vehicle-view.ts |   100 |    94.73 |     100 |     100 | 183
  public-vehicles.ts |     0 |        0 |       0 |       0 | 27-95
  request-user.ts  |     100 |    92.59 |     100 |     100 | 19,33
  supabase-admin.ts|       0 |        0 |       0 |       0 | 16-25
  supabase-browser.ts |    0 |        0 |     100 |       0 | 3-20
  theme.ts         |       0 |      100 |       0 |       0 | 7-124
  vehicle-description.ts |98.66 |  97.72 |     100 |     100 | 46
  vehicles.ts      |     100 |    96.73 |     100 |     100 | 342-356
  vercel-cache.ts  |   94.73 |      100 |   66.66 |     100 |
  wordpress-migration.ts | 95.37 |  82.35 |   90.32 |   95.27 | 296,301,306,317
 lib/api           |     100 |    83.33 |     100 |     100 |
  parseApiResponse.ts |   100 |    83.33 |     100 |     100 | 10
 pages/api         |     100 |    77.67 |     100 |     100 |
  finance.ts       |     100 |    77.67 |     100 |     100 | 128-129,188,198
 pages/api/admin   |   86.44 |    79.12 |    87.5 |   86.08 |
  refresh-cache.ts |       0 |        0 |       0 |       0 | 1-59
  refresh-session.ts |   100 |    89.65 |     100 |     100 | 39-40,59
  set-session.ts   |     100 |    95.45 |     100 |     100 | 44
  update-application.ts | 100 |    92.85 |     100 |     100 | 74
 pages/api/dealer  |    91.3 |     93.1 |      75 |   90.24 |
  users.ts         |    91.3 |     93.1 |      75 |   90.24 | 47,66-67,94
 pages/api/dealer/users |93.47 |  89.74 |     100 |   92.68 |
  [userId].ts      |   93.47 |    89.74 |     100 |   92.68 | 30,92-93
 pages/api/expenses |  75.86 |    72.72 |     100 |   78.57 |
  upload-url.ts    |   75.86 |    72.72 |     100 |   78.57 | 36,41,45,48,60-61
 pages/api/expenses/business | 90.54 | 87.5 |   100 |   90.62 |
  index.ts         |   78.78 |    73.68 |     100 |   79.31 | 31-32,48,53,64-65
  [expenseId].ts   |     100 |      100 |     100 |     100 |
 pages/api/finance |   96.61 |    90.56 |     100 |   96.49 |
  phase2.ts        |   97.77 |    86.11 |     100 |   97.67 | 84
  upload-url.ts    |   95.89 |    92.85 |     100 |   95.77 | 128,191-192
 pages/api/vehicles |  86.19 |    71.57 |    87.5 |   87.85 |
  import.ts        |      81 |    65.33 |   77.77 |   84.44 | 107,121,137,205
  index.ts         |   89.79 |    68.35 |     100 |   90.58 | 131,183,200-202
  upload-url.ts    |   90.24 |    91.66 |     100 |   89.74 | 66,72,107-108
 pages/api/vehicles/[vin] |  86.3 |  78.65 |    92.3 |   90.32 |
  commission.ts    |   80.48 |       68 |   66.66 |   88.57 | 32,65-67
  index.ts         |   84.41 |    77.55 |     100 |   87.69 | 148-150,175-177
 pages/api/vehicles/[vin]/documents | 82.35 | 72.72 | 100 | 82.6 |
  [docId].ts       |   88.88 |    85.71 |     100 |    87.5 | 40-41
  index.ts         |   78.78 |    66.66 |     100 |      80 | 31-32,47,65-67
 pages/api/vehicles/[vin]/expenses | 90.27 | 84.37 | 100 | 90.76 |
  index.ts         |   78.78 |    66.66 |     100 |      80 | 31-32,47,65-67
  [expenseId].ts   |     100 |      100 |     100 |     100 |
 pages/api/vehicles/expenses | 90.09 | 80.88 |  90.9 |   95.55 |
  import.ts        |   87.34 |    76.36 |   88.88 |   94.28 | 56,70,77,86
  [expenseId].ts   |     100 |      100 |     100 |     100 |
-------------------|---------|----------|---------|---------|-------------------
```
