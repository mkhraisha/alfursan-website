# DMS Phase 2 Implementation Plan

**Status:** Not Started  
**Date:** 2026-05-24  
**Depends on:** Phase 1 complete — see `docs/DMS_PHASE1_PLAN.md`  
**Reference docs:** `DEALER_MANAGEMENT_DESIGN.md`, `DEALER_MANAGEMENT_DECISIONS.md`

---

## Sprint 1 — Bill of Sale Generation

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

## Sprint 2 — Website Integration (Replace WordPress Inventory)

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

## Sprint 3 — Financing Form DMS Integration

Connect the public financing application form to the DMS vehicle inventory so applicants can select an available vehicle from a dropdown instead of manually entering a VIN.

- [ ] **Expose a public vehicle list endpoint**
  - **Description:** Add a `GET /api/vehicles/available` route (no auth required) that returns only vehicles with `status` containing `"available"`, projecting only public-safe fields: `vin`, `make`, `model`, `year`, `trim`, `advertised_price`. Ordered by `year DESC, make ASC, model ASC`.
  - **Validation:** Unauthenticated request succeeds (200). Response excludes `purchase_price`, `sale_price`, `commission_user_id`, and all other private fields. Only available vehicles returned.
  - **Test:** Call endpoint without auth token; verify shape. Add a "sold" vehicle; verify it does not appear.

- [ ] **Replace VIN text input with vehicle selector in Step 3 of `FinancingForm.tsx`**
  - **Description:** On mount (Step 3), fetch `GET /api/vehicles/available`. Render a `<select>` dropdown: each option shows `"{year} {make} {model} {trim} — ${advertised_price}"` with value = VIN. Include a "— I don't see my vehicle / enter manually —" escape option that reveals the existing VIN text input. When a vehicle is selected from the dropdown, auto-populate `vehicleYear`, `vehicleMake`, `vehicleModel`, `vehiclePrice`, and `vin` fields. When switching to manual entry, clear the dropdown selection.
  - **Validation:** Selecting a vehicle from dropdown sets all five fields correctly. Choosing the manual option resets dropdown and allows free-text VIN. If the endpoint returns an empty list (no available vehicles), skip the dropdown and show manual input only. Loading state shown while fetching.
  - **Test:** Mock endpoint with 3 vehicles; verify dropdown renders 4 options (3 + manual). Select option 2; verify `vin`, `vehicleYear`, `vehicleMake`, `vehicleModel`, `vehiclePrice` all populated. Switch to manual; verify VIN field is editable and not locked.

- [ ] **Link from public listing pages to financing form with VIN pre-selected**
  - **Description:** On each public vehicle listing page (`/listing/[vin]`), add an "Apply for Financing" button that links to `/finance?vin={vin}`. The financing form already reads `vin` from URL params; after Sprint 2 migrates listings to VIN-based routing, this wires up cleanly. Also pre-populate `vehicleYear`, `vehicleMake`, `vehicleModel`, `vehiclePrice` from URL params (already supported via `year`, `make`, `model`, `price` query params).
  - **Validation:** Clicking the button on a listing page opens the form with the dropdown pre-selected to that VIN (or VIN field pre-filled if vehicle is not in the available list). If the vehicle is no longer available (sold between page load and form submission), the submission is still accepted — availability is advisory only.
  - **Test:** Visit `/finance?vin=1HGCM82633A123456`; verify dropdown auto-selects matching vehicle (or falls back to manual VIN entry if not in available list).

- [ ] **Store vehicle VIN FK on `applications` table**
  - **Description:** Add a migration: `ALTER TABLE applications ADD COLUMN vehicle_vin TEXT REFERENCES vehicles(vin) ON DELETE SET NULL;`. Populate this column in `POST /api/finance.ts` when a valid VIN is submitted and a matching vehicle exists in `vehicles`. Keep existing `vin TEXT` column for backwards compatibility (copy value there as well for legacy queries).
  - **Validation:** After submit with a DMS vehicle VIN, `applications.vehicle_vin` is populated. Submit with a non-DMS VIN (manual entry); column is NULL, `vin` text column still populated. FK set to `ON DELETE SET NULL` so deleting a vehicle does not cascade-delete applications.
  - **Test:** Submit form selecting DMS vehicle; query DB: `vehicle_vin` = the VIN. Submit with manual VIN not in DMS; `vehicle_vin` IS NULL, `vin` = the manual value.

- [ ] **Show linked vehicle in application admin view**
  - **Description:** In `/admin/applications`, when `vehicle_vin` is populated, show a clickable link to `/admin/inventory/{vehicle_vin}` alongside or replacing the plain-text VIN display. If `vehicle_vin` is NULL, fall back to displaying the `vin` text field as before.
  - **Validation:** Application with DMS vehicle shows linked VIN. Application with manual VIN shows plain text. No regressions to existing application list or detail view.
  - **Test:** Open application linked to a DMS vehicle; click the VIN link; verify navigation to inventory detail page.

---

## Completion Criteria for Phase 2

All of the following must be true before Phase 2 is considered done:

- [ ] `npm run build` passes with zero TypeScript errors
- [ ] `npm run test` passes with zero test failures
- [ ] Bill of Sale generation works for all three sale types (Wholesale, As-Is, Retail)
- [ ] Public website shows vehicles from Supabase (not WordPress)
- [ ] Financing form accepts vehicle selection from DMS inventory
- [ ] VIN FK stored on `applications` table when a DMS vehicle is selected
- [ ] Linked vehicle visible in application admin view
