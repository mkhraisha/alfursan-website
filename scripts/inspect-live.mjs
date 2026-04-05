/**
 * Inspect exact CSS measurements from live site for key sections.
 * Run: node scripts/inspect-live.mjs
 * Delete after use.
 */
import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto("https://alfursanauto.ca/", { waitUntil: "networkidle" });

const measurements = await page.evaluate(() => {
  // Helper
  const cs = (el) => el ? window.getComputedStyle(el) : null;

  // ── Hero ──────────────────────────────────────────────────────────────
  const heroSection = document.querySelector('[data-element_type="section"]');
  const heroStyle = cs(heroSection);
  const heroRect = heroSection?.getBoundingClientRect();

  // ── Hero search panel ─────────────────────────────────────────────────
  const searchPanel = document.querySelector('.elementor-widget-search-form, form[role="search"], .elementor-search-form, .elementor-widget-container form');
  
  // Find the white card (search box) in the hero - look for something with white bg in hero
  const allInHero = heroSection ? [...heroSection.querySelectorAll('*')] : [];
  const whiteCard = allInHero.find(el => {
    const bg = window.getComputedStyle(el).backgroundColor;
    return bg === 'rgb(255, 255, 255)' || bg === 'rgba(255, 255, 255, 1)';
  });

  // ── Hero heading ──────────────────────────────────────────────────────
  const heroH1 = document.querySelector('h1');
  const h1Style = cs(heroH1);

  // ── Featured ──────────────────────────────────────────────────────────
  const featSection = (() => {
    const all = document.querySelectorAll('[data-element_type="section"]');
    for (const s of all) {
      if (s.textContent.includes('Featured')) return s;
    }
    return null;
  })();
  const featRect = featSection?.getBoundingClientRect();
  const featStyle = cs(featSection);

  // Big car card
  const bigCard = document.querySelector('.vehica-car-card, .vehica-car-card-v2');
  const bigCardRect = bigCard?.getBoundingClientRect();
  const bigCardImg = bigCard?.querySelector('img');
  const bigCardImgRect = bigCardImg?.getBoundingClientRect();

  // Small card
  const smallCards = document.querySelectorAll('.vehica-car-card-v2, .vehica-car-card');
  const smallCard = smallCards[1];
  const smallCardRect = smallCard?.getBoundingClientRect();
  const smallCardImg = smallCard?.querySelector('img');
  const smallCardImgRect = smallCardImg?.getBoundingClientRect();

  // ── PM ────────────────────────────────────────────────────────────────
  const pmSection = (() => {
    const all = document.querySelectorAll('[data-element_type="section"]');
    for (const s of all) {
      if (s.textContent.includes('Popular Makes')) return s;
    }
    return null;
  })();
  const pmStyle = cs(pmSection);
  const pmRect = pmSection?.getBoundingClientRect();

  const pmHeading = pmSection?.querySelector('h2, h3');
  const pmHeadingStyle = cs(pmHeading);

  // PM tabs
  const pmTabs = pmSection?.querySelectorAll('.vehica-archive-select-filter button, [class*="tab"], button');
  const pmFirstTab = pmTabs?.[0];
  const pmTabStyle = cs(pmFirstTab);
  const pmTabRect = pmFirstTab?.getBoundingClientRect();

  // PM card
  const pmCard = pmSection?.querySelector('.vehica-car-card, .vehica-car-card-v2, [class*="car-card"]');
  const pmCardRect = pmCard?.getBoundingClientRect();
  const pmCardStyle = cs(pmCard);

  // ── Why ───────────────────────────────────────────────────────────────
  const whySection = (() => {
    const all = document.querySelectorAll('[data-element_type="section"]');
    for (const s of all) {
      if (s.textContent.includes('Why')) return s;
    }
    return null;
  })();
  const whyStyle = cs(whySection);
  const whyRect = whySection?.getBoundingClientRect();

  const whyH2 = whySection?.querySelector('h2, h3');
  const whyH2Style = cs(whyH2);

  const whyIcons = whySection?.querySelectorAll('img');
  const whyIconRect = whyIcons?.[0]?.getBoundingClientRect();
  const whyIconStyle = cs(whyIcons?.[0]);

  const whyItem = whySection?.querySelector('[class*="column"], [data-element_type="column"]');

  // ── Container ─────────────────────────────────────────────────────────
  const container = document.querySelector('.elementor-container, .e-con-inner');
  const containerStyle = cs(container);

  return {
    hero: {
      height: heroRect?.height,
      padding: heroStyle ? `${heroStyle.paddingTop} ${heroStyle.paddingRight} ${heroStyle.paddingBottom} ${heroStyle.paddingLeft}` : null,
      minHeight: heroStyle?.minHeight,
      bg: heroStyle?.backgroundColor,
      width: heroRect?.width,
    },
    heroH1: {
      fontSize: h1Style?.fontSize,
      lineHeight: h1Style?.lineHeight,
      fontWeight: h1Style?.fontWeight,
      fontFamily: h1Style?.fontFamily,
      marginBottom: h1Style?.marginBottom,
    },
    whiteCardInHero: whiteCard ? {
      width: whiteCard.getBoundingClientRect().width,
      height: whiteCard.getBoundingClientRect().height,
      padding: window.getComputedStyle(whiteCard).padding,
      tag: whiteCard.tagName,
      className: typeof whiteCard.className === 'string' ? whiteCard.className.substring(0, 80) : '[SVG]',
    } : null,
    featured: {
      height: featRect?.height,
      padding: featStyle ? `${featStyle.paddingTop} ${featStyle.paddingRight} ${featStyle.paddingBottom} ${featStyle.paddingLeft}` : null,
      marginBottom: featStyle?.marginBottom,
    },
    bigCard: {
      width: bigCardRect?.width,
      height: bigCardRect?.height,
      imgHeight: bigCardImgRect?.height,
    },
    smallCard: {
      width: smallCardRect?.width,
      height: smallCardRect?.height,
      imgHeight: smallCardImgRect?.height,
    },
    pm: {
      height: pmRect?.height,
      padding: pmStyle ? `${pmStyle.paddingTop} ${pmStyle.paddingRight} ${pmStyle.paddingBottom} ${pmStyle.paddingLeft}` : null,
      bg: pmStyle?.backgroundColor,
    },
    pmHeading: {
      fontSize: pmHeadingStyle?.fontSize,
      fontWeight: pmHeadingStyle?.fontWeight,
      lineHeight: pmHeadingStyle?.lineHeight,
      text: pmHeading?.textContent?.trim().substring(0, 40),
    },
    pmTab: pmFirstTab ? {
      width: pmTabRect?.width,
      height: pmTabRect?.height,
      padding: pmTabStyle?.padding,
      fontSize: pmTabStyle?.fontSize,
      borderRadius: pmTabStyle?.borderRadius,
      tag: pmFirstTab.tagName,
    } : null,
    pmCard: {
      width: pmCardRect?.width,
      height: pmCardRect?.height,
      padding: pmCardStyle?.padding,
    },
    why: {
      height: whyRect?.height,
      padding: whyStyle ? `${whyStyle.paddingTop} ${whyStyle.paddingRight} ${whyStyle.paddingBottom} ${whyStyle.paddingLeft}` : null,
      bg: whyStyle?.backgroundColor,
    },
    whyH2: {
      fontSize: whyH2Style?.fontSize,
      fontWeight: whyH2Style?.fontWeight,
      lineHeight: whyH2Style?.lineHeight,
      marginBottom: whyH2Style?.marginBottom,
    },
    whyIcon: {
      width: whyIconRect?.width,
      height: whyIconRect?.height,
      objectFit: whyIconStyle?.objectFit,
    },
  };
});

console.log(JSON.stringify(measurements, null, 2));

await browser.close();
