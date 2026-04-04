import { chromium, devices } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import fs from "fs/promises";
import path from "path";

const LIVE = "https://alfursanauto.ca";
const LOCAL = "http://127.0.0.1:4322";
const ROUTES = (process.argv[2] || "/loan-calculator/").split(",");
const DIR = "docs/migration/visual-evidence";

const browser = await chromium.launch();

async function capture(url, file, profile) {
  const ctx = await browser.newContext(profile);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  const buf = await page.screenshot({ fullPage: true });
  await fs.writeFile(file, buf);
  await ctx.close();
  return buf;
}

const desktop = { viewport: { width: 1280, height: 900 } };
const mobile = devices["iPhone 12"];

for (const ROUTE of ROUTES) {
  const slug =
    ROUTE === "/" ? "home" : ROUTE.replace(/^\/|\/$/g, "").replace(/\//g, "-");
  console.log("\n--- " + ROUTE + " ---");
  for (const [label, profile] of [
    ["desktop", desktop],
    ["mobile", mobile],
  ]) {
    const liveBuf = await capture(
      LIVE + ROUTE,
      path.join(DIR, slug + "-live-" + label + ".png"),
      profile,
    );
    const localBuf = await capture(
      LOCAL + ROUTE,
      path.join(DIR, slug + "-local-" + label + ".png"),
      profile,
    );

    const liveImg = PNG.sync.read(liveBuf);
    const localImg = PNG.sync.read(localBuf);
    const w = Math.min(liveImg.width, localImg.width);
    const h = Math.min(liveImg.height, localImg.height);

    const lCrop = new PNG({ width: w, height: h });
    PNG.bitblt(liveImg, lCrop, 0, 0, w, h, 0, 0);
    const rCrop = new PNG({ width: w, height: h });
    PNG.bitblt(localImg, rCrop, 0, 0, w, h, 0, 0);

    const diff = new PNG({ width: w, height: h });
    const pm = pixelmatch.default || pixelmatch;
    const mismatched = pm(lCrop.data, rCrop.data, diff.data, w, h, {
      threshold: 0.1,
    });
    const pct = ((mismatched / (w * h)) * 100).toFixed(2);

    await fs.writeFile(
      path.join(DIR, slug + "-diff-" + label + ".png"),
      PNG.sync.write(diff),
    );
    console.log("  " + label + ": " + pct + "% mismatch");
  }
}

await browser.close();
console.log("Done");
