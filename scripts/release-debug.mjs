import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.AUDIT_URL || 'http://127.0.0.1:4173/';
const outDir = path.join(process.cwd(), 'audit');
fs.mkdirSync(outDir, { recursive: true });
const result = { generatedAt: new Date().toISOString(), baseURL, desktop: {}, mobile: {}, accessibility: {} };

const number = async (page, selector) => {
  const text = await page.locator(selector).first().textContent().catch(() => '');
  const match = String(text || '').replaceAll(',', '').match(/\d+/);
  return match ? Number(match[0]) : null;
};

async function loadSample(page) {
  const candidates = page.locator('button').filter({ hasText: /샘플/ });
  for (let i = 0; i < await candidates.count(); i++) {
    if (await candidates.nth(i).isVisible()) {
      await candidates.nth(i).click();
      break;
    }
  }
  await page.waitForFunction(() => Number((document.querySelector('#countFollowing')?.textContent || '').replace(/\D/g, '')) > 0, null, { timeout: 15000 });
}

async function accessibility(page, key) {
  const audit = await new AxeBuilder({ page }).analyze();
  result.accessibility[key] = audit.violations
    .filter(item => ['critical', 'serious'].includes(item.impact))
    .map(item => ({
      id: item.id,
      impact: item.impact,
      description: item.description,
      nodes: item.nodes.slice(0, 12).map(node => ({ target: node.target, html: node.html, failureSummary: node.failureSummary, any: node.any, all: node.all, none: node.none })),
    }));
}

const browser = await chromium.launch({ headless: true });
try {
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const logs = [];
    page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await loadSample(page);

    result.desktop.before = {
      following: await number(page, '#countFollowing'),
      done: await number(page, '#countDone'),
      currentText: await page.locator('.focusPanel').innerText().catch(() => ''),
      localStorage: await page.evaluate(() => ({ ...localStorage })),
    };

    const keep = page.locator('#focusKeepBtn');
    result.desktop.keepButton = {
      count: await keep.count(),
      visible: await keep.isVisible().catch(() => false),
      disabled: await keep.isDisabled().catch(() => null),
      text: await keep.textContent().catch(() => ''),
      html: await keep.evaluate(el => el.outerHTML).catch(() => ''),
    };
    if (result.desktop.keepButton.visible) {
      await keep.click();
      await page.waitForTimeout(1000);
    }
    result.desktop.afterKeep = {
      done: await number(page, '#countDone'),
      currentText: await page.locator('.focusPanel').innerText().catch(() => ''),
      localStorage: await page.evaluate(() => ({ ...localStorage })),
      toasts: await page.locator('#v10Toast,.toast,[role="alert"]').allInnerTexts().catch(() => []),
    };

    const done = page.locator('#focusDoneBtn');
    result.desktop.doneButton = {
      count: await done.count(),
      visible: await done.isVisible().catch(() => false),
      disabled: await done.isDisabled().catch(() => null),
      text: await done.textContent().catch(() => ''),
      html: await done.evaluate(el => el.outerHTML).catch(() => ''),
    };
    if (result.desktop.doneButton.visible) {
      await done.click();
      await page.waitForTimeout(1000);
    }
    result.desktop.afterDone = {
      done: await number(page, '#countDone'),
      currentText: await page.locator('.focusPanel').innerText().catch(() => ''),
      localStorage: await page.evaluate(() => ({ ...localStorage })),
      logs,
    };

    const details = page.locator('#businessInfoV10 details');
    result.desktop.business = {
      detailsCount: await details.count(),
      beforeOpen: await page.locator('#businessInfoV10').innerText().catch(() => ''),
    };
    if (await details.count()) {
      await details.evaluate(el => { el.open = true; });
      result.desktop.business.afterOpen = await page.locator('#businessInfoV10').innerText();
      result.desktop.business.registrationVisible = await page.getByText('455-23-01867', { exact: true }).isVisible().catch(() => false);
    }

    await accessibility(page, 'desktop-result');
    await context.close();
  }

  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await loadSample(page);
    result.mobile.bottomNav = await page.evaluate(() => {
      const el = document.querySelector('.bottomNavV8');
      if (!el) return { exists: false };
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        exists: true,
        className: el.className,
        html: el.outerHTML,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        position: style.position,
        zIndex: style.zIndex,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        bottom: rect.bottom,
        media760: matchMedia('(max-width:760px)').matches,
        bodyClasses: document.body.className,
      };
    });
    result.mobile.top = await page.evaluate(() => {
      const el = document.querySelector('.mobileTopV8');
      if (!el) return { exists: false };
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return { exists: true, display: style.display, height: rect.height, position: style.position, bodyClasses: document.body.className };
    });
    result.mobile.filter = await page.evaluate(() => {
      const el = document.querySelector('.mobileFilterToggle');
      if (!el) return { exists: false };
      const style = getComputedStyle(el);
      return { exists: true, display: style.display, text: el.textContent, expanded: el.getAttribute('aria-expanded') };
    });
    await accessibility(page, 'mobile-result');
    await context.close();
  }
} finally {
  await browser.close();
}

const html = fs.readFileSync(path.join(process.cwd(), 'dist', 'index.html'), 'utf8');
result.sourceContexts = {};
for (const term of ['focusKeepBtn', 'focusDoneBtn', 'countDone', 'bottomNavV8']) {
  const positions = [];
  let index = html.indexOf(term);
  while (index >= 0 && positions.length < 10) {
    positions.push(html.slice(Math.max(0, index - 600), Math.min(html.length, index + 1200)));
    index = html.indexOf(term, index + term.length);
  }
  result.sourceContexts[term] = positions;
}

fs.writeFileSync(path.join(outDir, 'debug-report.json'), JSON.stringify(result, null, 2));
