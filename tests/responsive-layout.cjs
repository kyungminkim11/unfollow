const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = process.env.QA_OUT || path.join(process.cwd(), 'qa-artifacts');
fs.mkdirSync(OUT_DIR, { recursive: true });

const cases = [
  { name: 'desktop-1536', width: 1536, height: 900, expectedColumns: 2 },
  { name: 'sidepanel-1240', width: 1240, height: 900, expectedColumns: 1 },
  { name: 'sidepanel-1180', width: 1180, height: 900, expectedColumns: 1 },
  { name: 'sidepanel-drag-1080', width: 1080, height: 900, expectedColumns: 1 },
  { name: 'mobile-390', width: 390, height: 844, expectedColumns: 1 },
];

function countComputedTracks(elementMetrics) {
  if (!elementMetrics) return 0;
  if (elementMetrics.display !== 'grid' && elementMetrics.display !== 'inline-grid') return 1;
  const value = elementMetrics.gridTemplateColumns;
  if (!value || value === 'none') return 1;
  return value.trim().split(/\s+/).length;
}

async function collectMetrics(page) {
  return page.evaluate(() => {
    const pick = selector => document.querySelector(selector);
    const style = selector => {
      const element = pick(selector);
      if (!element) return null;
      const computed = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        selector,
        classes: element.className,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        display: computed.display,
        position: computed.position,
        gridTemplateColumns: computed.gridTemplateColumns,
        minWidth: computed.minWidth,
        widthStyle: computed.width,
        maxWidth: computed.maxWidth,
        writingMode: computed.writingMode,
        wordBreak: computed.wordBreak,
        overflowWrap: computed.overflowWrap,
        whiteSpace: computed.whiteSpace,
        overflowX: computed.overflowX,
      };
    };

    const textChecks = Array.from(document.querySelectorAll(
      '.v14StepStrip span,.v14SummaryGrid span,.v14HeroAside button,.v14HeroAside .btn,.v14ResourceBar button,.v14ResourceBar a'
    )).map((element, index) => {
      const computed = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.4;
      const estimatedLines = lineHeight > 0 ? Math.round(rect.height / lineHeight) : 0;
      const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
      return {
        index,
        tag: element.tagName,
        classes: element.className,
        text,
        width: Math.round(rect.width * 10) / 10,
        height: Math.round(rect.height * 10) / 10,
        scrollWidth: element.scrollWidth,
        estimatedLines,
        writingMode: computed.writingMode,
        wordBreak: computed.wordBreak,
        overflowWrap: computed.overflowWrap,
        whiteSpace: computed.whiteSpace,
        visible: computed.display !== 'none' && rect.width > 0 && rect.height > 0,
        likelyCharacterColumn: computed.display !== 'none' && text.length >= 3 && rect.width > 0 && rect.width < 48 && estimatedLines >= Math.max(3, Math.floor(text.replace(/\s/g, '').length * 0.55)),
      };
    });

    const matchingRules = [];
    const inspectRules = (rules, source, media = 'all') => {
      for (const rule of Array.from(rules || [])) {
        if (rule.type === CSSRule.MEDIA_RULE) {
          if (matchMedia(rule.conditionText).matches) inspectRules(rule.cssRules, source, rule.conditionText);
          continue;
        }
        if (rule.type === CSSRule.SUPPORTS_RULE) {
          try { if (CSS.supports(rule.conditionText)) inspectRules(rule.cssRules, source, media); } catch {}
          continue;
        }
        if (rule.type !== CSSRule.STYLE_RULE) continue;
        const selector = rule.selectorText || '';
        if (!/(hero|v14Hero|v14StepStrip|v14SummaryGrid|uploadPanel|dashboard|btn|button)/i.test(selector)) continue;
        let matches = false;
        try { matches = Boolean(document.querySelector(selector)); } catch {}
        if (!matches) continue;
        const properties = {};
        for (const property of ['display','grid-template-columns','width','min-width','max-width','writing-mode','word-break','overflow-wrap','white-space','position']) {
          const value = rule.style.getPropertyValue(property);
          if (value) properties[property] = `${value}${rule.style.getPropertyPriority(property) ? ' !important' : ''}`;
        }
        if (Object.keys(properties).length) matchingRules.push({ source, media, selector, properties });
      }
    };
    Array.from(document.styleSheets).forEach((sheet, index) => {
      try { inspectRules(sheet.cssRules, sheet.href || `inline-style-${index}`); } catch (error) {
        matchingRules.push({ source: sheet.href || `inline-style-${index}`, error: String(error) });
      }
    });

    const hero = pick('.hero.v14Hero');
    const aside = pick('.v14HeroAside');
    return {
      url: location.href,
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight, visualWidth: visualViewport?.width || null },
      bodyClasses: document.body.className,
      dataset: { ...document.body.dataset },
      documentWidth: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      },
      loadedResponsiveSheets: Array.from(document.querySelectorAll('link[href*="responsive"],style[id*="responsive"]')).map(element => element.getAttribute('href') || element.id),
      heroInlineStyle: hero?.getAttribute('style') || '',
      asideInlineStyle: aside?.getAttribute('style') || '',
      elements: {
        appShell: style('.appShell'),
        main: style('.main'),
        hero: style('.hero.v14Hero'),
        primary: style('.v14HeroPrimary'),
        aside: style('.v14HeroAside'),
        stepStrip: style('.v14StepStrip'),
        summaryGrid: style('.v14SummaryGrid'),
        dashboard: style('.dashboard'),
      },
      directAsideChildren: aside ? Array.from(aside.children).map((child, index) => {
        const computed = getComputedStyle(child);
        const rect = child.getBoundingClientRect();
        return {
          index,
          tag: child.tagName,
          classes: child.className,
          text: (child.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
          width: Math.round(rect.width * 10) / 10,
          display: computed.display,
          gridColumn: computed.gridColumn,
          minWidth: computed.minWidth,
          writingMode: computed.writingMode,
          wordBreak: computed.wordBreak,
          overflowWrap: computed.overflowWrap,
        };
      }) : [],
      textChecks,
      matchingRules,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let failed = false;

  for (const testCase of cases) {
    const context = await browser.newContext({
      viewport: { width: testCase.width, height: testCase.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const consoleEntries = [];
    page.on('console', msg => {
      if (['warning', 'error'].includes(msg.type())) consoleEntries.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', error => consoleEntries.push({ type: 'pageerror', text: String(error) }));

    await page.goto(`${BASE_URL}?qa=${encodeURIComponent(testCase.name)}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('body.service-v15 .hero.v14Hero', { timeout: 30_000 });
    await page.waitForSelector('.v14HeroAside', { timeout: 30_000 });
    await page.waitForTimeout(1500);

    let interactionProof = null;
    if (testCase.name === 'desktop-1536') {
      const guideButton = page.locator('[data-extension-guide]').first();
      if (await guideButton.isVisible().catch(() => false)) {
        await guideButton.click();
        const dialogVisible = await page.locator('#extensionGuideBackdrop.show').isVisible().catch(() => false);
        interactionProof = { action: 'open extension usage guide', pass: dialogVisible };
        await page.keyboard.press('Escape');
      }
    }

    if (testCase.name === 'sidepanel-1240') {
      /* This is the same viewport transition Chrome performs while dragging the side-panel divider. */
      await page.setViewportSize({ width: 1080, height: 900 });
      await page.waitForTimeout(250);
      const dragged = await collectMetrics(page);
      await page.setViewportSize({ width: 1240, height: 900 });
      await page.waitForTimeout(250);
      interactionProof = {
        action: 'drag side-panel boundary 1240 → 1080 → 1240',
        pass: countComputedTracks(dragged.elements.hero) === 1 && dragged.documentWidth.scrollWidth <= dragged.documentWidth.clientWidth + 1,
        draggedViewport: dragged.viewport,
        draggedHero: dragged.elements.hero,
        draggedDocumentWidth: dragged.documentWidth,
      };
    }

    const metrics = await collectMetrics(page);
    const trackCount = countComputedTracks(metrics.elements.hero);
    const noHorizontalOverflow = metrics.documentWidth.scrollWidth <= metrics.documentWidth.clientWidth + 1;
    const noCharacterColumns = !metrics.textChecks.some(item => item.visible && (item.likelyCharacterColumn || item.writingMode !== 'horizontal-tb'));
    const asideHidden = metrics.elements.aside?.display === 'none';
    const asideWideEnough = asideHidden || (testCase.width <= 420
      ? metrics.elements.aside?.width >= testCase.width - 30
      : testCase.expectedColumns === 1
        ? metrics.elements.aside?.width >= Math.min(700, testCase.width - 80)
        : metrics.elements.aside?.width >= 330);
    const singleResponsiveLayer = metrics.loadedResponsiveSheets.filter(value => value.includes('responsive-final')).length === 1
      && metrics.loadedResponsiveSheets.every(value => !value.includes('responsive-shell'));

    const checks = {
      heroColumnCount: { pass: trackCount === testCase.expectedColumns, expected: testCase.expectedColumns, actual: trackCount, value: metrics.elements.hero?.gridTemplateColumns, display: metrics.elements.hero?.display },
      noHorizontalOverflow: { pass: noHorizontalOverflow, ...metrics.documentWidth },
      noCharacterColumns: { pass: noCharacterColumns, offenders: metrics.textChecks.filter(item => item.visible && (item.likelyCharacterColumn || item.writingMode !== 'horizontal-tb')) },
      asideWideEnough: { pass: Boolean(asideWideEnough), width: metrics.elements.aside?.width || 0, display: metrics.elements.aside?.display },
      singleResponsiveLayer: { pass: singleResponsiveLayer, sheets: metrics.loadedResponsiveSheets },
      noResponsiveInlineStyles: { pass: !metrics.heroInlineStyle && !metrics.asideInlineStyle, hero: metrics.heroInlineStyle, aside: metrics.asideInlineStyle },
      noRelevantConsoleErrors: { pass: !consoleEntries.some(entry => entry.type === 'error' || entry.type === 'pageerror'), entries: consoleEntries },
      interactionProof: interactionProof || { pass: true, action: 'layout-only case' },
    };
    if (Object.values(checks).some(check => !check.pass)) failed = true;

    const result = { case: testCase, checks, metrics, consoleEntries };
    results.push(result);
    fs.writeFileSync(path.join(OUT_DIR, `${testCase.name}.json`), JSON.stringify(result, null, 2));
    await page.screenshot({ path: path.join(OUT_DIR, `${testCase.name}.png`), fullPage: false });
    await context.close();
  }

  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(results.map(({ case: c, checks, metrics }) => ({
    case: c,
    checks,
    bodyClasses: metrics.bodyClasses,
    loadedResponsiveSheets: metrics.loadedResponsiveSheets,
    heroInlineStyle: metrics.heroInlineStyle,
    asideInlineStyle: metrics.asideInlineStyle,
    hero: metrics.elements.hero,
    aside: metrics.elements.aside,
    stepStrip: metrics.elements.stepStrip,
    summaryGrid: metrics.elements.summaryGrid,
  })), null, 2));
  await browser.close();
  if (failed) process.exitCode = 1;
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
