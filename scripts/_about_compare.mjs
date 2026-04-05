/**
 * Custom visual comparison script for the About Us page.
 * Compares: intro, ceo, faq sections between dev and live.
 * Usage: node scripts/_about_compare.mjs [--props] [--section=intro|ceo|faq]
 */
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs';

const OUT = 'docs/migration/visual-evidence/about-us';
fs.mkdirSync(OUT, { recursive: true });

const DEV_URL = 'http://localhost:4321/about-us/';
const LIVE_URL = 'https://alfursanauto.ca/about-us/';
const VIEWPORT = { width: 1440, height: 900 };

const args = process.argv.slice(2);
const SHOW_PROPS = args.includes('--props');
const SECTION_FILTER = (args.find(a => a.startsWith('--section=')) || '').replace('--section=', '') || null;

async function getSections(page, isDev) {
  return await page.evaluate((isDev) => {
    function rect(el) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const scrollY = window.scrollY;
      return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
    }

    function findByText(selectors, texts) {
      for (const text of texts) {
        for (const tag of ['h1','h2','h3','h4','h5']) {
          for (const h of document.querySelectorAll(tag)) {
            const t = h.textContent || '';
            if (t.toLowerCase().includes(text.toLowerCase())) {
              // walk up to find a containing section
              let el = h.parentElement;
              while (el && el !== document.body) {
                const tag2 = el.tagName.toLowerCase();
                if (tag2 === 'section' || el.dataset?.elementType === 'section') return rect(el);
                el = el.parentElement;
              }
              return rect(h.closest('[data-element_type="section"]') || h.parentElement);
            }
          }
        }
      }
      return null;
    }

    if (isDev) {
      return {
        intro: rect(document.querySelector('.intro')),
        ceo: rect(document.querySelector('.ceo-section')),
        faq: rect(document.querySelector('.faq-section')),
      };
    } else {
      return {
        intro: findByText([], ['About us', 'About Al Fursan', 'who we are', 'How Alfursan']),
        ceo: findByText([], ['CEO', 'Our CEO', 'Book a Test Drive']),
        faq: findByText([], ['Frequently Asked', 'FAQ']),
      };
    }
  }, isDev);
}

async function getProps(page, isDev) {
  return await page.evaluate((isDev) => {
    const results = {};

    function getStyle(selector, props) {
      const el = document.querySelector(selector);
      if (!el) return null;
      const cs = window.getComputedStyle(el);
      const out = {};
      for (const p of props) out[p] = cs.getPropertyValue(p);
      return out;
    }

    if (isDev) {
      results.introTitle = getStyle('.about-title', ['font-size','font-weight','color','margin-bottom','letter-spacing']);
      results.introLead = getStyle('.intro-text .lead', ['font-size','font-weight','color','line-height']);
      results.introP = getStyle('.intro-text p', ['font-size','color','line-height']);
      results.introCallout = getStyle('.intro-text .callout', ['border-left','padding-left','color']);
      results.introImage = getStyle('.intro-image', ['border-radius','min-height']);
      results.ceoSection = getStyle('.ceo-section', ['background','grid-template-columns','height','border-radius']);
      results.ceoQuoteH2 = getStyle('.ceo-quote h2', ['font-size','font-weight','color']);
      results.quoteMark = getStyle('.quote-mark', ['font-size','color']);
      results.quoteText = getStyle('.quote-text', ['font-size','color','font-style']);
      results.ceoCtaH2 = getStyle('.ceo-cta h2', ['font-size','font-weight','color']);
      results.btnPrimary = getStyle('.btn-primary', ['font-size','padding','background-color','border-radius','font-weight']);
      results.faqHeading = getStyle('.faq-heading', ['font-size','font-weight','color']);
      results.faqItem = getStyle('.faq-item', ['border','border-radius','background']);
      results.faqSummary = getStyle('.faq-item summary', ['font-size','font-weight','padding']);
    } else {
      // Live selectors – best-effort
      const findSection = (text) => {
        for (const tag of ['h1','h2','h3','h4']) {
          for (const h of document.querySelectorAll(tag)) {
            if ((h.textContent||'').toLowerCase().includes(text.toLowerCase())) {
              return h.closest('[data-element_type="section"]') || h.parentElement;
            }
          }
        }
        return null;
      };
      const introSec = findSection('About us') || findSection('How Alfursan');
      const ceoSec = findSection('Our CEO');
      const faqSec = findSection('Frequently Asked');

      const getStyleEl = (el, props) => {
        if (!el) return null;
        const cs = window.getComputedStyle(el);
        const out = {};
        for (const p of props) out[p] = cs.getPropertyValue(p);
        return out;
      };

      // Intro
      const h1 = introSec?.querySelector('h1,h2') || document.querySelector('h1');
      results.introTitle = h1 ? getStyleEl(h1, ['font-size','font-weight','color','margin-bottom','letter-spacing']) : null;
      const leads = introSec?.querySelectorAll('p');
      results.introLead = leads?.[0] ? getStyleEl(leads[0], ['font-size','font-weight','color','line-height']) : null;

      // CEO
      const ceoH2 = ceoSec?.querySelector('h2,h3');
      results.ceoQuoteH2 = ceoH2 ? getStyleEl(ceoH2, ['font-size','font-weight','color']) : null;
      results.ceoSection = ceoSec ? getStyleEl(ceoSec, ['background','height','border-radius']) : null;
      const btn = ceoSec?.querySelector('a.elementor-button, a[href*="contact"]');
      results.btnPrimary = btn ? getStyleEl(btn, ['font-size','padding','background-color','border-radius','font-weight']) : null;

      // FAQ
      const faqH2 = faqSec?.querySelector('h2,h3,h4');
      results.faqHeading = faqH2 ? getStyleEl(faqH2, ['font-size','font-weight','color']) : null;
      const faqAccordion = faqSec?.querySelector('.elementor-accordion-item, [class*="accordion"]');
      results.faqItem = faqAccordion ? getStyleEl(faqAccordion, ['border','border-radius','background']) : null;
      const faqTitle = faqSec?.querySelector('.elementor-tab-title, [class*="accordion-title"], summary');
      results.faqSummary = faqTitle ? getStyleEl(faqTitle, ['font-size','font-weight','padding']) : null;
    }

    return results;
  }, isDev);
}

async function fullPageScreenshot(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function cropSection(imgPath, rect, outPath) {
  if (!rect || rect.w <= 0 || rect.h <= 0) {
    console.warn(`  ⚠ invalid rect for ${outPath}:`, rect);
    return false;
  }
  const src = PNG.sync.read(fs.readFileSync(imgPath));
  const left = Math.max(0, rect.x);
  const top = Math.max(0, rect.y);
  const width = Math.min(rect.w, src.width - left);
  const height = Math.min(rect.h, src.height - top);
  if (width <= 0 || height <= 0) {
    console.warn(`  ⚠ crop out-of-bounds for ${outPath}`);
    return false;
  }
  const out = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const si = ((top + y) * src.width + (left + x)) * 4;
      const di = (y * width + x) * 4;
      out.data[di] = src.data[si];
      out.data[di+1] = src.data[si+1];
      out.data[di+2] = src.data[si+2];
      out.data[di+3] = src.data[si+3];
    }
  }
  fs.writeFileSync(outPath, PNG.sync.write(out));
  return true;
}

function diffImages(devPath, livePath, diffPath) {
  const img1 = PNG.sync.read(fs.readFileSync(devPath));
  const img2 = PNG.sync.read(fs.readFileSync(livePath));

  // Resize to common dimensions
  const width = Math.min(img1.width, img2.width);
  const height = Math.min(img1.height, img2.height);

  const d1 = new PNG({ width, height });
  const d2 = new PNG({ width, height });
  PNG.bitblt(img1, d1, 0, 0, width, height, 0, 0);
  PNG.bitblt(img2, d2, 0, 0, width, height, 0, 0);

  const diff = new PNG({ width, height });
  const numDiff = pixelmatch(d1.data, d2.data, diff.data, width, height, { threshold: 0.1 });
  fs.writeFileSync(diffPath, PNG.sync.write(diff));
  const pct = ((numDiff / (width * height)) * 100).toFixed(1);
  return { numDiff, total: width * height, pct: parseFloat(pct) };
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const devPage = await browser.newPage();
  const livePage = await browser.newPage();

  await devPage.setViewportSize(VIEWPORT);
  await livePage.setViewportSize(VIEWPORT);

  console.log('📸 Loading pages...');
  console.log('Loading dev page...');
  devPage.goto(DEV_URL).catch(() => {});
  await devPage.waitForSelector('.intro', { state: 'attached', timeout: 15000 });
  await devPage.waitForTimeout(800);
  console.log('Dev page ready. Loading live page...');
  await livePage.goto(LIVE_URL, { waitUntil: 'networkidle', timeout: 30000 });

  // Scroll to load lazy images
  for (const pg of [devPage, livePage]) {
    await pg.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await pg.waitForTimeout(800);
    await pg.evaluate(() => window.scrollTo(0, 0));
    await pg.waitForTimeout(300);
  }

  console.log('📸 Taking full-page screenshots...');
  const [devFull, liveFull] = await Promise.all([
    fullPageScreenshot(devPage, 'dev-full'),
    fullPageScreenshot(livePage, 'live-full'),
  ]);

  console.log('🔍 Detecting sections...');
  const [devSections, liveSections] = await Promise.all([
    getSections(devPage, true),
    getSections(livePage, false),
  ]);

  console.log('Dev sections:', JSON.stringify(devSections, null, 2));
  console.log('Live sections:', JSON.stringify(liveSections, null, 2));

  const sections = SECTION_FILTER ? [SECTION_FILTER] : ['intro', 'ceo', 'faq'];
  const results = {};

  for (const sec of sections) {
    console.log(`\n── ${sec.toUpperCase()} ──`);
    const dr = devSections[sec];
    const lr = liveSections[sec];

    if (!dr) { console.log(`  ⚠ dev section not found`); continue; }
    if (!lr) { console.log(`  ⚠ live section not found`); continue; }

    const devCrop = `${OUT}/dev-${sec}.png`;
    const liveCrop = `${OUT}/live-${sec}.png`;
    const diffPath = `${OUT}/diff-${sec}.png`;

    const ok1 = await cropSection(devFull, dr, devCrop);
    const ok2 = await cropSection(liveFull, lr, liveCrop);

    if (!ok1 || !ok2) { console.log('  ⚠ crop failed'); continue; }

    const { pct } = diffImages(devCrop, liveCrop, diffPath);
    results[sec] = pct;
    console.log(`  diff: ${pct}%`);
  }

  if (SHOW_PROPS) {
    console.log('\n\n── CSS PROPERTIES (dev) ──');
    const devProps = await getProps(devPage, true);
    console.log(JSON.stringify(devProps, null, 2));

    console.log('\n── CSS PROPERTIES (live) ──');
    const liveProps = await getProps(livePage, false);
    console.log(JSON.stringify(liveProps, null, 2));
  }

  await browser.close();

  console.log('\n\n═══ RESULTS ═══');
  for (const [sec, pct] of Object.entries(results)) {
    const flag = pct > 25 ? '🔴' : pct > 15 ? '🟡' : '🟢';
    console.log(`  ${flag} ${sec.padEnd(8)} ${pct}%`);
  }

  // Write log
  const logEntry = `\n## ${new Date().toISOString()}\n${JSON.stringify(results, null, 2)}\n`;
  fs.appendFileSync(`${OUT}/log.md`, logEntry);
})();
