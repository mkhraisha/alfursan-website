# Phase 1 Baseline And Parity Inventory

Generated: 2026-03-28
Plan reference: docs/migration/FULL_MIGRATION_PLAN.md
Inventory source: docs/migration/URL_INVENTORY_REDIRECT_MAP.md

## Scope Applied

- Included: public-facing URLs and user-relevant route patterns.
- Excluded from migration scope: internal/template/admin/auth URLs.
- Canonical search policy: query URLs are canonical; legacy path-based search URLs must 301 to canonical query URLs.

## Inventory Snapshot

- Total unique URLs discovered in source inventory: 140.
- Source inventory includes core pages, listing pages, blog posts, blog taxonomies, search path URLs, search query URLs, and internal template URLs.

## Excluded URL Groups (Per Plan Scope)

- /vehica_template/\* (internal template content)
- /login-register/ (auth)
- /panel/ (user/admin panel)
- /404-page/ (utility path, not a canonical content page)

## Point 3 Exclusion Action Map

All excluded groups are explicitly mapped to launch behavior.

| Excluded Legacy Pattern | Action Type | Target | SEO/Crawl Rule                                             | Owner             | Acceptance Criteria                                                          |
| ----------------------- | ----------- | ------ | ---------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| /vehica_template/\*     | 410 Gone    | n/a    | Exclude from sitemap; return non-indexable responses       | Mahmoud + Copilot | Sample URLs return 410 and no redirect chain is introduced.                  |
| /login-register/        | 410 Gone    | n/a    | Exclude from sitemap; return non-indexable responses       | Mahmoud + Copilot | URL returns 410 and does not resolve to an unintended 200 page.              |
| /panel/                 | 410 Gone    | n/a    | Exclude from sitemap; return non-indexable responses       | Mahmoud + Copilot | URL returns 410 and monitoring shows no redirect loop.                       |
| /404-page/              | 410 Gone    | n/a    | Exclude from sitemap; rely on Astro 404 for unknown routes | Mahmoud + Copilot | Legacy utility URL returns 410 while normal unknown routes still render 404. |

## Definitive Migration Matrix (Public URL Families)

Status values:

- Migrated: route exists and is usable in Astro.
- Partial: route exists but has parity gaps (content source, SEO, redirect, or behavior parity).
- Missing: route/pattern not implemented in Astro yet.

| Legacy URL Family              | Inventory Count | Astro Target Pattern                       | Status   | Owner             | Acceptance Criteria                                              |
| ------------------------------ | --------------: | ------------------------------------------ | -------- | ----------------- | ---------------------------------------------------------------- |
| /                              |               1 | /                                          | Migrated | Mahmoud + Copilot | Content, metadata, and schema parity verified in launch QA.      |
| /about-us/                     |               1 | /about-us/                                 | Partial  | Mahmoud + Copilot | Content sourced from WP model with parity and fallback states.   |
| /contact-us/                   |               1 | /contact-us/                               | Partial  | Mahmoud + Copilot | Content source, lead flow, and metadata parity validated.        |
| /faq/                          |               1 | /faq/                                      | Partial  | Mahmoud + Copilot | FAQ model sourced from WP and rendered with parity.              |
| /our-team/                     |               1 | /our-team/                                 | Partial  | Mahmoud + Copilot | Team data sourced from WP and validated for parity.              |
| /loan-calculator/              |               1 | /loan-calculator/                          | Migrated | Mahmoud + Copilot | UX and SEO parity pass regression.                               |
| /sold/                         |               1 | /sold/                                     | Migrated | Mahmoud + Copilot | Filtered results and metadata parity pass.                       |
| /blog/                         |               1 | /blog/                                     | Partial  | Mahmoud + Copilot | Blog listing pagination and metadata parity validated.           |
| Root-level blog posts (/slug/) |               2 | /blog/<slug>/ via 301                      | Missing  | Mahmoud + Copilot | 301 mapping exists for all legacy blog post URLs.                |
| /listing/<slug>/               |              22 | /listing/<slug>/                           | Partial  | Mahmoud + Copilot | Full slug coverage and clean missing-slug handling validated.    |
| /search/                       |               1 | /search/                                   | Migrated | Mahmoud + Copilot | Canonical/meta parity and filter behavior validated.             |
| /search/<make>/                |               6 | /search/?make=<make> via 301               | Missing  | Mahmoud + Copilot | 301 redirects in place for all make URLs.                        |
| /search/<make>/<model>/        |              19 | /search/?make=<make>&model=<model> via 301 | Missing  | Mahmoud + Copilot | 301 redirects in place for all make/model URLs.                  |
| /search/?<filters>             |              56 | /search/?<filters>                         | Partial  | Mahmoud + Copilot | Legacy filter parity and canonical consistency validated.        |
| /category/<slug>/              |               3 | policy-pending (keep or redirect)          | Missing  | Mahmoud + Copilot | Final taxonomy policy implemented with redirects/canonicals.     |
| /tag/<slug>/                   |               6 | policy-pending (keep or redirect)          | Missing  | Mahmoud + Copilot | Final taxonomy policy implemented with redirects/canonicals.     |
| /compare/                      |               1 | policy-pending                             | Missing  | Mahmoud + Copilot | Explicit keep/remove decision implemented via route or redirect. |
| /map-search/                   |               1 | policy-pending                             | Missing  | Mahmoud + Copilot | Explicit keep/remove decision implemented via route or redirect. |
| /meet-the-team/                |               1 | /our-team/ via 301                         | Missing  | Mahmoud + Copilot | 301 redirect implemented and validated.                          |

## Point 2 Completion

Point 2 completed: definitive migration matrix established with status, owner, and acceptance criteria.

Matrix source references:

- Core pages, blog posts, listings, taxonomies, and search URLs: docs/migration/URL_INVENTORY_REDIRECT_MAP.md
- Current Astro route coverage: src/pages/\*

## Phase 1 Point 1 Outcome

Point 1 completed: baseline and parity inventory established in this document.

## Point 3 Completion

Point 3 completed: exclusion scope is explicitly documented and each excluded pattern is mapped to a concrete handling action.

Immediate next actions (Phase 2):

- Begin CMS-driven content/data contract work in src/lib/wordpress.ts and the About/FAQ/Team/Contact pages.
