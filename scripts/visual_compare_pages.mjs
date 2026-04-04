import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const LIVE_BASE = process.env.LIVE_BASE ?? "https://alfursanauto.ca";
const LOCAL_BASE = process.env.LOCAL_BASE ?? "http://127.0.0.1:4322";
const EVIDENCE_DIR = path.join(ROOT, "docs", "migration", "visual-evidence");
const LOG_PATH = path.join(
  ROOT,
  "docs",
  "migration",
  "VISUAL_COMPARISON_LOG.md",
);

const ROUTES = [
  "/",
  "/about-us/",
  "/contact-us/",
  "/faq/",
  "/our-team/",
  "/loan-calculator/",
  "/sold/",
  "/search/",
  "/blog/",
  "/blog/14-surprisingly-affordable-luxury-cars/",
  "/blog/how-close-are-we-to-autonomous-cars/",
];

const slugifyRoute = (route) => {
  if (route === "/") return "home";
  return route
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
};

const capture = async (browser, url, outPath, profile) => {
  const context = await browser.newContext(profile);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: outPath, fullPage: true });
  } finally {
    await context.close();
  }
};

const comparePng = async (leftPath, rightPath, diffPath) => {
  const left = PNG.sync.read(await fs.readFile(leftPath));
  const right = PNG.sync.read(await fs.readFile(rightPath));

  const width = Math.min(left.width, right.width);
  const height = Math.min(left.height, right.height);

  const crop = (png) => {
    const out = new PNG({ width, height });
    PNG.bitblt(png, out, 0, 0, width, height, 0, 0);
    return out;
  };

  const a = crop(left);
  const b = crop(right);
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(a.data, b.data, diff.data, width, height, {
    threshold: 0.1,
    alpha: 0.6,
    includeAA: true,
  });

  await fs.writeFile(diffPath, PNG.sync.write(diff));

  const totalPixels = width * height;
  const ratio = totalPixels > 0 ? diffPixels / totalPixels : 1;
  return {
    diffPixels,
    totalPixels,
    ratio,
    percent: Number((ratio * 100).toFixed(2)),
  };
};

const classify = (desktopPercent, mobilePercent) => {
  if (desktopPercent <= 8 && mobilePercent <= 10) return "Pass";
  if (desktopPercent <= 15 && mobilePercent <= 18) return "Needs review";
  return "Fail";
};

const nowDate = () => new Date().toISOString().slice(0, 10);

const rel = (absPath) => path.relative(ROOT, absPath).replaceAll("\\", "/");

const appendLog = async (content) => {
  await fs.appendFile(LOG_PATH, `\n\n${content}`);
};

const run = async () => {
  await fs.mkdir(EVIDENCE_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  const desktopProfile = devices["Desktop Chrome"];
  const mobileProfile = devices["iPhone 13"];

  try {
    const intro = [
      `## ${nowDate()} - Batch Visual Comparison (One Page At A Time)`,
      "",
      `Run config:`,
      `- Live base: ${LIVE_BASE}`,
      `- Local base: ${LOCAL_BASE}`,
      `- Routes: ${ROUTES.length}`,
      "",
      "Per-page results:",
    ].join("\n");
    await appendLog(intro);

    for (const route of ROUTES) {
      const slug = slugifyRoute(route);

      const liveDesktop = path.join(EVIDENCE_DIR, `${slug}-live-desktop.png`);
      const localDesktop = path.join(EVIDENCE_DIR, `${slug}-local-desktop.png`);
      const liveMobile = path.join(EVIDENCE_DIR, `${slug}-live-mobile.png`);
      const localMobile = path.join(EVIDENCE_DIR, `${slug}-local-mobile.png`);
      const diffDesktop = path.join(EVIDENCE_DIR, `${slug}-diff-desktop.png`);
      const diffMobile = path.join(EVIDENCE_DIR, `${slug}-diff-mobile.png`);

      const liveUrl = `${LIVE_BASE}${route}`;
      const localUrl = `${LOCAL_BASE}${route}`;

      await capture(browser, liveUrl, liveDesktop, desktopProfile);
      await capture(browser, localUrl, localDesktop, desktopProfile);
      await capture(browser, liveUrl, liveMobile, mobileProfile);
      await capture(browser, localUrl, localMobile, mobileProfile);

      const desktop = await comparePng(liveDesktop, localDesktop, diffDesktop);
      const mobile = await comparePng(liveMobile, localMobile, diffMobile);
      const status = classify(desktop.percent, mobile.percent);

      const section = [
        `### ${route} - ${status}`,
        `- Desktop mismatch: ${desktop.percent}% (${desktop.diffPixels}/${desktop.totalPixels})`,
        `- Mobile mismatch: ${mobile.percent}% (${mobile.diffPixels}/${mobile.totalPixels})`,
        `- Live desktop: ${rel(liveDesktop)}`,
        `- Local desktop: ${rel(localDesktop)}`,
        `- Diff desktop: ${rel(diffDesktop)}`,
        `- Live mobile: ${rel(liveMobile)}`,
        `- Local mobile: ${rel(localMobile)}`,
        `- Diff mobile: ${rel(diffMobile)}`,
      ].join("\n");

      await appendLog(section);
      console.log(
        `[visual-compare] ${route} -> ${status} (desktop ${desktop.percent}%, mobile ${mobile.percent}%)`,
      );
    }
  } finally {
    await browser.close();
  }
};

run().catch((error) => {
  console.error("[visual-compare] failed", error);
  process.exitCode = 1;
});
