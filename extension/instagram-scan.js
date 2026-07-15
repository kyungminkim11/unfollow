(() => {
  'use strict';

  if (window.__MATCHAL_RELATIONSHIP_SCANNER_V23__) return;
  window.__MATCHAL_RELATIONSHIP_SCANNER_V23__ = true;

  const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/;
  const RESERVED_PATHS = new Set([
    'about', 'accounts', 'api', 'challenge', 'checkpoint', 'developer', 'direct', 'directory',
    'emails', 'explore', 'graphql', 'legal', 'oauth', 'p', 'privacy', 'reel', 'reels', 'stories',
    'terms', 'web', 'your_activity'
  ]);
  const EDIT_PROFILE_LABELS = new Set([
    'edit profile', '프로필 편집', 'プロフィールを編集', 'editar perfil', 'editar perfil', 'modifier le profil'
  ]);
  const PROFILE_LABELS = new Set([
    'profile', '프로필', 'プロフィール', 'perfil', 'profil'
  ]);
  const CLOSE_LABELS = new Set([
    'close', '닫기', '閉じる', 'cerrar', 'fechar', 'fermer'
  ]);

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en-US');
  let activeScan = null;

  function visible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  }

  function firstPathSegment(href) {
    try {
      const url = new URL(href, location.origin);
      if (url.origin !== location.origin) return '';
      const parts = decodeURIComponent(url.pathname).split('/').filter(Boolean);
      if (parts.length !== 1) return '';
      const username = parts[0].toLowerCase();
      return USERNAME_PATTERN.test(username) && !RESERVED_PATHS.has(username) ? username : '';
    } catch {
      return '';
    }
  }

  function currentPathUsername() {
    const first = decodeURIComponent(location.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
    return USERNAME_PATTERN.test(first) && !RESERVED_PATHS.has(first) ? first : '';
  }

  function combinedLabel(element) {
    if (!(element instanceof Element)) return '';
    const values = [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.textContent,
      ...Array.from(element.querySelectorAll('[aria-label],[title]')).slice(0, 4).flatMap(node => [node.getAttribute('aria-label'), node.getAttribute('title')])
    ];
    return normalize(values.filter(Boolean).join(' '));
  }

  function detectProfileFromNavigation() {
    const anchors = Array.from(document.querySelectorAll('nav a[href], header a[href], a[role="link"][href]')).filter(visible);
    for (const anchor of anchors) {
      const label = combinedLabel(anchor);
      if (![...PROFILE_LABELS].some(value => label === value || label.includes(`${value} `) || label.endsWith(` ${value}`))) continue;
      const username = firstPathSegment(anchor.getAttribute('href') || '');
      if (username) return username;
    }
    return '';
  }

  function ownProfileConfirmed(username) {
    if (currentPathUsername() !== username) return false;
    if (document.querySelector('a[href^="/accounts/edit"], a[href*="/accounts/edit/"]')) return true;
    const controls = Array.from(document.querySelectorAll('main header button, main header a, main section header button, main section header a')).filter(visible);
    return controls.some(control => EDIT_PROFILE_LABELS.has(combinedLabel(control)));
  }

  function detectOwnProfile() {
    const current = currentPathUsername();
    if (current && ownProfileConfirmed(current)) return { ok: true, username: current, confirmed: true };
    const navigation = detectProfileFromNavigation();
    if (navigation) return { ok: true, username: navigation, confirmed: current === navigation && ownProfileConfirmed(navigation) };
    return { ok: false, username: '', confirmed: false, message: 'Instagram에서 내 프로필을 열거나 아이디를 직접 입력해 주세요.' };
  }

  function isLogin() {
    return /\/accounts\/login\b/i.test(location.pathname) || Boolean(document.querySelector('input[name="username"], input[name="password"]'));
  }

  function isChallenge() {
    return /\/(challenge|checkpoint)\b/i.test(location.pathname) || Boolean(document.querySelector('form[action*="challenge"], input[name="security_code"]'));
  }

  function findListLink(username, kind) {
    const expected = `/${username}/${kind}/`;
    const anchors = Array.from(document.querySelectorAll('main header a[href], main section header a[href], header a[href]')).filter(visible);
    return anchors.find(anchor => {
      try {
        return new URL(anchor.getAttribute('href') || '', location.origin).pathname.toLowerCase() === expected;
      } catch {
        return false;
      }
    }) || null;
  }

  function parseExpectedCount(link) {
    const text = normalize(`${link?.getAttribute('aria-label') || ''} ${link?.textContent || ''}`).replace(/,/g, '');
    const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(만|천|k|m)?/i);
    if (!match) return null;
    const number = Number(match[1]);
    if (!Number.isFinite(number)) return null;
    const unit = String(match[2] || '').toLowerCase();
    const multiplier = unit === 'm' ? 1_000_000 : unit === 'k' || unit === '천' ? 1_000 : unit === '만' ? 10_000 : 1;
    return Math.max(0, Math.round(number * multiplier));
  }

  async function waitFor(fn, timeoutMs = 12000, intervalMs = 180) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const value = fn();
      if (value) return value;
      await sleep(intervalMs);
    }
    return null;
  }

  function visibleDialog() {
    return Array.from(document.querySelectorAll('[role="dialog"]')).filter(visible).at(-1) || null;
  }

  function findScrollContainer(dialog) {
    const candidates = Array.from(dialog.querySelectorAll('div,ul')).filter(element => {
      if (!(element instanceof HTMLElement) || !visible(element)) return false;
      const style = getComputedStyle(element);
      const scrollable = /(auto|scroll)/.test(style.overflowY) || element.scrollHeight > element.clientHeight + 40;
      return scrollable && element.clientHeight >= 120 && element.scrollHeight > element.clientHeight + 20;
    });
    candidates.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));
    return candidates[0] || null;
  }

  function collectDialogUsernames(dialog, ownUsername) {
    const values = [];
    const seen = new Set();
    for (const anchor of dialog.querySelectorAll('a[href]')) {
      const username = firstPathSegment(anchor.getAttribute('href') || '');
      if (!username || username === ownUsername || seen.has(username)) continue;
      seen.add(username);
      values.push(username);
    }
    return values;
  }

  async function closeDialog(dialog) {
    if (!dialog?.isConnected) return;
    const controls = Array.from(dialog.querySelectorAll('button,[role="button"]')).filter(visible);
    const close = controls.find(control => CLOSE_LABELS.has(combinedLabel(control))) || controls.find(control => {
      const label = combinedLabel(control);
      return [...CLOSE_LABELS].some(value => label.includes(value));
    });
    if (close) {
      close.click();
      await sleep(350);
      return;
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
    await sleep(350);
  }

  function emitProgress(payload) {
    chrome.runtime.sendMessage({ type: 'MATCHAL_SCAN_PROGRESS', payload }).catch(() => {});
  }

  async function scanList(username, kind) {
    if (activeScan?.running) return { ok: false, code: 'scan_running', message: '이미 관계 목록을 수집하고 있습니다.' };
    if (!USERNAME_PATTERN.test(username)) return { ok: false, code: 'invalid_username', message: 'Instagram 아이디 형식을 확인해 주세요.' };
    if (!['followers', 'following'].includes(kind)) return { ok: false, code: 'invalid_kind', message: '수집할 목록을 확인해 주세요.' };
    if (isChallenge()) return { ok: false, code: 'challenge', message: 'Instagram 보안 확인 또는 제한 화면이 감지되었습니다.' };
    if (isLogin()) return { ok: false, code: 'login_required', message: 'Instagram 로그인이 필요합니다.' };
    if (currentPathUsername() !== username) return { ok: false, code: 'profile_mismatch', message: `Instagram에서 @${username} 프로필을 먼저 열어 주세요.` };
    if (!ownProfileConfirmed(username)) return { ok: false, code: 'own_profile_unconfirmed', message: '현재 페이지가 로그인한 계정의 내 프로필인지 확인하지 못했습니다. 내 프로필을 직접 연 뒤 다시 시도해 주세요.' };

    activeScan = { running: true, stop: false, kind, username };
    const set = new Set();
    let expected = null;
    let rounds = 0;
    let stableRounds = 0;
    let lastSize = 0;
    let lastScrollTop = -1;
    let warning = '';
    let dialog = null;

    try {
      const link = await waitFor(() => findListLink(username, kind), 12000);
      if (!link) return { ok: false, code: 'list_link_missing', message: `${kind === 'followers' ? '팔로워' : '팔로잉'} 목록 버튼을 찾지 못했습니다. Instagram 화면을 새로고침해 주세요.` };
      expected = parseExpectedCount(link);
      link.scrollIntoView({ block: 'center', inline: 'center' });
      link.click();
      dialog = await waitFor(visibleDialog, 12000);
      if (!dialog) return { ok: false, code: 'dialog_missing', message: `${kind === 'followers' ? '팔로워' : '팔로잉'} 목록 창을 열지 못했습니다.` };

      const started = Date.now();
      while (rounds < 4000 && Date.now() - started < 25 * 60 * 1000) {
        if (activeScan.stop) break;
        if (isChallenge()) return { ok: false, code: 'challenge', message: '수집 중 Instagram 보안 확인 화면이 감지되었습니다.', usernames: [...set] };
        if (isLogin()) return { ok: false, code: 'login_required', message: '수집 중 Instagram 로그인 화면이 감지되었습니다.', usernames: [...set] };
        dialog = visibleDialog();
        if (!dialog) return { ok: false, code: 'dialog_closed', message: '목록 창이 닫혀 수집을 중지했습니다.', usernames: [...set] };

        collectDialogUsernames(dialog, username).forEach(value => set.add(value));
        rounds++;
        const currentSize = set.size;
        emitProgress({ kind, username, count: currentSize, expected, rounds, status: 'collecting' });
        if (expected !== null && currentSize >= expected) break;
        if (currentSize >= 50000) {
          warning = '브라우저 보호를 위해 50,000개에서 수집을 중지했습니다.';
          break;
        }

        const scroller = findScrollContainer(dialog);
        if (!scroller) {
          stableRounds++;
          if (stableRounds >= 10) {
            warning = '스크롤 영역을 찾지 못해 현재 화면에 로드된 계정까지만 저장했습니다.';
            break;
          }
          await sleep(700);
          continue;
        }

        const beforeTop = scroller.scrollTop;
        const beforeHeight = scroller.scrollHeight;
        const step = Math.max(360, Math.floor(scroller.clientHeight * 0.82));
        scroller.scrollTop = Math.min(scroller.scrollHeight, scroller.scrollTop + step);
        scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
        await sleep(650 + Math.floor(Math.random() * 300));

        const noNewUsers = currentSize === lastSize;
        const noMovement = Math.abs(scroller.scrollTop - beforeTop) < 2 && Math.abs(scroller.scrollTop - lastScrollTop) < 2;
        const heightStable = Math.abs(scroller.scrollHeight - beforeHeight) < 2;
        stableRounds = noNewUsers && noMovement && heightStable ? stableRounds + 1 : 0;
        if (stableRounds >= 8) break;
        lastSize = currentSize;
        lastScrollTop = scroller.scrollTop;
      }

      const stopped = Boolean(activeScan.stop);
      const coverage = expected && expected > 0 ? set.size / expected : 1;
      const complete = !stopped && (!expected || coverage >= 0.94 || stableRounds >= 8);
      if (!warning && expected && coverage < 0.94) warning = `화면 표시 수 ${expected.toLocaleString()}개 중 ${set.size.toLocaleString()}개를 수집했습니다. 목록 로딩이 멈췄을 수 있습니다.`;
      const message = stopped
        ? `${kind === 'followers' ? '팔로워' : '팔로잉'} 수집을 중지했습니다. 현재까지 ${set.size.toLocaleString()}개를 보관합니다.`
        : `${kind === 'followers' ? '팔로워' : '팔로잉'} ${set.size.toLocaleString()}개를 수집했습니다.`;
      emitProgress({ kind, username, count: set.size, expected, rounds, status: stopped ? 'stopped' : 'completed', complete, warning });
      return { ok: true, kind, username, usernames: [...set], count: set.size, expected, complete, stopped, warning, message };
    } finally {
      await closeDialog(dialog).catch(() => {});
      activeScan = null;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const type = String(message?.type || '');
    if (type === 'MATCHAL_SCAN_DETECT_PROFILE') {
      sendResponse(detectOwnProfile());
      return;
    }
    if (type === 'MATCHAL_SCAN_STOP') {
      if (activeScan) activeScan.stop = true;
      sendResponse({ ok: true, running: Boolean(activeScan?.running) });
      return;
    }
    if (type === 'MATCHAL_SCAN_STATUS') {
      sendResponse({ ok: true, running: Boolean(activeScan?.running), kind: activeScan?.kind || '', username: activeScan?.username || '' });
      return;
    }
    if (type === 'MATCHAL_SCAN_LIST') {
      scanList(String(message.username || '').trim().replace(/^@/, '').toLowerCase(), String(message.kind || ''))
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ ok: false, code: 'unexpected_error', message: error?.message || String(error) }));
      return true;
    }
  });
})();