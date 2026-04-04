/**
 * compare_popular_makes.mjs
 *
 * Captures the Popular Makes section from the live site and the local dev
 * server, then produces a side-by-side diff using pixelmatch.
 *
 * Usage:
 *   node scripts/compare_popular_makes.mjs [--local http://127.0.0.1:4323]
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "migration", "visual-evidence");

const LIVE_URL = "https://alfursanauto.ca/";
const LOCAL_URL =
  process.argv.find((a) => a.startsWith("--local="))?.slice(8) ??
  "http://127.0.0.1:4323/";

const VIEWPORT = { width: 1440, height: 900 };

// ── Helpers ────────────────────────────────────────────────────────────────

async function captureSection(page, url, label) {
  console.log(`  → navigating to ${url}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(2000); // let React hydrate

  // Find the Popular Makes heading on either site
  const heading = page.getByRole("heading", { name: /popular makes/i }).first();
  await heading.waitFor({ timeout: 15_000 });

  // Scroll it into view
  await heading.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);

  // On the live site the section is the closest ancestor section/div
  // On local it's .pm-section. We grab the bounding box of the heading's
  // parent container, expanding outward until we capture the full section.
  const container = await heading.evaluateHandle((el) => {
    // Walk up until we find a block-level container that is wide enough
    let node = el.parentElement;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if (
        ["section", "div", "article"].includes(node.tagName.toLowerCase()) &&
        node.offsetWidth > 400
      ) {
        return node;
      }
      node = node.parentElement;
    }
    return el.parentElement;
  });

  // Increase clip by walking up a few more levels to capture tabs + cards
  const sectionHandle = await container.evaluateHandle((el) => {
    // Go up 3 more levels from the found container to capture the whole block
    let node = el;
    for (let i = 0; i < 3; i++) {
      if (node.parentElement && node.parentElement !== document.body) {
        node = node.parentElement;
      }
    }
    return node;
  });

  const box = await sectionHandle.asElement()?.boundingBox();
  await container.dispose();
  await sectionHandle.dispose();

  if (!box) {
    throw new Error(`Could not locate section bounding box on ${url}`);
  }

  // Clip with a bit of vertical padding
  const clip = {
    x: Math.max(0, box.x - 10),
    y: Math.max(0, box.y - 10),
    width: Math.min(box.width + 20, VIEWPORT.width),
    height: Math.min(box.height + 40, 2400),
  };

  const outPath = path.join(OUT_DIR, `popular-makes-${label}.png`);
  await page.screenshot({ path: outPath, clip });
  console.log(`  ✓ saved ${path.relative(ROOT, outPath)} (${Math.round(clip.width)}×${Math.round(clip.height)})`);
  return outPath;
}

async function diff(livePath, localPath) {
  const liveImg = PNG.sync.read(await fs.readFile(livePath));
  const localImg = PNG.sync.read(await fs.readFile(localPath));

  const width = Math.max(liveImg.width, localImg.width);
  const height = Math.max(liveImg.height, localImg.height);

  // Pad both images to the same dimensions
  const pad = (src) => {
    if (src.width === width && src.height === height) return src;
    const out = new PNG({ width, height });
    // fill with white
    out.data.fill(255);
    PNG.bitblt(src, out, 0, 0, src.width, src.height, 0, 0);
    return out;
  };

  const a = pad(liveImg);
  const b = pad(localImg);
  const diffImg = new PNG({ width, height });

  const diffPixels = pixelmatch(a.data, b.data, diffImg.data, width, height, {
    threshold: 0.1,
    alpha: 0.5,
    includeAA: true,
  });

  const diffPath = path.join(OUT_DIR, "popular-makes-diff.png");
  await fs.writeFile(diffPath, PNG.sync.write(diffImg));

  // Side-by-side composite: live | diff | local
  const composite = new PNG({ width: width * 3 + 4, height });
  composite.data.fill(200); // grey separator
  PNG.bitblt(a, composite, 0, 0, width, height, 0, 0);
  PNG.bitblt(diffImg, composite, 0, 0, width, height, width + 2, 0);
  PNG.bitblt(b, composite, 0, 0, width, height, width * 2 + 4, 0);

  const sidePath = path.join(OUT_DIR, "popular-makes-side-by-side.png");
  await fs.writeFile(sidePath, PNG.sync.write(composite));

  const total = width * height;
  const pct = ((diffPixels / total) * 100).toFixed(2);
  return { diffPixels, total, pct, diffPath, sidePath };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function run() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  try {
    console.log("\n[1/4] Capturing live site Popular Makes...");
    const liveShot = await captureSection(page, LIVE_URL, "live");

    console.log("\n[2/4] Capturing local site Popular Makes...");
    const localShot = await captureSection(page, LOCAL_URL, "local");

    console.log("\n[3/4] Running pixelmatch diff...");
    const result = await diff(liveShot, localShot);

    console.log("\n[4/4] Results");
    console.log("─".repeat(50));
    console.log(`  Diff pixels : ${result.diffPixels} / ${result.total}`);
    console.log(`  Mismatch    : ${result.pct}%`);
    const status =
      Number(result.pct) <= 8
        ? "✅ PASS"
        : Number(result.pct) <= 20
          ? "⚠️  NEEDS REVIEW"
          : "❌ FAIL";
    console.log(`  Status      : ${status}`);
    console.log(`\n  Diff image  : ${path.relative(ROOT, result.diffPath)}`);
    console.log(
      `  Side-by-side: ${path.relative(ROOT, result.sidePath)}`,
    );
    console.log(
      "  (left=live, centre=diff, right=local)\n",
    );
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("[compare-popular-makes] failed:", err.message);
  process.exitCode = 1;
});
