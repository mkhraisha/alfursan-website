# Visual Comparison Skill

Use this skill when asked to visually compare the dev site against the live site, check visual parity, run a screenshot diff, or investigate CSS mismatches between dev and production.

## Tool

The unified comparison script lives at `scripts/visual-compare.mjs`. It uses **Playwright** (Chromium) + **pixelmatch** to capture full-page and per-section screenshots, diff them, and optionally compare computed CSS properties.

### Prerequisites

- Dev server must be running at `http://localhost:4321/` (Astro: `npm run dev`)
- Dependencies installed: `playwright`, `pixelmatch`, `pngjs` (already in package.json)

### Commands

```bash
# Full comparison: full-page diff + all sections
node scripts/visual-compare.mjs

# Full-page pixelmatch only
node scripts/visual-compare.mjs --full-only

# Section-by-section diffs only
node scripts/visual-compare.mjs --sections-only

# Single section (header|hero|featured|social|pm|why|footer)
node scripts/visual-compare.mjs --section=hero

# Include computed CSS property comparison (fonts, colors, sizes)
node scripts/visual-compare.mjs --props

# Machine-readable JSON output
node scripts/visual-compare.mjs --json

# Custom URLs or viewport
node scripts/visual-compare.mjs --dev=http://localhost:4321 --live=https://alfursanauto.ca --width=1440
```

### Output

All artifacts go to `docs/migration/visual-evidence/`:

| File | Contents |
|------|----------|
| `dev-desktop.png` | Full-page dev screenshot |
| `live-desktop.png` | Full-page live screenshot |
| `diff-desktop.png` | Full-page pixelmatch diff (changed pixels in red) |
| `crop-dev-{section}.png` | Cropped dev screenshot per section |
| `crop-live-{section}.png` | Cropped live screenshot per section |
| `diff-{section}.png` | Per-section pixelmatch diff |

### Sections detected

| Name | Dev selector | Live selector |
|------|-------------|---------------|
| `header` | `header` or `nav` | `.vehica-menu` or `nav` |
| `hero` | `.hero` | First large `[data-element_type="section"]` near top |
| `featured` | `.featured` | `.vehica-featured-v1` |
| `social` | `.social-bar` | Gap between featured and PM sections |
| `pm` | `.pm-section` | Section containing "Popular Makes" text |
| `why` | `.why-us` (via h2 text match) | Section containing "Why Choose" text |
| `footer` | `footer` | Last `[data-element_type="section"]` |

## Workflow

1. **Run the comparison**: `node scripts/visual-compare.mjs` to get section diff percentages
2. **Identify high-diff sections**: anything above ~10% that isn't purely image-driven
3. **Run with `--props`** for CSS property-level deltas on the high-diff sections
4. **Fix the CSS** in `src/pages/index.astro` (scoped styles) or the relevant component
5. **Re-run** to verify the fix reduced the diff

### Interpreting results

- **< 10% diff**: Close match. Remaining pixels are from different inventory images, text content, or font rendering.
- **10-25% diff**: Minor structural/style differences. Check `--props` output for mismatched font sizes, colors, padding.
- **25-50% diff**: Significant visual differences. Likely layout, background color, card style, or sizing issues.
- **> 50% diff**: Major structural mismatch. Layout, grid, or missing/extra content.

### Known irreducible delta

~40% of the full-page diff comes from different car inventory (images, titles, prices differ between dev data and live data). This is not a CSS bug. Focus on per-section structural parity.

## Key files

| File | What it contains |
|------|-----------------|
| `src/pages/index.astro` | Homepage HTML + all scoped/global CSS |
| `src/components/PopularMakes.tsx` | React island for PM tabbed carousel |
| `src/layouts/Layout.astro` | Shared layout (header, footer, global CSS, body font) |
| `src/lib/theme.ts` | CSS custom property definitions (design tokens) |
| `docs/migration/visual-evidence/visual_comparison_log.md` | Audit log of all comparison runs and fixes |

## Theme tokens reference

```
--surface: #ffffff    --bg: #ffffff       --ink: #222732
--brand-red: #B92111  --muted: #99a1b2    --line: #e4e7ec
--dark: #171818
```

## Live site notes

The live site is WordPress + Elementor. It has no semantic class names — sections use `[data-element_type="section"]` with data-id attributes. Car cards use `.vehica-car-card` / `.vehica-car-card-v2` classes. SVG elements have `SVGAnimatedString` className objects (not plain strings), so always check `typeof el.className === 'string'` before `.split()`.
