# Alfursan Auto WordPress -> Astro Migration Checklist

Last updated: 2026-03-08
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
- [ ] Add centralized error handling + fallback behavior for API failures/timeouts.

## 3. Core Route Migration
- [x] Home page route (`src/pages/index.astro`) wired to live inventory data.
- [x] Inventory/search route (`src/pages/search/index.astro`) implemented.
- [x] Listing detail route (`src/pages/listing/[slug].astro`) implemented with static generation.
- [x] Build pipeline validated after route work (`npm run build`).
- [x] Migrate Contact page route (`src/pages/contact-us/index.astro`) using live WordPress page content.
- [x] Migrate About page route (`src/pages/about-us/index.astro`) using live WordPress page content.
- [ ] Migrate remaining business pages (Financing, Trade-in, etc.). (FAQ excluded by scope)
- [ ] Migrate blog/news pages (if still used for SEO or campaigns).

## 4. Inventory UX Parity
- [x] Add client-side filters (make, model, max price, max mileage).
- [x] Add URL query sync for filters.
- [x] Add sort controls with URL query sync.
- [x] Add pagination controls with URL query sync.
- [x] Add dynamic make/model option counts based on live filtered data.
- [x] Add smooth scroll to results on pagination change.
- [x] Expose all gallery images (`images: string[]`) in CarSummary for listing detail gallery.
- [x] Card info updated to show year, fuel type, drive type (matching production card layout).
- [ ] Match all legacy Vehica filters and controls (body type, drivetrain, fuel, etc.).
- [ ] Verify legacy sort naming/default behavior parity with current production UX.
- [ ] Implement API-backed pagination/filtering for scale (instead of loading all cars on client).

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
- [ ] Run cross-device QA (mobile/tablet/desktop) for layout and interactions.
- [ ] **Visual QA: compare every page side-by-side against live alfursanauto.ca and log remaining discrepancies.**

## 6. SEO And Analytics Parity
- [ ] Implement page-level titles, meta descriptions, canonical tags, and OG/Twitter metadata parity.
- [ ] Add structured data/schema for vehicle listings and organization/local business.
- [ ] Generate XML sitemap strategy for Astro routes and dynamic listing pages.
- [ ] Add robots.txt rules aligned to production SEO strategy.
- [ ] Reconnect analytics/pixels (GA4, Meta Pixel, other tags) and conversion events.

## 7. Integrations And Operations
- [ ] Migrate forms (contact/lead) with anti-spam protection and delivery verification.
- [ ] Reconnect CRM or email workflows tied to lead submission.
- [ ] Define environment variables and deployment configuration for staging and production.
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

## Current Focus (Next Up)
- [x] Step 1: Export full URL inventory and draft redirect/canonical mapping. (`docs/migration/URL_INVENTORY_REDIRECT_MAP.md`)
- [x] Step 2: Expand Vehica field mapping in `src/lib/wordpress.ts` for full filter/detail parity.
- [x] Step 3: Migrate one high-value static page (recommended: Contact) as the template for the remaining page migrations.
- [x] Step 4: Colour extraction and theme object (`src/lib/theme.ts`) — 27 CSS vars, all pages converted.
- [x] Step 5: Design parity pass — hero typography, UCDA badge, why-us icons, card layouts, listing detail overhaul, breadcrumbs, gallery.
- [ ] **Step 6: Full visual QA — open every page alongside the live site and document any remaining visual differences.**
