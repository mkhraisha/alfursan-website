# Security Audit — Alfursan Auto Website

**Date:** 2025  
**Scope:** Full codebase static analysis (`src/`, middleware, DB schema, CI/CD)  
**Status:** Findings only — no fixes applied

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | 0 |
| 🟠 High | 2 |
| 🟡 Medium | 6 |
| 🔵 Low | 5 |

---

## 🟠 HIGH

### H1 — Over-broad `.vercel.app` Origin Allowlist

**File:** `src/middleware.ts`  
**Location:** `isAllowedOrigin()` function

```ts
check.includes(".vercel.app") && !check.includes("://vercel.app")
```

Any application deployed to Vercel (i.e. `attacker-app.vercel.app`) is accepted as a valid `Origin` for all three public API endpoints:
- `POST /api/finance`
- `POST /api/finance/phase2`
- `POST /api/finance/upload-url`

An attacker can create a free Vercel project, host a malicious form at `evil.vercel.app`, and submit cross-origin requests to all three endpoints with no CORS block. Phase 1 is rate-limited but the token is shared across all `.vercel.app` traffic (see H2/M3).

**Impact:** Enables cross-origin abuse of the application form, Phase 2, and upload URL generation.  
**Fix direction:** Replace the wildcard check with a hardcoded allowlist (`alfursan-website.vercel.app` + production domain).

---

### H2 — Session Cookie Missing `HttpOnly` Flag

**File:** `src/pages/admin/callback/index.astro`

```ts
document.cookie = `sb-access-token=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
```

The admin session cookie is set via client-side JavaScript, which means:
1. It **cannot be `HttpOnly`** — the flag can only be set server-side.
2. Any JavaScript on the page (injected via XSS, a compromised CDN, or a Supabase storage object returned inline) can read `document.cookie` and exfiltrate the JWT.

Note: `Secure` is also absent, though Vercel enforces HTTPS in production. The `HttpOnly` gap is the critical one.

**Impact:** XSS on any admin page → full session token theft.  
**Fix direction:** Set the cookie via a server-side `Set-Cookie` response header in a Supabase auth callback API route, then redirect. This allows `HttpOnly; Secure; SameSite=Lax`.

---

## 🟡 MEDIUM

### M1 — No Content-Security-Policy Header

**File:** `src/middleware.ts` (security headers block)

The middleware sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy`, but no `Content-Security-Policy`.

Without CSP:
- Inline script injection from XSS has no browser-level mitigation
- External script loads are unrestricted
- Admin pages with `<script>` tags containing token-handling code have no `script-src` guard

**Impact:** Amplifies any XSS finding — no secondary browser-level control.  
**Fix direction:** Add a `Content-Security-Policy` header. Start permissive (e.g., `default-src 'self'; script-src 'self' 'unsafe-inline'` as a baseline), then tighten.

---

### M2 — User-Controlled Storage Paths Written to DB Without Sanitization

**File:** `src/pages/api/finance.ts`

```ts
if (d.draftId && d.licenseFrontPath) licenseUpdates.license_front_path = d.licenseFrontPath;
if (d.draftId && d.licenseBackPath)  licenseUpdates.license_back_path  = d.licenseBackPath;
```

`licenseFrontPath` and `licenseBackPath` are strings sent in the POST body (user-controlled). They are stored directly into the `applications` table without validating that the path belongs to the expected pattern (`tmp/{draftId}/…`).

A malicious user could submit `../other-user-id/front.jpg` or an arbitrary bucket path, causing:
- An admin to generate a signed URL to a storage object they didn't upload
- Storage path confusion if multiple applications are involved

**Impact:** Moderate — limited by Supabase bucket RLS, but path confusion is possible.  
**Fix direction:** Validate that `licenseFrontPath` matches `^tmp/<draftId>/`.

---

### M3 — Phase 2 Token Has No Expiry Enforcement

**File:** `src/pages/apply/phase2.astro`, `src/pages/api/phase2.ts`

The applicant email states the link is "valid for 30 days," but there is no `phase2_token_expires_at` column in the schema and no expiry check in the API. The token is valid indefinitely (until documents are submitted or a new token is generated).

**Impact:** Old links in forwarded/leaked emails remain usable forever.  
**Fix direction:** Add `phase2_token_expires_at TIMESTAMPTZ` to the schema. Check `NOW() < phase2_token_expires_at` in `phase2.astro` and in `POST /api/finance/phase2`.

---

### M4 — Rate Limit IP Bucket Falls Back to Shared Key `"unknown"`

**File:** `src/lib/rate-limit.ts` (and callers)

```ts
const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
```

If `x-forwarded-for` is absent (direct connection, proxy misconfiguration, or stripped header), all requests share the single bucket key `"unknown"`. The entire world effectively becomes one client, causing legitimate users to be rate-limited by a single abusive request chain.

Additionally, `x-forwarded-for` is a user-controllable header on non-proxied connections. On Vercel the platform sets it, but a request routed around Vercel would allow IP spoofing.

**Impact:** Rate-limiting can be trivially bypassed or inadvertently blocks all non-proxied traffic.  
**Fix direction:** Fall back to a unique-per-request random key (effectively no limit) or reject requests without a valid IP header. On Vercel, use `x-vercel-forwarded-for` or `cf-connecting-ip` as the canonical IP source.

---

### M5 — Phase 2 Storage Files Not Deleted on Application Deletion

**File:** `src/pages/api/admin/update-application.ts`  
**File:** `src/pages/admin/applications/[id].astro`

When an application is deleted (or the delete flow runs), only `license_front_path` and `license_back_path` are cleaned up. The Phase 2 storage objects (`void_cheque_path`, `proof_insurance_path`, `payslip_path`) are left orphaned in Supabase Storage indefinitely.

**Impact:** PII (bank void cheques, insurance documents, pay stubs) persists in storage beyond the application lifecycle.  
**Fix direction:** Extend the deletion routine to also remove Phase 2 storage paths.

---

### M6 — Admin User Role Not Server-Validated

**File:** `src/pages/admin/users/index.astro`

```ts
const role = String(form.get("role") ?? "staff");
```

The `role` field is extracted from the form body without validating it is one of `staff | manager | owner`. An attacker with admin access (or who manipulates the POST body) could insert arbitrary role strings into the `admin_users` table.

**Impact:** Privilege escalation within admin tiers if the role column is used for access decisions without an enum guard.  
**Fix direction:** Validate `role` against `["staff", "manager", "owner"]` before the INSERT.

---

## 🔵 LOW

### L1 — Security Headers Not Applied to Redirect Responses

**File:** `src/middleware.ts`

When the middleware returns a 302 redirect (e.g., unauthenticated admin → `/admin/`) or a 403, security headers are not added to that response. Only passthrough responses get headers.

**Impact:** Minor — browsers don't cache redirect headers, and attacks on the redirect itself are uncommon.  
**Fix direction:** Apply security headers to all responses including redirects.

---

### L2 — `admin/users` Actions Accept Unvalidated UUIDs

**File:** `src/pages/admin/users/index.astro`

`toggle_active` and `delete_user` both use `user_id` directly from `form.get("user_id")` without UUID format validation. While Supabase rejects malformed UUIDs at the DB level, an unvalidated string can cause confusing 500 errors rather than a clean 400.

**Fix direction:** Validate UUIDs with a regex or `z.string().uuid()` before use.

---

### L3 — `admin_users` Insert Does Not Provide the `id` FK

**File:** `src/pages/admin/users/index.astro`

The schema:
```sql
id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
```

The insert:
```ts
await supabase.from("admin_users").insert({ email, role, is_active: true });
```

No `id` is provided. Unless there's a `DEFAULT gen_random_uuid()` or trigger on the live DB (not in `docs/schema.sql`), this insert will fail at the NOT NULL / FK constraint and silently show "Failed to add user." New admin accounts cannot be created via the UI.

**Impact:** Admin user management is non-functional, forcing direct SQL access for all user provisioning.  
**Fix direction:** Look up the `auth.users.id` for the email before inserting:
```ts
const { data: authUser } = await supabase.from("admin_users")...
// or use supabase admin.auth.admin.getUserByEmail(email)
```

---

### L4 — Email Addresses Logged to Server Output

**File:** `src/middleware.ts`

```ts
console.error("[middleware] admin_users check failed", { email: user.email, adminError, adminUser });
```

User emails appear in Vercel Function logs, which are visible to anyone with Vercel dashboard access and potentially logged/retained by Vercel infrastructure.

**Fix direction:** Remove `email` from the log payload; log only a redacted form (e.g., `user.id`) or omit it entirely.

---

### L5 — `SITE_URL` Not Validated at Startup

**File:** `src/pages/admin/applications/[id].astro`

```ts
const siteUrl = import.meta.env.SITE_URL ?? "https://alfursanauto.ca";
const phase2Link = `${siteUrl}/apply/phase2?token=${token}`;
```

If `SITE_URL` is misconfigured to an attacker-controlled domain (e.g., during environment setup), the Phase 2 email would contain a phishing link to that domain.

**Fix direction:** Add `SITE_URL` to the env checker (`src/lib/check-env.ts`) and validate it starts with `https://`.

---

## Informational

- **`.env` and `.env.production` are in `.gitignore`** ✅ No secrets found in git history.
- **`.env.example` is committed** ✅ Contains only placeholder keys, no real values.
- **Signed URLs for admin downloads expire in 5 minutes** ✅ Good practice.
- **Draft IDs are UUIDs** ✅ Not sequential/guessable.
- **Zod validation on all API inputs** ✅ Phase 1 and Phase 2 schemas are thorough.
- **`X-Frame-Options: DENY`** ✅ Clickjacking protection present.
- **`X-Content-Type-Options: nosniff`** ✅ MIME sniffing protection present.
