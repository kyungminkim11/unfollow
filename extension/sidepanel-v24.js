(() => {
  'use strict';

  const RELATIONSHIP_KEY = 'matchalRelationshipStateV23';
  const HISTORY_KEY = 'matchalRelationshipHistoryV24';
  const q = selector => document.querySelector(selector);
  const normalizeUsers = values => {
    const seen = new Set();
    return (Array.isArray(values) ? values : [])
      .map(value => String(value || '').trim().replace(/^@/, '').toLowerCase())
      .filter(username => {
        if (!/^[a-z0-9._]{1,30}$/.test(username) || seen.has(username)) return false;
        seen.add(username);
        return true;
      });
  };
  const difference = (left, right) => {
    const rightSet = new Set(right);
    return left.filter(value => !rightSet.has(value));
  };
  const intersection = (left, right) => {
    const rightSet = new Set(right);
    return left.filter(value => rightSet.has(value));
  };

  const els = {
    profile: q('#dashboardProfileV24'), meta: q('#dashboardMetaV24'),
    followers: q('#dashboardFollowersV24'), following: q('#dashboardFollowingV24'), mutual: q('#dashboardMutualV24'), nonMutual: q('#dashboardNonMutualV24'), followersOnly: q('#dashboardFollowersOnlyV24'),
    compare: q('#dashboardCompareV24'), list: q('#dashboardListV24'), queue: q('#dashboardQueueV24'), export: q('#dashboardExportV24')
  };
  let current = null;
  let history = [];
  let view = 'lostFollowersStillFollowing';

  const viewConfig = {
    lostFollowersStillFollowing: { label: '나를 언팔', actionable: true, source: 'scan_history_lost_followers' },
    newFollowers: { label: '새 팔로워' },
    newNonMutual: { label: '새 비맞팔', actionable: true, source: 'scan_history_new_non_mutual' },
    newMutual: { label: '새 맞팔' }
  };

  function normalizeSnapshot(raw = {}) {
    const followers = normalizeUsers(raw.followers);
    const following = normalizeUsers(raw.following);
    const followerSet = new Set(followers);
    return {
      id: String(raw.id || `${raw.profileUsername || ''}|${raw.createdAt || raw.lastScanAt || ''}`),
      profileUsername: String(raw.profileUsername || '').toLowerCase(),
      createdAt: String(raw.createdAt || raw.lastScanAt || ''),
      followers,
      following,
      mutual: normalizeUsers(raw.mutual?.length ? raw.mutual : following.filter(username => followerSet.has(username))),
      nonMutual: normalizeUsers(raw.nonMutual?.length ? raw.nonMutual : following.filter(username => !followerSet.has(username))),
      complete: Boolean(raw.complete)
    };
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '날짜 없음';
    return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  async function upsertCurrentSnapshot(raw) {
    if (!raw?.lastScanAt || raw.status !== 'completed' || !raw.profileUsername) return;
    const snapshot = normalizeSnapshot({ ...raw, createdAt: raw.lastScanAt });
    const key = `${snapshot.profileUsername}|${snapshot.createdAt}`;
    const next = [snapshot, ...history.filter(item => `${item.profileUsername}|${item.createdAt}` !== key)]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 24);
    history = next;
    await chrome.storage.local.set({ [HISTORY_KEY]: history });
  }

  function pair() {
    const after = current?.lastScanAt ? normalizeSnapshot({ ...current, createdAt: current.lastScanAt }) : history[0] || null;
    const before = history.find(item => item.profileUsername === after?.profileUsername && item.createdAt !== after?.createdAt) || null;
    return { before, after };
  }

  function changes() {
    const { before, after } = pair();
    if (!before || !after) return { lostFollowersStillFollowing: [], newFollowers: [], newNonMutual: [], newMutual: [] };
    const lostFollowers = difference(before.followers, after.followers);
    return {
      lostFollowersStillFollowing: intersection(lostFollowers, after.following),
      newFollowers: difference(after.followers, before.followers),
      newNonMutual: difference(after.nonMutual, before.nonMutual),
      newMutual: difference(after.mutual, before.mutual)
    };
  }

  function currentList() { return changes()[view] || []; }

  function render() {
    if (!els.profile) return;
    const { before, after } = pair();
    const values = after || normalizeSnapshot({});
    const followersOnly = difference(values.followers, values.following);
    els.profile.textContent = after?.profileUsername ? `@${after.profileUsername}` : '스캔 기록 없음';
    els.meta.textContent = after ? `${formatDate(after.createdAt)} · 기록 ${history.filter(item => item.profileUsername === after.profileUsername).length}개${after.complete ? '' : ' · 일부 목록 가능'}` : '관계 스캔을 두 번 이상 실행하면 최근 변화를 비교합니다.';
    els.followers.textContent = values.followers.length.toLocaleString('ko-KR');
    els.following.textContent = values.following.length.toLocaleString('ko-KR');
    els.mutual.textContent = values.mutual.length.toLocaleString('ko-KR');
    els.nonMutual.textContent = values.nonMutual.length.toLocaleString('ko-KR');
    els.followersOnly.textContent = followersOnly.length.toLocaleString('ko-KR');
    els.compare.textContent = before && after ? `${formatDate(before.createdAt)} → ${formatDate(after.createdAt)}` : '이전 스캔 기록이 아직 없습니다.';

    const map = changes();
    document.querySelectorAll('[data-dashboard-view]').forEach(button => {
      const key = button.dataset.dashboardView;
      button.classList.toggle('active', key === view);
      const count = button.querySelector('strong');
      if (count) count.textContent = (map[key] || []).length.toLocaleString('ko-KR');
    });

    els.list.replaceChildren();
    const list = currentList();
    if (!before) {
      const empty = document.createElement('div'); empty.className = 'dashboardEmpty'; empty.textContent = '같은 계정을 한 번 더 스캔하면 변화 목록이 표시됩니다.'; els.list.appendChild(empty);
    } else if (!list.length) {
      const empty = document.createElement('div'); empty.className = 'dashboardEmpty'; empty.textContent = '이 조건에 해당하는 변화가 없습니다.'; els.list.appendChild(empty);
    } else {
      const fragment = document.createDocumentFragment();
      list.slice(0, 200).forEach((username, index) => {
        const row = document.createElement('a'); row.className = 'dashboardListItem'; row.href = `https://www.instagram.com/${encodeURIComponent(username)}/`; row.target = '_blank'; row.rel = 'noopener noreferrer';
        const number = document.createElement('span'); number.textContent = String(index + 1);
        const name = document.createElement('strong'); name.textContent = `@${username}`;
        const open = document.createElement('small'); open.textContent = '열기';
        row.append(number, name, open); fragment.appendChild(row);
      });
      if (list.length > 200) { const more = document.createElement('div'); more.className = 'dashboardEmpty'; more.textContent = `앞의 200개만 표시합니다. 전체 ${list.length.toLocaleString('ko-KR')}개는 CSV와 작업 목록에 포함됩니다.`; fragment.appendChild(more); }
      els.list.appendChild(fragment);
    }
    const config = viewConfig[view];
    els.queue.disabled = !config.actionable || !list.length;
    els.queue.textContent = config.actionable ? `${config.label} ${list.length.toLocaleString('ko-KR')}개를 작업 목록으로 만들기` : '이 목록은 확인용입니다';
    els.export.disabled = !list.length;
  }

  async function queueCurrent() {
    const config = viewConfig[view];
    const list = currentList();
    const { before, after } = pair();
    if (!config.actionable || !list.length) return;
    const response = await chrome.runtime.sendMessage({
      type: 'MATCHAL_SAVE_QUEUE',
      payload: {
        queueName: `${config.label} · @${after?.profileUsername || 'instagram'} · ${formatDate(before?.createdAt)} → ${formatDate(after?.createdAt)}`,
        sourceType: config.source,
        items: list.map(username => ({ username, source: config.source }))
      }
    });
    els.compare.textContent = response?.ok ? `${list.length.toLocaleString('ko-KR')}개 계정을 팔로우 취소 작업 목록으로 만들었습니다.` : response?.message || '작업 목록을 만들지 못했습니다.';
  }

  function exportCurrent() {
    const list = currentList();
    const { before, after } = pair();
    if (!list.length) return;
    const rows = [['change_type', 'username', 'profile_url', 'before', 'after'], ...list.map(username => [view, username, `https://www.instagram.com/${username}/`, before?.createdAt || '', after?.createdAt || ''])];
    const csv = '\ufeff' + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `matchal-${view}-${after?.profileUsername || 'instagram'}-${new Date().toISOString().slice(0, 10)}.csv`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function load() {
    const stored = await chrome.storage.local.get([RELATIONSHIP_KEY, HISTORY_KEY]);
    current = stored[RELATIONSHIP_KEY] || null;
    history = (Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : []).map(normalizeSnapshot);
    if (!history.length && Array.isArray(current?.snapshots)) history = current.snapshots.map(normalizeSnapshot);
    await upsertCurrentSnapshot(current);
    render();
  }

  document.querySelectorAll('[data-dashboard-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.dashboardView; render(); }));
  els.queue?.addEventListener('click', queueCurrent);
  els.export?.addEventListener('click', exportCurrent);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[RELATIONSHIP_KEY]?.newValue) {
      current = changes[RELATIONSHIP_KEY].newValue;
      upsertCurrentSnapshot(current).then(render);
    }
    if (changes[HISTORY_KEY]?.newValue) {
      history = (Array.isArray(changes[HISTORY_KEY].newValue) ? changes[HISTORY_KEY].newValue : []).map(normalizeSnapshot);
      render();
    }
  });
  load().catch(error => { if (els.compare) els.compare.textContent = error?.message || String(error); });
})();