#!/usr/bin/env node
/**
 * Visual Comparison Tool — Playwright + pixelmatch
 *
 * Usage:
 *   node scripts/visual-compare.mjs                       # full page + all sections
 *   node scripts/visual-compare.mjs --full-only            # full page diff only
 *   node scripts/visual-compare.mjs --sections-only        # section diffs only
 *   node scripts/visual-compare.mjs --props                # computed property comparison
 *   node scripts/visual-compare.mjs --section=hero         # single section only
 *   node scripts/visual-compare.mjs --dev=http://localhost:4321 --live=https://alfursanauto.ca
 *   node scripts/visual-compare.mjs --width=1440           # viewport width (default 1440)
 *   node scripts/visual-compare.mjs --threshold=0.1        # pixelmatch threshold (default 0.1)
 *   node scripts/visual-compare.mjs --output=./my-dir      # output directory
 *   node scripts/visual-compare.mjs --json                 # output results as JSON
 */

import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    dev: "http://localhost:4321/",
    live: "https://alfursanauto.ca",
    width: 1440,
    threshold: 0.1,
    output: path.join(__dirname, "../docs/migration/visual-evidence"),
    fullOnly: false,
    sectionsOnly: false,
    props: false,
    section: null,
    json: false,
  };

  for (const arg of args) {
    if (arg === "--full-only") opts.fullOnly = true;
    else if (arg === "--sections-only") opts.sectionsOnly = true;
    else if (arg === "--props") opts.props = true;
    else if (arg === "--json") opts.json = true;
    else if (arg.startsWith("--dev=")) opts.dev = arg.slice(6);
    else if (arg.startsWith("--live=")) opts.live = arg.slice(7);
    else if (arg.startsWith("--width=")) opts.width = parseInt(arg.slice(8));
    else if (arg.startsWith("--threshold=")) opts.threshold = parseFloat(arg.slice(12));
    else if (arg.startsWith("--output=")) opts.output = arg.slice(9);
    else if (arg.startsWith("--section=")) opts.section = arg.slice(10);
    else if (arg === "--help" || arg === "-h") {
      console.log(
        `Usage: node scripts/visual-compare.mjs [options]\n` +
          `  --dev=URL          Dev site URL (default: http://localhost:4321/)\n` +
          `  --live=URL         Live site URL (default: https://alfursanauto.ca)\n` +
          `  --width=N          Viewport width (default: 1440)\n` +
          `  --threshold=N      Pixelmatch threshold 0-1 (default: 0.1)\n` +
          `  --output=DIR       Output directory\n` +
          `  --full-only        Full-page diff only\n` +
          `  --sections-only    Section diffs only\n` +
          `  --props            Compare computed CSS properties\n` +
          `  --section=NAME     Single section (header|hero|featured|social|pm|why|footer)\n` +
          `  --json             Output results as JSON to stdout\n`
      );
      process.exit(0);
    }
  }

  return opts;
}

// ── pixelmatch helper ─────────────────────────────────────────
function compareImages(pathA, pathB, diffPath, threshold = 0.1) {
  const imgA = PNG.sync.read(fs.readFileSync(pathA));
  const imgB = PNG.sync.read(fs.readFileSync(pathB));
  const width = Math.min(imgA.width, imgB.width);
  const height = Math.min(imgA.height, imgB.height);
  const cropA = new PNG({ width, height });
  const cropB = new PNG({ width, height });
  PNG.bitblt(imgA, cropA, 0, 0, width, height, 0, 0);
  PNG.bitblt(imgB, cropB, 0, 0, width, height, 0, 0);
  const diff = new PNG({ width, height });
  const numDiff = pixelmatch(cropA.data, cropB.data, diff.data, width, height, {
    threshold,
    includeAA: false,
  });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  const total = width * height;
  return {
    diffPixels: numDiff,
    totalPixels: total,
    diffPct: parseFloat(((numDiff / total) * 100).toFixed(2)),
    width,
    height,
  };
}

// ── Section boundary extraction: DEV ──────────────────────────
function getDevSections() {
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const sections = {};

  const header = document.querySelector("header") || document.querySelector("nav");
  if (header) sections.header = { y: 0, h: Math.round(r(header).bottom) };

  const hero = document.querySelector(".hero");
  if (hero) {
    const b = r(hero);
    sections.hero = { y: Math.round(b.y), h: Math.round(b.height) };
  }

  const featured = document.querySelector(".featured");
  if (featured) {
    const b = r(featured);
    sections.featured = { y: Math.round(b.y), h: Math.round(b.height) };
  }

  const social = document.querySelector(".social-bar");
  if (social) {
    const b = r(social);
    sections.social = { y: Math.round(b.y), h: Math.round(b.height) };
  }

  const pm = document.querySelector(".pm-section");
  if (pm) {
    const b = r(pm);
    sections.pm = { y: Math.round(b.y), h: Math.round(b.height) };
  }

  document.querySelectorAll("section, div").forEach((el) => {
    if (sections.why) return;
    const h2 = el.querySelector("h2");
    if (h2 && /why choose/i.test(h2.textContent)) {
      const b = r(el);
      if (b.height > 100 && b.height < 1000) {
        sections.why = { y: Math.round(b.y), h: Math.round(b.height) };
      }
    }
  });

  const footer = document.querySelector("footer");
  if (footer) {
    const b = r(footer);
    sections.footer = { y: Math.round(b.y), h: Math.round(b.height) };
  }

  sections.pageHeight = document.documentElement.scrollHeight;
  return sections;
}

// ── Section boundary extraction: LIVE (Elementor) ─────────────
function getLiveSections() {
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const sections = {};

  const nav = document.querySelector(".vehica-menu, nav");
  if (nav) sections.header = { y: 0, h: Math.round(r(nav).bottom + 10) };

  const featEl = document.querySelector(".vehica-featured-v1");
  if (featEl) {
    const b = r(featEl);
    sections.hero = { y: 0, h: Math.round(b.y) };
    sections.featured = { y: Math.round(b.y), h: Math.round(b.height) };
  }

  document.querySelectorAll('[data-element_type="section"]').forEach((el) => {
    const text = el.textContent?.trim().slice(0, 100);
    const b = r(el);
    if (!b || b.height < 50) return;
    if (text?.includes("Popular Makes") && !sections.pm) {
      sections.pm = { y: Math.round(b.y), h: Math.round(b.height) };
    }
    if (/why choose/i.test(text) && b.height > 100 && b.height < 1000 && !sections.why) {
      sections.why = { y: Math.round(b.y), h: Math.round(b.height) };
    }
  });

  if (sections.featured && sections.pm) {
    const gapY = sections.featured.y + sections.featured.h;
    sections.social = { y: gapY, h: sections.pm.y - gapY };
  }

  const allSections = document.querySelectorAll('[data-element_type="section"]');
  if (allSections.length) {
    const last = allSections[allSections.length - 1];
    const b = r(last);
    sections.footer = { y: Math.round(b.y), h: Math.round(b.height) };
  }

  sections.pageHeight = document.documentElement.scrollHeight;
  return sections;
}

// ── Computed property extraction ──────────────────────────────
function extractDevProps() {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const props = {};

  // Body
  const bodyS = cs(document.body);
  props.body = {
    bg: bodyS?.backgroundColor,
    fontFamily: bodyS?.fontFamily?.substring(0, 80),
    fontSize: bodyS?.fontSize,
  };

  // Header
  const header = document.querySelector("header");
  if (header) props.header = { height: r(header)?.height, bg: cs(header)?.backgroundColor };

  // Hero
  const hero = document.querySelector(".hero");
  if (hero) {
    props.hero = {
      height: r(hero)?.height,
      bg: cs(hero)?.backgroundColor,
      padding: cs(hero)?.padding,
    };
  }

  // Featured section heading
  const sectionH = document.querySelector(".section-head h2");
  if (sectionH) {
    props.featuredHeading = {
      fontSize: cs(sectionH)?.fontSize,
      fontWeight: cs(sectionH)?.fontWeight,
      color: cs(sectionH)?.color,
    };
  }

  // Featured cards
  const heroCard = document.querySelector(".card-hero");
  if (heroCard) {
    const s = cs(heroCard);
    const body = heroCard.querySelector(".card-body");
    const title = heroCard.querySelector("h3");
    const price = heroCard.querySelector(".price");
    props.heroCard = {
      width: r(heroCard)?.width,
      height: r(heroCard)?.height,
      bg: s?.backgroundColor,
      borderRadius: s?.borderRadius,
      border: s?.border,
      boxShadow: s?.boxShadow === "none" ? "none" : s?.boxShadow?.substring(0, 40),
      titleFont: cs(title)?.fontSize,
      titleColor: cs(title)?.color,
      priceFont: cs(price)?.fontSize,
      priceColor: cs(price)?.color,
    };
  }

  const smCards = document.querySelectorAll(".card-sm");
  if (smCards.length) {
    const c = smCards[0];
    const s = cs(c);
    const img = c.querySelector("img");
    const title = c.querySelector("h3");
    const price = c.querySelector(".price");
    props.smallCard = {
      width: r(c)?.width,
      height: r(c)?.height,
      bg: s?.backgroundColor,
      borderRadius: s?.borderRadius,
      border: s?.border,
      boxShadow: s?.boxShadow === "none" ? "none" : s?.boxShadow?.substring(0, 40),
      imgHeight: r(img)?.height,
      titleFont: cs(title)?.fontSize,
      titleColor: cs(title)?.color,
      priceFont: cs(price)?.fontSize,
      priceColor: cs(price)?.color,
    };
  }

  // Featured grid
  const grid = document.querySelector(".featured-grid");
  if (grid) {
    props.featuredGrid = {
      display: cs(grid)?.display,
      gridCols: cs(grid)?.gridTemplateColumns,
      width: r(grid)?.width,
    };
  }

  // PM section
  const pm = document.querySelector(".pm-section");
  if (pm) {
    props.pmSection = {
      height: r(pm)?.height,
      bg: cs(pm)?.backgroundColor,
      padding: cs(pm)?.padding,
    };
  }

  const pmCard = document.querySelector(".pm-card");
  if (pmCard) {
    const s = cs(pmCard);
    const title = pmCard.querySelector("h4");
    const price = pmCard.querySelector(".pm-price");
    props.pmCard = {
      width: r(pmCard)?.width,
      height: r(pmCard)?.height,
      bg: s?.backgroundColor,
      borderRadius: s?.borderRadius,
      titleFont: cs(title)?.fontSize,
      titleColor: cs(title)?.color,
      priceFont: cs(price)?.fontSize,
      priceColor: cs(price)?.color,
    };
  }

  // Why section
  const why = document.querySelector(".why-us");
  if (why) {
    props.whySection = {
      height: r(why)?.height,
      bg: cs(why)?.backgroundColor,
      padding: cs(why)?.padding,
    };
    const article = why.querySelector("article");
    if (article) {
      props.whyArticle = {
        bg: cs(article)?.backgroundColor,
        border: cs(article)?.border,
        padding: cs(article)?.padding,
      };
    }
    const icon = why.querySelector("img");
    if (icon) {
      props.whyIcon = { width: r(icon)?.width, height: r(icon)?.height };
    }
  }

  // Social bar
  const social = document.querySelector(".social-bar");
  if (social) {
    props.socialBar = {
      height: r(social)?.height,
      bg: cs(social)?.backgroundColor,
      padding: cs(social)?.padding,
    };
  }

  // Footer
  const footer = document.querySelector("footer");
  if (footer) {
    props.footer = {
      height: r(footer)?.height,
      bg: cs(footer)?.backgroundColor,
    };
  }

  // Container
  const container = document.querySelector(".container");
  if (container) {
    props.container = { width: r(container)?.width };
  }

  return props;
}

function extractLiveProps() {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const r = (el) => (el ? el.getBoundingClientRect() : null);
  const props = {};

  // Body
  const bodyS = cs(document.body);
  props.body = {
    bg: bodyS?.backgroundColor,
    fontFamily: bodyS?.fontFamily?.substring(0, 80),
    fontSize: bodyS?.fontSize,
  };

  // Header
  const header = document.querySelector("header");
  if (header) props.header = { height: r(header)?.height, bg: cs(header)?.backgroundColor };

  // Hero — large section near top
  const allSections = document.querySelectorAll('[data-element_type="section"]');
  let heroEl = null, featuredEl = null, pmEl = null, whyEl = null;
  allSections.forEach((s) => {
    const b = r(s);
    const text = s.textContent?.trim().substring(0, 100);
    if (b && b.height > 400 && b.top < 200) heroEl = s;
    if (text?.includes("Featured Listings")) featuredEl = s;
    if (text?.includes("Popular Makes")) pmEl = s;
    if (/why choose/i.test(text) || text?.includes("Free Accident")) whyEl = s;
  });

  if (heroEl) props.hero = { height: r(heroEl)?.height, bg: cs(heroEl)?.backgroundColor };

  // Featured heading
  const headings = document.querySelectorAll("h2");
  let featH = null;
  headings.forEach((h) => { if (h.textContent?.includes("Featured")) featH = h; });
  if (featH) {
    props.featuredHeading = {
      fontSize: cs(featH)?.fontSize,
      fontWeight: cs(featH)?.fontWeight,
      color: cs(featH)?.color,
    };
  }

  // Featured cards
  const cards = document.querySelectorAll(".vehica-car-card-v2, .vehica-car-card");
  cards.forEach((c, i) => {
    if (i > 5) return;
    const inner = c.querySelector(".vehica-car-card-v2__inner, .vehica-car-card__inner");
    const el = inner || c;
    const s = cs(el);
    const title = c.querySelector(".vehica-car-card-v2__name, .vehica-car-card__name");
    const price = c.querySelector(".vehica-car-card-v2__price, .vehica-car-card__price");
    const img = c.querySelector("img");
    const key = i === 0 ? "heroCard" : (i === 1 ? null : "smallCard");
    if (!key || props[key]) return;
    props[key] = {
      width: r(el)?.width,
      height: r(el)?.height,
      bg: s?.backgroundColor,
      borderRadius: s?.borderRadius,
      border: s?.border,
      boxShadow: s?.boxShadow === "none" ? "none" : s?.boxShadow?.substring(0, 40),
      imgHeight: r(img)?.height,
      titleFont: cs(title)?.fontSize,
      titleColor: cs(title)?.color,
      priceFont: cs(price)?.fontSize,
      priceColor: cs(price)?.color,
    };
  });

  // PM section
  if (pmEl) {
    props.pmSection = {
      height: r(pmEl)?.height,
      bg: cs(pmEl)?.backgroundColor,
      padding: cs(pmEl)?.padding,
    };
    const pmCard = pmEl.querySelector(".vehica-car-card__inner, .vehica-car-card-v2__inner");
    if (pmCard) {
      const title = pmCard.closest(".vehica-car-card, .vehica-car-card-v2")
        ?.querySelector(".vehica-car-card__name, .vehica-car-card-v2__name");
      const price = pmCard.closest(".vehica-car-card, .vehica-car-card-v2")
        ?.querySelector(".vehica-car-card__price, .vehica-car-card-v2__price");
      props.pmCard = {
        width: r(pmCard)?.width,
        height: r(pmCard)?.height,
        bg: cs(pmCard)?.backgroundColor,
        borderRadius: cs(pmCard)?.borderRadius,
        titleFont: cs(title)?.fontSize,
        titleColor: cs(title)?.color,
        priceFont: cs(price)?.fontSize,
        priceColor: cs(price)?.color,
      };
    }
  }

  // Why section
  if (whyEl) {
    props.whySection = {
      height: r(whyEl)?.height,
      bg: cs(whyEl)?.backgroundColor,
      padding: cs(whyEl)?.padding,
    };
  }

  // Social bar
  let socialEl = null;
  allSections.forEach((s) => {
    const b = r(s);
    if (b && b.height < 120 && b.height > 20) {
      const links = s.querySelectorAll('a[href*="facebook"], a[href*="instagram"]');
      if (links.length >= 2) socialEl = s;
    }
  });
  if (socialEl) {
    props.socialBar = { height: r(socialEl)?.height, bg: cs(socialEl)?.backgroundColor };
  }

  // Footer
  const footer = document.querySelector("footer");
  if (footer) props.footer = { height: r(footer)?.height, bg: cs(footer)?.backgroundColor };

  // Container
  const containers = document.querySelectorAll(".elementor-container");
  let maxC = null;
  containers.forEach((c) => {
    const b = r(c);
    if (b && b.width > 1000 && (!maxC || b.width > r(maxC).width)) maxC = c;
  });
  if (maxC) props.container = { width: r(maxC)?.width };

  return props;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const opts = parseArgs();
  fs.mkdirSync(opts.output, { recursive: true });

  const log = opts.json ? () => {} : (...a) => console.log(...a);
  const results = { fullPage: null, sections: {}, props: null, timestamp: new Date().toISOString() };

  const browser = await chromium.launch({ headless: true });

  try {
    // Launch both pages
    const devCtx = await browser.newContext({ viewport: { width: opts.width, height: 4000 } });
    const devPage = await devCtx.newPage();
    log(`Navigating to ${opts.dev}...`);
    await devPage.goto(opts.dev, { waitUntil: "networkidle", timeout: 60000 });
    await devPage.waitForTimeout(2000);

    const liveCtx = await browser.newContext({ viewport: { width: opts.width, height: 4000 } });
    const livePage = await liveCtx.newPage();
    log(`Navigating to ${opts.live}...`);
    await livePage.goto(opts.live, { waitUntil: "networkidle", timeout: 60000 });
    await livePage.waitForTimeout(3000);

    // ── Full-page diff ──
    if (!opts.sectionsOnly && !opts.section) {
      const devPath = path.join(opts.output, "dev-desktop.png");
      const livePath = path.join(opts.output, "live-desktop.png");
      const diffPath = path.join(opts.output, "diff-desktop.png");
      await devPage.screenshot({ path: devPath, fullPage: true });
      await livePage.screenshot({ path: livePath, fullPage: true });
      const r = compareImages(devPath, livePath, diffPath, opts.threshold);
      results.fullPage = r;
      log(
        `\n✦ FULL PAGE: ${r.diffPct}% diff (${r.diffPixels.toLocaleString()} / ${r.totalPixels.toLocaleString()} pixels, ${r.width}×${r.height})`
      );
    }

    // ── Section diffs ──
    if (!opts.fullOnly) {
      const devInfo = await devPage.evaluate(getDevSections);
      const liveInfo = await livePage.evaluate(getLiveSections);

      const sectionNames = opts.section
        ? [opts.section]
        : ["header", "hero", "featured", "social", "pm", "why", "footer"];

      log("\n┌─────────────────────────────────────────────────────────┐");
      log("│  SECTION-BY-SECTION COMPARISON                          │");
      log("├──────────┬────────┬────────┬──────────┬────────────────┤");
      log("│ Section  │ Dev H  │ Live H │ Diff %   │ Status         │");
      log("├──────────┼────────┼────────┼──────────┼────────────────┤");

      for (const name of sectionNames) {
        const dev = devInfo[name];
        const live = liveInfo[name];

        if (!dev || !live || dev.h <= 0 || live.h <= 0) {
          log(`│ ${name.padEnd(8)} │   —    │   —    │    —     │ ❌ missing      │`);
          results.sections[name] = { error: "missing" };
          continue;
        }

        const devFile = path.join(opts.output, `crop-dev-${name}.png`);
        const liveFile = path.join(opts.output, `crop-live-${name}.png`);
        const diffFile = path.join(opts.output, `diff-${name}.png`);

        await devPage.screenshot({ path: devFile, clip: { x: 0, y: dev.y, width: opts.width, height: dev.h } });
        await livePage.screenshot({ path: liveFile, clip: { x: 0, y: live.y, width: opts.width, height: live.h } });

        const r = compareImages(devFile, liveFile, diffFile, opts.threshold);

        let status = "✅ close";
        if (r.diffPct > 40) status = "🔴 high diff";
        else if (r.diffPct > 20) status = "🟡 moderate";
        else if (r.diffPct > 10) status = "🟠 minor";

        log(
          `│ ${name.padEnd(8)} │ ${String(dev.h).padStart(5)}px│ ${String(live.h).padStart(5)}px│ ${String(r.diffPct + "%").padStart(8)} │ ${status.padEnd(14)} │`
        );

        results.sections[name] = { devH: dev.h, liveH: live.h, ...r };
      }

      log("└──────────┴────────┴────────┴──────────┴────────────────┘");
    }

    // ── Property comparison ──
    if (opts.props) {
      const devProps = await devPage.evaluate(extractDevProps);
      const liveProps = await livePage.evaluate(extractLiveProps);
      results.props = { dev: devProps, live: liveProps, deltas: [] };

      log("\n┌─────────────────────────────────────────────────────────┐");
      log("│  CSS PROPERTY COMPARISON                                │");
      log("└─────────────────────────────────────────────────────────┘");

      const flatCompare = (label, devObj, liveObj) => {
        if (!devObj && !liveObj) return;
        if (!devObj || !liveObj) {
          const delta = { property: label, dev: devObj ?? "MISSING", live: liveObj ?? "MISSING" };
          results.props.deltas.push(delta);
          log(`  ❌ ${label}: DEV=${JSON.stringify(devObj)} | LIVE=${JSON.stringify(liveObj)}`);
          return;
        }
        const allKeys = new Set([...Object.keys(devObj), ...Object.keys(liveObj)]);
        for (const key of allKeys) {
          const d = JSON.stringify(devObj[key]);
          const l = JSON.stringify(liveObj[key]);
          if (d !== l) {
            const delta = { property: `${label}.${key}`, dev: devObj[key], live: liveObj[key] };
            results.props.deltas.push(delta);
            log(`  ❌ ${label}.${key}: DEV=${d} | LIVE=${l}`);
          }
        }
      };

      flatCompare("body", devProps.body, liveProps.body);
      flatCompare("header", devProps.header, liveProps.header);
      flatCompare("hero", devProps.hero, liveProps.hero);
      flatCompare("featuredHeading", devProps.featuredHeading, liveProps.featuredHeading);
      flatCompare("heroCard", devProps.heroCard, liveProps.heroCard);
      flatCompare("smallCard", devProps.smallCard, liveProps.smallCard);
      flatCompare("featuredGrid", devProps.featuredGrid, liveProps.featuredGrid);
      flatCompare("pmSection", devProps.pmSection, liveProps.pmSection);
      flatCompare("pmCard", devProps.pmCard, liveProps.pmCard);
      flatCompare("whySection", devProps.whySection, liveProps.whySection);
      flatCompare("socialBar", devProps.socialBar, liveProps.socialBar);
      flatCompare("footer", devProps.footer, liveProps.footer);
      flatCompare("container", devProps.container, liveProps.container);

      if (results.props.deltas.length === 0) {
        log("  ✅ All compared properties match!");
      } else {
        log(`\n  ${results.props.deltas.length} property differences found.`);
      }
    }

    log(`\nOutput saved to: ${opts.output}/`);
  } finally {
    await browser.close();
  }

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
