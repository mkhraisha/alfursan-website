/**
 * Centralised design tokens for Alfursan Auto.
 * Consumed by Layout.astro to generate CSS custom properties
 * and available to any TS/Astro file that needs colour values.
 */

export const colors = {
  /** Brand red – primary action colour */
  brandRed: "#B92111",
  /** Lighter tint of brand red */
  primaryLight: "#fff0eb",

  /* ── Neutrals (dark → light) ─────────────────────── */

  /** Main body text */
  ink: "#222732",
  /** Secondary / label text */
  muted: "#99a1b2",
  /** Subtle body copy */
  mutedDark: "#6F6F6F",
  /** Card meta text */
  meta: "#5f6b7a",
  /** Placeholder text */
  placeholder: "#728197",

  /* ── Borders & lines ─────────────────────────────── */

  /** Default border */
  line: "#e4e7ec",
  /** Slightly darker border for inputs */
  inputBorder: "#cfd6df",
  /** Pagination / subtle card border */
  borderLight: "#d4d9e0",

  /* ── Surfaces ────────────────────────────────────── */

  /** Pure white */
  surface: "#ffffff",
  /** Page background – white (matches live site) */
  bg: "#ffffff",
  /** Card inner / subtle bg */
  bgSubtle: "#f7f9fd",
  /** Image placeholder bg */
  bgPlaceholder: "#f3f5f7",
  /** Active filter state bg */
  bgActiveFilter: "#fff5f4",

  /* ── Darks ───────────────────────────────────────── */

  /** Hero / heading band background */
  dark: "#171818",
  /** Header / topbar background */
  headerBg: "#141414",
  /** Footer background */
  footerBg: "#181818",
  /** Footer divider */
  footerDivider: "#3B4250",
  /** Topbar & kicker subdued text */
  subdued: "#d0d5dd",
  /** Hero subtitle / kicker text on dark */
  subtitleOnDark: "#B9B9B9",

  /** White text on dark surfaces */
  white: "#FFFFFF",

  /* ── Listing detail ─────────────────────────────── */

  /** Detail meta text */
  detailMeta: "#435063",
  /** Detail description text */
  detailBody: "#1f2d3d",

  /* ── Search-specific ────────────────────────────── */

  /** Filter label text */
  filterLabel: "#344054",
  /** Active filter outline (red) */
  activeFilterBorder: "#b42318",
  /** Active filter text (red) */
  activeFilterText: "#b42318",

  /** Mobile menu border */
  menuBorder: "#d8dde5",
} as const;

/** Map from CSS custom-property name → hex value, injected into :root */
export const cssVars: Record<string, string> = {
  "--brand-red": colors.brandRed,
  "--primary-light": colors.primaryLight,
  "--ink": colors.ink,
  "--muted": colors.muted,
  "--muted-dark": colors.mutedDark,
  "--meta": colors.meta,
  "--placeholder": colors.placeholder,
  "--line": colors.line,
  "--input-border": colors.inputBorder,
  "--border-light": colors.borderLight,
  "--surface": colors.surface,
  "--bg": colors.bg,
  "--bg-subtle": colors.bgSubtle,
  "--bg-placeholder": colors.bgPlaceholder,
  "--bg-active-filter": colors.bgActiveFilter,
  "--dark": colors.dark,
  "--header-bg": colors.headerBg,
  "--footer-bg": colors.footerBg,
  "--footer-divider": colors.footerDivider,
  "--subdued": colors.subdued,
  "--subtitle-on-dark": colors.subtitleOnDark,
  "--detail-meta": colors.detailMeta,
  "--detail-body": colors.detailBody,
  "--filter-label": colors.filterLabel,
  "--active-filter-border": colors.activeFilterBorder,
  "--active-filter-text": colors.activeFilterText,
  "--menu-border": colors.menuBorder,
};

/** Returns a valid CSS string for injecting inside :root { } */
export function rootCss(): string {
  return Object.entries(cssVars)
    .map(([prop, value]) => `${prop}: ${value};`)
    .join("\n\t\t");
}
