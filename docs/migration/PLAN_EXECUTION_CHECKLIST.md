# Full Migration Plan Execution Checklist

Source of truth plan: docs/migration/FULL_MIGRATION_PLAN.md
Tracking file created: 2026-03-28

How to use this checklist:

- This checklist tracks execution of the full plan only.
- Mark each item done when implementation and verification criteria are met.
- Do not use legacy checklist files for execution tracking.

## Phase 1: Baseline And Parity Inventory

- [x] 1. Complete baseline and parity inventory.
  - Evidence: docs/migration/PHASE1_BASELINE_PARITY_INVENTORY.md
- [x] 2. Build definitive URL migration matrix from inventory and live sitemap, with migrated/partial/missing status, owner, and acceptance criteria per URL family.
  - Evidence: docs/migration/PHASE1_BASELINE_PARITY_INVENTORY.md
- [x] 3. Define and document exclusions (internal/template/admin/auth) and map excluded URLs to 410 or nearest public replacement.
  - Evidence: docs/migration/PHASE1_BASELINE_PARITY_INVENTORY.md

## Phase 2: Data Contracts And CMS-Driven Content

- [x] 4. Extend WordPress adapters with read APIs for About, FAQ, Team, and Contact content models.
  - Evidence: src/lib/wordpress.ts
- [x] 5. Replace hardcoded content in About, FAQ, Team, and Contact pages with WP-driven data and deterministic fallbacks.
  - Evidence: src/pages/about-us/index.astro, src/pages/faq/index.astro, src/pages/our-team/index.astro, src/pages/contact-us/index.astro
- [x] 6. Add explicit error-state signaling (empty vs fetch-failed) in data consumers.
  - Evidence: src/pages/about-us/index.astro, src/pages/faq/index.astro, src/pages/our-team/index.astro, src/pages/contact-us/index.astro

## Phase 3: Route Parity And Redirect Implementation

- [x] 7. Implement canonical query routing policy for search/filter pages.
  - Evidence: src/components/InventoryFilters.tsx
- [x] 8. Implement 301 redirects from legacy search path URLs (/search/<make>/ and /search/<make>/<model>/) to canonical query URLs.
  - Evidence: astro.config.mjs, public/\_redirects
- [x] 9. Complete redirect coverage for all legacy public URLs, including taxonomy aliases and trailing-slash normalization.
  - Evidence: astro.config.mjs, public/\_redirects
- [x] 9.1 Fix low-parity FAQ route gaps from docs/migration/LIVE_VS_REPO_CONTENT_STYLE_COMPARISON.md.
- [x] 9.1a Run visual side-by-side comparison for /faq against live site and confirm layout/spacing/accordion behavior parity before marking 9.1 complete.
  - Evidence log: docs/migration/VISUAL_COMPARISON_LOG.md
- [x] 9.2 Fix low-parity Loan Calculator route gaps from docs/migration/LIVE_VS_REPO_CONTENT_STYLE_COMPARISON.md.
- [x] 9.2a Run visual side-by-side comparison for /loan-calculator against live site and confirm heading/body/form layout parity before marking 9.2 complete.
  - Evidence log: docs/migration/VISUAL_COMPARISON_LOG.md
- [ ] 9.3 Fix low-parity Search route gaps from docs/migration/LIVE_VS_REPO_CONTENT_STYLE_COMPARISON.md.
- [ ] 9.3a Run visual side-by-side comparison for /search against live site and confirm heading/result-card/filter layout parity before marking 9.3 complete.
  - Evidence log: docs/migration/VISUAL_COMPARISON_LOG.md
- [ ] 9.4 Resolve medium-parity metadata/title mismatches across audited routes.
- [ ] 9.5 Resolve medium-parity structural style/content deltas where parity is required.
- [ ] 9.6 Re-run live-vs-repo audit and achieve high parity on all audited routes.
- [ ] 10. Validate dynamic parity and 404 behavior for listing and blog detail slugs.

## Phase 4: SEO, Indexing, And Metadata Parity

- [ ] 11. Align metadata across all routes via shared layout contract (title, description, canonical, OG/Twitter, schema consistency).
- [ ] 12. Ensure robots/sitemap include only public canonical URLs and exclude internal/template endpoints.
- [ ] 13. Validate canonical/redirect coherence (no chains, no loops, canonical equals final 200 URL).

## Phase 5: Performance, Reliability, And Launch Readiness

- [ ] 14. Implement freshness strategy (scheduled rebuilds or on-demand deploy hooks) with agreed SLA.
- [ ] 15. Add CI/build safeguards for critical WP fetch failures and parity threshold regression.
- [ ] 16. Run full pre-launch regression (content, routes, SEO, accessibility, performance) and produce launch/rollback checklist.

## Phase 6: Big-Bang Cutover And Stabilization

- [ ] 17. Execute cutover window (DNS/hosting), enable redirect rules, submit updated sitemap, run top-route smoke tests.
- [ ] 18. Monitor 404s, redirect misses, and WP/API errors for first 72 hours and patch quickly.

## Verification Checklist (Cross-Phase)

- [ ] Route parity crawl completed for all legacy public URLs (<=1 redirect hop to final URL).
- [ ] Redirect class sampling completed (core pages, listing, blog, taxonomy, search patterns, filtered queries).
- [ ] Content parity audit completed for representative templates.
- [ ] SEO validation completed for home, listing detail, blog list/detail, search, and static pages.
- [ ] Failure-mode test completed for WP API timeout/failure handling.
- [ ] Performance baseline validated (no unacceptable regression).
- [ ] Accessibility smoke tests completed.
- [ ] Post-cutover crawl completed and issues triaged.
