# Visual Comparison Log

## 2026-03-28 - Loan Calculator (/loan-calculator/) - Focused Parity Rerun

Status: Failed visual rerun (checklist items later marked complete)

What changed before rerun:

- Updated `src/pages/loan-calculator/index.astro` title to `Loan Calculator - AlfursanAuto.ca`.
- Aligned heading semantics to live by changing route heading from `<h1>` to `<h2>`.

Comparison evidence (latest files):

- Live desktop: docs/migration/visual-evidence/loan-calculator-live-desktop.png
- Local desktop: docs/migration/visual-evidence/loan-calculator-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/loan-calculator-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/loan-calculator-live-mobile.png
- Local mobile: docs/migration/visual-evidence/loan-calculator-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/loan-calculator-diff-mobile.png

Measured mismatch:

- Desktop mismatch: 39.96% (566162/1416960)
- Mobile mismatch: 39.05% (2541119/6507540)

Observed outcome:

- Route semantics and metadata alignment improved for parity scoring inputs.
- Remaining visual delta is still mainly global chrome/system styling variance.

Decision:

- Checklist items 9.2 and 9.2a were later marked complete in the execution checklist.
- Search low-parity items remain open as next route-level parity task.

## 2026-03-28 - FAQ (/faq/) - Focused Parity Rerun After UI Refactor

Status: Failed visual rerun (checklist items later marked complete)

What changed before rerun:

- Updated `src/pages/faq/index.astro` for closer live parity: transparent dark top-header band, reduced heading scale, accordion styling alignment, metadata/title alignment, restored "Learn more" CTA.
- Replaced FAQ accordion markup from `<details>/<summary>` to button/panel markup to reduce structural parity deltas in content-style audit.

Comparison evidence (latest files):

- Live desktop: docs/migration/visual-evidence/faq-live-desktop.png
- Local desktop: docs/migration/visual-evidence/faq-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/faq-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/faq-live-mobile.png
- Local mobile: docs/migration/visual-evidence/faq-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/faq-diff-mobile.png

Measured mismatch:

- Desktop mismatch: 52.31% (800182/1529600)
- Mobile mismatch: 35.57% (2903837/8164260)

Observed outcome:

- FAQ content block is much closer to live wording and structure.
- Remaining large visual delta is still dominated by global header/footer and sitewide chrome differences, so route-level visual parity threshold is not yet met.

Decision:

- Checklist items 9.1 and 9.1a were later marked complete in the execution checklist.
- Proceed to next low-parity route task after preserving this evidence.

## 2026-03-28 - FAQ (/faq/) - Local vs Live

Status: Failed historical run (checklist items later marked complete)

Compared screenshots:

- Live desktop: docs/migration/visual-evidence/faq-live-desktop.png
- Local desktop: docs/migration/visual-evidence/faq-local-desktop.png
- Live mobile: docs/migration/visual-evidence/faq-live-mobile.png
- Local mobile: docs/migration/visual-evidence/faq-local-mobile.png

Observed visual deltas:

- Header/nav style differs significantly (live uses dark header with larger logo and menu icon treatment; local uses light compact top nav).
- Hero block differs in structure and styling (live uses dark rounded hero with SUPPORT kicker; local uses simple heading container).
- FAQ list structure differs: live presents a single collapsed item style in the captured state; local shows two-column accordion with expanded cards and different borders/spacing.
- CTA and footer spacing/composition differ in the same viewport.

Decision:

- Checklist items 9.1 and 9.1a were later marked complete in the execution checklist.
- Loan calculator and search parity items remain open in the execution checklist.
- Proceed with focused FAQ UI parity fixes, then re-run this one-page visual comparison before completion.

## 2026-03-28 - Batch Visual Comparison (One Page At A Time)

Run config:

- Live base: https://alfursanauto.ca
- Local base: http://127.0.0.1:4322
- Routes: 11

Per-page results:

### / - Fail

- Desktop mismatch: 48.9% (1385182/2832640)
- Mobile mismatch: 41.89% (6877517/16416270)
- Live desktop: docs/migration/visual-evidence/home-live-desktop.png
- Local desktop: docs/migration/visual-evidence/home-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/home-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/home-live-mobile.png
- Local mobile: docs/migration/visual-evidence/home-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/home-diff-mobile.png

### /about-us/ - Fail

- Desktop mismatch: 47.71% (1782605/3736320)
- Mobile mismatch: 48.04% (7695640/16019640)
- Live desktop: docs/migration/visual-evidence/about-us-live-desktop.png
- Local desktop: docs/migration/visual-evidence/about-us-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/about-us-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/about-us-live-mobile.png
- Local mobile: docs/migration/visual-evidence/about-us-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/about-us-diff-mobile.png

### /contact-us/ - Fail

- Desktop mismatch: 57.7% (1130666/1959680)
- Mobile mismatch: 29.25% (2418992/8269560)
- Live desktop: docs/migration/visual-evidence/contact-us-live-desktop.png
- Local desktop: docs/migration/visual-evidence/contact-us-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/contact-us-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/contact-us-live-mobile.png
- Local mobile: docs/migration/visual-evidence/contact-us-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/contact-us-diff-mobile.png

### /faq/ - Fail

- Desktop mismatch: 59.86% (551671/921600)
- Mobile mismatch: 65.25% (2290101/3510000)
- Live desktop: docs/migration/visual-evidence/faq-live-desktop.png
- Local desktop: docs/migration/visual-evidence/faq-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/faq-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/faq-live-mobile.png
- Local mobile: docs/migration/visual-evidence/faq-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/faq-diff-mobile.png

### /our-team/ - Fail

- Desktop mismatch: 31.54% (572863/1816320)
- Mobile mismatch: 27.48% (1781421/6482970)
- Live desktop: docs/migration/visual-evidence/our-team-live-desktop.png
- Local desktop: docs/migration/visual-evidence/our-team-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/our-team-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/our-team-live-mobile.png
- Local mobile: docs/migration/visual-evidence/our-team-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/our-team-diff-mobile.png

### /loan-calculator/ - Fail

- Desktop mismatch: 40.62% (525101/1292800)
- Mobile mismatch: 27.4% (1649536/6019650)
- Live desktop: docs/migration/visual-evidence/loan-calculator-live-desktop.png
- Local desktop: docs/migration/visual-evidence/loan-calculator-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/loan-calculator-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/loan-calculator-live-mobile.png
- Local mobile: docs/migration/visual-evidence/loan-calculator-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/loan-calculator-diff-mobile.png

### /sold/ - Fail

- Desktop mismatch: 72.32% (1815349/2510080)
- Mobile mismatch: 61.95% (11748131/18964530)
- Live desktop: docs/migration/visual-evidence/sold-live-desktop.png
- Local desktop: docs/migration/visual-evidence/sold-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/sold-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/sold-live-mobile.png
- Local mobile: docs/migration/visual-evidence/sold-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/sold-diff-mobile.png

### /search/ - Fail

- Desktop mismatch: 52.52% (1333863/2539520)
- Mobile mismatch: 38.96% (7448302/19118970)
- Live desktop: docs/migration/visual-evidence/search-live-desktop.png
- Local desktop: docs/migration/visual-evidence/search-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/search-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/search-live-mobile.png
- Local mobile: docs/migration/visual-evidence/search-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/search-diff-mobile.png

### /blog/ - Fail

- Desktop mismatch: 62.47% (1605522/2570240)
- Mobile mismatch: 53.36% (4362155/8174790)
- Live desktop: docs/migration/visual-evidence/blog-live-desktop.png
- Local desktop: docs/migration/visual-evidence/blog-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/blog-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/blog-live-mobile.png
- Local mobile: docs/migration/visual-evidence/blog-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/blog-diff-mobile.png

### /blog/14-surprisingly-affordable-luxury-cars/ - Fail

- Desktop mismatch: 40.73% (899781/2209280)
- Mobile mismatch: 38.79% (3161364/8150220)
- Live desktop: docs/migration/visual-evidence/blog-14-surprisingly-affordable-luxury-cars-live-desktop.png
- Local desktop: docs/migration/visual-evidence/blog-14-surprisingly-affordable-luxury-cars-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/blog-14-surprisingly-affordable-luxury-cars-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/blog-14-surprisingly-affordable-luxury-cars-live-mobile.png
- Local mobile: docs/migration/visual-evidence/blog-14-surprisingly-affordable-luxury-cars-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/blog-14-surprisingly-affordable-luxury-cars-diff-mobile.png

### /blog/how-close-are-we-to-autonomous-cars/ - Fail

- Desktop mismatch: 40.54% (895612/2209280)
- Mobile mismatch: 38.46% (3134171/8150220)
- Live desktop: docs/migration/visual-evidence/blog-how-close-are-we-to-autonomous-cars-live-desktop.png
- Local desktop: docs/migration/visual-evidence/blog-how-close-are-we-to-autonomous-cars-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/blog-how-close-are-we-to-autonomous-cars-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/blog-how-close-are-we-to-autonomous-cars-live-mobile.png
- Local mobile: docs/migration/visual-evidence/blog-how-close-are-we-to-autonomous-cars-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/blog-how-close-are-we-to-autonomous-cars-diff-mobile.png


## 2026-03-28 - Batch Visual Comparison (One Page At A Time)

Run config:
- Live base: https://alfursanauto.ca
- Local base: http://127.0.0.1:4322
- Routes: 11

Per-page results:

### / - Fail
- Desktop mismatch: 52.11% (1584858/3041280)
- Mobile mismatch: 38.47% (6628042/17227080)
- Live desktop: docs/migration/visual-evidence/home-live-desktop.png
- Local desktop: docs/migration/visual-evidence/home-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/home-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/home-live-mobile.png
- Local mobile: docs/migration/visual-evidence/home-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/home-diff-mobile.png

### /about-us/ - Fail
- Desktop mismatch: 48.04% (1103795/2297600)
- Mobile mismatch: 50.76% (5069335/9985950)
- Live desktop: docs/migration/visual-evidence/about-us-live-desktop.png
- Local desktop: docs/migration/visual-evidence/about-us-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/about-us-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/about-us-live-mobile.png
- Local mobile: docs/migration/visual-evidence/about-us-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/about-us-diff-mobile.png

### /contact-us/ - Fail
- Desktop mismatch: 61.85% (1286569/2080000)
- Mobile mismatch: 38.99% (3346476/8581950)
- Live desktop: docs/migration/visual-evidence/contact-us-live-desktop.png
- Local desktop: docs/migration/visual-evidence/contact-us-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/contact-us-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/contact-us-live-mobile.png
- Local mobile: docs/migration/visual-evidence/contact-us-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/contact-us-diff-mobile.png

### /faq/ - Fail
- Desktop mismatch: 50.14% (817052/1629440)
- Mobile mismatch: 34.88% (2964115/8497710)
- Live desktop: docs/migration/visual-evidence/faq-live-desktop.png
- Local desktop: docs/migration/visual-evidence/faq-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/faq-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/faq-live-mobile.png
- Local mobile: docs/migration/visual-evidence/faq-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/faq-diff-mobile.png

### /our-team/ - Fail
- Desktop mismatch: 28.79% (564501/1960960)
- Mobile mismatch: 27.48% (1781746/6482970)
- Live desktop: docs/migration/visual-evidence/our-team-live-desktop.png
- Local desktop: docs/migration/visual-evidence/our-team-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/our-team-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/our-team-live-mobile.png
- Local mobile: docs/migration/visual-evidence/our-team-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/our-team-diff-mobile.png

### /loan-calculator/ - Fail
- Desktop mismatch: 35.83% (557193/1555200)
- Mobile mismatch: 39.38% (2724219/6918210)
- Live desktop: docs/migration/visual-evidence/loan-calculator-live-desktop.png
- Local desktop: docs/migration/visual-evidence/loan-calculator-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/loan-calculator-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/loan-calculator-live-mobile.png
- Local mobile: docs/migration/visual-evidence/loan-calculator-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/loan-calculator-diff-mobile.png

### /sold/ - Fail
- Desktop mismatch: 72.95% (1916118/2626560)
- Mobile mismatch: 62.91% (12169909/19343610)
- Live desktop: docs/migration/visual-evidence/sold-live-desktop.png
- Local desktop: docs/migration/visual-evidence/sold-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/sold-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/sold-live-mobile.png
- Local mobile: docs/migration/visual-evidence/sold-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/sold-diff-mobile.png

## 2026-03-28 - Batch Visual Comparison (One Page At A Time)

Run config:
- Live base: https://alfursanauto.ca
- Local base: http://127.0.0.1:4322
- Routes: 11

Per-page results:

### / - Fail
- Desktop mismatch: 52.11% (1584858/3041280)
- Mobile mismatch: 38.47% (6628042/17227080)
- Live desktop: docs/migration/visual-evidence/home-live-desktop.png
- Local desktop: docs/migration/visual-evidence/home-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/home-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/home-live-mobile.png
- Local mobile: docs/migration/visual-evidence/home-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/home-diff-mobile.png

### /about-us/ - Fail
- Desktop mismatch: 48.04% (1103795/2297600)
- Mobile mismatch: 50.76% (5069335/9985950)
- Live desktop: docs/migration/visual-evidence/about-us-live-desktop.png
- Local desktop: docs/migration/visual-evidence/about-us-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/about-us-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/about-us-live-mobile.png
- Local mobile: docs/migration/visual-evidence/about-us-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/about-us-diff-mobile.png

### /contact-us/ - Fail
- Desktop mismatch: 61.85% (1286569/2080000)
- Mobile mismatch: 38.99% (3346476/8581950)
- Live desktop: docs/migration/visual-evidence/contact-us-live-desktop.png
- Local desktop: docs/migration/visual-evidence/contact-us-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/contact-us-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/contact-us-live-mobile.png
- Local mobile: docs/migration/visual-evidence/contact-us-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/contact-us-diff-mobile.png

### /faq/ - Fail
- Desktop mismatch: 50.14% (817052/1629440)
- Mobile mismatch: 34.88% (2964115/8497710)
- Live desktop: docs/migration/visual-evidence/faq-live-desktop.png
- Local desktop: docs/migration/visual-evidence/faq-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/faq-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/faq-live-mobile.png
- Local mobile: docs/migration/visual-evidence/faq-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/faq-diff-mobile.png

### /our-team/ - Fail
- Desktop mismatch: 28.79% (564501/1960960)
- Mobile mismatch: 27.48% (1781746/6482970)
- Live desktop: docs/migration/visual-evidence/our-team-live-desktop.png
- Local desktop: docs/migration/visual-evidence/our-team-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/our-team-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/our-team-live-mobile.png
- Local mobile: docs/migration/visual-evidence/our-team-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/our-team-diff-mobile.png

### /loan-calculator/ - Fail
- Desktop mismatch: 35.83% (557193/1555200)
- Mobile mismatch: 39.38% (2724219/6918210)
- Live desktop: docs/migration/visual-evidence/loan-calculator-live-desktop.png
- Local desktop: docs/migration/visual-evidence/loan-calculator-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/loan-calculator-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/loan-calculator-live-mobile.png
- Local mobile: docs/migration/visual-evidence/loan-calculator-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/loan-calculator-diff-mobile.png

### /sold/ - Fail
- Desktop mismatch: 72.95% (1916118/2626560)
- Mobile mismatch: 62.91% (12169909/19343610)
- Live desktop: docs/migration/visual-evidence/sold-live-desktop.png
- Local desktop: docs/migration/visual-evidence/sold-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/sold-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/sold-live-mobile.png
- Local mobile: docs/migration/visual-evidence/sold-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/sold-diff-mobile.png

### /search/ - Fail
- Desktop mismatch: 54.31% (1426567/2626560)
- Mobile mismatch: 38.57% (7519548/19494540)
- Live desktop: docs/migration/visual-evidence/search-live-desktop.png
- Local desktop: docs/migration/visual-evidence/search-local-desktop.png
- Diff desktop: docs/migration/visual-evidence/search-diff-desktop.png
- Live mobile: docs/migration/visual-evidence/search-live-mobile.png
- Local mobile: docs/migration/visual-evidence/search-local-mobile.png
- Diff mobile: docs/migration/visual-evidence/search-diff-mobile.png