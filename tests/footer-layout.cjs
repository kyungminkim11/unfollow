const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = process.env.QA_OUT || path.join(process.cwd(), 'qa-artifacts');
const DEPLOY_SHA = process.env.DEPLOY_SHA || 'local';
const PRODUCTION_ORIGIN = 'https://unfollow.lavalabs.co.kr';
fs.mkdirSync(OUT_DIR, { recursive: true });

const cases = [
  { name: 'footer-desktop-1536', width: 1536, height: 900, expectedNavColumns: 3 },
  { name: 'footer-mobile-390', width: 390, height: 844, expectedNavColumns: 1 },
];

function countGridColumns(value) {
  if (!value || value === 'none') return 0;
  return value.trim().split(/\s+/).length;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let failed = false;
  const baseOrigin = new URL(BASE_URL).origin;

  for (const testCase of cases) {
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
    target.searchParams.set('footer-qa', testCase.name);
    target.searchParams.set('deploy', DEPLOY_SHA);
    target.searchParams.set('cache', String(Date.now()));
    await page.goto(target.href, { waitUntil: 'commit', timeout: 30_000 });
    await page.waitForTimeout(5000);

    const footer = page.locator('.businessInfoV10');
    await footer.scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);

    const metrics = await page.evaluate(() => {
      const footer = document.querySelector('.businessInfoV10');
      const top = footer?.querySelector('.businessTopV10');
      const nav = footer?.querySelector('.businessLinksV10');
      const utility = footer?.querySelector('.businessUtilitiesV20');
      const details = footer?.querySelector('.businessDetailsV10');
      const footerRect = footer?.getBoundingClientRect();
      const topStyle = top ? getComputedStyle(top) : null;
      const navStyle = nav ? getComputedStyle(nav) : null;
      const textNodes = Array.from(footer?.querySelectorAll('a,button,strong,span,p,small') || []).map(element => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
          width: Number(rect.width.toFixed(1)),
          writingMode: style.writingMode,
          wordBreak: style.wordBreak,
          whiteSpace: style.whiteSpace,
          textDecorationLine: style.textDecorationLine,
        };
      });
      return {
        exists: Boolean(footer),
        footerWidth: footerRect ? Number(footerRect.width.toFixed(1)) : 0,
        viewportWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        topDisplay: topStyle?.display || '',
        topColumns: topStyle?.gridTemplateColumns || '',
        navColumns: navStyle?.gridTemplateColumns || '',
        navGroupCount: footer?.querySelectorAll('.businessLinkGroupV20').length || 0,
        utilityExists: Boolean(utility),
        utilityButtonCount: utility?.querySelectorAll('.businessUtilityButtonV20').length || 0,
        detailsExists: Boolean(details),
        oldLooseUtilityButtons: footer?.querySelectorAll('.businessLinksV10 > [data-v13-workspace],.businessLinksV10 > [data-v13-diagnostic]').length || 0,
        utilityButtonStyles: Array.from(utility?.querySelectorAll('.businessUtilityButtonV20') || []).map(button => {
          const style = getComputedStyle(button);
          const rect = button.getBoundingClientRect();
          return {
            text: button.textContent.trim(),
            width: Number(rect.width.toFixed(1)),
            textDecorationLine: style.textDecorationLine,
            whiteSpace: style.whiteSpace,
          };
        }),
        textNodes,
      };
    });

    const relevantErrors = errors.filter(entry => !entry.text.includes('code.iconify.design'));
    const navColumnCount = countGridColumns(metrics.navColumns);
    const checks = {
      footerRendered: { pass: metrics.exists && metrics.footerWidth > 0, ...metrics },
      groupedNavigation: { pass: metrics.navGroupCount === 3 && navColumnCount === testCase.expectedNavColumns, expectedColumns: testCase.expectedNavColumns, actualColumns: navColumnCount, groupCount: metrics.navGroupCount },
      utilityControlsGrouped: { pass: metrics.utilityExists && metrics.utilityButtonCount === 2 && metrics.oldLooseUtilityButtons === 0, utilityExists: metrics.utilityExists, buttonCount: metrics.utilityButtonCount, oldLooseUtilityButtons: metrics.oldLooseUtilityButtons },
      utilityButtonsReadable: { pass: metrics.utilityButtonStyles.every(item => item.width >= 90 && item.textDecorationLine === 'none' && item.whiteSpace === 'nowrap'), buttons: metrics.utilityButtonStyles },
      horizontalText: { pass: metrics.textNodes.every(item => item.writingMode === 'horizontal-tb'), offenders: metrics.textNodes.filter(item => item.writingMode !== 'horizontal-tb') },
      noHorizontalOverflow: { pass: metrics.scrollWidth <= metrics.viewportWidth + 1 && metrics.footerWidth <= metrics.viewportWidth + 1, viewportWidth: metrics.viewportWidth, scrollWidth: metrics.scrollWidth, footerWidth: metrics.footerWidth },
      noPageErrors: { pass: relevantErrors.length === 0, entries: relevantErrors },
    };

    if (Object.values(checks).some(check => !check.pass)) failed = true;
    const result = { source: BASE_URL, deploySha: DEPLOY_SHA, case: testCase, checks, metrics, errors };
    results.push(result);
    fs.writeFileSync(path.join(OUT_DIR, `${testCase.name}.json`), JSON.stringify(result, null, 2));
    await footer.screenshot({ path: path.join(OUT_DIR, `${testCase.name}.png`) });
    await context.close();
  }

  fs.writeFileSync(path.join(OUT_DIR, 'footer-summary.json'), JSON.stringify(results, null, 2));
  await browser.close();
  if (failed) process.exitCode = 1;
})().catch(error => {
  console.error('[footer-qa] fatal', error);
  process.exitCode = 1;
});
