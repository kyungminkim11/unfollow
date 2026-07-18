(() => {
  'use strict';

  if (window.__MATCHAL_RELATIONSHIP_DASHBOARD_V24__) return;
  window.__MATCHAL_RELATIONSHIP_DASHBOARD_V24__ = true;

  const q = (selector, root = document) => root.querySelector(selector);
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
  const timestamp = value => {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  const unionSnapshots = (history = [], current = null) => {
    const rows = [];
    const seen = new Set();
    const push = raw => {
      if (!raw) return;
      const createdAt = String(raw.createdAt || raw.lastScanAt || '');
      const profileUsername = String(raw.profileUsername || '').toLowerCase();
      if (!createdAt || !profileUsername) return;
      const key = `${profileUsername}|${createdAt}`;
      if (seen.has(key)) return;
      seen.add(key);
      const followers = normalizeUsers(raw.followers);
      const following = normalizeUsers(raw.following);
      const followerSet = new Set(followers);
      rows.push({
        id: String(raw.id || key),
        profileUsername,
        createdAt,
        followers,
        following,
        mutual: normalizeUsers(raw.mutual?.length ? raw.mutual : following.filter(username => followerSet.has(username))),
        nonMutual: normalizeUsers(raw.nonMutual?.length ? raw.nonMutual : following.filter(username => !followerSet.has(username))),
        complete: Boolean(raw.complete),
        warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : []
      });
    };
    push(current);
    history.forEach(push);
    return rows.sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)).slice(0, 24);
  };

  const state = {
    mounted: false,
    connected: false,
    history: [],
    beforeId: '',
    afterId: '',
    view: 'lostFollowersStillFollowing',
    search: '',
    selected: new Set()
  };

  const VIEWS = {
    lostFollowersStillFollowing: { label: '나를 언팔', description: '이전에는 나를 팔로우했지만 현재는 팔로우하지 않으며, 나는 아직 팔로우 중인 계정입니다.', actionable: true, source: 'scan_history_lost_followers' },
    newFollowers: { label: '새 팔로워', description: '이전 스캔 이후 새로 나를 팔로우한 계정입니다.' },
    newNonMutual: { label: '새 비맞팔', description: '이전에는 비맞팔이 아니었지만 현재 나만 팔로우 중인 계정입니다.', actionable: true, source: 'scan_history_new_non_mutual' },
    newMutual: { label: '새 맞팔', description: '이전 스캔 이후 새롭게 맞팔 관계가 된 계정입니다.' },
    newFollowing: { label: '새 팔로잉', description: '이전 스캔 이후 내가 새로 팔로우한 계정입니다.' },
    unfollowedByMe: { label: '내가 취소', description: '이전에는 팔로우했지만 현재는 내가 팔로우하지 않는 계정입니다.' }
  };

  function root() { return q('#relationshipDashboardV24'); }
  function formatDate(value, compact = false) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '날짜 없음';
    return new Intl.DateTimeFormat('ko-KR', compact ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' } : { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }
  function signed(value) {
    if (!Number.isFinite(value) || value === 0) return '변화 없음';
    return `${value > 0 ? '+' : ''}${value.toLocaleString('ko-KR')}`;
  }
  function snapshotById(id) { return state.history.find(item => item.id === id) || null; }
  function olderSnapshots(after) {
    if (!after) return [];
    return state.history.filter(item => item.profileUsername === after.profileUsername && timestamp(item.createdAt) < timestamp(after.createdAt));
  }
  function currentPair() {
    const after = snapshotById(state.afterId) || state.history[0] || null;
    const allowedBefore = olderSnapshots(after);
    const selectedBefore = snapshotById(state.beforeId);
    const before = selectedBefore && allowedBefore.some(item => item.id === selectedBefore.id) ? selectedBefore : allowedBefore[0] || null;
    return { before, after };
  }
  function metrics(snapshot) {
    if (!snapshot) return { followers: 0, following: 0, mutual: 0, nonMutual: 0, followersOnly: 0 };
    return {
      followers: snapshot.followers.length,
      following: snapshot.following.length,
      mutual: snapshot.mutual.length,
      nonMutual: snapshot.nonMutual.length,
      followersOnly: difference(snapshot.followers, snapshot.following).length
    };
  }
  function changes() {
    const { before, after } = currentPair();
    if (!before || !after) return Object.fromEntries(Object.keys(VIEWS).map(key => [key, []]));
    const lostFollowers = difference(before.followers, after.followers);
    return {
      lostFollowersStillFollowing: intersection(lostFollowers, after.following),
      newFollowers: difference(after.followers, before.followers),
      newNonMutual: difference(after.nonMutual, before.nonMutual),
      newMutual: difference(after.mutual, before.mutual),
      newFollowing: difference(after.following, before.following),
      unfollowedByMe: difference(before.following, after.following)
    };
  }
  function currentChangeList() { return changes()[state.view] || []; }

  function mount() {
    if (state.mounted || root()) return;
    const section = document.createElement('section');
    section.id = 'relationshipDashboardV24';
    section.className = 'relationshipDashboardV24 sectionAnchorV11';
    section.innerHTML = `
      <header class="dashboardHeadV24">
        <div><span class="dashboardEyebrowV24">RELATIONSHIP DASHBOARD · v24</span><h2>Instagram 관계 대시보드</h2><p>Companion 스캔 기록을 비교해 현재 관계 요약과 최근 변화를 확인합니다. 기록과 명단은 이 Chrome의 로컬 저장소에만 보관됩니다.</p></div>
        <span class="dashboardConnectionV24" data-v24-connected="false">Companion 확인 중</span>
      </header>
      <div class="dashboardProfileV24"><div><strong data-v24-profile>스캔 기록 없음</strong><span data-v24-profile-meta>Companion에서 첫 관계 스캔을 실행해 주세요.</span></div><button type="button" data-v24-open-panel>Companion 열기</button></div>
      <div class="dashboardSummaryV24" aria-label="현재 관계 요약">
        <article data-v24-metric="followers"><span>팔로워</span><strong>0</strong><small data-v24-delta>비교 기록 없음</small></article>
        <article data-v24-metric="following"><span>팔로잉</span><strong>0</strong><small data-v24-delta>비교 기록 없음</small></article>
        <article data-v24-metric="mutual"><span>맞팔</span><strong>0</strong><small data-v24-delta>비교 기록 없음</small></article>
        <article data-v24-metric="nonMutual"><span>맞팔 아님</span><strong>0</strong><small data-v24-delta>비교 기록 없음</small></article>
        <article data-v24-metric="followersOnly"><span>나를 팔로우만</span><strong>0</strong><small data-v24-delta>비교 기록 없음</small></article>
      </div>
      <section class="dashboardCompareV24" aria-labelledby="dashboardCompareTitleV24">
        <div class="dashboardCompareHeadV24"><div><h3 id="dashboardCompareTitleV24">스캔 기록 비교</h3><p data-v24-compare-summary>두 번 이상 스캔하면 최근 변화가 표시됩니다.</p></div><button type="button" data-v24-refresh>기록 새로고침</button></div>
        <div class="dashboardSelectorsV24"><label><span>이전 시점</span><select data-v24-before aria-label="이전 스캔 선택"></select></label><span class="dashboardArrowV24">→</span><label><span>현재 시점</span><select data-v24-after aria-label="현재 스캔 선택"></select></label></div>
        <div class="dashboardChangeTabsV24" role="tablist" aria-label="관계 변화 종류">
          ${Object.entries(VIEWS).map(([key, item]) => `<button type="button" role="tab" data-v24-view="${key}"><span>${item.label}</span><strong data-v24-change-count="${key}">0</strong></button>`).join('')}
        </div>
        <div class="dashboardChangeWorkspaceV24">
          <div class="dashboardChangeListPanelV24"><div class="dashboardChangeListHeadV24"><div><h3 data-v24-list-title>나를 언팔한 계정</h3><p data-v24-list-description></p></div><input type="search" data-v24-search placeholder="아이디 검색" aria-label="관계 변화 아이디 검색"></div><div class="dashboardChangeListV24" data-v24-list></div></div>
          <aside class="dashboardActionV24"><h3>변화 목록 활용</h3><p data-v24-action-copy>현재 변화 목록을 확인하거나 CSV로 저장할 수 있습니다.</p><div class="dashboardSelectionV24"><span>전체</span><strong data-v24-total>0</strong><span>선택</span><strong data-v24-selected>0</strong></div><div class="dashboardActionButtonsV24"><button type="button" data-v24-select-all>전체 선택</button><button type="button" data-v24-clear>선택 해제</button><button type="button" data-v24-export>CSV 저장</button></div><label class="dashboardConfirmV24"><input type="checkbox" data-v24-confirm><span>선택한 계정을 팔로우 취소 작업 목록으로 보내는 것을 확인했습니다.</span></label><button type="button" class="primary" data-v24-queue disabled>선택 목록을 Companion 작업으로 보내기</button><p data-v24-status class="dashboardStatusV24" role="status" aria-live="polite"></p></aside>
        </div>
      </section>`;

    const scan = q('#relationshipScanV23');
    if (scan?.parentNode) scan.parentNode.insertBefore(section, scan);
    else (q('.main') || document.body).appendChild(section);

    section.addEventListener('click', handleClick);
    section.addEventListener('change', handleChange);
    q('[data-v24-search]', section).addEventListener('input', event => { state.search = event.target.value.trim().toLowerCase(); renderList(); });
    window.addEventListener('message', handleMessage);
    state.mounted = true;
    render();
    window.postMessage({ source: 'MATCHAL_WEB', type: 'MATCHAL_PING' }, location.origin);
    requestDashboard();
  }

  function requestDashboard() {
    window.postMessage({ source: 'MATCHAL_WEB', type: 'MATCHAL_GET_RELATIONSHIP_DASHBOARD' }, location.origin);
  }

  function updateDashboard(payload = {}) {
    state.history = unionSnapshots(payload.history || payload.current?.snapshots || [], payload.current);
    const profiles = new Set(state.history.map(item => item.profileUsername));
    if (state.history.length) {
      const latest = state.history[0];
      const currentAfter = snapshotById(state.afterId);
      if (!currentAfter) state.afterId = latest.id;
      const after = snapshotById(state.afterId) || latest;
      const candidates = olderSnapshots(after);
      const currentBefore = snapshotById(state.beforeId);
      if (!currentBefore || !candidates.some(item => item.id === currentBefore.id)) state.beforeId = candidates[0]?.id || '';
    } else {
      state.beforeId = '';
      state.afterId = '';
    }
    if (profiles.size > 1) setStatus('여러 Instagram 계정의 기록이 있습니다. 이전 시점은 선택한 현재 시점과 같은 계정의 과거 기록만 표시됩니다.');
    state.selected = new Set(currentChangeList());
    render();
  }

  function render() {
    const section = root();
    if (!state.mounted || !section) return;
    const { before, after } = currentPair();
    const afterMetrics = metrics(after);
    const beforeMetrics = metrics(before);
    const connection = q('[data-v24-connected]', section);
    connection.dataset.v24Connected = String(state.connected);
    connection.textContent = state.connected ? 'Companion 연결됨' : 'Companion 설치 필요';
    q('[data-v24-profile]', section).textContent = after?.profileUsername ? `@${after.profileUsername}` : '스캔 기록 없음';
    q('[data-v24-profile-meta]', section).textContent = after ? `${formatDate(after.createdAt)} · ${after.complete ? '전체 목록 수집 완료' : '일부 목록일 수 있음'} · 저장된 기록 ${state.history.filter(item => item.profileUsername === after.profileUsername).length}개` : 'Companion에서 첫 관계 스캔을 실행해 주세요.';

    Object.keys(afterMetrics).forEach(key => {
      const card = q(`[data-v24-metric="${key}"]`, section);
      q('strong', card).textContent = afterMetrics[key].toLocaleString('ko-KR');
      const delta = before ? afterMetrics[key] - beforeMetrics[key] : null;
      const deltaNode = q('[data-v24-delta]', card);
      deltaNode.textContent = before ? `${signed(delta)} · 이전 대비` : '비교 기록 없음';
      deltaNode.dataset.state = delta > 0 ? 'up' : delta < 0 ? 'down' : 'same';
    });

    renderSelectors();
    const changeMap = changes();
    Object.entries(changeMap).forEach(([key, values]) => { q(`[data-v24-change-count="${key}"]`, section).textContent = values.length.toLocaleString('ko-KR'); });
    section.querySelectorAll('[data-v24-view]').forEach(button => {
      const active = button.dataset.v24View === state.view;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    const view = VIEWS[state.view];
    q('[data-v24-list-title]', section).textContent = view.label;
    q('[data-v24-list-description]', section).textContent = view.description;
    q('[data-v24-compare-summary]', section).textContent = before && after ? `${formatDate(before.createdAt, true)}에서 ${formatDate(after.createdAt, true)}까지의 변화 · ${before.complete && after.complete ? '두 기록 모두 전체 수집' : '일부 목록 가능성 있음'}` : '같은 계정의 더 오래된 스캔 기록이 있어야 변화를 계산할 수 있습니다.';
    const list = currentChangeList();
    state.selected = new Set(list.filter(username => state.selected.has(username)));
    if (view.actionable && !state.selected.size && list.length) state.selected = new Set(list);
    q('[data-v24-total]', section).textContent = list.length.toLocaleString('ko-KR');
    q('[data-v24-selected]', section).textContent = view.actionable ? state.selected.size.toLocaleString('ko-KR') : '정보용';
    q('[data-v24-action-copy]', section).textContent = view.actionable ? '이 변화 목록은 선택한 계정만 팔로우 취소 작업으로 보낼 수 있습니다.' : '이 변화 목록은 확인과 CSV 저장용입니다.';
    q('[data-v24-select-all]', section).disabled = !view.actionable || !list.length;
    q('[data-v24-clear]', section).disabled = !view.actionable || !list.length;
    q('[data-v24-export]', section).disabled = !list.length;
    q('[data-v24-confirm]', section).disabled = !view.actionable || !list.length;
    q('[data-v24-queue]', section).disabled = !state.connected || !view.actionable || !state.selected.size || !q('[data-v24-confirm]', section).checked;
    renderList();
  }

  function renderSelectors() {
    const section = root();
    const afterSelect = q('[data-v24-after]', section);
    const beforeSelect = q('[data-v24-before]', section);
    const after = snapshotById(state.afterId) || state.history[0] || null;
    const fill = (select, values, selectedId, emptyLabel) => {
      select.replaceChildren();
      if (!values.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = emptyLabel;
        select.appendChild(option);
        select.disabled = true;
        return;
      }
      select.disabled = false;
      values.forEach(item => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = `${formatDate(item.createdAt, true)} · @${item.profileUsername} · 팔로워 ${item.followers.length.toLocaleString('ko-KR')}${item.complete ? '' : ' · 일부'}`;
        option.selected = item.id === selectedId;
        select.appendChild(option);
      });
    };
    fill(afterSelect, state.history, state.afterId, '스캔 기록 없음');
    fill(beforeSelect, olderSnapshots(after), state.beforeId, '이전 기록 없음');
  }

  function renderList() {
    const section = root();
    const listRoot = q('[data-v24-list]', section);
    const source = currentChangeList();
    const view = VIEWS[state.view];
    const filtered = state.search ? source.filter(username => username.includes(state.search)) : source;
    listRoot.replaceChildren();
    if (!source.length || !filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'dashboardEmptyV24';
      empty.textContent = !currentPair().before ? '비교할 더 오래된 스캔 기록이 없습니다. 같은 계정을 나중에 한 번 더 스캔해 주세요.' : !source.length ? '이 조건에 해당하는 변화가 없습니다.' : '검색 결과가 없습니다.';
      listRoot.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    filtered.slice(0, 500).forEach((username, index) => {
      const row = document.createElement(view.actionable ? 'label' : 'a');
      row.className = 'dashboardRowV24';
      if (view.actionable) {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.v24Username = username;
        input.checked = state.selected.has(username);
        row.appendChild(input);
      } else {
        row.href = `https://www.instagram.com/${encodeURIComponent(username)}/`;
        row.target = '_blank';
        row.rel = 'noopener noreferrer';
      }
      const name = document.createElement('strong'); name.textContent = `@${username}`;
      const number = document.createElement('span'); number.textContent = String(index + 1);
      row.append(name, number);
      fragment.appendChild(row);
    });
    if (filtered.length > 500) {
      const more = document.createElement('div');
      more.className = 'dashboardEmptyV24';
      more.textContent = `앞의 500개만 표시합니다. 전체 ${filtered.length.toLocaleString('ko-KR')}개는 CSV와 작업 목록에 포함됩니다.`;
      fragment.appendChild(more);
    }
    listRoot.appendChild(fragment);
  }

  function setStatus(message, type = '') {
    const target = q('[data-v24-status]', root());
    if (!target) return;
    target.textContent = message || '';
    if (type) target.dataset.state = type; else delete target.dataset.state;
  }
  function exportCurrent() {
    const values = currentChangeList();
    if (!values.length) return;
    const { before, after } = currentPair();
    const rows = [['change_type', 'username', 'profile_url', 'before', 'after'], ...values.map(username => [state.view, username, `https://www.instagram.com/${username}/`, before?.createdAt || '', after?.createdAt || ''])];
    const csv = '\ufeff' + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `matchal-${state.view}-${after?.profileUsername || 'instagram'}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function queueSelected() {
    const view = VIEWS[state.view];
    if (!view.actionable || !state.selected.size || !q('[data-v24-confirm]', root()).checked) {
      setStatus('선택 목록과 확인란을 확인해 주세요.', 'error');
      return;
    }
    const { before, after } = currentPair();
    const items = currentChangeList().filter(username => state.selected.has(username)).map(username => ({ username, source: view.source }));
    window.postMessage({
      source: 'MATCHAL_WEB',
      type: 'MATCHAL_SAVE_QUEUE',
      payload: {
        queueName: `${view.label} · @${after?.profileUsername || 'instagram'} · ${before ? formatDate(before.createdAt, true) : ''} → ${after ? formatDate(after.createdAt, true) : ''}`,
        sourceType: view.source,
        items
      }
    }, location.origin);
    setStatus(`${items.length.toLocaleString('ko-KR')}개 계정을 Companion 작업 목록으로 보내는 중입니다.`);
  }

  function handleClick(event) {
    const section = root();
    const viewButton = event.target.closest('[data-v24-view]');
    if (viewButton) {
      state.view = viewButton.dataset.v24View;
      state.search = '';
      q('[data-v24-search]', section).value = '';
      state.selected = new Set(VIEWS[state.view].actionable ? currentChangeList() : []);
      q('[data-v24-confirm]', section).checked = false;
      render();
      return;
    }
    if (event.target.closest('[data-v24-open-panel]')) {
      state.connected ? window.postMessage({ source: 'MATCHAL_WEB', type: 'MATCHAL_OPEN_PANEL' }, location.origin) : q('[data-extension-primary]')?.click();
      return;
    }
    if (event.target.closest('[data-v24-refresh]')) { setStatus('Companion에서 스캔 기록을 불러오는 중입니다.'); requestDashboard(); return; }
    if (event.target.closest('[data-v24-select-all]')) { state.selected = new Set(currentChangeList()); render(); return; }
    if (event.target.closest('[data-v24-clear]')) { state.selected.clear(); render(); return; }
    if (event.target.closest('[data-v24-export]')) { exportCurrent(); return; }
    if (event.target.closest('[data-v24-queue]')) queueSelected();
  }

  function handleChange(event) {
    if (event.target.matches('[data-v24-after]')) {
      state.afterId = event.target.value;
      const after = snapshotById(state.afterId);
      state.beforeId = olderSnapshots(after)[0]?.id || '';
      state.selected = new Set();
      q('[data-v24-confirm]', root()).checked = false;
      render();
      return;
    }
    if (event.target.matches('[data-v24-before]')) {
      state.beforeId = event.target.value;
      state.selected = new Set();
      q('[data-v24-confirm]', root()).checked = false;
      render();
      return;
    }
    const username = event.target.dataset.v24Username;
    if (username) {
      event.target.checked ? state.selected.add(username) : state.selected.delete(username);
      render();
      return;
    }
    if (event.target.matches('[data-v24-confirm]')) render();
  }

  function handleMessage(event) {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'MATCHAL_EXTENSION') return;
    if (event.data.type === 'MATCHAL_READY') { state.connected = true; render(); requestDashboard(); }
    if (event.data.type === 'MATCHAL_RELATIONSHIP_DASHBOARD') {
      updateDashboard(event.data.payload || {});
      setStatus(state.history.length ? '저장된 관계 대시보드를 불러왔습니다.' : '아직 저장된 스캔 기록이 없습니다.', state.history.length ? 'success' : '');
    }
    if (event.data.type === 'MATCHAL_RELATIONSHIP_SCAN' && !state.history.length) updateDashboard({ current: event.data.payload?.state || {}, history: event.data.payload?.state?.snapshots || [] });
    if (event.data.type === 'MATCHAL_QUEUE_SAVED') setStatus(`${Number(event.data.payload?.count || 0).toLocaleString('ko-KR')}개 계정을 Companion 작업 목록으로 저장했습니다.`, 'success');
    if (event.data.type === 'MATCHAL_ERROR') setStatus(event.data.payload?.message || '확장 프로그램 요청을 처리하지 못했습니다.', 'error');
  }

  function boot() {
    const ready = () => {
      if (q('#relationshipScanV23')) mount();
      else setTimeout(ready, 120);
    };
    ready();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();