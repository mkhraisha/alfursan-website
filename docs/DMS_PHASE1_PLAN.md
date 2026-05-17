# DMS Phase 1 Implementation Plan

**Status:** In Progress  
**Date:** 2026-05-17  
**Reference docs:** `DEALER_MANAGEMENT_DESIGN.md`, `DEALER_MANAGEMENT_DECISIONS.md`

---

## Existing Infrastructure (Already Done)

- Magic-link auth with Supabase ✅
- `admin_users` table with `owner/manager/staff` roles ✅
- `application_audit` table (append-only) ✅
- File upload to Supabase Storage ✅
- Middleware auth guard for `/admin/**` ✅
- AdminLayout.astro shell ✅
- Rate limiting (Upstash) ✅

---

## Sprint 1 — Database Foundation

### 1.1 Extend user management for DMS roles

- [x] **Create `user_profiles` migration**
  - **Description:** Add `user_profiles` table with `id` (FK → `auth.users`), `email`, `role` (enum: `admin`, `sales`), `commission_percentage` (decimal, nullable), `is_active` (bool, default true), `disabled_at` (timestamptz, nullable), `created_at`, `updated_at`.
  - **Validation:** Table created, RLS applied, foreign key to `auth.users` on delete cascade.
  - **Test:** `supabase db reset` passes; `\d user_profiles` shows all columns.

- [x] **Seed existing admin_users into user_profiles**
  - **Description:** Migration step that copies existing `admin_users` rows into `user_profiles`, mapping `owner/manager` → `admin` and `staff` → `sales`.
  - **Validation:** After migration, `SELECT count(*) FROM user_profiles` equals `SELECT count(*) FROM admin_users`.
  - **Test:** Reset local DB, verify seed data is present in `user_profiles`.

### 1.2 Vehicles table

- [x] **Create `vehicles` migration**
  - **Description:** Create `vehicles` table with VIN as primary key (17-char alphanumeric), all fields per design doc Section 1 (make, model, trim, series, body_type, year, colour, odometer, purchase_date, purchase_price, purchaser_name, purchaser_address, wholesale_price, advertised_price, sale_price, sale_date, ownership_status enum, status enum, photography_status enum, garage_register_number, all document path columns, commission_user_id FK → user_profiles.id, images_json, videos_json, carfax_link, internal_notes, disclosures, created_at, updated_at).
  - **Validation:** VIN column is PK and NOT NULL; enums constrained; FK on commission_user_id nullable.
  - **Test:** Insert a test vehicle via psql; duplicate VIN returns unique constraint error; invalid status enum rejected.

- [x] **Add `updated_at` auto-trigger**
  - **Description:** Trigger function that sets `updated_at = now()` on every UPDATE to `vehicles`.
  - **Validation:** Update any field; `updated_at` changes; `created_at` does not.
  - **Test:** `UPDATE vehicles SET colour = 'Red' WHERE vin = 'TEST'`; verify timestamps.

### 1.3 Supporting tables

- [x] **Create `vehicle_expenses` migration**
  - **Description:** Table with `id` (uuid PK), `vin` (FK → vehicles, cascade delete), `category` (enum: repair, detailing, parts, other), `description` (text), `amount` (decimal > 0 check), `receipt_file_path` (nullable), `created_at`.
  - **Validation:** Check constraint `amount > 0` enforced; cascade delete removes expenses when vehicle deleted.
  - **Test:** Insert expense; delete parent vehicle; expense row is gone.

- [x] **Create `vehicle_documents` migration**
  - **Description:** Table with `id` (uuid PK), `vin` (FK → vehicles, cascade delete), `document_type` (text), `file_path` (text), `description` (text nullable), `uploaded_by` (uuid nullable FK → user_profiles.id), `created_at`.
  - **Validation:** FK references correct; cascade delete works.
  - **Test:** Insert document; delete parent vehicle; document row is gone.

### 1.4 Supabase Storage buckets

- [x] **Create `vehicle-images` bucket (public)**
  - **Description:** Public bucket for vehicle photos and videos. Path pattern: `vehicles/{vin}/{filename}`.
  - **Validation:** Bucket exists and is publicly readable.
  - **Test:** Upload a file; fetch the public URL and confirm 200 response.

- [x] **Create `vehicle-documents` bucket (private)**
  - **Description:** Private bucket for all vehicle documents (bill of sale, inspection, ownership, expense receipts). Path pattern: `vehicles/{vin}/docs/{filename}`.
  - **Validation:** Bucket exists and is NOT publicly readable; requires signed URL.
  - **Test:** Direct URL returns 403; signed URL returns 200.

### 1.5 RLS Policies

- [x] **Apply RLS to `vehicles`**
  - **Description:** Admin/Sales: full SELECT/INSERT/UPDATE/DELETE. Public (unauthenticated): SELECT only `[vin, make, model, trim, series, year, colour, odometer, advertised_price, images_json, videos_json, carfax_link]`. Helper function `is_dealer_user()` checks `user_profiles` for active admin/sales role.
  - **Validation:** Unauthenticated SELECT returns only public columns. Unauthenticated INSERT returns 403.
  - **Test:** Run test queries as anon role; verify column set. Run as dealer user; verify all columns returned.

- [x] **Apply RLS to `vehicle_expenses` and `vehicle_documents`**
  - **Description:** Admin/Sales: full access. Public: no access (all operations blocked).
  - **Validation:** Unauthenticated SELECT returns 0 rows (or RLS error).
  - **Test:** Query as anon; expect empty result or 403.

- [x] **Apply RLS to `user_profiles`**
  - **Description:** Admin: full SELECT/INSERT/UPDATE/DELETE. Sales: SELECT only. Public: no access.
  - **Validation:** Sales user cannot UPDATE user_profiles. Admin can UPDATE.
  - **Test:** Attempt PATCH via sales JWT; expect 403.

### 1.6 Extend audit log

- [x] **Add vehicle audit actions**
  - **Description:** Extend `application_audit.action` check constraint (or create a separate `vehicle_audit` table following the same append-only pattern) to include: `vehicle_created`, `vehicle_updated`, `vehicle_deleted`, `expense_added`, `expense_deleted`, `document_uploaded`, `document_deleted`, `commission_assigned`, `csv_import`, `user_created`, `user_updated`, `user_disabled`.
  - **Validation:** All new action values can be inserted; old values still work.
  - **Test:** Insert each new action type; verify no constraint violation.

---

## Sprint 2 — Auth & Permissions Layer

- [x] **Update `src/lib/permissions.ts` for DMS roles**
  - **Description:** Add DMS permissions map: `vehicles:read`, `vehicles:write`, `vehicles:delete`, `users:manage`, `commission:assign`, `garage:read`, `garage:write`. Map `admin` role to all; `sales` to all except `users:manage`. Keep existing financing permissions intact.
  - **Validation:** `can('sales', 'users:manage')` returns false; `can('admin', 'users:manage')` returns true.
  - **Test:** Add unit tests in `permissions.test.ts` for all new permissions.

- [x] **Update `src/middleware.ts` to support DMS routes**
  - **Description:** For requests to `/dealer/**`, look up the user in `user_profiles` (not `admin_users`). Attach `locals.dealerRole` (`admin` | `sales`) and `locals.dealerUserId`. For `/admin/**`, continue using `admin_users` as before.
  - **Validation:** A user in `user_profiles` can access `/dealer/**`; a user only in `admin_users` cannot (and vice versa).
  - **Test:** Manual test both route sets with valid session tokens.

- [x] **Create `DealerLayout.astro`**
  - **Description:** Sidebar navigation layout for all `/dealer/**` pages. Navigation items: Inventory, Applications, Garage Register, Users (admin-only). Shows current user email + role. Reuses AdminLayout patterns.
  - **Validation:** Layout renders with sidebar; Users nav item hidden for sales role.
  - **Test:** Visual inspection on `/dealer/inventory`.

- [x] **Create `/dealer/` entry point**
  - **Description:** `/dealer/index.astro` — redirects authenticated users to `/dealer/inventory`; unauthenticated users to `/dealer/login`. Reuse existing magic-link sign-in flow but scoped to `user_profiles`.
  - **Validation:** Unauthenticated visit redirects to login; authenticated redirects to inventory.
  - **Test:** Visit `/dealer/` without session; expect redirect to login.

---

## Sprint 3 — Vehicles API

- [x] **GET /api/vehicles**
  - **Description:** Returns paginated vehicle list. Unauthenticated: public fields only (Supabase RLS enforces). Authenticated dealer: all fields. Query params: `status`, `ownership_status`, `photography_status`, `sort` (`field:asc|desc`), `limit` (default 10), `offset` (default 0), `min_price`, `max_price`, `min_year`, `max_year`. Cached 5 min for public requests via Cache-Control header.
  - **Validation:** Unauthenticated request returns only public fields. Sorting and pagination work. Filters narrow results correctly.
  - **Test:** Integration test: 3 vehicles in DB; request with `status=frontline_ready`; expect 1 result.

- [x] **POST /api/vehicles**
  - **Description:** Create a new vehicle. Authenticated (admin/sales) only. Validates: VIN 17 chars alphanumeric, required fields (vin, make, model, year), price non-negative, dates valid. Returns 201 + full vehicle object. Logs `vehicle_created` to audit.
  - **Validation:** Missing VIN returns 422. Duplicate VIN returns 409. Valid request returns 201 with vehicle JSON.
  - **Test:** Integration test for happy path, duplicate VIN, and missing required fields.

- [x] **GET /api/vehicles/[vin]**
  - **Description:** Fetch single vehicle by VIN. Unauthenticated: public fields only. Authenticated: full object. 404 if not found.
  - **Validation:** Unknown VIN returns 404. Field filtering matches role.
  - **Test:** Integration test for existing VIN (authenticated), non-existent VIN, and unauthenticated field set.

- [x] **PATCH /api/vehicles/[vin]**
  - **Description:** Partial update of vehicle fields. Authenticated (admin/sales) only. Validates same rules as POST for provided fields. Logs `vehicle_updated` with changed fields to audit. Returns 200 + full updated object.
  - **Validation:** Invalid price rejected. Unknown VIN returns 404. Valid partial update persists and returns updated object.
  - **Test:** Integration test: update `colour` only; verify `updated_at` changes; other fields unchanged.

- [x] **DELETE /api/vehicles/[vin]**
  - **Description:** Delete vehicle and cascade (expenses, documents). Authenticated (admin/sales) only. Logs `vehicle_deleted` to audit. Returns 204 No Content.
  - **Validation:** Vehicle and all expenses/documents removed. 404 on non-existent VIN. Audit log entry created.
  - **Test:** Insert vehicle + 2 expenses + 1 document; DELETE; verify all 4 rows removed.

- [x] **POST /api/vehicles/import**
  - **Description:** CSV import. Accepts `multipart/form-data` with `file` (CSV) and `mapping` (JSON column-name → field-name). Validates format, returns preview for first 10 rows on `?preview=true`. On confirm: bulk insert valid rows, skip duplicates, return `{ created, failed, errors }`.
  - **Validation:** Duplicate VIN skipped (not error-abort). Missing required column returns descriptive error. 200 returned even with partial failures.
  - **Test:** Integration test: CSV with 3 rows (1 duplicate, 1 missing make, 1 valid); expect `{ created: 1, failed: 2, errors: [...] }`.

---

## Sprint 4 — Expenses, Documents & Commission API

- [x] **POST /api/vehicles/[vin]/expenses**
  - **Description:** Add expense line item. Validates: `amount > 0`, `category` in enum, `description` non-empty. Logs `expense_added` to audit. Returns 201 + expense object.
  - **Validation:** `amount = 0` returns 422. Invalid category returns 422. Valid insert returns 201.
  - **Test:** Integration test for happy path and each validation failure.

- [x] **DELETE /api/vehicles/[vin]/expenses/[expenseId]**
  - **Description:** Remove expense. Authenticated (admin/sales) only. Logs `expense_deleted`. Returns 204.
  - **Validation:** Non-existent expense ID returns 404.
  - **Test:** Insert expense; DELETE; verify row gone; 404 on retry.

- [x] **POST /api/vehicles/[vin]/documents**
  - **Description:** Add a misc document record. Validates `document_type` and `file_path` non-empty. Logs `document_uploaded`. Returns 201.
  - **Validation:** Missing `file_path` returns 422.
  - **Test:** Integration test for happy path.

- [x] **DELETE /api/vehicles/[vin]/documents/[docId]**
  - **Description:** Remove misc document record. Logs `document_deleted`. Returns 204.
  - **Validation:** Non-existent doc returns 404.
  - **Test:** Insert; DELETE; verify gone.

- [x] **PATCH /api/vehicles/[vin]/commission**
  - **Description:** Assign or clear commission user. Body: `{ commission_user_id: uuid | null }`. Validates user exists and is active in `user_profiles`. Logs `commission_assigned`. Returns 200 + `{ vin, commission_user_id, commission_percentage, calculated_commission }`.
  - **Validation:** Disabled user ID returns 422. Null clears assignment.
  - **Test:** Assign user; verify commission calculated at user's % (or $150 floor for loss vehicles).

- [x] **Extend /api/upload-url for vehicle assets**
  - **Description:** Extend existing signed URL endpoint to accept `context: 'vehicle-image' | 'vehicle-document'` and `vehicle_vin`. Returns signed URL targeting the correct bucket and path.
  - **Validation:** Returns URL pointing to `vehicle-images/{vin}/...` or `vehicle-documents/{vin}/docs/...` depending on context.
  - **Test:** Request signed URL for each context; verify bucket and path in response.

---

## Sprint 5 — Users API

- [x] **GET /api/dealer/users**
  - **Description:** List all users in `user_profiles`. Admin role only. Returns `[{ id, email, role, commission_percentage, is_active, created_at }]`.
  - **Validation:** Sales role returns 403. Admin returns full list.
  - **Test:** Two users in DB; GET as admin; expect both returned.

- [x] **POST /api/dealer/users**
  - **Description:** Create a new dealer user. Admin only. Body: `{ email, role, commission_percentage? }`. Creates Supabase Auth user (magic-link invite), inserts into `user_profiles`. Logs `user_created` to audit. Returns 201.
  - **Validation:** Duplicate email returns 409. Sales attempting returns 403.
  - **Test:** POST with valid email; verify `user_profiles` row created; verify Supabase Auth invite sent.

- [x] **PATCH /api/dealer/users/[userId]**
  - **Description:** Update role, commission_percentage, or is_active. Admin only. When `is_active = false`, sets `disabled_at = now()`. When re-enabling, clears `disabled_at`. Logs `user_updated` or `user_disabled`. Returns 200.
  - **Validation:** Disabling a user sets `disabled_at`. Re-enabling clears it. Sales attempting returns 403.
  - **Test:** Disable user; verify `is_active = false` and `disabled_at` is set. Re-enable; verify both cleared.

---

## Sprint 6 — Inventory UI

- [x] **`/admin/inventory` — Inventory List Page**
  - **Description:** Table with columns: VIN (link), Make/Model/Year, Status (badge), Ownership Status, Photography Status, Advertised Price, Total Cost (purchase + expenses), Profit/Loss (red if negative), Commission, Actions (Edit / Delete). Sortable columns. Filters: status, ownership_status, photography_status, price range, year range. Pagination: 10/page.
  - **Validation:** Table renders all vehicles; sort changes order; filters narrow list; pagination navigates correctly; profit/loss negative shown in red; delete prompts confirmation.
  - **Test:** Manual E2E: Add 2 vehicles; verify both appear; sort by price; filter by status; paginate.

- [x] **`/admin/inventory/new` — Add Vehicle Page**
  - **Description:** Form for all required fields (basics: VIN, make, model, year; purchase: date, price; pricing: wholesale, advertised; status). Optional fields can be filled later. Submits to POST /api/vehicles.
  - **Validation:** VIN field validates 17 chars in real-time; required field errors shown; successful submit redirects to detail page.
  - **Test:** Submit with valid data; verify vehicle in DB and redirect to `/admin/inventory/{vin}`.

- [x] **`/admin/inventory/[vin]` — Vehicle Detail Page (Tabbed)**
  - **Description:** 9-tab interface. Each tab saves explicitly on Save button (or auto-saves on blur for Notes). Tabs: Basics, Purchase, Pricing, Media, Status, Documents, Expenses, Commission, Notes.
  - **Validation:** Switching tabs preserves unsaved data in-memory. Each tab's save updates only its fields via PATCH.
  - **Test:** Edit Basics; switch to Purchase without saving; switch back; data still present. Save Basics; verify DB updated.

- [x] **Tab: Basics**
  - **Description:** Fields: VIN (read-only after create), Make, Model, Trim, Series, Body Type, Year, Colour, Odometer. Save button.
  - **Validation:** VIN non-editable. All string fields update on save.
  - **Test:** Edit colour; save; reload page; verify colour persists.

- [x] **Tab: Purchase**
  - **Description:** Fields: Purchase Date, Purchase Price, Purchaser Name, Purchaser Address.
  - **Validation:** Purchase Date cannot be in the future (max={today}).
  - **Test:** Set purchase date to tomorrow; expect validation error.

- [x] **Tab: Pricing**
  - **Description:** Fields: Wholesale Price, Advertised Price, Sale Price (nullable), Sale Date (nullable). Computed: Total Cost (read-only), Profit/Loss (read-only, color-coded).
  - **Validation:** Prices non-negative. Computed fields update after save.
  - **Test:** Enter sale price; save; verify profit/loss recalculates.

- [x] **Tab: Media**
  - **Description:** Image upload (multi-file), video upload, Carfax link. Images stored in `vehicle-images` bucket, paths saved to `images_json`. Delete individual images.
  - **Validation:** Images appear after upload. Carfax link saved. Delete removes from images_json.
  - **Test:** Upload 2 images; save; reload; images displayed. Delete one; verify removed.

- [x] **Tab: Status & Tracking**
  - **Description:** Checkboxes: Status (multi-select). Dropdowns: Ownership Status, Photography Status. Text: Garage Register Number.
  - **Validation:** Multi-select status saves as array. All dropdowns persist on save.
  - **Test:** Select 2 statuses; save; reload; both statuses shown.

- [x] **Tab: Documents**
  - **Description:** Fixed documents (5) — each with upload/view/replace via signed URL. Misc documents table with delete. "+ Add Document" button.
  - **Validation:** Fixed doc uploads persist to specific path columns. Misc documents show in table. Delete misc doc removes record.
  - **Test:** Upload acquisition bill of sale; reload; file shown with download link. Add misc doc; delete it; verify gone.

- [x] **Tab: Expenses**
  - **Description:** Table: Category | Description | Amount | Delete. "+ Add Expense" inline form. Total Cost shown at bottom (read-only, computed from purchase_price + expenses).
  - **Validation:** Amount must be > 0. Category from enum. Total updates after add/delete.
  - **Test:** Add $500 repair expense; verify Total Cost increases by $500. Delete expense; verify Total reverts.

- [x] **Tab: Commission**
  - **Description:** Commission User dropdown (active users from `user_profiles`). Commission % (read-only from selected user). Calculated Commission (read-only, computed with $150 floor). Uses PATCH /api/vehicles/[vin]/commission.
  - **Validation:** Disabled users not in dropdown. Commission floor of $150 shown for loss vehicles.
  - **Test:** Assign a user; verify commission calculated at their %. Set sale price below cost; verify $150 floor shown.

- [x] **Tab: Notes**
  - **Description:** Two text areas: Internal Notes, Disclosures. Auto-save on blur.
  - **Validation:** Text persists after blur and reload.
  - **Test:** Type in notes; click elsewhere; reload; notes present.

---

## Sprint 7 — CSV Import UI

- [ ] **`/dealer/inventory/import` — CSV Import Page**
  - **Description:** Step 1: Upload CSV file. Step 2: Map columns (CSV column → vehicle field dropdown for each). Step 3: Preview table (first 10 rows). Step 4: Confirm import. Step 5: Summary (`X created, Y failed`) with error list (row #, VIN, reason).
  - **Validation:** Non-CSV file rejected. Preview shows mapped data. Duplicate VINs flagged in summary without aborting the whole import.
  - **Test:** Upload OpenLane-format CSV with 5 rows (1 duplicate). Verify preview; confirm; expect `{ created: 4, failed: 1 }`.

---

## Sprint 8 — User Management UI

- [ ] **`/dealer/users` — Users Page (Admin only)**
  - **Description:** Table: Email | Role | Commission % | Status | Actions (Edit / Disable-Enable). "+ Add User" button at top.
  - **Validation:** Sales users cannot access this page (redirect with error). Disabled users shown with greyed row.
  - **Test:** Visit as sales role; expect redirect. Visit as admin; expect user list.

- [ ] **Add User Modal/Form**
  - **Description:** Modal with Email, Role dropdown (admin/sales), Commission % (numeric input, required for sales). On submit: POST /api/dealer/users; show success or duplicate error.
  - **Validation:** Missing email returns error. Duplicate email shows "User already exists".
  - **Test:** Add user with valid email; verify row appears in table.

- [ ] **Edit User Modal**
  - **Description:** Pre-filled form for Role and Commission %. On submit: PATCH /api/dealer/users/[id].
  - **Validation:** Changes persist after save and table reload.
  - **Test:** Change commission from 10% to 12%; save; verify table shows 12%.

- [ ] **Disable / Re-enable User**
  - **Description:** Toggle button on each row. Calls PATCH with `is_active: false / true`. Confirm dialog before disabling. Disabled user immediately hidden from commission dropdown.
  - **Validation:** Disabled user cannot log in (middleware rejects). Re-enabling restores access.
  - **Test:** Disable user; attempt login with their email; expect rejection.

---

## Sprint 9 — Garage Register UI

- [ ] **`/dealer/garage-register` — Garage Register Page**
  - **Description:** Table of vehicles sorted by `purchase_date` descending. Columns: Garage Register #, VIN, Make/Model/Year, Purchase Date (intake), Sale Date (outflow, or "In Stock"), Status. Admin can edit Garage Register Number. Sales: read-only. Ontario TODS compliance fields displayed.
  - **Validation:** Vehicles without sale_date show "In Stock". Sales role sees table but cannot edit register numbers.
  - **Test:** Add vehicle with purchase_date; verify it appears in register. Mark as sold (sale_date set); verify outflow date shown.

---

## Sprint 10 — Bill of Sale Generation

- [ ] **Install PDF generation library**
  - **Description:** Add `@react-pdf/renderer` or `pdf-lib` to dependencies. Choose based on template complexity (react-pdf for component-based, pdf-lib for precise layout).
  - **Validation:** `npm run build` passes with new dependency.
  - **Test:** Generate a test PDF with dummy data; verify output is a valid PDF.

- [ ] **Wholesale Bill of Sale template**
  - **Description:** PDF template with dealership info (name, address), vehicle details (VIN, make, model, year, odometer, body type), sale date, sale price, buyer info, signature fields. Generated from vehicle detail page.
  - **Validation:** Generated PDF contains all required fields. Signature areas are blank (manual signing).
  - **Test:** Generate from a vehicle with complete data; open PDF; verify all fields populated.

- [ ] **As-Is Bill of Sale template**
  - **Description:** Same base as wholesale plus "as-is" disclosure clause.
  - **Validation:** Disclosure text present in generated PDF.
  - **Test:** Generate; verify as-is clause visible.

- [ ] **Retail Bill of Sale template (province variants + export)**
  - **Description:** Retail template with province-specific fields. Variants: Ontario, Quebec, Alberta, BC, Export. Selector on generate dialog. Dealership provides exact fields — use placeholder layout until confirmed.
  - **Validation:** Province-specific fields differ per variant. Export variant includes export-specific language.
  - **Test:** Generate Ontario and Export variants; verify distinct content.

- [ ] **"Generate Bill of Sale" button on vehicle detail**
  - **Description:** Button on Pricing tab (or document toolbar). Opens modal to select type + province. Calls generation endpoint. Returns PDF download. On upload of signed copy: file goes to `signed_bill_of_sale_path`.
  - **Validation:** PDF downloads successfully. Uploading signed copy updates `signed_bill_of_sale_path`.
  - **Test:** Click generate; select Wholesale; verify PDF download. Upload signed PDF; verify field in DB updated.

---

## Sprint 11 — Website Integration (Replace WordPress Inventory)

- [ ] **Update public inventory pages to use Supabase**
  - **Description:** Replace `wordpress.ts` inventory fetch in `search/index.astro` and `listing/[slug].astro` with GET /api/vehicles (unauthenticated). Map Supabase fields to existing UI components. Keep WordPress for blog only.
  - **Validation:** Public inventory page shows vehicles from Supabase. Listing detail page works with VIN-based routing.
  - **Test:** Add a vehicle in DMS; verify it appears on public `/search` page with only public fields visible.

- [ ] **Update listing route from WordPress slug to VIN**
  - **Description:** Change `/listing/[slug]` to `/listing/[vin]` (or create redirect from old slugs). Update all internal links.
  - **Validation:** `/listing/{vin}` returns correct vehicle detail. Old slug URLs redirect gracefully.
  - **Test:** Visit `/listing/{valid-vin}`; verify correct vehicle shown. Visit old-format slug; verify redirect.

- [ ] **Remove WordPress dependency for inventory**
  - **Description:** Delete or gut `wordpress.ts` inventory-related functions. Keep blog-related functions intact. Remove unused imports.
  - **Validation:** `npm run build` passes. No TypeScript errors.
  - **Test:** Build passes; blog pages still work.

---

## Sprint 12 — Tests

- [ ] **Unit tests: validation helpers**
  - **Description:** Tests for: VIN format validation (17 chars, alphanumeric), commission calculation (% × profit, $150 floor for losses), total_cost calculation (purchase_price + sum of expenses), date validation (purchase ≤ today, sale ≥ purchase), expense amount > 0 validation.
  - **Validation:** All edge cases covered (negative profit, zero expenses, boundary dates).
  - **Test:** `npm run test` — all pass.

- [ ] **Unit tests: CSV parsing & column mapping**
  - **Description:** Tests for CSV parse, column mapping application, and validation of mapped rows.
  - **Validation:** Handles missing headers, extra columns, and malformed rows.
  - **Test:** Parse 3 CSVs (valid, missing-required-col, malformed-VIN); verify output.

- [ ] **Integration tests: vehicle CRUD API**
  - **Description:** Tests for GET (public vs. authenticated field set), POST (valid, duplicate VIN, missing fields), PATCH, DELETE (with cascade), GET /[vin] (not found).
  - **Validation:** All HTTP status codes match spec.
  - **Test:** `npm run test` — all pass.

- [ ] **Integration tests: expenses and commission**
  - **Description:** Tests for add expense (valid, amount = 0, bad category), delete expense, assign commission (valid user, disabled user, profit floor).
  - **Validation:** $150 floor tested explicitly.
  - **Test:** `npm run test` — all pass.

- [ ] **Integration tests: user management API**
  - **Description:** Tests for GET /users (admin vs. sales role), POST /users (valid, duplicate, sales attempting), PATCH /users (disable, re-enable, commission update).
  - **Validation:** 403 returned for unauthorized role on all endpoints.
  - **Test:** `npm run test` — all pass.

- [ ] **Security tests: unauthenticated access**
  - **Description:** Verify all write endpoints return 401 without auth token. Verify sales-blocked endpoints return 403 with sales token. Verify public GET /vehicles returns only public fields (not purchase_price, commission, etc.).
  - **Validation:** Zero sensitive fields leak through unauthenticated requests.
  - **Test:** Programmatic requests without token to every write endpoint; all return 401.

- [ ] **Audit log tests**
  - **Description:** After each create/update/delete operation, verify an audit log row was inserted with correct `action`, `user_id`, and relevant identifiers.
  - **Validation:** No operation completes without audit entry. Audit rows are immutable (no UPDATE/DELETE on audit table).
  - **Test:** Create vehicle; query audit log; expect 1 row with `action='vehicle_created'`.

---

## Completion Criteria for Phase 1

All of the following must be true before Phase 1 is considered done:

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run test` passes with zero test failures
- [ ] All security tests pass (no sensitive data leakage, all write endpoints auth-gated)
- [ ] Dealer can log in, add a vehicle, upload images, add expenses, assign commission, generate a bill of sale
- [ ] Public website shows vehicles from Supabase (not WordPress)
- [ ] CSV import successfully imports a real OpenLane file
- [ ] Admin can create, disable, and re-enable a user
- [ ] Audit log captures all key operations

---

## Order of Execution

```
Sprint 1 (DB)  →  Sprint 2 (Auth/Permissions)  →  Sprint 3 (Vehicles API)
       ↓
Sprint 4 (Sub-resources API)  →  Sprint 5 (Users API)
       ↓
Sprint 6 (Inventory UI)  →  Sprint 7 (CSV Import UI)  →  Sprint 8 (User Mgmt UI)
       ↓
Sprint 9 (Garage Register)  →  Sprint 10 (Bill of Sale)  →  Sprint 11 (WP Migration)
       ↓
Sprint 12 (Tests)  →  Phase 1 Complete
```

**Dependencies:**
- Sprint 2 (auth/permissions) requires Sprint 1 (DB)
- Sprint 3+ (API) requires Sprint 1 + Sprint 2
- Sprint 6+ (UI) requires Sprint 3-5 (APIs)
- Sprint 11 (WP migration) requires Sprint 3 (vehicles API)
- Sprint 12 (tests) can be written alongside each sprint (TDD preferred)
