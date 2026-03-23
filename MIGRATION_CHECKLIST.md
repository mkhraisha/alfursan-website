# Alfursan Auto WordPress -> Astro Migration Checklist

Last updated: 2026-03-21
Owner: Mahmoud + Copilot

How to use this file:

- Keep this as the single source of truth for migration progress.
- Check a box when a step is done (`[x]`).
- If scope changes, append a new item instead of deleting history.

## 1. Discovery And Planning

- [x] Confirm migration architecture: WordPress as headless source, Astro + React frontend.
- [x] Confirm incremental migration strategy (parallel build, no hard cutover at start).
- [x] Inspect live site structure and identify core routes to migrate first (`/`, `/search`, listing detail pages).
- [x] Verify WordPress public APIs are reachable (`wp-json`, `wp/v2/*`, Vehica custom data endpoints).
- [x] Export full URL inventory from production WordPress (all pages, listings, taxonomies, blog, utility pages).
- [x] Define redirect/canonical mapping table (`old_url -> new_url`, canonical, notes).

## 2. Frontend Foundation

- [x] Create Astro frontend project scaffold.
- [x] Add React integration for interactive islands.
- [x] Build shared layout shell with site metadata support.
- [x] Implement WordPress data layer (`src/lib/wordpress.ts`) with normalized `CarSummary` mapping.
- [x] Expand data layer to include all Vehica fields needed for full design and feature parity.
- [x] Add centralized error handling + fallback behavior for API failures/timeouts. _Added `fetchWithRetry` helper in wordpress.ts with automatic retry (2 attempts, 1s delay) on 5xx/network errors, no retry on 4xx. All API functions (`getCars`, `getCarBySlug`, `getPosts`, `getPostBySlug`, `getTermMap`) now use fetchWithRetry. List endpoints return empty arrays on failure; single-item endpoints return null._

## 3. Core Route Migration

- [x] Home page route (`src/pages/index.astro`) wired to live inventory data.
- [x] Inventory/search route (`src/pages/search/index.astro`) implemented.
- [x] Listing detail route (`src/pages/listing/[slug].astro`) implemented with static generation.
- [x] Build pipeline validated after route work (`npm run build`).
- [x] Migrate Contact page route (`src/pages/contact-us/index.astro`) using live WordPress page content.
- [x] Migrate About page route (`src/pages/about-us/index.astro`) using live WordPress page content.
- [x] Migrate `/faq/` page — standalone FAQ page with accordion questions (also embedded on About page on live site).
- [x] Migrate `/loan-calculator/` page — interactive loan calculator (price, interest rate, period, down payment).
- [x] Migrate `/sold/` page — dedicated sold-inventory view filtering to sold-only vehicles.
- [x] Migrate `/blog/` listing page and 2 existing blog posts (SEO value: `/14-surprisingly-affordable-luxury-cars/`, `/how-close-are-we-to-autonomous-cars/`).
- [x] Evaluate remaining WP pages for migration: `/compare/`, `/meet-the-team/`, `/our-team/`, `/map-search/`. **Decision:** `/compare/` SKIP (plugin-dependent JS), `/map-search/` SKIP (plugin-dependent JS), `/meet-the-team/` REDIRECT→`/our-team/` (duplicate with empty widgets), `/our-team/` MIGRATED with clean semantic page (stats + intro + CTA).

## 4. Inventory UX Parity

- [x] Add client-side filters (make, model, max price, max mileage).
- [x] Add URL query sync for filters.
- [x] Add sort controls with URL query sync.
- [x] Add pagination controls with URL query sync.
- [x] Add dynamic make/model option counts based on live filtered data.
- [x] Add smooth scroll to results on pagination change.
- [x] Expose all gallery images (`images: string[]`) in CarSummary for listing detail gallery.
- [x] Card info updated to show year, fuel type, drive type (matching production card layout).
- [x] Match all legacy Vehica filters and controls (body type, drivetrain, fuel, etc.). _Added collapsible "More Filters" panel with condition, body type, drivetrain, fuel type, transmission, and color dropdowns. Active filter count shown in toggle button. URL sync and matching logic for all new facets._
- [x] Verify legacy sort naming/default behavior parity with current production UX. _Changed sort label to "Date Listed: Newest" and logic to sort by WP publish date._
- [ ] Implement API-backed pagination/filtering for scale (instead of loading all cars on client).
- [x] Add "Sold" badge overlay on inventory cards for sold vehicles (live site shows a red "Sold" label over the card image).
- [x] Add image-count badge on inventory cards (live site shows photo count number over the card thumbnail).
- [ ] Add "Compare" feature on search page (live site has a "Compare" button alongside filters).

## 5. Visual And Brand Parity

- [x] Build baseline global header/nav with desktop links, active states, and mobile menu.
- [x] Rebuild global header/nav with mobile menu behavior matching current site.
- [x] Rebuild global footer with all content/links/disclaimers.
- [x] Match all production colours — extracted actual Vehica/Elementor CSS and built centralised theme object (`src/lib/theme.ts`) with 27 CSS custom properties.
- [x] Add Google Font "Bebas Neue" for hero heading; match production typography (87px/78px line-height, text-shadow).
- [x] Hero subtitle sized to 22px/36px weight 700; button padding 18px 40px matching Elementor output.
- [x] Add UCDA Member badge to hero section.
- [x] "Why choose us" section: 50px/900 heading, production icon images, centred card layout, 24px/40px card titles.
- [x] Recreate key homepage sections in final visual form (hero, trust blocks, featured inventory, etc.).
- [x] Listing detail page overhaul: breadcrumbs, image gallery with thumbnails, 2-column attributes grid, features checklist, contact sidebar, related listings.
- [x] Search page: breadcrumbs, card layout updated to show price/year/fuel/drivetrain matching production.
- [x] Widen all containers from 1200px to 1468px with 30px padding matching production max-width.
- [x] Nav link label: live site says "Search", local says "Listings" — aligned to match live site.
- [x] Footer: add FAQ quick link (live footer links: Listings, FAQ, About us, Contact — local was missing FAQ).
- [x] Footer: add physical address link (already present in footer Contact section with Google Maps link).
- [x] Homepage hero: added inline search bar with "We found N listings for you" label, make dropdown, and search button. CTA buttons kept as secondary actions below.
- [x] Homepage: live "Featured Listings" section has a "Hand picked" eyebrow label above it — added.
- [x] About page: verified — WP API returns all sections (intro, social links, CEO quote, Test Drive CTA, FAQ accordion). Content renders via `set:html`. Styling differs from Elementor but content is complete.
- [x] Contact page: replaced broken WPCF7 form with standalone contact form (FormSubmit.co), added Google Maps embed, rebuilt as 2-column layout with contact info + form. Map no longer depends on WP.
- [x] Run cross-device QA (mobile/tablet/desktop) for layout and interactions. _Audited all 14 component/page files for responsive breakpoints. Listing detail, homepage, about-us, blog, contact, FAQ, search, sold all have proper media queries (900px, 768px, 640px, 480px). Grids collapse to single-column on mobile. Hero subtitle now uses clamp() for fluid typography._
- [x] **Visual QA: compare every page side-by-side against live alfursanauto.ca and log remaining discrepancies.** _Fetched all 8 live pages and compared. Fixed: nav labels match live (Home, Search, About us, Contact — removed Blog from nav), footer copyright year (2025), footer postal code, footer link casing ("About us"), contact form privacy policy checkbox added, blog page heading/subtitle matched live ("Our Latest News / From spy shots..."), blog sidebar added (Recent Posts, About us)._

## 6. SEO And Analytics Parity

- [x] Implement page-level titles, meta descriptions, canonical tags, and OG/Twitter metadata parity. _Added canonical URLs, Open Graph (type, url, title, description, image, site_name, locale), and Twitter Card (summary_large_image) meta tags to Layout.astro. All pages pass `image` and `schema` props where applicable._
- [x] Add structured data/schema for vehicle listings and organization/local business. _Homepage: AutoDealer schema (name, address, geo, contact, sameAs). Listing pages: Vehicle schema (brand, model, year, mileage, transmission, fuel, drive, color, doors, bodyType, offers with price/currency/availability). Blog posts: Article schema (headline, dates, publisher, image)._
- [x] Generate XML sitemap strategy for Astro routes and dynamic listing pages. _Installed `@astrojs/sitemap`, configured `site` in astro.config.mjs. Generates sitemap-index.xml + sitemap-0.xml with all 35 pages including dynamic listing/blog slugs._
- [x] Add robots.txt rules aligned to production SEO strategy. _Created public/robots.txt: `User-agent: * Allow: /` with Sitemap directive pointing to sitemap-index.xml._
- [ ] Reconnect analytics/pixels (GA4, Meta Pixel, other tags) and conversion events.

## 7. Integrations And Operations

- [x] Migrate forms (contact/lead) with anti-spam protection and delivery verification. _Contact form rebuilt with FormSubmit.co (anti-spam honeypot + CAPTCHA). Delivery verified._
- [ ] Reconnect CRM or email workflows tied to lead submission.
- [x] Define environment variables and deployment configuration for staging and production. _Created `.env.example` documenting `PUBLIC_WP_API_BASE`. wordpress.ts reads env with safe fallback to default._
- [ ] Add uptime/error monitoring (frontend + API dependency monitoring).

## 8. QA, Launch, And Cutover

- [ ] Create staging deployment and run full functional QA pass.
- [ ] Run SEO regression checks (indexability, canonicals, redirects, metadata, structured data).
- [ ] Run performance checks (Core Web Vitals, image optimization, script budget).
- [ ] Freeze WordPress content before final sync window.
- [ ] Execute DNS/cutover and enable redirects.
- [ ] Monitor 404s, ranking/traffic, and lead funnel after launch.

## 9. Post-Launch Hardening

- [ ] Fix launch regressions discovered in logs and analytics.
- [ ] Optimize image pipeline and caching strategy.
- [ ] Document runbooks for content updates and incident response.
- [ ] Plan WordPress decommission timeline (after stabilization).

---

## Live Site vs. Local Comparison (2026-03-21)

Performed a full comparison of `alfursanauto.ca` (production WordPress/Vehica) against the local Astro build. Key findings:

### Inventory Changes Since Last Audit

- Live site now shows **24 listings** (was 22 at time of URL inventory export on 2026-03-08).
- New listings added since last audit:
  - `2016 Mazda CX-5 Touring, 127,117 KM, Zero Accidents`
  - `2014 Hyundai Elantra GL - 117k KM, Zero Accidents, Mechanically Perfect`
- Popular Makes distribution on live: Honda 9, Hyundai 5, Toyota 5, Mazda 3, Tesla 1.

### Pages Present on Live Site But Not Yet Migrated

| Live URL                                   | Description                                  | Priority |
| ------------------------------------------ | -------------------------------------------- | -------- |
| `/faq/`                                    | Standalone FAQ accordion page (12 questions) | Medium   |
| `/loan-calculator/`                        | Interactive loan/financing calculator        | Medium   |
| `/sold/`                                   | Sold-only inventory filtered view            | Medium   |
| `/blog/`                                   | Blog listing page                            | Low      |
| `/14-surprisingly-affordable-luxury-cars/` | Blog post                                    | Low      |
| `/how-close-are-we-to-autonomous-cars/`    | Blog post                                    | Low      |
| `/compare/`                                | Vehicle comparison tool                      | Low      |
| `/meet-the-team/`                          | Team page                                    | Low      |
| `/our-team/`                               | Team page (duplicate?)                       | Low      |
| `/map-search/`                             | Map-based search                             | Low      |
| `/login-register/`                         | User login/register (WP-only)                | Skip     |
| `/panel/`                                  | User dashboard (WP-only)                     | Skip     |

### Feature Gaps (Search/Inventory UX)

1. **Sold badge**: Live shows "Sold" overlay on sold vehicle cards; local does not.
2. **Image count badge**: Live shows photo count on card thumbnails; local does not.
3. **Compare feature**: Live has "Compare" button on search page; local does not.
4. **Filter UI**: Live uses a collapsible "Filters (0)" panel; local shows always-visible dropdowns.
5. **Sort default**: Live sorts by "Date Listed: Newest" (by WP publish date); local sorts by year desc.
6. **Additional filter facets on live**: condition, body type, drivetrain, fuel, transmission, cylinders, color, doors, features — most not exposed in local filter UI.

### Visual/Layout Gaps

1. **Nav label mismatch**: "Search" (live) vs "Listings" (local).
2. **Footer missing FAQ link**: Live footer has Listings/FAQ/About/Contact; local omits FAQ.
3. **Footer missing address**: Live footer includes physical address with Google Maps link.
4. **Hero search bar**: Live hero has an inline inventory search bar; local has CTA buttons.
5. **"Hand picked" label**: Live features section has this eyebrow text; local does not.
6. **Contact form**: Live uses WP plugin form (WPForms/CF7); local renders raw HTML that may not function.
7. **Google Maps embed**: Live contact page has an interactive embed; may be missing in local.

---

## Current Focus (Next Up)

- [x] Step 1: Export full URL inventory and draft redirect/canonical mapping. (`docs/migration/URL_INVENTORY_REDIRECT_MAP.md`)
- [x] Step 2: Expand Vehica field mapping in `src/lib/wordpress.ts` for full filter/detail parity.
- [x] Step 3: Migrate one high-value static page (recommended: Contact) as the template for the remaining page migrations.
- [x] Step 4: Colour extraction and theme object (`src/lib/theme.ts`) — 27 CSS vars, all pages converted.
- [x] Step 5: Design parity pass — hero typography, UCDA badge, why-us icons, card layouts, listing detail overhaul, breadcrumbs, gallery.
- [x] Step 6: Full visual QA — compared every page against live alfursanauto.ca and documented all differences (see comparison table above).
- [x] **Step 7: Fix quick-win visual gaps** — ~~nav label~~, ~~footer FAQ link~~, ~~footer address~~, ~~sold badge~~, ~~image count badge~~, ~~"Hand picked" label~~, ~~sort label/logic~~. **All done.**
- [x] **Step 8: Migrate missing pages** — `/faq/`, `/loan-calculator/`, `/sold/` done.
- [ ] **Step 9: Replace contact form** — implement standalone form solution to replace broken WP plugin markup.
- [ ] **Step 10: Implement remaining search filter facets and sort parity.**
