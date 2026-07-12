const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE_URL = process.env.QA_URL || 'http://127.0.0.1:4173/';
const OUT_DIR = process.env.QA_OUT || path.join(process.cwd(), 'qa-artifacts');
const DEPLOY_SHA = process.env.DEPLOY_SHA || 'local';
const EXPECTED_URL = 'https://github.com/kyungminkim11/unfollow/issues/new?template=feedback.yml';
const PRODUCTION_ORIGIN = 'https://unfollow.lavalabs.co.kr';
const feedbackDir = path.join(OUT_DIR, 'feedback');
fs.mkdirSync(feedbackDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1536, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const errors = [];
  let requestedFeedbackUrl = '';

  if (new URL(BASE_URL).origin !== PRODUCTION_ORIGIN) {
    await page.route(`${PRODUCTION_ORIGIN}/**`, async route => {
      const production = new URL(route.request().url());
      const local = new URL(`${production.pathname}${production.search}`, BASE_URL).href;
      const response = await route.fetch({ url: local });
      await route.fulfill({ response });
    });
  }

  await context.route('https://github.com/**', async route => {
    requestedFeedbackUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html lang="ko"><head><title>맞팔체커 피드백 양식</title></head><body><main><h1>맞팔체커 피드백 양식</h1><p>GitHub issue form target reached.</p></main></body></html>',
    });
  });

  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('code.iconify.design')) {
      errors.push({ type: 'console', text: message.text() });
    }
  });
  page.on('pageerror', error => errors.push({ type: 'pageerror', text: String(error) }));
  page.on('requestfailed', request => {
    if (!request.url().includes('code.iconify.design')) {
      errors.push({ type: 'requestfailed', text: `${request.url()} ${request.failure()?.errorText || ''}` });
    }
  });

  const target = new URL(BASE_URL);
  target.searchParams.set('qa', 'feedback-flow');
  target.searchParams.set('deploy', DEPLOY_SHA);
  target.searchParams.set('cache', String(Date.now()));
  await page.goto(target.href, { waitUntil: 'commit', timeout: 30_000 });
  await page.waitForTimeout(5000);

  const feedback = page.getByRole('link', { name: /맞팔체커 피드백 보내기|피드백 보내기/ }).first();
  const visible = await feedback.isVisible().catch(() => false);
  const attributes = visible ? await feedback.evaluate(element => ({
    text: (element.textContent || '').replace(/\s+/g, ' ').trim(),
    href: element.getAttribute('href') || '',
    absoluteHref: element.href || '',
    target: element.getAttribute('target') || '',
    rel: element.getAttribute('rel') || '',
    feedbackReady: element.getAttribute('data-feedback-ready') || '',
    ariaLabel: element.getAttribute('aria-label') || '',
  })) : null;

  await page.screenshot({ path: path.join(feedbackDir, 'feedback-before.png'), fullPage: false });

  let popup = null;
  let clickError = '';
  if (visible) {
    try {
      const popupPromise = context.waitForEvent('page', { timeout: 5000 });
      await feedback.click({ timeout: 3000 });
      popup = await popupPromise;
      await popup.waitForLoadState('domcontentloaded', { timeout: 5000 }).catch(() => {});
      await popup.screenshot({ path: path.join(feedbackDir, 'feedback-target.png'), fullPage: false });
    } catch (error) {
      clickError = String(error);
    }
  }

  const checks = {
    pageLoaded: Boolean(await page.locator('.hero,.main').first().count()),
    feedbackVisible: visible,
    correctHref: attributes?.absoluteHref === EXPECTED_URL,
    opensNewTab: attributes?.target === '_blank' && Boolean(popup),
    safeRel: Boolean(attributes?.rel.includes('noopener') && attributes?.rel.includes('noreferrer')),
    repairedMarker: attributes?.feedbackReady === 'true',
    clickReachedExpectedTarget: requestedFeedbackUrl === EXPECTED_URL,
    noPageErrors: errors.length === 0,
  };

  const result = {
    source: BASE_URL,
    deploySha: DEPLOY_SHA,
    expectedUrl: EXPECTED_URL,
    requestedFeedbackUrl,
    popupUrl: popup?.url() || '',
    attributes,
    clickError,
    errors,
    checks,
    pass: Object.values(checks).every(Boolean),
  };

  fs.writeFileSync(path.join(feedbackDir, 'feedback-result.json'), JSON.stringify(result, null, 2));
  console.log('[feedback-qa]', JSON.stringify(result));

  await browser.close();
  if (!result.pass) process.exitCode = 1;
})().catch(error => {
  console.error('[feedback-qa] fatal', error);
  process.exitCode = 1;
});
