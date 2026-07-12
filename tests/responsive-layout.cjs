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

function countColumns(metrics) {
  if (!metrics) return 0;
  if (!['grid', 'inline-grid'].includes(metrics.display)) return 1;
  if (!metrics.gridTemplateColumns || metrics.gridTemplateColumns === 'none') return 1;
  return metrics.gridTemplateColumns.trim().split(/\s+/).length;
}

async function collect(page) {
  return page.evaluate(() => {
    const elementMetrics = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const computed = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        selector,
        classes: element.className,
        display: computed.display,
        position: computed.position,
        width: Number(rect.width.toFixed(1)),
        height: Number(rect.height.toFixed(1)),
        gridTemplateColumns: computed.gridTemplateColumns,
        writingMode: computed.writingMode,
        wordBreak: computed.wordBreak,
        overflowWrap: computed.overflowWrap,
        whiteSpace: computed.whiteSpace,
        overflowX: computed.overflowX,
        inlineStyle: element.getAttribute('style') || '',
      };
    };

    const textChecks = Array.from(document.querySelectorAll(
      '.v14StepStrip span,.v14SummaryGrid span,.v14SummaryGrid strong,.v14HeroAside button,.v14HeroAside .btn,.v14ResourceBar button,.v14ResourceBar a'
    )).map(element => {
      const computed = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
      const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.4;
      const lines = lineHeight ? Math.round(rect.height / lineHeight) : 0;
      const visible = computed.display !== 'none' && rect.width > 0 && rect.height > 0;
      return {
        text,
        classes: element.className,
        width: Number(rect.width.toFixed(1)),
        height: Number(rect.height.toFixed(1)),
        lines,
        visible,
        writingMode: computed.writingMode,
        wordBreak: computed.wordBreak,
        overflowWrap: computed.overflowWrap,
        whiteSpace: computed.whiteSpace,
        likelyCharacterColumn: visible && text.length >= 3 && rect.width < 48 && lines >= Math.max(3, Math.floor(text.replace(/\s/g, '').length * .55)),
      };
    });

    const responsiveAssets = Array.from(document.querySelectorAll('link[href*="responsive"],style[id*="responsive"]'))
      .map(element => element.getAttribute('href') || element.id);

    return {
      viewport: { width: innerWidth, height: innerHeight, visualWidth: visualViewport?.width || null },
      bodyClasses: document.body.className,
      documentWidth: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      },
      responsiveAssets,
      elements: {
        appShell: elementMetrics('.appShell'),
        main: elementMetrics('.main'),
        hero: elementMetrics('.hero.v14Hero'),
        primary: elementMetrics('.v14HeroPrimary'),
        aside: elementMetrics('.v14HeroAside'),
        stepStrip: elementMetrics('.v14StepStrip'),
        summaryGrid: elementMetrics('.v14SummaryGrid'),
        dashboard: elementMetrics('.dashboard'),
      },
      textChecks,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let failed = false;

  for (const testCase of cases) {
    console.log(`[responsive-qa] start ${testCase.name}`);
    const context = await browser.newContext({
      viewport: { width: testCase.width, height: testCase.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    await page.route(/^https:\/\/(?!127\.0\.0\.1|localhost).*/, route => route.abort());

    const consoleEntries = [];
    page.on('console', message => {
      if (['error'].includes(message.type())) consoleEntries.push({ type: message.type(), text: message.text() });
    });
    page.on('pageerror', error => consoleEntries.push({ type: 'pageerror', text: String(error) }));

    await page.goto(`${BASE_URL}?qa=${encodeURIComponent(testCase.name)}`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await page.waitForSelector('body.service-v15 .hero.v14Hero', { state: 'attached', timeout: 20_000 });
    await page.waitForSelector('.v14HeroAside', { state: 'attached', timeout: 20_000 });
    await page.waitForTimeout(1000);

    let interaction = { pass: true, action: 'layout-only case' };
    if (testCase.name === 'desktop-1536') {
      const button = page.locator('[data-extension-guide]').first();
      if (await button.isVisible().catch(() => false)) {
        await button.click({ timeout: 5000 });
        interaction = {
          action: 'open and close extension usage guide',
          pass: await page.locator('#extensionGuideBackdrop.show').isVisible().catch(() => false),
        };
        await page.keyboard.press('Escape');
      }
    }

    if (testCase.name === 'sidepanel-1240') {
      await page.setViewportSize({ width: 1080, height: 900 });
      await page.waitForTimeout(200);
      const dragged = await collect(page);
      await page.setViewportSize({ width: 1240, height: 900 });
      await page.waitForTimeout(200);
      interaction = {
        action: 'drag divider 1240 → 1080 → 1240',
        pass: countColumns(dragged.elements.hero) === 1 && dragged.documentWidth.scrollWidth <= dragged.documentWidth.clientWidth + 1,
        dragged,
      };
    }

    const metrics = await collect(page);
    const heroColumns = countColumns(metrics.elements.hero);
    const visibleText = metrics.textChecks.filter(item => item.visible);
    const asideHidden = metrics.elements.aside?.display === 'none';
    const asideWideEnough = asideHidden || (testCase.width <= 420
      ? metrics.elements.aside.width >= testCase.width - 30
      : testCase.expectedColumns === 1
        ? metrics.elements.aside.width >= Math.min(700, testCase.width - 80)
        : metrics.elements.aside.width >= 330);

    const checks = {
      heroColumns: {
        pass: heroColumns === testCase.expectedColumns,
        expected: testCase.expectedColumns,
        actual: heroColumns,
        display: metrics.elements.hero?.display,
        gridTemplateColumns: metrics.elements.hero?.gridTemplateColumns,
      },
      noHorizontalOverflow: {
        pass: metrics.documentWidth.scrollWidth <= metrics.documentWidth.clientWidth + 1,
        ...metrics.documentWidth,
      },
      horizontalText: {
        pass: visibleText.every(item => item.writingMode === 'horizontal-tb' && !item.likelyCharacterColumn),
        offenders: visibleText.filter(item => item.writingMode !== 'horizontal-tb' || item.likelyCharacterColumn),
      },
      asideWideEnough: {
        pass: Boolean(asideWideEnough),
        display: metrics.elements.aside?.display,
        width: metrics.elements.aside?.width || 0,
      },
      oneCanonicalResponsiveAsset: {
        pass: metrics.responsiveAssets.filter(item => item.includes('responsive-final')).length === 1
          && metrics.responsiveAssets.every(item => !item.includes('responsive-shell')),
        assets: metrics.responsiveAssets,
      },
      noResponsiveInlineStyles: {
        pass: !metrics.elements.hero?.inlineStyle && !metrics.elements.aside?.inlineStyle,
        hero: metrics.elements.hero?.inlineStyle,
        aside: metrics.elements.aside?.inlineStyle,
      },
      noPageErrors: {
        pass: consoleEntries.length === 0,
        entries: consoleEntries,
      },
      interaction,
    };

    if (Object.values(checks).some(check => !check.pass)) failed = true;
    const result = { case: testCase, checks, metrics };
    results.push(result);
    fs.writeFileSync(path.join(OUT_DIR, `${testCase.name}.json`), JSON.stringify(result, null, 2));
    await page.screenshot({ path: path.join(OUT_DIR, `${testCase.name}.png`), fullPage: false });
    await context.close();
    console.log(`[responsive-qa] done ${testCase.name}`, JSON.stringify(checks));
  }

  fs.writeFileSync(path.join(OUT_DIR, 'summary.json'), JSON.stringify(results, null, 2));
  await browser.close();
  if (failed) process.exitCode = 1;
})().catch(error => {
  console.error('[responsive-qa] fatal', error);
  process.exitCode = 1;
});
