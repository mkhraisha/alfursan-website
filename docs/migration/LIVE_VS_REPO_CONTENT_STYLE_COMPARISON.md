# Live vs Repo Content and Style Comparison

Generated: 2026-03-28
Compared routes: 11

## Summary

- High parity pages: 0
- Medium parity pages: 8
- Low parity pages: 3

## Method

- Local baseline: built output in dist/
- Live baseline: https://alfursanauto.ca (curl fetch)
- Content checks: title, meta description overlap, H1 overlap, body-text token overlap
- Style/structure checks: forms, iframes, details, images, inline style markers

## Page-by-Page Results

| Route | Parity | Title Match | Desc Overlap | H1 Overlap | Body Overlap | Style Notes |
|---|---|---:|---:|---:|---:|---|
| / | Medium parity | No | 0.00 | 1.00 | 0.57 | forms 2->1; details 0->1; images 20->10; inline styles 27->0 |
| /about-us/ | Medium parity | No | 0.00 | 1.00 | 0.40 | forms 1->0; details 0->2; images 5->2 |
| /contact-us/ | Medium parity | No | 0.00 | 1.00 | 0.56 | forms 2->1; iframes 0->1; details 0->1; images 4->1 |
| /faq/ | Low parity | No | 0.00 | 0.00 | 0.82 | forms 1->0; details 0->12; images 4->1 |
| /our-team/ | Medium parity | No | 0.00 | 1.00 | 0.51 | forms 1->0; details 0->1; images 4->1 |
| /loan-calculator/ | Low parity | No | 0.00 | 0.00 | 0.58 | forms 2->1; details 0->1; images 4->1 |
| /sold/ | Medium parity | No | 0.00 | 1.00 | 0.54 | forms 1->0; details 0->1; images 40->13; inline styles 144->0 |
| /search/ | Low parity | No | 0.00 | 0.00 | 0.47 | forms 1->0; details 0->1; images 18->13; inline styles 21->0 |
| /blog/ | Medium parity | No | 0.00 | 1.00 | 0.55 | forms 3->0; details 0->1; images 11->5; inline styles 8->0 |
| /blog/14-surprisingly-affordable-luxury-cars/ | Medium parity | No | 0.00 | 1.00 | 0.42 | forms 3->0; details 0->1; images 11->2; inline styles 12->3 |
| /blog/how-close-are-we-to-autonomous-cars/ | Medium parity | No | 0.00 | 1.00 | 0.41 | forms 3->0; details 0->1; images 11->2; inline styles 12->3 |

## Detailed Findings

### / - Medium parity
- Live title: AlfursanAuto.ca &#8211; Used car dealership GTA
- Local title: Alfursan Auto | Used Cars In GTA
- Live H1: Good cars. Fair prices. Nothing hidden.
- Local H1: GOOD CARS. FAIR PRICES. NOTHING HIDDEN.
- Content overlap score: 0.57
- Structure counts (live->local): forms 2->1, iframes 0->0, details 0->1, images 20->10
- Style differences flagged: forms 2->1; details 0->1; images 20->10; inline styles 27->0

### /about-us/ - Medium parity
- Live title: About us &#8211; AlfursanAuto.ca
- Local title: About Us | Alfursan Auto
- Live H1: About us
- Local H1: About us
- Content overlap score: 0.40
- Structure counts (live->local): forms 1->0, iframes 0->0, details 0->2, images 5->2
- Style differences flagged: forms 1->0; details 0->2; images 5->2

### /contact-us/ - Medium parity
- Live title: Contact &#8211; AlfursanAuto.ca
- Local title: Contact Us | Alfursan Auto
- Live H1: Contact us
- Local H1: Contact us
- Content overlap score: 0.56
- Structure counts (live->local): forms 2->1, iframes 0->1, details 0->1, images 4->1
- Style differences flagged: forms 2->1; iframes 0->1; details 0->1; images 4->1

### /faq/ - Low parity
- Live title: FAQ &#8211; AlfursanAuto.ca
- Local title: FAQ - AlfursanAuto.ca
- Live H1: (none)
- Local H1: (none)
- Content overlap score: 0.82
- Structure counts (live->local): forms 1->0, iframes 0->0, details 0->12, images 4->1
- Style differences flagged: forms 1->0; details 0->12; images 4->1

### /our-team/ - Medium parity
- Live title: Our team &#8211; simple &#8211; AlfursanAuto.ca
- Local title: Our Team | Alfursan Auto
- Live H1: Meet Our Team
- Local H1: Meet Our Team | Meet Our Team
- Content overlap score: 0.51
- Structure counts (live->local): forms 1->0, iframes 0->0, details 0->1, images 4->1
- Style differences flagged: forms 1->0; details 0->1; images 4->1

### /loan-calculator/ - Low parity
- Live title: Loan Calculator &#8211; AlfursanAuto.ca
- Local title: Loan Calculator - AlfursanAuto.ca
- Live H1: (none)
- Local H1: (none)
- Content overlap score: 0.58
- Structure counts (live->local): forms 2->1, iframes 0->0, details 0->1, images 4->1
- Style differences flagged: forms 2->1; details 0->1; images 4->1

### /sold/ - Medium parity
- Live title: Sold &#8211; AlfursanAuto.ca
- Local title: Sold Vehicles | Alfursan Auto
- Live H1: Sold
- Local H1: Sold
- Content overlap score: 0.54
- Structure counts (live->local): forms 1->0, iframes 0->0, details 0->1, images 40->13
- Style differences flagged: forms 1->0; details 0->1; images 40->13; inline styles 144->0

### /search/ - Low parity
- Live title: Listings &#8211; AlfursanAuto.ca
- Local title: Listings | Alfursan Auto
- Live H1: (none)
- Local H1: Available Listings
- Content overlap score: 0.47
- Structure counts (live->local): forms 1->0, iframes 0->0, details 0->1, images 18->13
- Style differences flagged: forms 1->0; details 0->1; images 18->13; inline styles 21->0

### /blog/ - Medium parity
- Live title: Blog &#8211; AlfursanAuto.ca
- Local title: Blog | Alfursan Auto
- Live H1: Our Latest News
- Local H1: Our Latest News
- Content overlap score: 0.55
- Structure counts (live->local): forms 3->0, iframes 0->0, details 0->1, images 11->5
- Style differences flagged: forms 3->0; details 0->1; images 11->5; inline styles 8->0

### /blog/14-surprisingly-affordable-luxury-cars/ - Medium parity
- Live title: 14 Surprisingly Affordable Luxury Cars &#8211; AlfursanAuto.ca
- Local title: 14 Surprisingly Affordable Luxury Cars | Alfursan Auto Blog
- Live H1: 14 Surprisingly Affordable Luxury Cars
- Local H1: 14 Surprisingly Affordable Luxury Cars
- Content overlap score: 0.42
- Structure counts (live->local): forms 3->0, iframes 0->0, details 0->1, images 11->2
- Style differences flagged: forms 3->0; details 0->1; images 11->2; inline styles 12->3

### /blog/how-close-are-we-to-autonomous-cars/ - Medium parity
- Live title: How Close are we to Autonomous Cars? &#8211; AlfursanAuto.ca
- Local title: How Close are we to Autonomous Cars? | Alfursan Auto Blog
- Live H1: How Close are we to Autonomous Cars?
- Local H1: How Close are we to Autonomous Cars?
- Content overlap score: 0.41
- Structure counts (live->local): forms 3->0, iframes 0->0, details 0->1, images 11->2
- Style differences flagged: forms 3->0; details 0->1; images 11->2; inline styles 12->3

## Global Style-System Comparison

- Repo uses centralized design tokens in src/lib/theme.ts with CSS custom properties and consistent surface/line/brand tokens.
- Live pages still include legacy page-builder style patterns on some routes; local pages are more componentized and normalized.
- Typography and spacing are generally close on key templates, but local components are cleaner and less plugin-dependent by design.

## Recommended Next Fixes (Priority)

1. Resolve all Low parity routes by aligning hero/body copy blocks and key CTA wording exactly to live content source.
2. For Medium parity routes, align heading hierarchy and meta descriptions first.
3. Re-run this audit after each parity pass and attach as release evidence for Step 19.
