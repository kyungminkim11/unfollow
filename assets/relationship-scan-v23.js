(() => {
  'use strict';

  if (window.__MATCHAL_RELATIONSHIP_SCAN_UI_V23__) return;
  window.__MATCHAL_RELATIONSHIP_SCAN_UI_V23__ = true;

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

  const state = {
    mounted: false,
    connected: false,
    view: 'nonMutual',
    scan: { profileUsername: '', followers: [], following: [], nonMutual: [], complete: false, warnings: [], lastScanAt: '', status: 'idle' },
    selected: new Set(),
    search: ''
  };

  function root() {
    return q('#relationshipScanV23');
  }

  function mount() {
    if (state.mounted || root()) return;
    const section = document.createElement('section');
    section.id = 'relationshipScanV23';
    section.className = 'relationshipScanV23 sectionAnchorV11';
    section.innerHTML = `
      <header class="relationshipHeadV23">
        <div><span class="relationshipEyebrowV23">INSTAGRAM WEB SCAN · v23</span><h2>데이터 다운로드 없이 현재 관계 확인</h2><p>Chrome Companion이 내 Instagram 프로필의 팔로워·팔로잉 목록을 화면에서 수집합니다. 비밀번호·쿠키·비공개 API는 사용하지 않고 결과는 확장 프로그램 로컬 저장소에만 보관합니다.</p></div>
        <span class="relationshipConnectionV23" data-v23-connected="false">확장 프로그램 확인 중</span>
      </header>
      <div class="relationshipToolbarV23">
        <button type="button" class="primary" data-v23-open-scan>Companion에서 스캔 시작</button>
        <button type="button" data-v23-refresh>저장된 결과 새로고침</button>
      </div>
      <div class="relationshipSnapshotV23">
        <div class="relationshipIdentityV23"><strong data-v23-profile>스캔 결과 없음</strong><span data-v23-meta>Companion에서 팔로워·팔로잉 스캔을 실행해 주세요.</span></div>
        <div class="relationshipCountsV23">
          <button type="button" data-v23-view="followers"><span>팔로워</span><strong data-v23-count="followers">0</strong><small>나를 팔로우</small></button>
          <button type="button" data-v23-view="following"><span>팔로잉</span><strong data-v23-count="following">0</strong><small>내가 팔로우</small></button>
          <button type="button" data-v23-view="nonMutual" class="active"><span>맞팔 아님</span><strong data-v23-count="nonMutual">0</strong><small>나만 팔로우</small></button>
        </div>
      </div>
      <div class="relationshipWorkspaceV23">
        <div class="relationshipListPanelV23">
          <div class="relationshipListHeadV23"><div><h3 data-v23-list-title>맞팔 아닌 명단</h3><p data-v23-list-description>스캔 결과가 준비되면 아이디 목록을 확인할 수 있습니다.</p></div><input type="search" data-v23-search placeholder="아이디 검색" aria-label="관계 스캔 결과 검색"></div>
          <div class="relationshipListV23" data-v23-list></div>
        </div>
        <aside class="relationshipActionsV23">
          <h3>목록 활용</h3><p>팔로워·팔로잉 명단은 확인용입니다. 맞팔 아닌 명단만 선택해 기존 팔로우 취소 작업 목록으로 보낼 수 있습니다.</p>
          <div class="relationshipSelectionV23"><span>현재 목록</span><strong data-v23-total>0</strong><span>선택</span><strong data-v23-selected>0</strong></div>
          <div class="relationshipSelectionToolsV23"><button type="button" data-v23-select-all>전체 선택</button><button type="button" data-v23-clear>선택 해제</button></div>
          <label class="relationshipConfirmV23"><input type="checkbox" data-v23-confirm><span>선택한 맞팔 아닌 계정을 팔로우 취소 작업 목록으로 보내는 것을 확인했습니다.</span></label>
          <button type="button" class="primary" data-v23-send disabled>선택 명단을 Companion 작업 목록으로 보내기</button>
          <p class="relationshipStatusV23" data-v23-status role="status" aria-live="polite"></p>
        </aside>
      </div>
      <div class="relationshipNoticeV23"><strong>첫 스캔은 계정 수에 따라 시간이 걸릴 수 있습니다.</strong><span>Instagram 목록 창을 자동으로 스크롤하므로 스캔이 끝날 때까지 해당 탭을 닫지 마세요. 로딩이 멈추면 일부 명단으로 표시됩니다.</span></div>`;

    const automation = q('#automationV22');
    const app = q('#appPanel');
    if (automation) automation.insertAdjacentElement('afterend', section);
    else if (app) app.insertAdjacentElement('afterend', section);
    else (q('.main') || document.body).appendChild(section);

    section.addEventListener('click', handleClick);
    section.addEventListener('change', handleChange);
    q('[data-v23-search]', section).addEventListener('input', event => {
      state.search = event.target.value.trim().toLowerCase();
      renderList();
    });
    window.addEventListener('message', handleMessage);
    state.mounted = true;
    render();
    window.postMessage({ source: 'MATCHAL_WEB', type: 'MATCHAL_PING' }, location.origin);
    window.postMessage({ source: 'MATCHAL_WEB', type: 'MATCHAL_GET_RELATIONSHIP_SCAN' }, location.origin);
  }

  function updateScan(raw = {}) {
    state.scan = {
      profileUsername: String(raw.profileUsername || ''),
      followers: normalizeUsers(raw.followers),
      following: normalizeUsers(raw.following),
      nonMutual: normalizeUsers(raw.nonMutual),
      complete: Boolean(raw.complete),
      warnings: Array.isArray(raw.warnings) ? raw.warnings.map(String) : [],
      lastScanAt: String(raw.lastScanAt || ''),
      status: String(raw.status || 'idle')
    };
    const list = currentList();
    state.selected = new Set(list.filter(username => state.selected.has(username)));
    if (state.view === 'nonMutual' && !state.selected.size && list.length) state.selected = new Set(list);
    render();
  }

  function currentList() {
    return state.scan[state.view] || [];
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function render() {
    const section = root();
    if (!state.mounted || !section) return;
    const connection = q('[data-v23-connected]', section);
    connection.dataset.v23Connected = String(state.connected);
    connection.textContent = state.connected ? 'Companion 연결됨' : 'Companion 설치 필요';
    q('[data-v23-count="followers"]', section).textContent = state.scan.followers.length.toLocaleString('ko-KR');
    q('[data-v23-count="following"]', section).textContent = state.scan.following.length.toLocaleString('ko-KR');
    q('[data-v23-count="nonMutual"]', section).textContent = state.scan.nonMutual.length.toLocaleString('ko-KR');
    q('[data-v23-profile]', section).textContent = state.scan.profileUsername ? `@${state.scan.profileUsername}` : '스캔 결과 없음';
    const warning = state.scan.warnings.at(-1) || '';
    q('[data-v23-meta]', section).textContent = state.scan.lastScanAt
      ? `${formatDate(state.scan.lastScanAt)} · ${state.scan.complete ? '전체 수집 완료' : '일부 목록일 수 있음'}${warning ? ` · ${warning}` : ''}`
      : state.connected ? 'Companion 사이드패널에서 관계 스캔을 시작해 주세요.' : '확장 프로그램을 설치한 뒤 관계 스캔을 사용할 수 있습니다.';

    section.querySelectorAll('[data-v23-view]').forEach(button => button.classList.toggle('active', button.dataset.v23View === state.view));
    const titles = { followers: '팔로워 명단', following: '팔로잉 명단', nonMutual: '맞팔 아닌 명단' };
    const descriptions = {
      followers: '현재 나를 팔로우하는 계정입니다.',
      following: '현재 내가 팔로우하는 계정입니다.',
      nonMutual: '내가 팔로우하지만 현재 나를 팔로우하지 않는 계정입니다.'
    };
    q('[data-v23-list-title]', section).textContent = titles[state.view];
    q('[data-v23-list-description]', section).textContent = descriptions[state.view];
    const list = currentList();
    q('[data-v23-total]', section).textContent = list.length.toLocaleString('ko-KR');
    q('[data-v23-selected]', section).textContent = state.view === 'nonMutual' ? state.selected.size.toLocaleString('ko-KR') : '정보용';
    const actionable = state.view === 'nonMutual';
    q('[data-v23-confirm]', section).disabled = !actionable;
    q('[data-v23-select-all]', section).disabled = !actionable;
    q('[data-v23-clear]', section).disabled = !actionable;
    q('[data-v23-send]', section).disabled = !actionable || !state.selected.size || !q('[data-v23-confirm]', section).checked || !state.connected;
    renderList();
  }

  function renderList() {
    const section = root();
    const listRoot = q('[data-v23-list]', section);
    const source = currentList();
    const filtered = state.search ? source.filter(username => username.includes(state.search)) : source;
    listRoot.replaceChildren();
    if (!source.length || !filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'relationshipEmptyV23';
      empty.textContent = !source.length
        ? state.scan.lastScanAt ? '이 조건에 해당하는 계정이 없습니다.' : 'Companion에서 스캔을 완료하면 명단이 표시됩니다.'
        : '검색 결과가 없습니다.';
      listRoot.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    filtered.slice(0, 600).forEach((username, index) => {
      const row = document.createElement(state.view === 'nonMutual' ? 'label' : 'a');
      row.className = 'relationshipRowV23';
      if (state.view === 'nonMutual') {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.v23Username = username;
        input.checked = state.selected.has(username);
        row.appendChild(input);
      } else {
        row.href = `https://www.instagram.com/${encodeURIComponent(username)}/`;
        row.target = '_blank';
        row.rel = 'noopener noreferrer';
      }
      const name = document.createElement('strong');
      name.textContent = `@${username}`;
      const number = document.createElement('span');
      number.textContent = String(index + 1);
      row.append(name, number);
      fragment.appendChild(row);
    });
    if (filtered.length > 600) {
      const more = document.createElement('div');
      more.className = 'relationshipEmptyV23';
      more.textContent = `화면에는 앞의 600개만 표시합니다. 전체 ${filtered.length.toLocaleString('ko-KR')}개는 저장되어 있습니다.`;
      fragment.appendChild(more);
    }
    listRoot.appendChild(fragment);
  }

  function setStatus(message, type = '') {
    const target = q('[data-v23-status]', root());
    target.textContent = message || '';
    if (type) target.dataset.state = type;
    else delete target.dataset.state;
  }

  function handleClick(event) {
    const section = root();
    const view = event.target.closest('[data-v23-view]');
    if (view) {
      state.view = view.dataset.v23View;
      state.search = '';
      q('[data-v23-search]', section).value = '';
      state.selected = state.view === 'nonMutual' ? new Set(state.scan.nonMutual) : new Set();
      q('[data-v23-confirm]', section).checked = false;
      render();
      return;
    }
    if (event.target.closest('[data-v23-open-scan]')) {
      if (state.connected) window.postMessage({ source: 'MATCHAL_WEB', type: 'MATCHAL_OPEN_PANEL' }, location.origin);
      else q('[data-extension-primary]')?.click();
      return;
    }
    if (event.target.closest('[data-v23-refresh]')) {
      setStatus('확장 프로그램에서 저장된 스캔 결과를 불러오는 중입니다.');
      window.postMessage({ source: 'MATCHAL_WEB', type: 'MATCHAL_GET_RELATIONSHIP_SCAN' }, location.origin);
      return;
    }
    if (event.target.closest('[data-v23-select-all]')) {
      state.selected = new Set(state.scan.nonMutual);
      render();
      return;
    }
    if (event.target.closest('[data-v23-clear]')) {
      state.selected.clear();
      render();
      return;
    }
    if (event.target.closest('[data-v23-send]')) sendQueue();
  }

  function handleChange(event) {
    const username = event.target.dataset.v23Username;
    if (username) {
      event.target.checked ? state.selected.add(username) : state.selected.delete(username);
      render();
      return;
    }
    if (event.target.matches('[data-v23-confirm]')) render();
  }

  function sendQueue() {
    const section = root();
    if (!q('[data-v23-confirm]', section).checked || !state.selected.size) {
      setStatus('확인란과 선택 명단을 확인해 주세요.', 'error');
      return;
    }
    const items = state.scan.nonMutual
      .filter(username => state.selected.has(username))
      .map(username => ({ username, source: 'instagram_scan_non_mutual' }));
    setStatus(`${items.length.toLocaleString('ko-KR')}개 계정을 Companion 작업 목록으로 보내는 중입니다.`);
    window.postMessage({
      source: 'MATCHAL_WEB',
      type: 'MATCHAL_SAVE_QUEUE',
      payload: {
        queueName: `Instagram 웹 스캔 맞팔 아님${state.scan.profileUsername ? ` · @${state.scan.profileUsername}` : ''}`,
        sourceType: 'instagram_scan_non_mutual',
        items
      }
    }, location.origin);
  }

  function handleMessage(event) {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== 'MATCHAL_EXTENSION') return;
    if (event.data.type === 'MATCHAL_READY') {
      state.connected = true;
      document.body.classList.add('matchal-extension-connected');
      render();
      window.postMessage({ source: 'MATCHAL_WEB', type: 'MATCHAL_GET_RELATIONSHIP_SCAN' }, location.origin);
    }
    if (event.data.type === 'MATCHAL_RELATIONSHIP_SCAN') {
      updateScan(event.data.payload?.state || {});
      setStatus(state.scan.lastScanAt ? '저장된 관계 스캔 결과를 불러왔습니다.' : '아직 저장된 관계 스캔 결과가 없습니다.', state.scan.lastScanAt ? 'success' : '');
    }
    if (event.data.type === 'MATCHAL_QUEUE_SAVED') setStatus(`${Number(event.data.payload?.count || 0).toLocaleString('ko-KR')}개 계정을 작업 목록으로 저장했습니다. Companion에서 처리 수를 확인한 뒤 시작하세요.`, 'success');
    if (event.data.type === 'MATCHAL_ERROR') setStatus(event.data.payload?.message || '확장 프로그램 요청을 처리하지 못했습니다.', 'error');
  }

  function boot() {
    const ready = () => {
      if (q('.main') && (q('#appPanel') || q('#automationV22'))) mount();
      else setTimeout(ready, 120);
    };
    ready();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();