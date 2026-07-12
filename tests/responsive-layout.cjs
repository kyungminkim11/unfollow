const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = process.env.QA_OUT || path.join(process.cwd(), 'qa-artifacts');
const DEPLOY_SHA = process.env.DEPLOY_SHA || 'local';
const PRODUCTION_ORIGIN = 'https://unfollow.lavalabs.co.kr';
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

    const brand = document.querySelector('.sidebar .brandLockupV15');
    const brandLogo = brand?.querySelector('.brandLogoV15 img');
    const brandText = (brand?.textContent || '').replace(/\s+/g, '').trim();

    const topBrandCandidates = Array.from(document.body.querySelectorAll('*')).filter(element => {
      const computed = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
      return computed.display !== 'none'
        && computed.visibility !== 'hidden'
        && Number(computed.opacity || 1) > 0
        && rect.width >= innerWidth * .72
        && rect.height >= 36
        && rect.height <= 120
        && rect.top >= -2
        && rect.top < 140
        && text.includes('맞팔체커');
    });
    const visibleTopBrandHeaders = topBrandCandidates
      .filter(element => !topBrandCandidates.some(other => other !== element && other.contains(element)))
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || '',
          classes: element.className,
          ariaHidden: element.getAttribute('aria-hidden'),
          text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
          top: Number(rect.top.toFixed(1)),
          width: Number(rect.width.toFixed(1)),
          height: Number(rect.height.toFixed(1)),
        };
      });

    return {
      readyState: document.readyState,
      bootText: document.getElementById('boot')?.innerText || '',
      bodyTextStart: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 500),
      viewport: { width: innerWidth, height: innerHeight, visualWidth: visualViewport?.width || null },
      bodyClasses: document.body?.className || '',
      documentWidth: {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body?.scrollWidth || 0,
      },
      responsiveAssets: Array.from(document.querySelectorAll('link[href*="responsive"],style[id*="responsive"]'))
        .map(element => element.getAttribute('href') || element.id),
      loadedScripts: Array.from(document.scripts).map(script => script.src).filter(Boolean),
      loadedStyles: Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(link => link.href),
      brand: {
        exists: Boolean(brand),
        text: brandText,
        homeHref: brand?.querySelector('.brandHomeV15')?.getAttribute('href') || '',
        titleCount: brand?.querySelectorAll('.brandTextV15 > strong').length || 0,
        descriptorCount: brand?.querySelectorAll('.brandDescriptorV15').length || 0,
        legacyDuplicatePresent: /인스타맞팔|맞팔·언팔/.test(brandText),
        logo: {
          src: brandLogo?.getAttribute('src') || '',
          complete: Boolean(brandLogo?.complete),
          naturalWidth: brandLogo?.naturalWidth || 0,
        },
      },
      visibleTopBrandHeaders,
      elements: {
        appShell: elementMetrics('.appShell'),
        main: elementMetrics('.main'),
        hero: elementMetrics('.hero.v14Hero'),
        primary: elementMetrics('.v14HeroPrimary'),
        aside: elementMetrics('.v14HeroAside'),
        stepStrip: elementMetrics('.v14StepStrip'),
        summaryGrid: elementMetrics('.v14SummaryGrid'),
        dashboard: elementMetrics('.dashboard'),
        brand: elementMetrics('.sidebar .brandLockupV15'),
        brandLogo: elementMetrics('.sidebar .brandLogoV15'),
        brandCopy: elementMetrics('.sidebar .brandTextV15'),
      },
      textChecks,
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let failed = false;
  const baseOrigin = new URL(BASE_URL).origin;

  for (const testCase of cases) {
    console.log(`[responsive-qa] start ${testCase.name} at ${BASE_URL}`);
    const context = await browser.newContext({
      viewport: { width: testCase.width, height: testCase.height },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
    });
    const page = await context.newPage();

    if (baseOrigin !== PRODUCTION_ORIGIN) {
      await page.route(`${PRODUCTION_ORIGIN}/**`, async route => {
        const production = new URL(route.request().url());
        const local = new URL(`${production.pathname}${production.search}`, BASE_URL).href;
        const response = await route.fetch({ url: local });
        await route.fulfill({ response });
      });
    }

    const errors = [];
    page.on('console', message => {
      if (message.type() === 'error') errors.push({ type: 'console', text: message.text() });
    });
    page.on('pageerror', error => errors.push({ type: 'pageerror', text: String(error) }));
    page.on('requestfailed', request => {
      errors.push({ type: 'requestfailed', text: `${request.url()} ${request.failure()?.errorText || ''}` });
    });

    const target = new URL(BASE_URL);
    target.searchParams.set('qa', testCase.name);
    target.searchParams.set('deploy', DEPLOY_SHA);
    target.searchParams.set('cache', String(Date.now()));
    await page.goto(target.href, { waitUntil: 'commit', timeout: 30_000 });
    await page.waitForTimeout(5000);

    let interaction = { pass: true, action: 'layout-only case' };
    if (testCase.name === 'desktop-1536' && await page.locator('[data-extension-guide]').first().isVisible().catch(() => false)) {
      await page.locator('[data-extension-guide]').first().click({ timeout: 3000 });
      interaction = {
        action: 'open and close extension usage guide',
        pass: await page.locator('#extensionGuideBackdrop.show').isVisible().catch(() => false),
      };
      await page.keyboard.press('Escape');
    }

    if (testCase.name === 'sidepanel-1240') {
      await page.setViewportSize({ width: 1080, height: 900 });
      await page.waitForTimeout(250);
      const dragged = await collect(page);
      await page.setViewportSize({ width: 1240, height: 900 });
      await page.waitForTimeout(250);
      interaction = {
        action: 'drag divider 1240 → 1080 → 1240',
        pass: countColumns(dragged.elements.hero) === 1 && dragged.documentWidth.scrollWidth <= dragged.documentWidth.clientWidth + 1,
        dragged,
      };
    }

    const metrics = await collect(page);
    const appLoaded = Boolean(metrics.elements.hero && metrics.elements.aside && metrics.elements.main);
    const heroColumns = countColumns(metrics.elements.hero);
    const visibleText = metrics.textChecks.filter(item => item.visible);
    const asideHidden = metrics.elements.aside?.display === 'none';
    const asideWideEnough = asideHidden || (testCase.width <= 420
      ? (metrics.elements.aside?.width || 0) >= testCase.width - 30
      : testCase.expectedColumns === 1
        ? (metrics.elements.aside?.width || 0) >= Math.min(700, testCase.width - 80)
        : (metrics.elements.aside?.width || 0) >= 330);
    const relevantErrors = errors.filter(entry => !entry.text.includes('code.iconify.design'));
    const brandPass = metrics.brand.exists
      && metrics.brand.text === '맞팔체커Instagram관계분석byLavaLabs'
      && metrics.brand.homeHref === '/'
      && metrics.brand.titleCount === 1
      && metrics.brand.descriptorCount === 1
      && !metrics.brand.legacyDuplicatePresent
      && metrics.brand.logo.src === '/favicon.svg'
      && metrics.brand.logo.complete
      && metrics.brand.logo.naturalWidth > 0;
    const mobileHeaderPass = testCase.width > 760 || metrics.visibleTopBrandHeaders.length === 1;

    const checks = {
      appLoaded: { pass: appLoaded, readyState: metrics.readyState, bootText: metrics.bootText, bodyTextStart: metrics.bodyTextStart },
      heroColumns: { pass: appLoaded && heroColumns === testCase.expectedColumns, expected: testCase.expectedColumns, actual: heroColumns, hero: metrics.elements.hero },
      noHorizontalOverflow: { pass: metrics.documentWidth.scrollWidth <= metrics.documentWidth.clientWidth + 1, ...metrics.documentWidth },
      horizontalText: { pass: visibleText.every(item => item.writingMode === 'horizontal-tb' && !item.likelyCharacterColumn), offenders: visibleText.filter(item => item.writingMode !== 'horizontal-tb' || item.likelyCharacterColumn) },
      asideWideEnough: { pass: appLoaded && Boolean(asideWideEnough), display: metrics.elements.aside?.display, width: metrics.elements.aside?.width || 0 },
      sidebarBrandLockup: { pass: brandPass, ...metrics.brand, elements: { brand: metrics.elements.brand, logo: metrics.elements.brandLogo, copy: metrics.elements.brandCopy } },
      oneVisibleMobileBrandHeader: { pass: mobileHeaderPass, expected: testCase.width <= 760 ? 1 : 'not enforced', actual: metrics.visibleTopBrandHeaders.length, headers: metrics.visibleTopBrandHeaders },
      oneCanonicalResponsiveAsset: {
        pass: metrics.responsiveAssets.filter(item => item.includes('responsive-final')).length === 1 && metrics.responsiveAssets.every(item => !item.includes('responsive-shell')),
        assets: metrics.responsiveAssets,
      },
      noResponsiveInlineStyles: { pass: !metrics.elements.hero?.inlineStyle && !metrics.elements.aside?.inlineStyle, hero: metrics.elements.hero?.inlineStyle, aside: metrics.elements.aside?.inlineStyle },
      noPageErrors: { pass: relevantErrors.length === 0, entries: relevantErrors },
      interaction,
    };

    if (Object.values(checks).some(check => !check.pass)) failed = true;
    const result = { source: BASE_URL, deploySha: DEPLOY_SHA, case: testCase, checks, metrics, errors };
    results.push(result);
    fs.writeFileSync(path.join(OUT_DIR, `${testCase.name}.json`), JSON.stringify(result, null, 2));
    await page.screenshot({ path: path.join(OUT_DIR, `${testCase.name}.png`), fullPage: false });
    if (testCase.name === 'desktop-1536') {
      const brand = page.locator('.sidebar .brandLockupV15');
      if (await brand.isVisible().catch(() => false)) {
        await brand.screenshot({ path: path.join(OUT_DIR, 'sidebar-brand-lockup.png') });
      }
    }
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