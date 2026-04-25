# Production Go-Live Checklist

**Date Created**: April 25, 2026  
**Status**: Ready for production deployment  
**Stack**: Astro 6 + Supabase + Vercel

---

## ✅ Already Completed

- [x] Supabase link + migration repair (baseline registered)
- [x] Admin user verified in production database
- [x] Security audit fixes deployed (H2, M1–M6, L1, L2, L4)
- [x] Phase 2 documents/references flow tested
- [x] Privacy Policy page live
- [x] Build process fixed (env var loading)

---

## 🚀 Production Deployment Steps

### 1. CORS Allowlist Update ⚠️ CRITICAL

**Location**: `src/middleware.ts` → `isAllowedOrigin()` function

**Current**: Allows any `.vercel.app` origin (security risk)

**Update to**:

```typescript
const ALLOWED_ORIGINS = [
  // Development
  "http://localhost:4321",
  "http://localhost:3000",

  // Vercel preview deployments (staging)
  /https:\/\/.+\.vercel\.app$/, // regex for any preview/staging

  // Production
  "https://alfursanauto.ca",
  "https://www.alfursanauto.ca",
];

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.some((allowed) =>
    allowed instanceof RegExp ? allowed.test(origin) : origin === allowed,
  );
}
```

**After updating**, redeploy to Vercel.

### 2. DNS & Email Verification

- [ ] Verify MX records point to your mail provider (not Vercel infrastructure)
- [ ] Test SPF record: `dig txt alfursanauto.ca` (should include your mail provider)
- [ ] Test DKIM: Verify signing key is active
- [ ] Send a test application → verify email delivery to dealer inbox
- [ ] Verify `RESEND_FROM_ADDRESS` is a verified Resend domain

### 3. End-to-End Staging Tests

Run these tests on the staging environment before switching to production:

#### Phase 1 — Application Form

- [ ] Navigate to `/finance/` (public page loads)
- [ ] Fill out all fields (personal, employment, vehicle, address history)
- [ ] Upload driver's license front and back
- [ ] Accept consent checkboxes
- [ ] Submit form → verify success message
- [ ] Confirm application appears in admin dashboard with correct data
- [ ] Verify email sent to dealer inbox

#### Phase 2 — Documents & References

- [ ] Admin: Set an application status to `document_incomplete`
- [ ] Verify Phase 2 email sent to applicant with token link
- [ ] Open Phase 2 link in incognito/new browser (token-gated access)
- [ ] Upload void cheque, proof of insurance, pay stub
- [ ] Add 2 personal references (name, phone, relationship)
- [ ] Accept Dealertrack consent checkbox
- [ ] Submit → verify status changes to `documents_submitted`
- [ ] Admin: View Phase 2 documents and references in detail page
- [ ] Admin: Edit Phase 1 fields (test inline edit)

#### Admin Dashboard

- [ ] Magic-link login from email works
- [ ] Applications list displays all submissions
- [ ] Click into application detail → all data visible
- [ ] Status dropdown: cycle through all statuses (new → reviewing → document_incomplete → documents_submitted → approved/declined)
- [ ] License viewer: download front/back images (check filename format: `REF-{id}_front.{ext}`)
- [ ] Delete application → verify storage cleanup (check Supabase Storage bucket is empty for that app)
- [ ] Export application as JSON
- [ ] Audit log shows all actions (viewed_license, status_changed, deleted, etc.)
- [ ] User management: Test add/edit/deactivate user

#### Rate Limiting (if Upstash enabled)

- [ ] Submit 30+ rapid applications from same IP → 31st should be rate-limited
- [ ] Verify rate-limit error message is user-friendly
- [ ] Wait for rate-limit window to reset, verify new submission accepted

#### Error Handling

- [ ] Submit form with invalid data → validation errors display
- [ ] Upload oversized file → error message shown
- [ ] Submit Phase 2 with expired token → graceful error (token expires after 30 days)
- [ ] Network error during submission → retry logic works

#### Security & Privacy

- [ ] Verify `/admin/*` pages reject unauthenticated access
- [ ] Check CSP headers in browser dev tools (Content-Security-Policy header present)
- [ ] Verify session cookie is HttpOnly + Secure + SameSite=Lax
- [ ] Admin logout clears session
- [ ] Privacy Policy page `/privacy-policy` loads and links work

#### Cross-Browser/Device

- [ ] Test on Chrome, Firefox, Safari (desktop)
- [ ] Test on mobile Safari (iOS) and Chrome (Android)
- [ ] Form layout responsive on mobile
- [ ] File uploads work on mobile

---

## 📋 Production Switchover

Once staging tests pass:

1. **Update DNS CNAME** (if not already pointing to Vercel):

   ```
   alfursanauto.ca → cname.vercel-dns.com
   www.alfursanauto.ca → cname.vercel-dns.com
   ```

2. **Verify SSL certificate** (Vercel auto-provisions):

   ```bash
   curl -I https://alfursanauto.ca
   # Look for: HTTP/1.1 200 OK
   # Look for: strict-transport-security header
   ```

3. **Update Supabase Auth config** (if not already done):
   - Supabase Dashboard → Authentication → URL Configuration
   - **Site URL**: `https://alfursanauto.ca`
   - **Redirect URLs**: `https://alfursanauto.ca/admin/callback/`

4. **Test production domain** in browser:
   - [ ] Site loads at `https://alfursanauto.ca`
   - [ ] Admin link works at `https://alfursanauto.ca/admin/`
   - [ ] Form submits successfully
   - [ ] Emails deliver to dealer inbox

5. **Enable monitoring** (optional):
   - [ ] Set up Sentry (or similar) for error tracking
   - [x] Enable Vercel Analytics
   - [ ] Configure Slack/email alerts for deployment failures

---

## 🔐 Post-Deployment Security Checklist

- [ ] H1 CORS fix deployed (explicit allowlist only)
- [x] All environment variables set in Vercel dashboard
- [ ] Database backups configured in Supabase (automated daily)
- [ ] Audit logging functional (verify `application_audit` table has recent entries)
- [x] Rate limiting active (Upstash or graceful fallback)
- [x] Error logging enabled (no sensitive data in logs)

---

## 📞 Rollback Plan

If issues arise after going live:

1. **Revert DNS** (point back to old infrastructure if applicable)
2. **Disable Vercel deployment** (mark as failed in dashboard)
3. **Investigate error logs** (Vercel deployment logs + Supabase logs)
4. **Fix issue locally** on feature branch, test, then redeploy

---

## 📝 Notes

- **Email setup**: Your domain's MX records are separate from Vercel DNS. Verify both are correct.
- **7-year retention**: Supabase is configured to retain application data for 7 years (PIPEDA compliance).
- **Rate limiting**: Upstash Redis is optional. If not set, rate limiter gracefully falls back to per-request UUID isolation.
- **Migrations**: All future DB changes use `npm run db:new` + `npm run db:push` workflow (see README for details).
