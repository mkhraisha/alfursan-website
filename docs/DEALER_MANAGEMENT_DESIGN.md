# Dealer Management System & CMS Migration — Design Document

**Status:** Validated  
**Date:** 2026-05-03  
**Scope:** Phase 1 (Inventory Management, Application Management, Garage Register, CSV Import, User Management)

---

## Phase Overview

### Phase 1: Core Operations (MVP)

**Core features:**

- Inventory management (add, edit, view vehicles with purchase/sale prices)
- Commission tracking (assign commission user, auto-calculate based on profit)
- Document management (upload required docs: bill of sale, inspection, ownership picture)
- Expense tracking (add expenses per vehicle with optional receipt upload)
- Application management (view financing applications from website)
- Receipt generation (auto-generate legal bill of sale documents)
- User management (admin can add/disable users, set commission percentages)
- CSV import (bulk upload inventory from OpenLane)
- Garage Register (track vehicle intake/completion dates)
- Role-based access (admin: user management; sales: inventory, applications, commissions)
- Audit logging (track all changes for compliance)

**Database & Infrastructure:**

- Vehicles table with VIN as primary key
- User roles (admin, sales)
- Supabase RLS policies for role-based filtering
- Document storage in Supabase Storage
- Audit log integration

### Phase 2: Reporting & Optimization

**Estimated scope:** Future phase  
**Features:**

- Payment & deposit tracking (record deposits and payments, calculate outstanding balance)
- Payment receipt generation (generate receipts with payment details and outstanding balance)
- Inventory duration reports (how long car was in inventory, repair time by model)
- Model-based acquisition recommendations (target future buys based on velocity)
- Mobile-optimized UI (Phase 1 is desktop-first)
- Advanced lead/customer management module
- Real-time sync with external inventory systems (if needed)
- Automated commission payout reports

---

## Understanding Summary

### What We're Building

Two integrated features:

1. **CMS Migration:** Migrate car inventory and About page from WordPress to a unified dealer dashboard
2. **Dealer Management System:** Dashboard to manage inventory, applications, legal documents, and team operations

### Why

- **Extensibility:** Dealership needs a full management system; WordPress cannot scale to this vision
- **Maintainability:** Single source of truth eliminates sync issues and reduces overhead
- **Usability:** Non-technical staff need an intuitive interface beyond WordPress

### Who It's For

- **Internal:** 5 dealership team members (admin role for 1-2, sales role for others)
- **External:** Website visitors see filtered inventory view (no sensitive data exposed)

### Key Constraints

- Scale: 10-20 vehicles, 5 concurrent users
- Inventory updates: ~2x/week
- About page: Rarely changes
- Mobile: Inventory must be accessible from phone (responsive design)
- Documents: Track acquisition, inspection, bill of sale, ownership, expenses
- Commission: Percentage of profit per user, $150 floor for loss sales

### Explicit Non-Goals (Phase 1)

- Real-time sync with external inventory systems (batch CSV import only)
- Customer/Lead Management module (Phase 2+)
- Bill of Sale/Invoice generation (Phase 2+)
- Inventory duration/efficiency reports (Phase 2+)
- Mobile-optimized UI (Phase 2+; desktop first)

---

## Assumptions

1. Dealer dashboard is the **single source of truth** for all inventory
2. Website queries dealer dashboard via API with role-based filtering
3. No WordPress REST API for cars anymore — entirely replaced by Supabase
4. Public website shows only non-sensitive fields (images, advertised_price, specs)
5. Profit/loss = advertised_price - (purchase_price + SUM(expenses))
6. Commission = profit_loss × user.commission_percentage, OR $150 (floor for losses)
7. Users are disabled (not deleted) to preserve audit trail and commission history
8. OpenLane CSV import is batch, not real-time
9. Existing magic-link authentication extends to dealer staff
10. Ontario TODS (Transfer of Ownership) compliance required for Garage Register

---

## Section 1: Data Model & Schema

### Core Table: `vehicles`

**Primary Key:** `vin` (string, 17 characters, unique)

**Vehicle Details:**

- `make`, `model`, `trim`, `series`, `year` (strings)
- `colour`, `odometer` (string, integer)

**Purchase Information:**

- `purchase_date` (date)
- `purchase_price` (decimal)

**Buyer/Seller Information:**

- `purchaser_name` (string, nullable — null until sold)
- `purchaser_address` (string, nullable — null until sold)
- `sale_date` (date, nullable — date vehicle was sold)

**Pricing:**

- `wholesale_price` (decimal)
- `advertised_price` (decimal)
- `sale_price` (decimal, nullable — null until sold)
- `sale_date` (date, nullable — null until sold)

**Ownership & Status:**

- `ownership_status` (enum: `'available'`, `'en_route'`, `'not_received'`)
- `status` (enum: `'frontline_ready'`, `'in_deal'`, `'sold'`, `'on_lot_work_needed'`, `'pending_delivery'`, `'pending_pickup'`, `'bodyshop'`, `'mechanic_ssc'`, `'detailing_shop'`, `'mechanic_repairs'`, `'openlane_arbitration'`, `'sale_cancelled_by_arbitration'`, `'openlane_auction'`)

**Photography:**

- `photography_status` (enum: `'pending'`, `'done'`)

**Garage Register (Ontario):**

- `garage_register_number` (string, nullable)

**Documents:**

- `acquisition_bill_of_sale_path` (string, nullable)
- `safety_inspection_document_path` (string, nullable)
- `signed_bill_of_sale_path` (string, nullable)
- `signed_ownership_picture_path` (string, nullable — picture of signed ownership when delivered)
- `disclosures` (text, nullable)

**Commission:**

- `commission_user_id` (uuid, nullable, foreign key to `auth.users`)

**Content:**

- `images_json` (array of file paths)
- `videos_json` (array of file paths)
- `carfax_link` (string, nullable)
- `internal_notes` (text)

**Metadata:**

- `created_at`, `updated_at` (timestamps)

---

### Table: `vehicle_expenses`

**Line-item tracking for costs associated with a vehicle**

- `id` (uuid, primary key)
- `vin` (string, foreign key to `vehicles`)
- `category` (enum: `'repair'`, `'detailing'`, `'parts'`, `'other'`)
- `description` (text)
- `amount` (decimal, > 0)
- `receipt_file_path` (string, nullable — attachment for receipt)
- `created_at` (timestamp)

---

### Table: `vehicle_documents`

**Flexible document storage for miscellaneous files**

- `id` (uuid, primary key)
- `vin` (string, foreign key to `vehicles`)
- `document_type` (string, e.g., `'warranty'`, `'service_record'`, `'other'`)
- `file_path` (string)
- `description` (text, optional)
- `uploaded_by` (uuid, nullable, foreign key to `auth.users`)
- `created_at` (timestamp)

---

### Table: `auth.users` (Extended)

**Existing table with dealership-specific fields**

- `id` (uuid, primary key)
- `email` (string, unique)
- `role` (enum: `'admin'`, `'sales'`)
- `commission_percentage` (decimal, e.g., 0.10 for 10%, nullable)
- `is_active` (boolean, default: true)
- `disabled_at` (timestamp, nullable)
- `created_at`, `updated_at` (timestamps)

---

### Computed Fields

- `total_cost = purchase_price + SUM(vehicle_expenses.amount WHERE vin = vehicle.vin)`
- `profit_loss = (sale_price ?? advertised_price) - total_cost`
- `commission = IF(profit_loss >= 0, profit_loss × commission_user.commission_percentage, 150)`

---

### Supabase RLS (Row-Level Security) Policies

**For `vehicles` table:**

- **Admin role:** SELECT/INSERT/UPDATE/DELETE all fields
- **Sales role:** SELECT/INSERT/UPDATE/DELETE all fields
- **Public role (unauthenticated):** SELECT only `[vin, make, model, trim, series, year, colour, odometer, advertised_price, images_json, videos_json, carfax_link]`

**For `vehicle_expenses` table:**

- **Admin/Sales roles:** Full access (SELECT/INSERT/UPDATE/DELETE)
- **Public role:** No access

**For `vehicle_documents` table:**

- **Admin/Sales roles:** Full access
- **Public role:** No access

**For `auth.users` table:**

- **Admin role:** SELECT/INSERT/UPDATE/DELETE
- **Sales role:** SELECT only (read-only view of team)
- **Public role:** No access

---

## Section 1.5: Bill of Sale Generation

**Purpose:** Generate a legal bill of sale document for vehicle sale.

**Bill of Sale types:** Three variants (exact fields to be provided by user later)
1. Wholesale Bill of Sale
2. As-Is Bill of Sale
3. Regular Bill of Sale

**Information required for all types:**
- Dealership information (name, address)
- Vehicle details: VIN, make, model, year, odometer
- Sale date
- Sale price
- Buyer information: name, address
- Seller signature field (for printing and manual signing)
- Buyer signature field (for printing and manual signing)

**Behavior:**
- Sales role can generate bill of sale from vehicle detail page
- Choose bill of sale type, then generate PDF
- No automatic signing (manual process, printed and signed)
- Generated bill of sale saved to `signed_bill_of_sale_path` when final signed version is uploaded

---

## Section 2: Dashboard Architecture & Roles

### Dashboard Navigation (Phase 1)

**Top-level sections:**

1. **Inventory** — core inventory management
2. **Applications** — extend existing financing application workflow
3. **Garage Register** — Ontario vehicle registry tracking
4. **Users** (admin-only) — manage team members and commissions

### Role-Based Permissions (Phase 1)

**Admin role:**

- View/edit all vehicles
- Upload/import cars (CSV)
- Manage users (create, update commission_percentage, disable)
- Manage applications
- Manage garage register

**Sales role:**

- View/edit all vehicles
- Upload/import cars (CSV)
- Assign commission_user to vehicles
- Manage applications
- View garage register (read-only)

_(Only difference: Admins manage users and commission percentages; Sales cannot)_

---

### Inventory List View

**Desktop table (sortable columns):**

- VIN (link to detail page) — sortable
- Make/Model/Year — sortable
- Status (color-coded badge) — sortable
- Ownership Status — sortable
- Photography Status — sortable
- Advertised Price — sortable
- Total Cost — sortable
- Profit/Loss (red for negative) — sortable
- Commission — sortable
- Actions (edit, delete, view)

**Filters (sidebar):**

- Status (multi-select)
- Ownership Status (multi-select)
- Photography Status
- Price range (min/max)
- Year range (min/max)

**Pagination:** 10 vehicles per page

---

### Car Detail View (Edit Page)

**Tabbed interface:**

1. **Basics**
   - VIN, Make, Model, Trim, Series, Year, Colour, Odometer

2. **Purchase**
   - Purchase Date, Purchase Price, Purchaser Name, Purchaser Address

3. **Pricing**
   - Wholesale Price, Advertised Price, Sale Price, Sale Date

4. **Media**
   - Upload images/videos
   - Carfax link

5. **Status & Tracking**
   - Status (dropdown)
   - Ownership Status (dropdown)
   - Photography Status (dropdown)
   - Garage Register Number

6. **Documents**
   - Acquisition Bill of Sale (upload/view)
   - Safety Inspection Document (upload/view)
   - Signed Bill of Sale (upload/view)
   - Signed Ownership Picture (upload/view)
   - Miscellaneous Documents (list with add/delete)

7. **Expenses**
   - Table: Category | Description | Amount | Receipt | Actions
   - Button: "+ Add Expense"
   - Total Cost (read-only, calculated)

8. **Commission** (Sales-visible)
   - Commission User (dropdown: select staff member or none)
   - Commission Percentage (read-only, shows user's % set by admin)
   - Calculated Commission (read-only, shows $ amount or $150 floor)

9. **Notes**
   - Internal Notes (text area)
   - Disclosures (text area)

---

### CSV Import Workflow

**Endpoint:** POST `/api/vehicles/import`

**Flow:**

1. Staff uploads CSV file (OpenLane format)
2. System validates format and previews rows
3. UI allows column mapping (e.g., "VIN" → vin, "Make" → make)
4. Preview: shows 5-10 rows before confirmation
5. On confirm: creates vehicles in bulk
6. Summary: "X vehicles created, Y errors"
7. Errors: shown with row numbers and reasons

**Validation:**

- Required fields: VIN (unique, 17 chars), make, model, year
- Dates must be valid and not in future
- Prices must be non-negative decimals

---

### User Management (Admin-only)

**Users table:**

- Email (unique)
- Role (admin/sales)
- Commission % (e.g., 10%)
- Status (Active/Disabled)
- Actions (edit, disable/enable)

**Create User:**

- Form: Email, Role, Commission %
- System sends magic-link to email
- User clicks link to set password (or uses magic-link auth)

**Edit User:**

- Update role, commission_percentage
- Option to disable (not delete)

**Disable User:**

- User cannot authenticate
- User is hidden from "Add Commission" dropdowns
- Historical commission records retained
- Can be re-enabled

---

## Section 3: API & Integration Design

### Single Vehicles Endpoint

**GET /api/vehicles**

```
Query parameters:
  - status (enum filter, optional)
  - ownership_status (enum filter, optional)
  - sort (field:asc|desc, e.g., "advertised_price:desc")
  - limit (default: 10)
  - offset (default: 0)

Response (unauthenticated/public role):
  [{ vin, make, model, trim, series, year, colour, odometer, advertised_price, images_json, videos_json, carfax_link }, ...]

Response (authenticated admin/sales):
  [{ vin, make, model, trim, series, year, colour, odometer, advertised_price,
     wholesale_price, purchase_price, purchase_date, purchaser_name, purchaser_address,
     ownership_status, status, photography_status, garage_register_number,
     acquisition_bill_of_sale_path, safety_inspection_document_path,
     signed_bill_of_sale_path, signed_ownership_picture_path, disclosures,
     commission_user_id, internal_notes, images_json, videos_json, carfax_link,
     created_at, updated_at }, ...]
```

**POST /api/vehicles** (authenticated: admin/sales)

```
Request body:
  { vin, make, model, trim, series, year, colour, odometer, purchase_date, purchase_price,
    purchaser_name, purchaser_address, wholesale_price, advertised_price,
    ownership_status, status, photography_status, carfax_link, disclosures, internal_notes }

Response: 201 Created
  { vin, ... (full vehicle object) }
```

**PATCH /api/vehicles/:vin** (authenticated: admin/sales)

```
Request body: partial vehicle object (any subset of fields)

Response: 200 OK
  { vin, ... (full updated vehicle object) }
```

**DELETE /api/vehicles/:vin** (authenticated: admin/sales)

```
Response: 204 No Content
Cascade: deletes all vehicle_expenses and vehicle_documents for this vin
```

---

### Expenses Endpoints

**POST /api/vehicles/:vin/expenses** (authenticated: admin/sales)

```
Request body:
  { category, description, amount, receipt_file_path (optional) }

Response: 201 Created
  { id, vin, category, description, amount, receipt_file_path, created_at }
```

**DELETE /api/vehicles/:vin/expenses/:expenseId** (authenticated: admin/sales)

```
Response: 204 No Content
```

---

### Commission Endpoint

**PATCH /api/vehicles/:vin/commission** (authenticated: admin/sales)

```
Request body:
  { commission_user_id: uuid | null }

Response: 200 OK
  { vin, commission_user_id, commission_percentage (from user), calculated_commission }
```

---

### Documents Endpoint

**POST /api/vehicles/:vin/documents** (authenticated: admin/sales)

```
Request body:
  { document_type, file_path, description (optional) }

Response: 201 Created
  { id, vin, document_type, file_path, description, uploaded_by, created_at }
```

**DELETE /api/vehicles/:vin/documents/:docId** (authenticated: admin/sales)

```
Response: 204 No Content
```

---

### CSV Import Endpoint

**POST /api/vehicles/import** (authenticated: admin/sales)

```
Request: multipart/form-data
  - file: CSV file
  - mapping: JSON object { "csv_column_name": "vehicle_field_name", ... }

Response: 200 OK
  { created: 15, failed: 1, errors: [ { row: 12, error: "Duplicate VIN" } ] }
```

---

### Users Endpoints

**GET /api/users** (authenticated: admin only)

```
Response: 200 OK
  [{ id, email, role, commission_percentage, is_active, created_at }, ...]
```

**POST /api/users** (authenticated: admin only)

```
Request body:
  { email, role, commission_percentage (optional) }

Response: 201 Created
  { id, email, role, commission_percentage, is_active, created_at }
```

**PATCH /api/users/:userId** (authenticated: admin only)

```
Request body:
  { role, commission_percentage, is_active }

Response: 200 OK
  { id, email, role, commission_percentage, is_active, created_at }
```

---

### File Upload (Images/Videos/Documents)

**POST /api/upload-url** (authenticated: admin/sales)

```
Request body:
  { filename, content_type, vehicle_vin (or document context) }

Response: 200 OK
  { url, fields, expires_in }

Purpose: Pre-signed URL for client to upload directly to Supabase Storage
Files stored under: /vehicles/{vin}/{filename}
```

---

### Website Integration

**Website queries GET /api/vehicles (unauthenticated)**

- Receives only public fields
- Supabase RLS enforces filtering
- Cached for 5 minutes to reduce DB load
- No modifications needed to existing website code (same endpoint)

---

## Section 4: Error Handling & Edge Cases

### Data Validation

**VIN:**

- Must be exactly 17 characters (alphanumeric)
- Required, must be unique
- Server validates before insert; duplicate returns 409 Conflict

**Prices/Decimals:**

- Negative values rejected (except profit_loss, which can be negative)
- Max 2 decimal places (cents)
- Server validates; invalid format returns 422 Unprocessable Entity

**Dates:**

- purchase_date must be ≤ today
- sale_date must be ≥ purchase_date (if provided)
- sale_date must be ≤ today
- Invalid dates return 422

**Commission:**

- commission_user_id must exist in auth.users
- Only one user per vehicle (unique constraint)
- commission_percentage on user must be > 0
- Invalid values return 422

**Expenses:**

- amount must be > 0
- category must be in enum
- Invalid expenses return 422

---

### Edge Cases

**1. Duplicate VIN upload (CSV import)**

- If VIN already exists: skip row, include in error summary
- User can choose: abort import or continue with remaining rows
- Returns: `{ created: 10, failed: 3, errors: [ { row: 5, vin: "ABC123...", error: "Duplicate VIN" }, ... ] }`

**2. Selling a car at loss**

- profit_loss shows negative (red highlight in UI)
- Commission calculation: $150 floor (not percentage)
- Staff sees this clearly in detail view and list

**3. Deleting a vehicle**

- Cascade deletes: vehicle_expenses, vehicle_documents, commission_user_id reference
- Confirm deletion in UI (non-reversible)
- Audit log records deletion

**4. Changing commission_user after assignment**

- Old user loses commission reference
- New user gains commission reference
- Audit log records both assignment and change

**5. Missing expenses for a vehicle**

- total_cost = purchase_price + $0 (no expenses)
- profit_loss calculated correctly
- UI shows "No expenses recorded" (optional)

**6. Disabling a user (instead of deletion)**

- User cannot authenticate (magic-link fails)
- Disabled user hidden from commission_user dropdown
- Vehicles with disabled user's commission_user_id:
  - Retain the commission_user_id (audit trail preserved)
  - UI shows commission_user as "Inactive"
  - Commission still calculates and is owed to their historical record
- Admin can re-enable user if needed

**7. CSV import with missing required fields**

- System validates before preview
- Shows which rows fail and why
- Allows retry or continue with valid rows

---

### Rate Limiting & Performance

**Public inventory endpoint (unauthenticated):**

- Rate limit: 100 requests/minute per IP
- Cached results: 5-minute TTL to reduce DB load

**Authenticated endpoints:**

- No strict rate limit (small team of 5 users)
- Monitor for abuse

**CSV import:**

- Validate file format (must be CSV)
- Parse & validate before insert (don't stream)
- Bulk insert optimized for 10-20 cars

---

## Section 5: Testing Strategy

### Unit Tests (Phase 1)

**Validation logic:**

- VIN format (17 chars, alphanumeric)
- Price calculations (total_cost, profit_loss, commission with floor)
- Commission floor logic ($150 for loss sales)
- Date validation (purchase_date ≤ today, sale_date ≥ purchase_date)
- Expense amount validation (must be > 0)

**Helpers:**

- CSV parsing & column mapping
- File path generation for Supabase Storage
- Commission percentage calculation

---

### Integration Tests (Phase 1)

**API endpoints:**

- GET /api/vehicles (unauthenticated) → only public fields returned
- GET /api/vehicles (authenticated admin) → all fields returned
- GET /api/vehicles (authenticated sales) → all fields returned
- GET /api/vehicles with filters → correct filtering applied
- GET /api/vehicles with sorting → correct sort order
- POST /api/vehicles (authenticated) → creates vehicle, returns full object
- PATCH /api/vehicles/:vin (authenticated) → updates vehicle, correct fields changed
- DELETE /api/vehicles/:vin (authenticated) → deletes vehicle, cascades expenses/docs
- POST /api/vehicles/:vin/expenses → adds expense, updates total_cost
- DELETE /api/vehicles/:vin/expenses/:expenseId → removes expense, recalculates total_cost
- PATCH /api/vehicles/:vin/commission → assigns commission user, calculates correctly
- POST /api/vehicles/import → valid CSV creates vehicles, summary returned
- POST /api/vehicles/import → duplicate VIN skipped, error returned
- POST /api/vehicles/import → missing required fields shows error
- POST /api/users (admin) → creates user
- PATCH /api/users/:userId (admin) → disables user, retains commission history
- GET /api/vehicles with disabled commission_user_id → shows "Inactive" label

**RLS policies:**

- Unauthenticated queries return only public fields
- Sales role queries return all fields
- Admin role queries return all fields
- Public role cannot write to vehicles table

---

### End-to-End Tests (Phase 1 - Manual/Smoke)

**Workflow 1: Add a car manually**

- Admin/Sales adds vehicle via form
- Verify all fields saved to DB
- Verify vehicle appears in inventory list
- Verify website shows only public fields

**Workflow 2: Import CSV**

- Admin/Sales uploads OpenLane CSV
- Verify preview shows correct column mapping
- Verify confirm button creates vehicles
- Verify summary shows count and errors

**Workflow 3: Add expenses**

- Admin/Sales adds expense line item to vehicle
- Verify total_cost updates
- Verify profit_loss recalculates
- Verify commission recalculates

**Workflow 4: Assign commission**

- Sales user assigns commission_user to vehicle
- Verify commission calculates (% or $150 floor)
- Verify commission appears in vehicle detail
- Verify commission_user can see their assignment

**Workflow 5: Disable user**

- Admin disables user (commission_percentage editor)
- Verify user cannot authenticate
- Verify vehicles with this user's commission still show commission
- Verify can re-enable user

---

### Performance Tests (Phase 1)

- Inventory list with 20 vehicles loads in < 1 second
- Public API endpoint (unauthenticated) caches for 5 minutes
- CSV import with 20 rows completes in < 5 seconds
- Sort/filter operations on inventory table responsive (< 500ms)

---

### Security Tests (Phase 1)

**Unauthenticated access (all should return 401/403):**

- POST /api/vehicles (create) → 401
- PATCH /api/vehicles/:vin (update) → 401
- DELETE /api/vehicles/:vin (delete) → 401
- POST /api/vehicles/:vin/expenses → 401
- DELETE /api/vehicles/:vin/expenses/:expenseId → 401
- PATCH /api/vehicles/:vin/commission → 401
- POST /api/vehicles/import → 401
- GET /api/users → 401
- POST /api/users → 401
- PATCH /api/users/:userId → 401

**Authenticated role restrictions:**

- Sales user POST /api/users → 403
- Sales user PATCH /api/users/:userId → 403
- Sales user DELETE /api/users/:userId → 403

**Database-level (Supabase RLS):**

- Unauthenticated attempt to read sensitive columns (purchase_price, expenses) → RLS policy blocks (403)
- Public role cannot write to vehicles table → 403

**Audit log tests (verify all changes are logged):**

- POST /api/vehicles → creates audit log entry with action='vehicle_created', user_id, vin, timestamp
- PATCH /api/vehicles/:vin → creates audit log entry with action='vehicle_updated', user_id, vin, changed_fields, timestamp
- DELETE /api/vehicles/:vin → creates audit log entry with action='vehicle_deleted', user_id, vin, timestamp
- POST /api/vehicles/:vin/expenses → audit log entry with action='expense_added', user_id, vin, expense_id, timestamp
- DELETE /api/vehicles/:vin/expenses/:expenseId → audit log entry with action='expense_deleted', user_id, vin, expense_id, timestamp
- PATCH /api/vehicles/:vin/commission → audit log entry with action='commission_assigned', user_id, vin, commission_user_id, timestamp
- POST /api/users → audit log entry with action='user_created', admin_user_id, new_user_id, role, commission_percentage, timestamp
- PATCH /api/users/:userId → audit log entry with action='user_updated', admin_user_id, user_id, changed_fields, timestamp
- PATCH /api/users/:userId (disable) → audit log entry with action='user_disabled', admin_user_id, user_id, timestamp
- POST /api/vehicles/import → audit log entry with action='csv_import', user_id, vehicle_count, timestamp

**Audit log integrity:**

- Audit entries are immutable (no updates/deletes after creation)
- Audit entries cannot be accessed/modified by sales role (admin-only if viewing added)
- All audit log entries include IP hash (consistent with financing form pattern)

---

## Summary

This design provides a unified dealer management and inventory system that:

✅ Replaces WordPress with a maintainable Supabase backend  
✅ Powers both internal operations and the public website from one source  
✅ Handles core dealership workflows (inventory, applications, garage register, commissions)  
✅ Scales to 5 users and 10-20 vehicles  
✅ Maintains audit trail for compliance and accountability  
✅ Enforces security via role-based access and Supabase RLS  
✅ Supports future Phase 2 features without major rework

---

**Ready for implementation.**
