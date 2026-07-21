import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const root = process.cwd();
const dist = path.join(root, 'dist');
const auditDir = path.join(root, 'audit');
const fixtureDir = path.join(root, 'audit-fixtures');
const baseURL = process.env.AUDIT_URL || 'http://127.0.0.1:4173/';
fs.mkdirSync(auditDir, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA || '',
  baseURL,
  checks: [],
  browser: {},
  static: {},
  summary: {},
};

function addCheck(area, name, status, severity, details = {}) {
  report.checks.push({ area, name, status, severity, details });
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(dist, file).replaceAll(path.sep, '/');
}

function countMatches(text, regex) {
  return [...text.matchAll(regex)].length;
}

function staticAudit() {
  const files = walk(dist);
  const textFiles = files.filter(file => /\.(?:html|js|css|json|xml|txt|webmanifest)$/i.test(file));
  const contents = new Map(textFiles.map(file => [file, fs.readFileSync(file, 'utf8')]));
  const htmlPath = path.join(dist, 'index.html');
  const html = contents.get(htmlPath) || '';

  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]);
  const duplicates = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  addCheck('build', '중복 ID 없음', duplicates.length ? 'fail' : 'pass', 'high', { duplicates });

  const localRefs = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/gi)]
    .map(match => match[1])
    .filter(value => value.startsWith('/') && !value.startsWith('//'))
    .map(value => value.split(/[?#]/)[0])
    .filter(value => value !== '/');
  const missing = [...new Set(localRefs)].filter(value => !fs.existsSync(path.join(dist, value.slice(1))));
  addCheck('build', 'HTML 로컬 자산 누락 없음', missing.length ? 'fail' : 'pass', 'critical', { missing });

  const externalRefs = [...html.matchAll(/(?:src|href)=["'](https?:\/\/[^"']+)["']/gi)].map(match => match[1]);
  const externalOrigins = [...new Set(externalRefs.map(value => {
    try { return new URL(value).origin; } catch { return value; }
  }))];
  report.static.externalOrigins = externalOrigins;
  addCheck('privacy', '초기 HTML의 외부 실행 자산 없음', externalOrigins.filter(origin => !origin.includes('unfollow.lavalabs.co.kr') && !origin.includes('lavalabs.co.kr')).length ? 'warn' : 'pass', 'medium', { externalOrigins });

  const inlineHandlers = countMatches(html, /\son[a-z]+\s*=/gi);
  addCheck('security', '인라인 이벤트 핸들러 없음', inlineHandlers ? 'warn' : 'pass', 'medium', { count: inlineHandlers });

  const targetBlankTags = [...html.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)].map(match => match[0]);
  const unsafeBlank = targetBlankTags.filter(tag => !/\brel=["'][^"']*(?:noopener|noreferrer)/i.test(tag));
  addCheck('security', '새 창 링크 noopener 적용', unsafeBlank.length ? 'fail' : 'pass', 'medium', { count: unsafeBlank.length, examples: unsafeBlank.slice(0, 5) });

  const allText = [...contents.entries()].map(([file, text]) => `\n/* ${rel(file)} */\n${text}`).join('\n');
  const dangerous = {
    eval: countMatches(allText, /\beval\s*\(/g),
    newFunction: countMatches(allText, /\bnew\s+Function\s*\(/g),
    documentWrite: countMatches(allText, /document\.write\s*\(/g),
    innerHTML: countMatches(allText, /\.innerHTML\s*=/g),
    insertAdjacentHTML: countMatches(allText, /insertAdjacentHTML\s*\(/g),
  };
  report.static.dangerousPatterns = dangerous;
  addCheck('security', 'eval/new Function/document.write 미사용', dangerous.eval || dangerous.newFunction || dangerous.documentWrite ? 'fail' : 'pass', 'critical', dangerous);
  addCheck('security', '동적 HTML 삽입 사용 검토', dangerous.innerHTML + dangerous.insertAdjacentHTML ? 'warn' : 'pass', 'medium', dangerous);

  const networkPatterns = {
    fetch: countMatches(allText, /\bfetch\s*\(/g),
    xhr: countMatches(allText, /XMLHttpRequest/g),
    websocket: countMatches(allText, /\bWebSocket\s*\(/g),
    beacon: countMatches(allText, /sendBeacon\s*\(/g),
  };
  report.static.networkPatterns = networkPatterns;
  addCheck('privacy', '명시적 업로드 API 없음', networkPatterns.xhr || networkPatterns.websocket || networkPatterns.beacon ? 'warn' : 'pass', 'high', networkPatterns);

  const storagePatterns = {
    localStorage: countMatches(allText, /localStorage/g),
    sessionStorage: countMatches(allText, /sessionStorage/g),
    indexedDB: countMatches(allText, /indexedDB/g),
  };
  report.static.storagePatterns = storagePatterns;

  const hasCSP = /http-equiv=["']Content-Security-Policy["']/i.test(html);
  addCheck('security', 'Content Security Policy 적용', hasCSP ? 'pass' : 'warn', 'medium', { hasCSP });

  const hasSRIExternalScript = externalRefs.filter(url => /\.js(?:[?#]|$)/i.test(url)).every(url => {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tag = html.match(new RegExp(`<script[^>]+src=["']${escaped}["'][^>]*>`, 'i'))?.[0] || '';
    return /\bintegrity=/i.test(tag);
  });
  addCheck('security', '외부 스크립트 SRI 적용', hasSRIExternalScript ? 'pass' : 'warn', 'medium', { externalScriptURLs: externalRefs.filter(url => /\.js(?:[?#]|$)/i.test(url)) });

  const manifest = path.join(dist, 'manifest.webmanifest');
  const sw = path.join(dist, 'sw.js');
  addCheck('pwa', 'Manifest 및 Service Worker 존재', fs.existsSync(manifest) && fs.existsSync(sw) ? 'pass' : 'fail', 'medium', { manifest: fs.existsSync(manifest), serviceWorker: fs.existsSync(sw) });

  const indexSize = fs.statSync(htmlPath).size;
  report.static.indexBytes = indexSize;
  addCheck('performance', '초기 HTML 크기 1MB 미만', indexSize < 1_000_000 ? 'pass' : 'warn', 'medium', { bytes: indexSize });

  const privacyClaims = {
    localOnly: /브라우저[^<]{0,30}(?:안에서만|로컬)/.test(html),
    noServer: /외부 서버로 전송되지/.test(html),
    noAutoUnfollow: /자동 언팔/.test(html),
    nonAffiliation: /Meta와 제휴/.test(html),
  };
  addCheck('legal', '핵심 개인정보·비제휴 안내 존재', Object.values(privacyClaims).every(Boolean) ? 'pass' : 'warn', 'medium', privacyClaims);

  const business = {
    registration: html.includes('455-23-01867'),
    email: html.includes('unfollow@lavalabs.co.kr'),
    unverifiedPhoneAbsent: !html.includes('031-900-9228') && !html.includes('+82-31-900-9228'),
  };
  addCheck('legal', '사업자 정보 정확성 기본 검사', Object.values(business).every(Boolean) ? 'pass' : 'fail', 'high', business);

  report.static.fileCount = files.length;
  report.static.textFileCount = textFiles.length;
}

async function firstVisible(locator) {
  const count = await locator.count();
  for (let i = 0; i < count; i++) {
    const item = locator.nth(i);
    if (await item.isVisible().catch(() => false)) return item;
  }
  return null;
}

async function textNumber(page, selector) {
  const text = await page.locator(selector).first().textContent().catch(() => '');
  const match = String(text || '').replaceAll(',', '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

async function axeAudit(page, label) {
  try {
    const result = await new AxeBuilder({ page }).analyze();
    const important = result.violations.filter(item => ['critical', 'serious'].includes(item.impact));
    addCheck('accessibility', `${label} 심각한 접근성 위반 없음`, important.length ? 'fail' : 'pass', 'high', {
      count: important.length,
      violations: important.map(item => ({ id: item.id, impact: item.impact, description: item.description, nodes: item.nodes.length })).slice(0, 20),
      totalViolations: result.violations.length,
    });
  } catch (error) {
    addCheck('accessibility', `${label} 접근성 자동검사 실행`, 'warn', 'medium', { error: String(error) });
  }
}

async function openPage(browser, name, viewport) {
  const context = await browser.newContext({ viewport, acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const externalRequests = [];
  const mutationRequests = [];
  const baseOrigin = new URL(baseURL).origin;

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), failure: request.failure()?.errorText || '' }));
  page.on('request', request => {
    const url = request.url();
    if (url.startsWith('http')) {
      const origin = new URL(url).origin;
      if (origin !== baseOrigin) externalRequests.push({ url, method: request.method(), type: request.resourceType() });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) mutationRequests.push({ url, method: request.method(), postDataBytes: request.postData()?.length || 0 });
  });

  const started = Date.now();
  const response = await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 45_000 });
  const loadMs = Date.now() - started;
  const status = response?.status() || 0;
  const title = await page.title();
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const overflow = await page.evaluate(() => ({
    width: innerWidth,
    htmlScrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 2,
  }));

  addCheck('runtime', `${name} 페이지 로드`, status >= 200 && status < 400 && /맞팔체커/.test(bodyText) ? 'pass' : 'fail', 'critical', { status, title, loadMs });
  addCheck('runtime', `${name} 콘솔·페이지 오류 없음`, consoleErrors.length || pageErrors.length ? 'fail' : 'pass', 'high', { consoleErrors, pageErrors });
  addCheck('runtime', `${name} 자산 요청 실패 없음`, failedRequests.length ? 'fail' : 'pass', 'high', { failedRequests });
  addCheck('responsive', `${name} 문서 가로 넘침 없음`, overflow.overflow ? 'fail' : 'pass', 'high', overflow);

  await axeAudit(page, `${name} 초기 화면`);

  const sampleButton = await firstVisible(page.locator('button').filter({ hasText: /샘플/ }));
  if (!sampleButton) {
    addCheck('function', `${name} 샘플 시작 버튼`, 'fail', 'critical', {});
  } else {
    await sampleButton.click();
    await page.waitForFunction(() => {
      const value = document.querySelector('#countFollowing')?.textContent || '';
      return Number(value.replace(/[^0-9]/g, '')) > 0;
    }, null, { timeout: 15_000 }).catch(() => {});

    const following = await textNumber(page, '#countFollowing');
    const mutual = await textNumber(page, '#countMutual');
    const nonMutual = await textNumber(page, '#countNonMutual');
    const sampleBanner = await page.locator('#syntheticSampleBanner').isVisible().catch(() => false);
    addCheck('function', `${name} 가상 샘플 분석`, following === 13 && mutual === 6 && nonMutual === 7 && sampleBanner ? 'pass' : 'fail', 'critical', { following, mutual, nonMutual, sampleBanner });

    const profileButton = await firstVisible(page.locator('button,a').filter({ hasText: /프로필 열기/ }));
    if (profileButton) {
      await profileButton.click();
      const modal = page.locator('#syntheticProfileModal');
      const modalVisible = await modal.isVisible().catch(() => false);
      const modalText = modalVisible ? await modal.innerText() : '';
      addCheck('function', `${name} 가상 프로필 안내 팝업`, modalVisible && /실제 Instagram 프로필은 열 수 없어요/.test(modalText) ? 'pass' : 'fail', 'high', { modalVisible, modalText: modalText.slice(0, 300) });
      if (modalVisible) await modal.locator('[data-modal-close]').first().click();
    } else {
      addCheck('function', `${name} 프로필 열기 버튼`, 'fail', 'high', {});
    }

    const keepButton = await firstVisible(page.locator('button').filter({ hasText: /유지하기.*다음|계속 팔로우/ }));
    if (keepButton) {
      const before = await textNumber(page, '#countDone');
      await keepButton.click();
      await page.waitForTimeout(250);
      const after = await textNumber(page, '#countDone');
      addCheck('function', `${name} 상태 선택 및 다음 이동`, before !== null && after !== null && after >= before + 1 ? 'pass' : 'fail', 'high', { before, after });
    } else {
      addCheck('function', `${name} 상태 처리 버튼`, 'warn', 'medium', { reason: 'visible keep button not found' });
    }

    const postSampleOverflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth + 2);
    addCheck('responsive', `${name} 결과 화면 가로 넘침 없음`, postSampleOverflow ? 'fail' : 'pass', 'high', { overflow: postSampleOverflow });
    await axeAudit(page, `${name} 결과 화면`);
  }

  if (viewport.width <= 760) {
    const toggle = page.locator('.mobileFilterToggle');
    const exists = await toggle.isVisible().catch(() => false);
    let expanded = false;
    if (exists) {
      await toggle.click();
      expanded = await toggle.getAttribute('aria-expanded') === 'true';
    }
    const bottomNav = await page.locator('.bottomNavV8').isVisible().catch(() => false);
    const tableHidden = await page.locator('.tableWrap').isHidden().catch(() => true);
    const mobileListVisible = await page.locator('.mobileList').isVisible().catch(() => false);
    addCheck('responsive', `${name} 모바일 필터 토글`, exists && expanded ? 'pass' : 'fail', 'high', { exists, expanded });
    addCheck('responsive', `${name} 하단 내비게이션`, bottomNav ? 'pass' : 'fail', 'high', { bottomNav });
    addCheck('responsive', `${name} 모바일 카드 목록 전환`, tableHidden && mobileListVisible ? 'pass' : 'fail', 'high', { tableHidden, mobileListVisible });
  }

  const business = page.locator('#businessInfoV10');
  const businessExists = await business.count() > 0;
  const businessText = businessExists ? await business.innerText() : '';
  addCheck('legal', `${name} 사업자 정보 표시`, businessExists && /455-23-01867/.test(businessText) && !/031-900-9228/.test(businessText) ? 'pass' : 'fail', 'high', { businessExists, preview: businessText.slice(0, 300) });

  report.browser[name] = { viewport, status, title, loadMs, consoleErrors, pageErrors, failedRequests, externalRequests, mutationRequests };
  addCheck('privacy', `${name} 파일 분석 중 외부 변경 요청 없음`, mutationRequests.length ? 'fail' : 'pass', 'critical', { mutationRequests });
  addCheck('privacy', `${name} 외부 요청 투명성`, 'pass', 'info', { externalRequests });

  await context.close();
}

async function uploadFixture(page, fixtureName, expected, label) {
  const file = path.join(fixtureDir, fixtureName);
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles(file);
  const started = Date.now();
  await page.waitForFunction(({ following }) => {
    const value = Number((document.querySelector('#countFollowing')?.textContent || '').replace(/[^0-9]/g, ''));
    return value === following;
  }, expected, { timeout: expected.following > 1000 ? 30_000 : 12_000 }).catch(() => {});
  const elapsedMs = Date.now() - started;
  const actual = {
    following: await textNumber(page, '#countFollowing'),
    mutual: await textNumber(page, '#countMutual'),
    nonMutual: await textNumber(page, '#countNonMutual'),
  };
  const ok = Object.entries(expected).every(([key, value]) => actual[key] === value);
  addCheck('parser', label, ok ? 'pass' : 'fail', 'critical', { expected, actual, elapsedMs });
  return { actual, elapsedMs };
}

async function parserAudit(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const network = [];
  const errors = [];
  page.on('request', request => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) network.push({ url: request.url(), method: request.method(), bytes: request.postData()?.length || 0 });
  });
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 45_000 });

  await uploadFixture(page, 'valid-basic.zip', { following: 3, mutual: 1, nonMutual: 2 }, '기본 Instagram JSON ZIP 분석 정확성');
  await uploadFixture(page, 'valid-split-followers.zip', { following: 3, mutual: 2, nonMutual: 1 }, '분할 followers_*.json 병합');

  await page.locator('input[type="file"]').first().setInputFiles(path.join(fixtureDir, 'malicious-username.zip'));
  await page.waitForTimeout(800);
  const xss = await page.evaluate(() => ({ flag: window.__auditXss || 0, images: document.querySelectorAll('img[data-audit-xss]').length }));
  addCheck('security', '업로드 데이터 DOM XSS 방어', xss.flag || xss.images ? 'fail' : 'pass', 'critical', xss);

  const large = await uploadFixture(page, 'large-5000.zip', { following: 5000, mutual: 3000, nonMutual: 2000 }, '5,000개 계정 ZIP 처리');
  addCheck('performance', '5,000개 분석 10초 이내', large.elapsedMs <= 10_000 ? 'pass' : 'warn', 'medium', { elapsedMs: large.elapsedMs });

  await page.locator('input[type="file"]').first().setInputFiles(path.join(fixtureDir, 'html-export.zip'));
  await page.waitForTimeout(800);
  const htmlMessage = await page.locator('#v10Toast,.toast,.error,[role="alert"]').allInnerTexts().catch(() => []);
  addCheck('error-handling', 'HTML 내보내기 파일 거부 안내', htmlMessage.some(text => /JSON|HTML|지원/.test(text)) ? 'pass' : 'warn', 'medium', { messages: htmlMessage });

  await page.locator('input[type="file"]').first().setInputFiles(path.join(fixtureDir, 'missing-files.zip'));
  await page.waitForTimeout(800);
  const missingMessage = await page.locator('#v10Toast,.toast,.error,[role="alert"]').allInnerTexts().catch(() => []);
  addCheck('error-handling', '필수 JSON 누락 안내', missingMessage.some(text => /찾지 못|팔로워|팔로잉|JSON/.test(text)) ? 'pass' : 'warn', 'medium', { messages: missingMessage });

  await uploadFixture(page, 'account-a.zip', { following: 2, mutual: 1, nonMutual: 1 }, '계정 A 분석');
  const keepButton = await firstVisible(page.locator('button').filter({ hasText: /유지하기.*다음|계속 팔로우/ }));
  if (keepButton) await keepButton.click();
  await page.waitForTimeout(200);
  const doneA = await textNumber(page, '#countDone');
  await uploadFixture(page, 'account-b.zip', { following: 1, mutual: 0, nonMutual: 1 }, '계정 B 분석');
  const doneB = await textNumber(page, '#countDone');
  addCheck('privacy', '다른 ZIP 업로드 시 작업 상태 분리', doneA && doneB === 0 ? 'pass' : 'fail', 'high', { doneA, doneB });

  addCheck('privacy', '실제 ZIP 테스트 중 서버 전송 없음', network.length ? 'fail' : 'pass', 'critical', { network });
  addCheck('runtime', '파서 테스트 중 페이지 오류 없음', errors.length ? 'fail' : 'pass', 'high', { errors });
  await context.close();
}

async function pwaAudit(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.waitForTimeout(1200);
  const registrations = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length).catch(() => 0);
  addCheck('pwa', 'Service Worker 등록', registrations > 0 ? 'pass' : 'warn', 'medium', { registrations });
  await context.setOffline(true);
  const offlinePage = await context.newPage();
  let offlineOK = false;
  let error = '';
  try {
    await offlinePage.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    offlineOK = /맞팔체커/.test(await offlinePage.locator('body').innerText());
  } catch (e) {
    error = String(e);
  }
  addCheck('pwa', '재방문 오프라인 로드', offlineOK ? 'pass' : 'warn', 'medium', { offlineOK, error });
  await context.close();
}

async function browserAudit() {
  const browser = await chromium.launch({ headless: true });
  try {
    await openPage(browser, 'desktop-1440', { width: 1440, height: 900 });
    await openPage(browser, 'tablet-1024', { width: 1024, height: 1366 });
    await openPage(browser, 'mobile-390', { width: 390, height: 844 });
    await openPage(browser, 'mobile-320', { width: 320, height: 568 });
    await parserAudit(browser);
    await pwaAudit(browser);
  } finally {
    await browser.close();
  }
}

function finalize() {
  const severityWeight = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
  const failed = report.checks.filter(check => check.status === 'fail');
  const warnings = report.checks.filter(check => check.status === 'warn');
  const blockers = failed.filter(check => ['critical', 'high'].includes(check.severity));
  const scorePenalty = failed.reduce((sum, check) => sum + severityWeight[check.severity] * 8, 0) + warnings.reduce((sum, check) => sum + severityWeight[check.severity] * 2, 0);
  const score = Math.max(0, Math.min(100, 100 - scorePenalty));
  const decision = blockers.length ? 'NO_GO' : warnings.some(check => check.severity === 'high') ? 'LIMITED_GO' : 'GO';
  report.summary = {
    decision,
    score,
    total: report.checks.length,
    passed: report.checks.filter(check => check.status === 'pass').length,
    failed: failed.length,
    warnings: warnings.length,
    blockers: blockers.map(check => ({ area: check.area, name: check.name, severity: check.severity })),
  };

  fs.writeFileSync(path.join(auditDir, 'latest-report.json'), JSON.stringify(report, null, 2));
  const lines = [
    '# 맞팔체커 출시 전 자동 감사',
    '',
    `- 생성 시각: ${report.generatedAt}`,
    `- 커밋: ${report.commit || '-'}`,
    `- 판정: **${decision}**`,
    `- 점수: **${score}/100**`,
    `- 통과 ${report.summary.passed} · 실패 ${report.summary.failed} · 경고 ${report.summary.warnings}`,
    '',
    '## 출시 차단 항목',
    '',
    ...(blockers.length ? blockers.map(item => `- [${item.severity.toUpperCase()}] ${item.area}: ${item.name}`) : ['- 없음']),
    '',
    '## 전체 검사',
    '',
    ...report.checks.map(item => `- ${item.status === 'pass' ? '✅' : item.status === 'fail' ? '❌' : '⚠️'} **${item.area} / ${item.name}** — ${item.status.toUpperCase()} (${item.severity})`),
    '',
  ];
  fs.writeFileSync(path.join(auditDir, 'latest-report.md'), lines.join('\n'));
}

try {
  staticAudit();
  await browserAudit();
} catch (error) {
  addCheck('audit', '감사 스크립트 완주', 'fail', 'critical', { error: String(error), stack: error?.stack || '' });
} finally {
  finalize();
}
