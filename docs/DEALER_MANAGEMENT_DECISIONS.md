# Dealer Management System — Decision Log

**Date:** 2026-05-03  
**Document:** Design decisions and rationale for Dealer Management System and CMS Migration

---

## Decision 1: CMS Migration Strategy

**What was decided:** Migrate car inventory and About page from WordPress to dealer dashboard, with the dealer dashboard becoming the single source of truth for all inventory data.

**Alternatives considered:**
- Keep WordPress as secondary sync source (more complex, sync issues)
- Use headless CMS (Sanity/Strapi) as separate layer (added complexity, cost)

**Why this option:** 
- Single source of truth eliminates sync issues and data inconsistencies
- Reduces maintenance overhead (no WordPress updates, plugins, security patches)
- Integrates seamlessly with dealer management system vision
- Lower cost (no additional CMS subscription)
- Faster to implement for 5-person team

---

## Decision 2: Architecture Approach (Monolithic vs. Separate Schemas)

**What was decided:** Monolithic database schema (Approach A) with Supabase RLS policies for role-based visibility. Single `vehicles` table with all fields; RLS policies filter what each role sees.

**Alternatives considered:**
- Approach B: Separate schemas (public view + internal detail) — clearer boundary but more complex

**Why this option:** 
- For 10-20 cars and 5 users, simpler to implement
- Supabase RLS is purpose-built for this pattern
- Faster to build and maintain
- No sync issues between multiple schema views
- Reduces code duplication

---

## Decision 3: Primary Key for Vehicles Table

**What was decided:** VIN as primary key (not UUID with VIN as unique index).

**Alternatives considered:**
- UUID as primary key, VIN as unique index
- Custom sequential ID

**Why this option:**
- VIN is the natural, unique identifier in automotive
- VIN is always required in our schema anyway
- Simplifies data relationships (no need for two identifiers)
- Improves data integrity (VIN cannot be null)
- Aligns with industry standard

---

## Decision 4: Commission Model (Percentage vs. Fixed, Per-User vs. Per-Vehicle)

**What was decided:** 
- Commission as percentage of profit per user
- $150 floor for loss sales (company still pays if car sells at loss)
- Commission percentage assigned to user (not editable per-vehicle)
- Commission user (salesper user) assignable by sales role

**Alternatives considered:**
- Fixed dollar amount per car (inflexible, not tied to profitability)
- Commission percentage editable per vehicle (complex, more error-prone)
- Commission percentage set globally (less flexible for team)

**Why this option:**
- Percentage scales with profit (incentivizes profitability over volume)
- $150 floor protects company margin on loss sales
- Per-user percentage simplifies admin overhead (set once, apply to all cars)
- Sales role can assign commission user without changing global settings
- Clear accountability: each user knows their %, sales team knows who's credited

---

## Decision 5: User Lifecycle (Disable vs. Delete)

**What was decided:** Users are disabled (not deleted) to retain audit trail and commission history. Disabled users cannot authenticate but records remain intact.

**Alternatives considered:**
- Hard delete users (loses historical commission records, breaks audit trail)
- Soft delete (same as disable but semantically different)

**Why this option:**
- Maintains audit integrity for compliance and accountability
- Preserves financial records (commissions owed, historical payments)
- Allows re-enabling if needed (e.g., staff returns after leave)
- Prevents orphaned commission records on vehicles
- Meets accounting/legal requirements for historical tracking

---

## Decision 6: API Endpoint Structure (Single vs. Namespaced)

**What was decided:** Single unified `/api/vehicles` endpoint (no `/api/dealer/vehicles` or `/api/public/vehicles` namespace).

**Alternatives considered:**
- Separate namespaces for clarity (`/api/dealer/vehicles` vs `/api/public/vehicles`)
- Nested endpoints for all operations

**Why this option:**
- Cleaner, simpler API surface
- Role-based access control (Supabase RLS + JWT auth) handles security, not URL structure
- Less code duplication
- Easier for frontend to consume (one endpoint, different responses based on auth)
- Aligns with RESTful best practices

---

## Decision 7: Document Storage (Fixed + Flexible)

**What was decided:** 
- Fixed documents (acquisition bill of sale, safety inspection, signed bill of sale, ownership picture) stored as specific columns in `vehicles` table
- Flexible `vehicle_documents` table for miscellaneous files (warranties, service records, etc.)

**Alternatives considered:**
- Single generic documents table for everything (loses structure, harder to audit)
- Only fixed documents, no misc upload (limits flexibility)
- All documents in separate table (loses field-level certainty)

**Why this option:**
- Balances structure (fixed docs tracked explicitly) with flexibility (any doc can be uploaded)
- Makes audit easier (required docs have explicit schema fields)
- Supports future reporting (e.g., "all vehicles missing safety inspection")
- Allows both explicit tracking and open-ended uploads

---

## Decision 8: Expense Receipts (Attachment vs. No Attachment)

**What was decided:** Expenses have optional `receipt_file_path` field for attaching receipt documents.

**Alternatives considered:**
- No file attachment for expenses (easier, but harder to audit)
- Separate table for expense attachments (more complex)

**Why this option:**
- Maintains audit trail for spend verification
- Integrates into existing expense model (no extra table)
- Optional (not required), so doesn't add friction
- Supports future reporting (e.g., "all repairs > $500 must have receipt")

---

## Decision 9: CSV Import (Batch with Column Mapping)

**What was decided:** Support OpenLane CSV import with flexible column mapping, validation preview before insert. No file size limits.

**Alternatives considered:**
- Real-time sync with OpenLane API (unnecessary, imports happen ~2x/week)
- Fixed column order, no mapping (inflexible)
- Automatic column detection (error-prone)

**Why this option:**
- Batch import sufficient for 2x/week update cycle
- Column mapping handles format variations (e.g., "Make" vs "MAKE")
- Preview prevents bulk insert mistakes
- No file size limits (OpenLane CSVs rarely exceed 1MB for 10-20 cars)
- Simpler to implement than API integration

---

## Decision 10: Authentication & Authorization (Role-Based)

**What was decided:** Extend existing magic-link authentication to dealer staff. Two roles: `admin` (user management, commission percentage setting) and `sales` (inventory/application management, commission assignment).

**Alternatives considered:**
- Three roles (`admin`, `sales`, `viewer`)
- Third-party auth provider (Okta, Auth0)
- Invite codes instead of email-based auth

**Why this option:**
- Minimal viable role set (reduces complexity)
- Aligns with dealership team structure (most staff are "sales" or "admin")
- Magic-link proven secure in financing flow (reuse existing pattern)
- No need for third-party auth at 5 users
- Simple to extend if roles needed later

---

## Decision 11: Audit Logging (Unified Table)

**What was decided:** All changes (vehicles, expenses, commission, users) logged to `application_audit` table with action, user_id, timestamp, and IP hash.

**Alternatives considered:**
- No audit logging (loses accountability, compliance issues)
- Separate audit table per entity (more complex, harder to query)
- Audit via Supabase Change Data Capture (overkill for this scale)

**Why this option:**
- Unified audit table (reuses existing pattern from financing form)
- Provides compliance trail for regulatory/legal requirements
- Immutable records (no modifications after creation)
- Minimal overhead (single INSERT per action)
- Easy to query: all changes in one place

---

## Decision 12: Testing Strategy (Unit + Integration + Manual E2E)

**What was decided:** 
- Unit tests for validation and helpers
- Integration tests for all API endpoints
- Manual E2E tests for key workflows (Phase 1)
- Security tests for all unauthenticated/unauthorized access
- Audit log verification for all changes

**Alternatives considered:**
- Comprehensive E2E automation (not justified for 5 users)
- No security testing (critical gap)
- No audit testing (compliance risk)

**Why this option:**
- Balances thoroughness with Phase 1 timeline
- Security testing non-negotiable (role-based access)
- Audit testing required (compliance, financial tracking)
- Manual E2E sufficient for small dealership team
- Unit + integration tests catch most bugs without automation overhead

---

## Decision 13: Mobile Optimization Timing

**What was decided:** Desktop-first for Phase 1. Mobile UI optimization deferred to Phase 2.

**Alternatives considered:**
- Mobile-first from Phase 1 (adds complexity, delays MVP)
- Responsive design for Phase 1 (middle ground)

**Why this option:**
- Inventory must be accessible from phone (requirement met via responsive browser, not app)
- Phase 1 focus: core functionality (inventory management, applications, commissions)
- 5 team members likely to use on desktop most of the time
- Phase 2 can add mobile-optimized UI when staff demand it
- Keeps Phase 1 MVP lean

---

## Summary of Trade-Offs

| Area | Decision | Trade-Off |
|------|----------|-----------|
| CMS | Single source of truth (Supabase) | No WordPress integration flexibility |
| Architecture | Monolithic schema + RLS | Less explicit security boundary than separate schemas |
| Primary Key | VIN | No anonymity/privacy separation from inventory ID |
| Commission | % of profit + $150 floor | More complex calculation than fixed amount |
| Users | Disable, not delete | More storage for disabled records (negligible at scale) |
| API | Single `/api/vehicles` endpoint | Auth/role logic in middleware, not URL |
| Documents | Fixed columns + flexible table | Two storage patterns (minor complexity) |
| Receipts | Optional attachment | Staff may skip receipts (mitigated by UI/training) |
| CSV Import | Batch, not real-time | Requires manual imports 2x/week (acceptable) |
| Auth | Magic-link + roles | No SSO (acceptable for 5 users) |
| Audit | Unified table | One large audit table vs. distributed (query performance acceptable) |
| Testing | Manual E2E | Fewer automated edge case tests (mitigated by unit/integration) |
| Mobile | Phase 2 | Phase 1 not optimized for phone editing (acceptable) |

All trade-offs are acceptable given team size (5 users), scale (10-20 cars), and timeline (MVP first, Phase 2 later).

---

**Approved:** 2026-05-03  
**Next Step:** Implementation setup and database migration
