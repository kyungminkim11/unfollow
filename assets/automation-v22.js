(() => {
  'use strict';

  if (window.__MATCHAL_AUTOMATION_UI_V22__) return;
  window.__MATCHAL_AUTOMATION_UI_V22__ = true;

  const q = (selector, root = document) => root.querySelector(selector);
  const state = { source: 'current_non_mutual', candidates: [], selected: new Set(), mounted: false };

  function normalizeUsers(values) {
    const seen = new Set();
    const users = [];
    for (const value of Array.isArray(values) ? values : []) {
      const username = String(value?.username || value || '').trim().replace(/^@/, '').toLowerCase();
      if (!/^[a-z0-9._]{1,30}$/.test(username) || seen.has(username)) continue;
      seen.add(username);
      users.push(username);
    }
    return users;
  }

  function currentData() {
    try {
      const data = window.__MATCHAL_AUTOMATION__?.getCurrent?.() || {};
      return { loaded: Boolean(data.loaded), sourceName: data.sourceName || '', users: normalizeUsers(data.nonMutual) };
    } catch {
      return { loaded: false, sourceName: '', users: [] };
    }
  }

  function comparisonData() {
    try {
      const data = window.MatchalComparisonV22?.getCandidates?.() || {};
      return {
        ready: Boolean(data.ready),
        sourceName: data.sourceName || '',
        lostFollowerTargets: normalizeUsers(data.lostFollowerTargets),
        currentNonMutual: normalizeUsers(data.currentNonMutual)
      };
    } catch {
      return { ready: false, sourceName: '', lostFollowerTargets: [], currentNonMutual: [] };
    }
  }

  function sourceData(type = state.source) {
    const single = currentData();
    const compare = comparisonData();
    if (type === 'lost_follower_targets') {
      return {
        type,
        title: '나를 언팔했고 내가 아직 팔로우 중',
        description: '이전에는 나를 팔로우했지만 최신 시점에는 팔로워가 아니며, 나는 현재도 팔로우 중인 계정입니다.',
        sourceName: compare.sourceName,
        users: compare.lostFollowerTargets
      };
    }
    const users = single.users.length ? single.users : compare.currentNonMutual;
    return {
      type: 'current_non_mutual',
      title: '현재 비맞팔 계정',
      description: '최신 데이터에서 나는 팔로우하지만 상대는 나를 팔로우하지 않는 계정입니다.',
      sourceName: single.sourceName || compare.sourceName,
      users
    };
  }

  function mount() {
    if (state.mounted || q('#automationV22')) return;
    const section = document.createElement('section');
    section.id = 'automationV22';
    section.className = 'automationV22 sectionAnchorV11';
    section.innerHTML = `
      <header class="automationHeadV22">
        <div><span class="automationEyebrowV22">OPTIONAL AUTOMATION · v22</span><h2>분석 목록을 팔로우 취소 작업으로 보내기</h2><p>웹은 A·B 시점과 현재 비맞팔 목록을 만들고, 실제 Instagram 버튼 처리는 Chrome 확장 프로그램의 사이드패널에서 사용자가 시작합니다. 시작 전 대상과 처리 수를 다시 확인할 수 있습니다.</p></div>
        <div class="automationExtensionStateV22" data-ready="false">확장 프로그램 연결 확인 중</div>
      </header>
      <div class="automationSourcesV22">
        <button type="button" class="automationSourceV22 active" data-source="current_non_mutual"><span><strong>현재 비맞팔 계정</strong><span>ZIP 한 개 또는 최신 비교 데이터 기준</span></span><b data-source-count="current_non_mutual">0</b></button>
        <button type="button" class="automationSourceV22" data-source="lost_follower_targets"><span><strong>나를 언팔한 뒤에도 내가 팔로우 중</strong><span>A·B 시점 비교 후 실제 작업 가능한 교집합</span></span><b data-source-count="lost_follower_targets">0</b></button>
      </div>
      <div class="automationWorkspaceV22">
        <div class="automationListPanelV22">
          <div class="automationListHeadV22"><div><h3 data-list-title>현재 비맞팔 계정</h3><p data-list-description>분석 데이터가 준비되면 목록이 표시됩니다.</p></div><div class="automationListToolsV22"><button type="button" data-select-all>전체 선택</button><button type="button" data-clear-selection>선택 해제</button></div></div>
          <div class="automationListV22" data-list></div>
        </div>
        <aside class="automationControlV22">
          <h3>확장 프로그램으로 전달</h3><p>선택한 아이디만 브라우저 확장 프로그램 로컬 저장소에 전달합니다. ZIP 원본은 전달하지 않습니다.</p>
          <div class="automationSummaryV22"><div><span>목록</span><strong data-total-count>0</strong></div><div><span>선택</span><strong data-selected-count>0</strong></div></div>
          <label class="automationConfirmV22"><input type="checkbox" data-confirm><span>선택한 계정에서 팔로우 취소 버튼을 자동으로 누르는 작업 목록임을 확인했습니다. 실제 시작·일시정지·중지는 확장 프로그램에서 합니다.</span></label>
          <div class="automationActionsV22"><button type="button" class="primary" data-send-queue disabled>선택 목록 보내고 사이드패널 열기</button><button type="button" data-install-extension>확장 프로그램 설치·열기</button></div>
          <p class="automationStatusV22" data-status role="status" aria-live="polite"></p>
        </aside>
      </div>
      <div class="automationSafetyV22"><b>!</b><div><strong>계정 제한 화면이나 UI 오류가 감지되면 자동 중지합니다</strong><span>한 번에 최대 30개, 임의 대기, 정기 휴식, 연속 오류 중지를 적용합니다. Instagram 화면 구조가 바뀌면 처리하지 않고 실패로 남깁니다.</span></div></div>`;

    const app = q('#appPanel');
    const compare = q('#compareV13');
    const main = q('.main') || document.body;
    if (app?.parentElement) app.insertAdjacentElement('afterend', section);
    else if (compare?.parentElement) compare.parentElement.insertBefore(section, compare);
    else main.appendChild(section);

    section.addEventListener('click', handleClick);
    section.addEventListener('change', handleChange);
    window.addEventListener('message', handleExtensionMessage);
    window.addEventListener('matchal:comparison-ready', refresh);
    state.mounted = true;
    refresh();
    setInterval(refreshCountsOnly, 1200);
    window.postMessage({ source: 'MATCHAL_WEB', type: 'MATCHAL_PING' }, location.origin);
  }

  function setStatus(message, type = '') {
    const target = q('[data-status]', q('#automationV22'));
    if (!target) return;
    target.textContent = message || '';
    if (type) target.dataset.state = type; else delete target.dataset.state;
  }

  function refreshCountsOnly() {
    if (!state.mounted) return;
    const single = currentData();
    const compare = comparisonData();
    const current = single.users.length ? single.users : compare.currentNonMutual;
    const currentCount = q('[data-source-count="current_non_mutual"]');
    const lostCount = q('[data-source-count="lost_follower_targets"]');
    if (currentCount) currentCount.textContent = current.length.toLocaleString('ko-KR');
    if (lostCount) lostCount.textContent = compare.lostFollowerTargets.length.toLocaleString('ko-KR');
    const ready = document.body.classList.contains('matchal-extension-connected');
    const indicator = q('.automationExtensionStateV22');
    if (indicator) {
      indicator.dataset.ready = String(ready);
      indicator.textContent = ready ? '확장 프로그램 연결됨' : '확장 프로그램 설치 필요';
    }
    const next = sourceData();
    if (next.users.join('|') !== state.candidates.join('|')) refresh();
  }

  function refresh() {
    if (!state.mounted) return;
    const data = sourceData();
    const previousSelected = new Set(state.selected);
    state.candidates = data.users;
    state.selected = new Set(state.candidates.filter(username => previousSelected.has(username)));
    if (!state.selected.size && state.candidates.length) state.selected = new Set(state.candidates);

    q('[data-list-title]').textContent = data.title;
    q('[data-list-description]').textContent = data.users.length
      ? `${data.description}${data.sourceName ? ` · ${data.sourceName}` : ''}`
      : state.source === 'lost_follower_targets'
        ? '먼저 관계 변화 비교에서 이전 ZIP과 최신 ZIP을 분석해 주세요.'
        : '먼저 Instagram JSON ZIP을 분석해 주세요.';
    q('[data-total-count]').textContent = data.users.length.toLocaleString('ko-KR');
    q('[data-selected-count]').textContent = state.selected.size.toLocaleString('ko-KR');
    q('[data-send-queue]').disabled = !state.selected.size || !q('[data-confirm]').checked;

    q('#automationV22').querySelectorAll('[data-source]').forEach(button => button.classList.toggle('active', button.dataset.source === state.source));
    renderList();
    refreshCountsOnlyNoLoop();
  }

  function refreshCountsOnlyNoLoop() {
    const single = currentData();
    const compare = comparisonData();
    const current = single.users.length ? single.users : compare.currentNonMutual;
    q('[data-source-count="current_non_mutual"]').textContent = current.length.toLocaleString('ko-KR');
    q('[data-source-count="lost_follower_targets"]').textContent = compare.lostFollowerTargets.length.toLocaleString('ko-KR');
  }

  function renderList() {
    const list = q('[data-list]');
    list.replaceChildren();
    if (!state.candidates.length) {
      const empty = document.createElement('div');
      empty.className = 'automationEmptyV22';
      empty.textContent = state.source === 'lost_follower_targets' ? 'A·B 시점 비교 결과가 아직 없습니다.' : '현재 비맞팔 분석 결과가 아직 없습니다.';
      list.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    state.candidates.slice(0, 500).forEach((username, index) => {
      const label = document.createElement('label');
      label.className = 'automationRowV22';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.dataset.username = username;
      input.checked = state.selected.has(username);
      const name = document.createElement('strong');
      name.textContent = `@${username}`;
      const number = document.createElement('span');
      number.textContent = String(index + 1);
      label.append(input, name, number);
      fragment.appendChild(label);
    });
    if (state.candidates.length > 500) {
      const more = document.createElement('div');
      more.className = 'automationEmptyV22';
      more.textContent = `화면에는 앞의 500개만 표시하지만 전체 ${state.candidates.length.toLocaleString('ko-KR')}개를 선택·전달할 수 있습니다.`;
      fragment.appendChild(more);
    }
    list.appendChild(fragment);
  }

  function handleChange(event) {
    const username = event.target.dataset.username;
    if (username) {
      event.target.checked ? state.selected.add(username) : state.selected.delete(username);
      q('[data-selected-count]').textContent = state.selected.size.toLocaleString('ko-KR');
    }
    if (event.target.matches('[data-confirm]')) {
      q('[data-send-queue]').disabled = !state.selected.size || !event.target.checked;
    }
  }

  function handleClick(event) {
    const sourceButton = event.target.closest('[data-source]');
    if (sourceButton) {
      state.source = sourceButton.dataset.source;
      state.selected.clear();
      q('[data-confirm]').checked = false;
      refresh();
      return;
    }
    if (event.target.closest('[data-select-all]')) {
      state.selected = new Set(state.candidates);
      renderList();
      q('[data-selected-count]').textContent = state.selected.size.toLocaleString('ko-KR');
      q('[data-send-queue]').disabled = !state.selected.size || !q('[data-confirm]').checked;
      return;
    }
    if (event.target.closest('[data-clear-selection]')) {
      state.selected.clear();
      renderList();
      q('[data-selected-count]').textContent = '0';
      q('[data-send-queue]').disabled = true;
      return;
    }
    if (event.target.closest('[data-install-extension]')) {
      const existing = q('[data-extension-primary]');
      if (existing) existing.click();
      else location.href = '/downloads/matchal-companion-v22.zip';
      return;
    }
    if (event.target.closest('[data-send-queue]')) sendQueue();
  }

  function sendQueue() {
    if (!q('[data-confirm]').checked || !state.selected.size) {
      setStatus('확인란과 선택 목록을 확인해 주세요.', 'error');
      return;
    }
    const data = sourceData();
    const items = state.candidates.filter(username => state.selected.has(username)).map(username => ({ username, source: state.source }));
    setStatus(`${items.length.toLocaleString('ko-KR')}개 계정을 확장 프로그램으로 보내는 중입니다.`);
    window.postMessage({
      source: 'MATCHAL_WEB',
      type: 'MATCHAL_SAVE_QUEUE',
      payload: {
        queueName: `${data.title}${data.sourceName ? ` · ${data.sourceName}` : ''}`,
        sourceType: state.source,
        items
      }
    }, location.origin);
    setTimeout(() => {
      if (!document.body.classList.contains('matchal-extension-connected')) setStatus('확장 프로그램이 연결되지 않았습니다. 설치 후 페이지를 새로고침해 주세요.', 'error');
    }, 1600);
  }

  function handleExtensionMessage(event) {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'MATCHAL_EXTENSION') return;
    if (event.data.type === 'MATCHAL_READY') {
      document.body.classList.add('matchal-extension-connected');
      refreshCountsOnlyNoLoop();
      const indicator = q('.automationExtensionStateV22');
      if (indicator) { indicator.dataset.ready = 'true'; indicator.textContent = `확장 프로그램 연결됨 · v${event.data.payload?.version || ''}`; }
    }
    if (event.data.type === 'MATCHAL_QUEUE_SAVED') {
      setStatus(`${Number(event.data.payload?.count || 0).toLocaleString('ko-KR')}개 계정을 저장했습니다. 사이드패널에서 처리 수와 대기 시간을 확인한 뒤 시작하세요.`, 'success');
    }
    if (event.data.type === 'MATCHAL_ERROR') setStatus(event.data.payload?.message || '확장 프로그램 요청을 처리하지 못했습니다.', 'error');
  }

  function boot() {
    const ready = () => {
      if (q('.main') && (q('#appPanel') || q('#compareV13'))) mount();
      else setTimeout(ready, 120);
    };
    ready();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();