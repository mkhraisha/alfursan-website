## Plan: Full WordPress to Astro Migration

Migrate all public-facing content and routes from alfursanauto.ca into Astro using WordPress as the CMS source of truth, normalize legacy search path URLs to canonical query URLs with 301 redirects, and execute a big-bang cutover with measurable parity checks before DNS switch.

**Steps**

- [x] 1. Phase 1 - Baseline and parity inventory.
- [x] 2. Build a definitive migration matrix from docs/migration/URL_INVENTORY_REDIRECT_MAP.md and live sitemap: classify each public URL as migrated, partial, or missing; mark owner and acceptance criteria per URL family. This is the go/no-go artifact for cutover.
- [x] 3. Define explicit exclusions from scope (internal/template/admin/auth pages) and map each excluded legacy URL to either 410 or nearest public replacement; avoid orphaned crawl paths.
- [x] 4. Phase 2 - Data contracts and CMS-driven content.
- [x] 5. Extend src/lib/wordpress.ts with read APIs for CMS-driven About, FAQ, Team, and Contact content (or equivalent WP endpoints/CPTs), plus normalization types mirroring existing CarSummary/BlogPost mapping patterns.
- [x] 6. Replace hardcoded content on src/pages/about-us/index.astro, src/pages/faq/index.astro, src/pages/our-team/index.astro, and src/pages/contact-us/index.astro with fetched WP data and deterministic fallbacks for empty-state rendering.
- [x] 7. Add structured error-state signaling (empty vs fetch-failed) in data layer consumers so migration QA can detect integration failures instead of silent success.
- [x] 8. Phase 3 - Route parity and redirect implementation.
- [x] 9. Implement canonical routing policy: query-based canonical URLs for search/filter pages; support 301 redirects from legacy /search/<make>/ and /search/<make>/<model>/ patterns to canonical query URLs.
- [x] 10. Complete redirect coverage for all legacy public URLs from the inventory map, including blog/tag/category aliases and trailing-slash normalization, with one canonical destination per source.
- [ ] 10.1 Fix low-parity FAQ page content/style gaps identified in docs/migration/LIVE_VS_REPO_CONTENT_STYLE_COMPARISON.md (heading structure, body copy parity, and structural deltas).
- [ ] 10.1a Perform visual side-by-side comparison between local /faq and live /faq and only mark 10.1 complete after visual parity is confirmed.
- [ ] 10.2 Fix low-parity Loan Calculator content/style gaps identified in docs/migration/LIVE_VS_REPO_CONTENT_STYLE_COMPARISON.md (heading parity, body content parity, and structural deltas).
- [ ] 10.2a Perform visual side-by-side comparison between local /loan-calculator and live route and only mark 10.2 complete after visual parity is confirmed.
- [ ] 10.3 Fix low-parity Search page content/style gaps identified in docs/migration/LIVE_VS_REPO_CONTENT_STYLE_COMPARISON.md (heading parity, inventory header copy, and structural deltas).
- [ ] 10.3a Perform visual side-by-side comparison between local /search and live /search and only mark 10.3 complete after visual parity is confirmed.
- [ ] 10.4 Resolve medium-parity metadata/title mismatches across audited routes (home, about-us, contact-us, our-team, sold, blog list/detail).
- [ ] 10.5 Resolve medium-parity structure deltas across audited routes (form/embed/accordion/image differences where parity is required).
- [ ] 10.6 Re-run full live vs repo comparison and move all audited routes to high parity before Step 11 validation.
- [ ] 11. Ensure dynamic page parity for listings and blog detail pages by verifying slug coverage and handling stale/missing slugs with clean 404 behavior.
- [ ] 12. Phase 4 - SEO, indexing, and metadata parity.
- [ ] 13. Align page metadata through src/layouts/Layout.astro across all routes: titles, descriptions, canonical links, OG/Twitter tags, and schema consistency for listing/blog pages.
- [ ] 14. Publish clean crawl controls: robots and sitemap should include only public canonical URLs, exclude internal/template endpoints, and reflect redirect destinations.
- [ ] 15. Validate canonical/redirect coherence (no chains/loops; canonical target equals final 200 URL).
- [ ] 16. Phase 5 - Performance, reliability, and launch readiness.
- [ ] 17. Decide and implement freshness strategy for WP-backed content (scheduled rebuilds or on-demand deploy hook) so inventory/blog updates appear within agreed SLA.
- [ ] 18. Add build-time safeguards: fail CI when critical WP fetches fail or when URL matrix parity drops below target threshold.
- [ ] 19. Execute full pre-launch regression (content parity, route parity, SEO parity, accessibility, performance) and produce a launch checklist with rollback instructions.
- [ ] 20. Phase 6 - Big-bang cutover and post-launch stabilization.
- [ ] 21. Cut over DNS/hosting in one release window, enable redirect rules, submit updated sitemap, and run immediate crawl smoke tests for top routes.
- [ ] 22. Monitor 404s, redirect misses, and WP API errors during the first 72 hours; patch gaps rapidly and update the migration matrix to complete state.

**Relevant files**

- src/lib/wordpress.ts - extend WP data adapters, type contracts, retry/error semantics, and endpoint mapping reuse.
- src/pages/index.astro - home composition and existing inventory/blog integration pattern reference.
- src/pages/search/index.astro - canonical query route behavior and inventory filtering integration.
- src/pages/sold/index.astro - filtered inventory page pattern for status-based subsets.
- src/pages/listing/[slug].astro - dynamic listing route pattern, slug coverage, and schema reference.
- src/pages/blog/index.astro - blog listing parity and pagination strategy entry point.
- src/pages/blog/[slug].astro - blog detail parity and metadata/schema enhancements.
- src/pages/about-us/index.astro - migrate to CMS-driven content.
- src/pages/faq/index.astro - migrate to CMS-driven FAQ source.
- src/pages/our-team/index.astro - migrate team content to CMS source.
- src/pages/contact-us/index.astro - migrate contact data/content to CMS source.
- src/layouts/Layout.astro - global canonical/meta/OG/schema defaults and per-page override contract.
- public/robots.txt - indexing controls and crawler policy alignment.
- docs/migration/URL_INVENTORY_REDIRECT_MAP.md - source-of-truth URL parity and redirect tracking.

**Verification**

1. Route parity check: crawl all legacy public URLs and verify each resolves to exactly one final Astro URL via <=1 redirect hop.
2. Redirect verification: sample every redirect class (core pages, listing, blog, taxonomy, search make/model, filtered queries) for 301 status and canonical consistency.
3. Content parity audit: compare representative pages against WordPress for headings, key body sections, media, and critical CTAs.
4. SEO validation: check canonical, OG, schema, and indexability for home, listing detail, blog list/detail, search, and static content pages.
5. Data reliability test: simulate WP API failures/timeouts and ensure pages render explicit fallback/error states without silent empty content.
6. Performance baseline: run Lighthouse/Core Web Vitals snapshots for top templates and confirm no regression beyond agreed thresholds.
7. Accessibility smoke tests: keyboard navigation, landmark/heading order, color contrast, and form labeling on major templates.
8. Go-live validation: post-cutover crawl for top 200 URLs, monitor 404 and 5xx logs, and fix misses within stabilization window.

**Decisions**

- Included scope: all public-facing pages and URLs.
- Excluded scope: internal/template/admin/auth pages unless later explicitly reintroduced.
- Search URL policy: canonical query URLs in Astro with 301 redirects from legacy path-based search URLs.
- Content source policy: About/FAQ/Team/Contact become CMS-driven from WordPress APIs.
- Release model: big-bang cutover, not phased rollout.

**Further Considerations**

1. WordPress content modeling: decide whether FAQ/Team live in existing WP pages, custom fields, or CPTs before implementation to avoid adapter churn.
2. Redirect ownership: choose deployment layer (hosting platform redirects vs app middleware) based on observability and ease of emergency updates.
3. Freshness SLA: define acceptable content latency (for listings/blog) to choose rebuild cadence and webhook triggers.
