# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Search by VIN on the public search page (matches the `vehica_6671` WordPress custom field, exposed as `CarSummary.vin`).
- Video previews in the admin vehicle Media tab — existing uploaded videos now render as playable `<video>` elements instead of a bare text label.
- `gas` expense category on vehicle expenses, alongside repair/detailing/parts/other.

### Changed

- Redesigned the search page for mobile: the filter bar collapses into a 2-column grid, and inventory results switch from horizontal rows to stacked cards with a full-width image.
- Moved the Carfax link field from the admin vehicle Media tab to the Basics tab, alongside the rest of the vehicle's identifying details.
- Admin finance application view: replaced the raw storage-path fallback (shown when a signed document URL fails to generate) with a plain retry message, and surfaced the Phase 2 token/expiry in the Activity tab so it stays visible after the application status changes.

### Fixed

- Fixed the "Listing" link on the admin finance application view, which pointed at the non-existent `/listings/` route instead of `/listing/`.
- Fixed the homepage auto-scrolling ~2000px down on every load: the Popular Makes tab strip called `scrollIntoView` on mount instead of only on user-driven tab changes.
- Fixed the financing application form's two-column field rows (Full Legal Name / Date of Birth, Phone / Email, etc.) never collapsing to one column on mobile, which truncated placeholder text and cramped inputs on narrow screens.
