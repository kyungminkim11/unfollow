(() => {
  'use strict';

  if (window.__MATCHAL_UNFOLLOW_EXECUTOR_V22__) return;
  window.__MATCHAL_UNFOLLOW_EXECUTOR_V22__ = true;

  const FOLLOWING_LABELS = new Set([
    'following', '팔로잉', 'フォロー中', 'siguiendo', 'seguindo', 'abonné(e)', 'abonnements'
  ]);
  const FOLLOW_LABELS = new Set([
    'follow', '팔로우', 'フォローする', 'seguir', 's’abonner', "s'abonner"
  ]);
  const UNFOLLOW_LABELS = new Set([
    'unfollow', '팔로우 취소', 'フォローをやめる', 'dejar de seguir', 'deixar de seguir', 'se désabonner'
  ]);

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('en-US');

  function currentUsername() {
    const first = decodeURIComponent(location.pathname.split('/').filter(Boolean)[0] || '').toLowerCase();
    return /^[a-z0-9._]{1,30}$/.test(first) ? first : '';
  }

  function isChallenge() {
    return /\/(challenge|checkpoint)\b/i.test(location.pathname) || Boolean(document.querySelector('form[action*="challenge"], input[name="security_code"]'));
  }

  function isLogin() {
    return /\/accounts\/login\b/i.test(location.pathname) || Boolean(document.querySelector('input[name="username"], input[name="password"]'));
  }

  function visible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }

  function labelOf(element) {
    return normalize(element.getAttribute('aria-label') || element.textContent || '');
  }

  function candidates(root = document) {
    return Array.from(root.querySelectorAll('button,[role="button"]')).filter(visible);
  }

  function findProfileFollowingControl() {
    const roots = [
      document.querySelector('main header'),
      document.querySelector('main section header'),
      document.querySelector('header')
    ].filter(Boolean);
    for (const root of roots) {
      const exact = candidates(root).find(element => FOLLOWING_LABELS.has(labelOf(element)));
      if (exact) return exact;
    }
    return null;
  }

  function findAlreadyFollowControl() {
    const root = document.querySelector('main header') || document.querySelector('main');
    return candidates(root || document).find(element => FOLLOW_LABELS.has(labelOf(element))) || null;
  }

  function findUnfollowConfirmation() {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]')).filter(visible);
    for (const dialog of dialogs) {
      const exact = candidates(dialog).find(element => UNFOLLOW_LABELS.has(labelOf(element)));
      if (exact) return exact;
    }
    return candidates(document).find(element => UNFOLLOW_LABELS.has(labelOf(element))) || null;
  }

  async function waitFor(fn, timeoutMs = 9000, intervalMs = 180) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const value = fn();
      if (value) return value;
      await sleep(intervalMs);
    }
    return null;
  }

  async function execute(username) {
    const expected = String(username || '').trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(expected)) return { ok: false, code: 'invalid_username', message: '아이디 형식이 올바르지 않습니다.' };
    if (isChallenge()) return { ok: false, code: 'challenge', message: 'Instagram 확인 또는 제한 화면이 감지되었습니다.' };
    if (isLogin()) return { ok: false, code: 'login_required', message: 'Instagram 로그인이 필요합니다.' };
    if (currentUsername() !== expected) return { ok: false, code: 'profile_mismatch', message: '현재 프로필과 작업 대상이 일치하지 않습니다.' };

    const following = await waitFor(findProfileFollowingControl, 10000);
    if (!following) {
      const alreadyNotFollowing = findAlreadyFollowControl();
      if (alreadyNotFollowing) return { ok: true, code: 'already_unfollowed', skipped: true, message: '이미 팔로우하지 않는 계정입니다.' };
      return { ok: false, code: 'following_control_missing', message: '팔로잉 버튼을 찾지 못했습니다. 화면 언어 또는 Instagram UI가 변경됐을 수 있습니다.' };
    }

    following.scrollIntoView({ block: 'center', inline: 'center' });
    following.click();

    const confirm = await waitFor(findUnfollowConfirmation, 7000);
    if (!confirm) return { ok: false, code: 'confirmation_missing', message: '팔로우 취소 확인 버튼을 찾지 못했습니다.' };
    confirm.click();

    const completed = await waitFor(() => findAlreadyFollowControl() || !findProfileFollowingControl(), 10000);
    if (!completed) return { ok: false, code: 'completion_timeout', message: '팔로우 취소 완료 상태를 확인하지 못했습니다.' };
    return { ok: true, code: 'unfollowed', skipped: false, message: '팔로우 취소가 완료되었습니다.' };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'MATCHAL_UNFOLLOW_CURRENT') return;
    execute(message.username)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ ok: false, code: 'unexpected_error', message: error?.message || String(error) }));
    return true;
  });
})();