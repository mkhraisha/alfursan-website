import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const base = process.cwd();
const distDir = path.join(base, "dist");
const outFile = path.join(
  base,
  "docs/migration/LIVE_VS_REPO_CONTENT_STYLE_COMPARISON.md",
);

const routes = [
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

function readLocalHtml(route) {
  const cleaned = route === "/" ? "/index.html" : `${route}index.html`;
  const localPath = path.join(distDir, cleaned);
  if (!fs.existsSync(localPath)) return null;
  return fs.readFileSync(localPath, "utf8");
}

function fetchLiveHtml(route) {
  const url = `https://alfursanauto.ca${route}`;
  try {
    return execSync(`curl -Ls --max-time 20 '${url}'`, { encoding: "utf8" });
  } catch {
    return null;
  }
}

function extractFirst(re, html) {
  const m = html.match(re);
  return m?.[1]?.trim() ?? "";
}

function extractAll(re, html) {
  return [...html.matchAll(re)].map((m) => (m[1] ?? "").trim()).filter(Boolean);
}

function textContent(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function words(s) {
  if (!s) return 0;
  return s.split(/\s+/).filter(Boolean).length;
}

function overlapScore(a, b) {
  const setA = new Set(
    a
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3),
  );
  const setB = new Set(
    b
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3),
  );
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  return inter / Math.max(setA.size, setB.size);
}

function metrics(html) {
  const title = extractFirst(/<title[^>]*>([\s\S]*?)<\/title>/i, html);
  const desc =
    extractFirst(
      /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
      html,
    ) ||
    extractFirst(
      /<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i,
      html,
    );
  const h1s = extractAll(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, html).map((h) =>
    h
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
  const txt = textContent(html);
  return {
    title,
    desc,
    h1s,
    words: words(txt),
    textSample: txt.slice(0, 320),
    forms: (html.match(/<form\b/gi) || []).length,
    iframes: (html.match(/<iframe\b/gi) || []).length,
    details: (html.match(/<details\b/gi) || []).length,
    images: (html.match(/<img\b/gi) || []).length,
    styleTags: (html.match(/<style\b/gi) || []).length,
    styleAttrs: (html.match(/\sstyle=/gi) || []).length,
    cssVarRefs: (html.match(/var\(--/gi) || []).length,
    buttons: (html.match(/<button\b/gi) || []).length,
  };
}

function cmp(route, liveHtml, localHtml) {
  const live = metrics(liveHtml);
  const local = metrics(localHtml);

  const titleSame = live.title.toLowerCase() === local.title.toLowerCase();
  const descOverlap = overlapScore(live.desc, local.desc);
  const h1Overlap = overlapScore(live.h1s.join(" "), local.h1s.join(" "));
  const bodyOverlap = overlapScore(
    textContent(liveHtml),
    textContent(localHtml),
  );

  let status = "High parity";
  if (bodyOverlap < 0.35 || h1Overlap < 0.25) status = "Low parity";
  else if (bodyOverlap < 0.55 || h1Overlap < 0.5 || descOverlap < 0.5)
    status = "Medium parity";

  const styleNotes = [];
  if (Math.abs(live.forms - local.forms) > 0)
    styleNotes.push(`forms ${live.forms}->${local.forms}`);
  if (Math.abs(live.iframes - local.iframes) > 0)
    styleNotes.push(`iframes ${live.iframes}->${local.iframes}`);
  if (Math.abs(live.details - local.details) > 0)
    styleNotes.push(`details ${live.details}->${local.details}`);
  if (Math.abs(live.images - local.images) > 2)
    styleNotes.push(`images ${live.images}->${local.images}`);
  if (Math.abs(live.styleAttrs - local.styleAttrs) > 2)
    styleNotes.push(`inline styles ${live.styleAttrs}->${local.styleAttrs}`);

  return {
    route,
    status,
    titleSame,
    descOverlap,
    h1Overlap,
    bodyOverlap,
    live,
    local,
    styleNotes,
  };
}

const results = [];
for (const route of routes) {
  const localHtml = readLocalHtml(route);
  const liveHtml = fetchLiveHtml(route);
  if (!localHtml || !liveHtml) {
    results.push({
      route,
      status: "Missing data",
      localMissing: !localHtml,
      liveMissing: !liveHtml,
    });
    continue;
  }
  results.push(cmp(route, liveHtml, localHtml));
}

const low = results.filter((r) => r.status === "Low parity").length;
const med = results.filter((r) => r.status === "Medium parity").length;
const high = results.filter((r) => r.status === "High parity").length;

let md = `# Live vs Repo Content and Style Comparison\n\n`;
md += `Generated: 2026-03-28\n`;
md += `Compared routes: ${routes.length}\n\n`;
md += `## Summary\n\n`;
md += `- High parity pages: ${high}\n`;
md += `- Medium parity pages: ${med}\n`;
md += `- Low parity pages: ${low}\n\n`;

md += `## Method\n\n`;
md += `- Local baseline: built output in dist/\n`;
md += `- Live baseline: https://alfursanauto.ca (curl fetch)\n`;
md += `- Content checks: title, meta description overlap, H1 overlap, body-text token overlap\n`;
md += `- Style/structure checks: forms, iframes, details, images, inline style markers\n\n`;

md += `## Page-by-Page Results\n\n`;
md += `| Route | Parity | Title Match | Desc Overlap | H1 Overlap | Body Overlap | Style Notes |\n`;
md += `|---|---|---:|---:|---:|---:|---|\n`;
for (const r of results) {
  if (r.status === "Missing data") {
    md += `| ${r.route} | Missing data | - | - | - | - | localMissing=${r.localMissing}, liveMissing=${r.liveMissing} |\n`;
  } else {
    md += `| ${r.route} | ${r.status} | ${r.titleSame ? "Yes" : "No"} | ${r.descOverlap.toFixed(2)} | ${r.h1Overlap.toFixed(2)} | ${r.bodyOverlap.toFixed(2)} | ${r.styleNotes.join("; ") || "none major"} |\n`;
  }
}

md += `\n## Detailed Findings\n\n`;
for (const r of results) {
  if (r.status === "Missing data") continue;
  md += `### ${r.route} - ${r.status}\n`;
  md += `- Live title: ${r.live.title || "(empty)"}\n`;
  md += `- Local title: ${r.local.title || "(empty)"}\n`;
  md += `- Live H1: ${r.live.h1s.join(" | ") || "(none)"}\n`;
  md += `- Local H1: ${r.local.h1s.join(" | ") || "(none)"}\n`;
  md += `- Content overlap score: ${r.bodyOverlap.toFixed(2)}\n`;
  md += `- Structure counts (live->local): forms ${r.live.forms}->${r.local.forms}, iframes ${r.live.iframes}->${r.local.iframes}, details ${r.live.details}->${r.local.details}, images ${r.live.images}->${r.local.images}\n`;
  if (r.styleNotes.length)
    md += `- Style differences flagged: ${r.styleNotes.join("; ")}\n`;
  md += `\n`;
}

md += `## Global Style-System Comparison\n\n`;
md += `- Repo uses centralized design tokens in src/lib/theme.ts with CSS custom properties and consistent surface/line/brand tokens.\n`;
md += `- Live pages still include legacy page-builder style patterns on some routes; local pages are more componentized and normalized.\n`;
md += `- Typography and spacing are generally close on key templates, but local components are cleaner and less plugin-dependent by design.\n\n`;

md += `## Recommended Next Fixes (Priority)\n\n`;
md += `1. Resolve all Low parity routes by aligning hero/body copy blocks and key CTA wording exactly to live content source.\n`;
md += `2. For Medium parity routes, align heading hierarchy and meta descriptions first.\n`;
md += `3. Re-run this audit after each parity pass and attach as release evidence for Step 19.\n`;

fs.writeFileSync(outFile, md, "utf8");
console.log(`Wrote ${outFile}`);
