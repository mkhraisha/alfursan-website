const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('https://alfursanauto.ca/about-us/', { waitUntil: 'networkidle', timeout: 30000 });
  
  const data = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll('[data-element_type="section"]'));
    
    const allSections = sections.map((sec, i) => {
      const cs = getComputedStyle(sec);
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const rect = sec.getBoundingClientRect();
      return {
        i, id: sec.getAttribute('data-id'),
        top: Math.round(rect.top + scrollTop),
        height: Math.round(rect.height),
        bg: cs.backgroundColor,
        snippet: sec.textContent.trim().slice(0, 50)
      };
    });
    
    // FAQ accordion items
    const accItems = Array.from(document.querySelectorAll('.elementor-accordion-item, .e-n-accordion-item'));
    let faqItems = null;
    if (accItems.length > 0) {
      const first = accItems[0];
      const fcs = getComputedStyle(first);
      const title = first.querySelector('.elementor-accordion-title, .e-n-accordion-item-title, .elementor-tab-title');
      let titleStyle = null;
      if (title) {
        const tcs = getComputedStyle(title);
        titleStyle = {
          bg: tcs.backgroundColor,
          color: tcs.color,
          fontSize: tcs.fontSize,
          fontWeight: tcs.fontWeight,
          padding: tcs.padding
        };
      }
      faqItems = {
        count: accItems.length,
        itemBg: fcs.backgroundColor,
        itemBorder: fcs.border,
        itemBorderTop: fcs.borderTop,
        itemBorderRadius: fcs.borderRadius,
        itemMarginBottom: fcs.marginBottom,
        titleStyle
      };
    }
    
    // FAQ section
    let faqWrapper = null;
    for (const sec of sections) {
      if (sec.textContent.includes('Frequently Asked Questions')) {
        const cs = getComputedStyle(sec);
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const rect = sec.getBoundingClientRect();
        faqWrapper = {
          id: sec.getAttribute('data-id'),
          bg: cs.backgroundColor,
          bgImage: cs.backgroundImage.slice(0, 80),
          padding: cs.padding,
          height: Math.round(rect.height),
          top: Math.round(rect.top + scrollTop)
        };
        break;
      }
    }
    
    // Social bar section
    let socialSection = null;
    for (const sec of sections) {
      if (sec.textContent.trim().startsWith('Follow us') || (sec.textContent.includes('Follow us') && sec.getBoundingClientRect().height < 200)) {
        const cs = getComputedStyle(sec);
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const rect = sec.getBoundingClientRect();
        socialSection = {
          id: sec.getAttribute('data-id'),
          bg: cs.backgroundColor,
          bgImage: cs.backgroundImage.slice(0, 80),
          padding: cs.padding,
          height: Math.round(rect.height),
          top: Math.round(rect.top + scrollTop)
        };
        break;
      }
    }
    
    // Intro columns
    let introCols = null;
    for (const sec of sections) {
      if (sec.getAttribute('data-id') === 'b1532e6' || sec.getAttribute('data-id') === '07d57a3') {
        const cols = Array.from(sec.querySelectorAll('[data-element_type="column"]'));
        introCols = cols.map((col) => {
          const cs = getComputedStyle(col);
          const rect = col.getBoundingClientRect();
          return { id: col.getAttribute('data-id'), width: Math.round(rect.width), bg: cs.backgroundColor };
        });
        break;
      }
    }
    
    // Intro heading
    const h1 = document.querySelector('h1.elementor-heading-title, h1');
    let introH1 = null;
    if (h1) {
      const cs = getComputedStyle(h1);
      const rect = h1.getBoundingClientRect();
      introH1 = {
        text: h1.textContent.trim(),
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        color: cs.color,
        top: Math.round(rect.top + (window.pageYOffset || 0))
      };
    }
    
    // Lead paragraph
    const paras = Array.from(document.querySelectorAll('.elementor-widget-text-editor p'));
    let paraStyles = null;
    if (paras.length > 0) {
      paraStyles = paras.slice(0, 3).map((p, i) => {
        const cs = getComputedStyle(p);
        return {
          i,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          color: cs.color,
          lineHeight: cs.lineHeight,
          snippet: p.textContent.trim().slice(0, 60)
        };
      });
    }
    
    return { allSections, faqItems, faqWrapper, socialSection, introCols, introH1, paraStyles };
  });
  
  console.log('=== LIVE SITE ===');
  console.log('Sections:', JSON.stringify(data.allSections, null, 2));
  console.log('Social:', JSON.stringify(data.socialSection, null, 2));
  console.log('FAQ wrapper:', JSON.stringify(data.faqWrapper, null, 2));
  console.log('FAQ items:', JSON.stringify(data.faqItems, null, 2));
  console.log('Intro cols:', JSON.stringify(data.introCols, null, 2));
  console.log('H1:', JSON.stringify(data.introH1, null, 2));
  console.log('Para styles:', JSON.stringify(data.paraStyles, null, 2));
  
  await browser.close();
})();
