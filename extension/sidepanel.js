(() => {
  'use strict';

  const STORAGE_KEY = 'matchalAutomationStateV22';
  const RELATIONSHIP_KEY = 'matchalRelationshipStateV23';
  const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/;
  const q = selector => document.querySelector(selector);
  const els = {
    queueName: q('#queueName'), runnerBadge: q('#runnerBadge'), countTotal: q('#countTotal'), countSuccess: q('#countSuccess'),
    countSkipped: q('#countSkipped'), countFailed: q('#countFailed'), progressBar: q('#progressBar'), runnerMessage: q('#runnerMessage'),
    batchSize: q('#batchSize'), minDelay: q('#minDelay'), maxDelay: q('#maxDelay'), restEvery: q('#restEvery'), restSeconds: q('#restSeconds'),
    confirmRun: q('#confirmRun'), startButton: q('#startButton'), pauseButton: q('#pauseButton'), stopButton: q('#stopButton'),
    queueSummary: q('#queueSummary'), queueList: q('#queueList'), resetErrors: q('#resetErrors'),
    profileUsername: q('#profileUsername'), detectProfile: q('#detectProfile'), startScan: q('#startScan'), stopScan: q('#stopScan'),
    scanBadge: q('#scanBadge'), scanProgressBar: q('#scanProgressBar'), scanMessage: q('#scanMessage'),
    scanFollowersCount: q('#scanFollowersCount'), scanFollowingCount: q('#scanFollowingCount'), scanNonMutualCount: q('#scanNonMutualCount'),
    scanSearch: q('#scanSearch'), scanList: q('#scanList'), exportScan: q('#exportScan'), queueNonMutual: q('#queueNonMutual'), scanMeta: q('#scanMeta')
  };

  let automationState = null;
  let relationshipState = null;
  let scanView = 'nonMutual';
  let scanTabId = null;
  let runToken = 0;
  let paused = false;
  let stopping = false;

  const automationDefaults = () => ({
    queue: [], queueName: '', sourceType: '', createdAt: '',
    settings: { batchSize: 10, minDelaySeconds: 8, maxDelaySeconds: 15, restEvery: 10, restSeconds: 60 },
    runner: { status: 'idle', processed: 0, succeeded: 0, skipped: 0, failed: 0, currentUsername: '', lastMessage: '', updatedAt: '' }
  });

  const relationshipDefaults = () => ({
    profileUsername: '', status: 'idle', currentKind: '', progressCount: 0, progressExpected: null,
    followers: [], following: [], nonMutual: [], mutual: [], complete: false, warnings: [], lastScanAt: '', snapshots: []
  });

  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const randomBetween = (min, max) => Math.floor(min + Math.random() * (Math.max(min, max) - min + 1));
  const normalizeUsername = value => String(value || '').trim().replace(/^@/, '').toLowerCase();
  const isScanActive = () => ['opening_profile', 'scanning_followers', 'scanning_following', 'stopping'].includes(relationshipState?.status);
  const isRunActive = () => ['running', 'paused'].includes(automationState?.runner?.status);

  async function loadStates() {
    const stored = await chrome.storage.local.get([STORAGE_KEY, RELATIONSHIP_KEY]);
    automationState = { ...automationDefaults(), ...(stored[STORAGE_KEY] || {}) };
    automationState.settings = { ...automationDefaults().settings, ...(automationState.settings || {}) };
    automationState.runner = { ...automationDefaults().runner, ...(automationState.runner || {}) };
    relationshipState = { ...relationshipDefaults(), ...(stored[RELATIONSHIP_KEY] || {}) };
    if (!Array.isArray(relationshipState.followers)) relationshipState.followers = [];
    if (!Array.isArray(relationshipState.following)) relationshipState.following = [];
    if (!Array.isArray(relationshipState.nonMutual)) relationshipState.nonMutual = [];
    if (!Array.isArray(relationshipState.mutual)) relationshipState.mutual = [];
    if (!Array.isArray(relationshipState.snapshots)) relationshipState.snapshots = [];
    if (!Array.isArray(relationshipState.warnings)) relationshipState.warnings = [];

    if (isRunActive()) {
      automationState.runner.status = 'stopped';
      automationState.runner.lastMessage = '사이드패널이 닫혀 이전 실행이 중지되었습니다.';
      await saveAutomation(false);
    }
    if (isScanActive()) {
      relationshipState.status = 'stopped';
      relationshipState.currentKind = '';
      relationshipState.progressExpected = null;
      relationshipState.warnings = [...relationshipState.warnings, '사이드패널이 닫혀 이전 스캔이 중지되었습니다.'].slice(-5);
      await saveRelationship(false);
    }
    syncInputs();
    renderAll();
  }

  async function saveAutomation(render = true) {
    automationState.runner.updatedAt = new Date().toISOString();
    await chrome.storage.local.set({ [STORAGE_KEY]: automationState });
    if (render) renderAutomation();
  }

  async function saveRelationship(render = true) {
    await chrome.storage.local.set({ [RELATIONSHIP_KEY]: relationshipState });
    if (render) renderScan();
  }

  function syncInputs() {
    els.batchSize.value = automationState.settings.batchSize;
    els.minDelay.value = automationState.settings.minDelaySeconds;
    els.maxDelay.value = automationState.settings.maxDelaySeconds;
    els.restEvery.value = automationState.settings.restEvery;
    els.restSeconds.value = automationState.settings.restSeconds;
    els.profileUsername.value = relationshipState.profileUsername || '';
  }

  function readSettings() {
    const minDelaySeconds = clamp(els.minDelay.value, 5, 120, 8);
    const maxDelaySeconds = clamp(els.maxDelay.value, minDelaySeconds + 1, 180, 15);
    automationState.settings = {
      batchSize: clamp(els.batchSize.value, 1, 30, 10),
      minDelaySeconds,
      maxDelaySeconds,
      restEvery: clamp(els.restEvery.value, 1, 30, 10),
      restSeconds: clamp(els.restSeconds.value, 30, 900, 60)
    };
    syncInputs();
  }

  function renderAll() {
    renderScan();
    renderAutomation();
  }

  function relationshipList(type = scanView) {
    return Array.isArray(relationshipState?.[type]) ? relationshipState[type] : [];
  }

  function renderScan() {
    if (!relationshipState) return;
    const labels = {
      idle: '대기', opening_profile: '프로필 확인', scanning_followers: '팔로워 수집', scanning_following: '팔로잉 수집',
      stopping: '중지 중', stopped: '중지', completed: '완료', error: '오류'
    };
    const status = relationshipState.status || 'idle';
    const active = isScanActive();
    const followers = relationshipState.followers.length;
    const following = relationshipState.following.length;
    const nonMutual = relationshipState.nonMutual.length;
    const expected = Number(relationshipState.progressExpected || 0);
    const stageBase = status === 'scanning_following' ? 50 : 0;
    const stageProgress = expected > 0 ? Math.min(50, Math.round(relationshipState.progressCount / expected * 50)) : active ? 12 : 0;
    const percent = status === 'completed' ? 100 : status === 'scanning_following' ? stageBase + stageProgress : status === 'scanning_followers' ? stageProgress : 0;

    els.scanBadge.textContent = labels[status] || status;
    els.scanBadge.dataset.state = status;
    els.scanProgressBar.style.width = `${percent}%`;
    els.scanFollowersCount.textContent = followers.toLocaleString('ko-KR');
    els.scanFollowingCount.textContent = following.toLocaleString('ko-KR');
    els.scanNonMutualCount.textContent = nonMutual.toLocaleString('ko-KR');
    els.startScan.disabled = active || isRunActive();
    els.stopScan.disabled = !active;
    els.detectProfile.disabled = active;
    els.profileUsername.disabled = active;
    els.exportScan.disabled = relationshipList().length === 0;
    els.queueNonMutual.disabled = active || nonMutual === 0 || isRunActive();

    document.querySelectorAll('[data-result-tab]').forEach(button => button.classList.toggle('active', button.dataset.resultTab === scanView));
    renderScanList();

    if (status === 'scanning_followers' || status === 'scanning_following') {
      const name = status === 'scanning_followers' ? '팔로워' : '팔로잉';
      const count = Number(relationshipState.progressCount || 0).toLocaleString('ko-KR');
      const target = expected ? ` / 약 ${expected.toLocaleString('ko-KR')}` : '';
      els.scanMessage.textContent = `${name} 목록을 스크롤하며 수집 중입니다. ${count}${target}개`;
    } else if (status === 'opening_profile') {
      els.scanMessage.textContent = `@${relationshipState.profileUsername} 내 프로필을 확인하는 중입니다.`;
    } else if (status === 'completed') {
      els.scanMessage.textContent = `스캔 완료 · 팔로워 ${followers.toLocaleString('ko-KR')}명 · 팔로잉 ${following.toLocaleString('ko-KR')}명 · 맞팔 아님 ${nonMutual.toLocaleString('ko-KR')}명`;
    } else if (status === 'stopped') {
      els.scanMessage.textContent = relationshipState.warnings.at(-1) || '스캔을 중지했습니다.';
    } else if (status === 'error') {
      els.scanMessage.textContent = relationshipState.warnings.at(-1) || '스캔 중 문제가 발생했습니다.';
    } else {
      els.scanMessage.textContent = relationshipState.lastScanAt
        ? `마지막 스캔: ${formatDate(relationshipState.lastScanAt)} · 필요할 때 다시 스캔하면 현재 명단으로 갱신됩니다.`
        : 'Instagram에 로그인한 뒤 내 아이디를 입력해 주세요.';
    }

    const warning = relationshipState.warnings.at(-1);
    const completeness = relationshipState.lastScanAt ? (relationshipState.complete ? '전체 목록 수집 완료' : '일부 목록일 수 있음') : '아직 저장된 스캔 없음';
    els.scanMeta.textContent = `${completeness}${warning ? ` · ${warning}` : ''} · 결과는 이 Chrome 확장 프로그램에만 저장됩니다.`;
  }

  function renderScanList() {
    const query = normalizeUsername(els.scanSearch.value);
    const source = relationshipList();
    const filtered = query ? source.filter(username => username.includes(query)) : source;
    els.scanList.replaceChildren();
    if (!source.length) {
      const empty = document.createElement('div');
      empty.className = 'queueEmpty';
      empty.textContent = '스캔을 완료하면 이 명단이 표시됩니다.';
      els.scanList.appendChild(empty);
      return;
    }
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'queueEmpty';
      empty.textContent = '검색 결과가 없습니다.';
      els.scanList.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    filtered.slice(0, 800).forEach((username, index) => {
      const row = document.createElement('a');
      row.className = 'scanListItem';
      row.href = `https://www.instagram.com/${encodeURIComponent(username)}/`;
      row.target = '_blank';
      row.rel = 'noopener noreferrer';
      const number = document.createElement('span');
      number.textContent = String(index + 1);
      const name = document.createElement('strong');
      name.textContent = `@${username}`;
      const arrow = document.createElement('small');
      arrow.textContent = '열기';
      row.append(number, name, arrow);
      fragment.appendChild(row);
    });
    if (filtered.length > 800) {
      const more = document.createElement('div');
      more.className = 'queueEmpty';
      more.textContent = `앞의 800개만 표시합니다. 전체 ${filtered.length.toLocaleString('ko-KR')}개는 CSV와 작업 목록에 포함됩니다.`;
      fragment.appendChild(more);
    }
    els.scanList.appendChild(fragment);
  }

  function renderAutomation() {
    if (!automationState) return;
    const queue = Array.isArray(automationState.queue) ? automationState.queue : [];
    const succeeded = queue.filter(item => item.status === 'success').length;
    const skipped = queue.filter(item => item.status === 'skipped').length;
    const failed = queue.filter(item => item.status === 'error').length;
    const done = succeeded + skipped + failed;
    const status = automationState.runner.status || 'idle';
    const labels = { idle: '대기', running: '실행 중', paused: '일시정지', stopped: '중지', completed: '완료', error: '오류 중지' };

    els.queueName.textContent = automationState.queueName || '작업 목록 없음';
    els.runnerBadge.textContent = labels[status] || status;
    els.runnerBadge.dataset.state = status;
    els.countTotal.textContent = queue.length.toLocaleString('ko-KR');
    els.countSuccess.textContent = succeeded.toLocaleString('ko-KR');
    els.countSkipped.textContent = skipped.toLocaleString('ko-KR');
    els.countFailed.textContent = failed.toLocaleString('ko-KR');
    els.progressBar.style.width = `${queue.length ? Math.round(done / queue.length * 100) : 0}%`;
    els.runnerMessage.textContent = automationState.runner.lastMessage || '웹 또는 위 스캔 결과에서 작업 목록을 만들어 주세요.';
    els.queueSummary.textContent = `${queue.length.toLocaleString('ko-KR')}개 · 대기 ${queue.filter(item => item.status === 'pending').length.toLocaleString('ko-KR')}개`;

    const active = isRunActive();
    els.startButton.disabled = active || isScanActive() || !queue.some(item => item.status === 'pending');
    els.pauseButton.disabled = !active;
    els.pauseButton.textContent = status === 'paused' ? '계속하기' : '일시정지';
    els.stopButton.disabled = !active;
    [els.batchSize, els.minDelay, els.maxDelay, els.restEvery, els.restSeconds].forEach(input => { input.disabled = active; });

    els.queueList.replaceChildren();
    if (!queue.length) {
      const empty = document.createElement('div');
      empty.className = 'queueEmpty';
      empty.textContent = '웹 분석 또는 위 관계 스캔에서 맞팔 아닌 명단을 작업 목록으로 만들어 주세요.';
      els.queueList.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    queue.slice(0, 500).forEach(item => {
      const row = document.createElement('article');
      row.className = 'queueItem';
      const copy = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = `@${item.username}`;
      const message = document.createElement('span');
      message.textContent = item.message || ({ pending: '처리 대기', processing: '현재 처리 중', success: '팔로우 취소 완료', skipped: '이미 팔로우하지 않음', error: '처리 실패' }[item.status] || item.status);
      copy.append(name, message);
      const badge = document.createElement('small');
      badge.dataset.state = item.status;
      badge.textContent = ({ pending: '대기', processing: '처리 중', success: '완료', skipped: '건너뜀', error: '실패' }[item.status] || item.status);
      row.append(copy, badge);
      fragment.appendChild(row);
    });
    if (queue.length > 500) {
      const more = document.createElement('div');
      more.className = 'queueEmpty';
      more.textContent = `목록이 길어 앞의 500개만 표시합니다. 전체 ${queue.length.toLocaleString('ko-KR')}개는 저장되어 있습니다.`;
      fragment.appendChild(more);
    }
    els.queueList.appendChild(fragment);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '알 수 없음';
    return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  async function findOrCreateInstagramTab() {
    const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/*' });
    if (tabs.length) return tabs.find(tab => tab.active) || tabs[0];
    return chrome.tabs.create({ url: 'https://www.instagram.com/', active: true });
  }

  function waitForTabComplete(tabId, timeoutMs = 30000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => finish(new Error('Instagram 페이지 로딩 시간이 초과되었습니다.')), timeoutMs);
      const listener = (updatedId, info) => {
        if (updatedId === tabId && info.status === 'complete') finish();
      };
      const finish = error => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        error ? reject(error) : resolve();
      };
      chrome.tabs.onUpdated.addListener(listener);
      chrome.tabs.get(tabId).then(tab => { if (tab.status === 'complete') finish(); }).catch(() => {});
    });
  }

  async function sendWithRetry(tabId, message, attempts = 6) {
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (error) {
        lastError = error;
        await sleep(600 + attempt * 500);
      }
    }
    throw lastError || new Error('Instagram 작업 스크립트와 연결하지 못했습니다.');
  }

  async function prepareProfileTab(tab, username) {
    const url = `https://www.instagram.com/${encodeURIComponent(username)}/`;
    await chrome.tabs.update(tab.id, { url, active: true });
    await waitForTabComplete(tab.id);
    await sleep(1400);
    return chrome.tabs.get(tab.id);
  }

  async function detectProfile() {
    els.scanMessage.textContent = 'Instagram에서 로그인한 계정을 확인하는 중입니다.';
    try {
      const tab = await findOrCreateInstagramTab();
      scanTabId = tab.id;
      const response = await sendWithRetry(tab.id, { type: 'MATCHAL_SCAN_DETECT_PROFILE' });
      if (!response?.ok || !response.username) throw new Error(response?.message || '내 프로필 아이디를 감지하지 못했습니다. Instagram에서 내 프로필을 연 뒤 다시 눌러 주세요.');
      relationshipState.profileUsername = response.username;
      els.profileUsername.value = response.username;
      relationshipState.warnings = [];
      await saveRelationship();
      els.scanMessage.textContent = `@${response.username} 계정을 감지했습니다.`;
    } catch (error) {
      els.scanMessage.textContent = error?.message || String(error);
    } finally {
      scanTabId = null;
    }
  }

  async function startRelationshipScan() {
    const username = normalizeUsername(els.profileUsername.value);
    if (!USERNAME_PATTERN.test(username)) {
      els.scanMessage.textContent = '내 Instagram 아이디를 영문, 숫자, 점 또는 밑줄 형식으로 입력해 주세요.';
      return;
    }
    if (isRunActive()) {
      els.scanMessage.textContent = '팔로우 취소 작업을 먼저 중지한 뒤 관계 스캔을 시작해 주세요.';
      return;
    }

    relationshipState = {
      ...relationshipDefaults(),
      profileUsername: username,
      status: 'opening_profile',
      warnings: [],
      snapshots: Array.isArray(relationshipState.snapshots) ? relationshipState.snapshots : []
    };
    await saveRelationship();

    try {
      let tab = await findOrCreateInstagramTab();
      scanTabId = tab.id;
      tab = await prepareProfileTab(tab, username);
      const detected = await sendWithRetry(tab.id, { type: 'MATCHAL_SCAN_DETECT_PROFILE' });
      if (!detected?.ok || detected.username !== username || !detected.confirmed) {
        throw new Error(detected?.message || `@${username} 페이지가 로그인한 계정의 내 프로필인지 확인하지 못했습니다.`);
      }

      relationshipState.status = 'scanning_followers';
      relationshipState.currentKind = 'followers';
      relationshipState.progressCount = 0;
      relationshipState.progressExpected = null;
      await saveRelationship();
      const followersResult = await sendWithRetry(tab.id, { type: 'MATCHAL_SCAN_LIST', username, kind: 'followers' }, 2);
      if (!followersResult?.ok) throw new Error(followersResult?.message || '팔로워 목록을 수집하지 못했습니다.');
      relationshipState.followers = Array.isArray(followersResult.usernames) ? followersResult.usernames : [];
      if (followersResult.warning) relationshipState.warnings.push(followersResult.warning);
      if (followersResult.stopped) throw new Error('사용자가 팔로워 수집을 중지했습니다.');

      tab = await prepareProfileTab(tab, username);
      relationshipState.status = 'scanning_following';
      relationshipState.currentKind = 'following';
      relationshipState.progressCount = 0;
      relationshipState.progressExpected = null;
      await saveRelationship();
      const followingResult = await sendWithRetry(tab.id, { type: 'MATCHAL_SCAN_LIST', username, kind: 'following' }, 2);
      if (!followingResult?.ok) throw new Error(followingResult?.message || '팔로잉 목록을 수집하지 못했습니다.');
      relationshipState.following = Array.isArray(followingResult.usernames) ? followingResult.usernames : [];
      if (followingResult.warning) relationshipState.warnings.push(followingResult.warning);
      if (followingResult.stopped) throw new Error('사용자가 팔로잉 수집을 중지했습니다.');

      const followerSet = new Set(relationshipState.followers);
      relationshipState.nonMutual = relationshipState.following.filter(usernameValue => !followerSet.has(usernameValue));
      relationshipState.mutual = relationshipState.following.filter(usernameValue => followerSet.has(usernameValue));
      relationshipState.complete = Boolean(followersResult.complete && followingResult.complete);
      relationshipState.status = 'completed';
      relationshipState.currentKind = '';
      relationshipState.progressCount = relationshipState.following.length;
      relationshipState.progressExpected = followingResult.expected;
      relationshipState.lastScanAt = new Date().toISOString();
      const snapshot = {
        id: crypto.randomUUID(),
        profileUsername: username,
        createdAt: relationshipState.lastScanAt,
        followers: relationshipState.followers,
        following: relationshipState.following,
        nonMutual: relationshipState.nonMutual,
        complete: relationshipState.complete
      };
      relationshipState.snapshots = [snapshot, ...relationshipState.snapshots.filter(item => item.profileUsername === username)].slice(0, 3);
      await saveRelationship();
      scanView = 'nonMutual';
      renderScan();
    } catch (error) {
      const message = error?.message || String(error);
      const wasStopping = relationshipState.status === 'stopping' || /중지/.test(message);
      relationshipState.status = wasStopping ? 'stopped' : 'error';
      relationshipState.currentKind = '';
      relationshipState.warnings = [...relationshipState.warnings, message].slice(-5);
      await saveRelationship();
    } finally {
      scanTabId = null;
    }
  }

  async function stopRelationshipScan() {
    if (!isScanActive()) return;
    relationshipState.status = 'stopping';
    relationshipState.warnings = [...relationshipState.warnings, '사용자가 스캔 중지를 요청했습니다.'].slice(-5);
    await saveRelationship();
    if (Number.isInteger(scanTabId)) await chrome.tabs.sendMessage(scanTabId, { type: 'MATCHAL_SCAN_STOP' }).catch(() => {});
  }

  async function queueScannedNonMutual() {
    const users = relationshipState.nonMutual;
    if (!users.length) return;
    const response = await chrome.runtime.sendMessage({
      type: 'MATCHAL_SAVE_QUEUE',
      payload: {
        queueName: `Instagram 웹 스캔 맞팔 아님 · @${relationshipState.profileUsername} · ${formatDate(relationshipState.lastScanAt)}`,
        sourceType: 'instagram_scan_non_mutual',
        items: users.map(username => ({ username, source: 'instagram_scan_non_mutual' }))
      }
    });
    if (!response?.ok) {
      els.scanMessage.textContent = response?.message || '팔로우 취소 작업 목록을 만들지 못했습니다.';
      return;
    }
    automationState = { ...automationDefaults(), ...(response.state || {}) };
    automationState.settings = { ...automationDefaults().settings, ...(automationState.settings || {}) };
    automationState.runner = { ...automationDefaults().runner, ...(automationState.runner || {}) };
    els.confirmRun.checked = false;
    renderAutomation();
    els.scanMessage.textContent = `맞팔 아닌 계정 ${users.length.toLocaleString('ko-KR')}개를 팔로우 취소 작업 목록으로 만들었습니다.`;
  }

  function exportCurrentScan() {
    const values = relationshipList();
    if (!values.length) return;
    const labels = { followers: 'followers', following: 'following', nonMutual: 'non_mutual' };
    const rows = [['type', 'username', 'profile_url'], ...values.map(username => [labels[scanView], username, `https://www.instagram.com/${username}/`])];
    const csv = '\ufeff' + rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `matchal-${labels[scanView]}-${relationshipState.profileUsername || 'instagram'}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function waitInterruptible(seconds, token, label) {
    for (let remaining = seconds; remaining > 0; remaining--) {
      if (token !== runToken || stopping) return false;
      while (paused && token === runToken && !stopping) {
        automationState.runner.status = 'paused';
        automationState.runner.lastMessage = '일시정지되었습니다. 계속하기를 누르면 현재 목록부터 이어집니다.';
        await saveAutomation();
        await sleep(300);
      }
      if (token !== runToken || stopping) return false;
      automationState.runner.status = 'running';
      automationState.runner.lastMessage = `${label} · ${remaining}초`;
      await saveAutomation();
      await sleep(1000);
    }
    return true;
  }

  async function processItem(tab, item, token) {
    const url = `https://www.instagram.com/${encodeURIComponent(item.username)}/`;
    await chrome.tabs.update(tab.id, { url, active: true });
    await waitForTabComplete(tab.id);
    if (!await waitInterruptible(2, token, `@${item.username} 프로필 확인 중`)) return null;
    return sendWithRetry(tab.id, { type: 'MATCHAL_UNFOLLOW_CURRENT', username: item.username });
  }

  async function runQueue() {
    readSettings();
    if (isScanActive()) {
      automationState.runner.lastMessage = '관계 스캔을 먼저 중지하거나 완료해 주세요.';
      await saveAutomation();
      return;
    }
    if (!els.confirmRun.checked) {
      automationState.runner.lastMessage = '자동 클릭 작업 확인란을 먼저 선택해 주세요.';
      await saveAutomation();
      return;
    }

    const pending = automationState.queue.filter(item => item.status === 'pending').slice(0, automationState.settings.batchSize);
    if (!pending.length) return;
    const token = ++runToken;
    paused = false;
    stopping = false;
    automationState.runner = { ...automationDefaults().runner, status: 'running', lastMessage: `${pending.length}개 계정 작업을 시작합니다.` };
    await saveAutomation();

    let tab;
    let consecutiveErrors = 0;
    try {
      tab = await findOrCreateInstagramTab();
      for (let index = 0; index < pending.length; index++) {
        if (token !== runToken || stopping) break;
        const item = automationState.queue.find(row => row.username === pending[index].username);
        if (!item || item.status !== 'pending') continue;

        item.status = 'processing';
        item.message = 'Instagram 프로필을 여는 중입니다.';
        item.updatedAt = new Date().toISOString();
        automationState.runner.currentUsername = item.username;
        automationState.runner.lastMessage = `${index + 1}/${pending.length} · @${item.username} 처리 중`;
        await saveAutomation();

        let result;
        try {
          result = await processItem(tab, item, token);
          if (!result) break;
          if (result.ok && result.skipped) {
            item.status = 'skipped';
            item.message = result.message || '이미 팔로우하지 않는 계정입니다.';
            consecutiveErrors = 0;
          } else if (result.ok) {
            item.status = 'success';
            item.message = result.message || '팔로우 취소가 완료되었습니다.';
            consecutiveErrors = 0;
          } else {
            item.status = 'error';
            item.message = result.message || '처리하지 못했습니다.';
            consecutiveErrors++;
          }
        } catch (error) {
          item.status = 'error';
          item.message = error?.message || String(error);
          consecutiveErrors++;
          result = { ok: false, code: 'extension_error', message: item.message };
        }
        item.updatedAt = new Date().toISOString();
        automationState.runner.processed++;
        automationState.runner.succeeded = automationState.queue.filter(row => row.status === 'success').length;
        automationState.runner.skipped = automationState.queue.filter(row => row.status === 'skipped').length;
        automationState.runner.failed = automationState.queue.filter(row => row.status === 'error').length;
        await saveAutomation();

        if (['challenge', 'login_required'].includes(result?.code)) {
          automationState.runner.status = 'error';
          automationState.runner.lastMessage = result.message;
          await saveAutomation();
          return;
        }
        if (consecutiveErrors >= 2) {
          automationState.runner.status = 'error';
          automationState.runner.lastMessage = '연속 오류가 감지되어 안전을 위해 중지했습니다. Instagram 화면과 언어를 확인해 주세요.';
          await saveAutomation();
          return;
        }
        if (index === pending.length - 1) continue;

        const processedNow = index + 1;
        if (processedNow % automationState.settings.restEvery === 0) {
          if (!await waitInterruptible(automationState.settings.restSeconds, token, '요청 간격 보호 휴식 중')) break;
        } else {
          const delay = randomBetween(automationState.settings.minDelaySeconds, automationState.settings.maxDelaySeconds);
          if (!await waitInterruptible(delay, token, '다음 계정까지 대기 중')) break;
        }
      }

      if (stopping || token !== runToken) {
        automationState.queue.forEach(item => { if (item.status === 'processing') { item.status = 'pending'; item.message = '중지되어 다시 대기합니다.'; } });
        automationState.runner.status = 'stopped';
        automationState.runner.lastMessage = '사용자가 작업을 중지했습니다.';
      } else {
        automationState.runner.status = 'completed';
        automationState.runner.lastMessage = `이번 실행이 끝났습니다. 완료 ${automationState.runner.succeeded}개 · 건너뜀 ${automationState.runner.skipped}개 · 실패 ${automationState.runner.failed}개`;
      }
      automationState.runner.currentUsername = '';
      await saveAutomation();
    } catch (error) {
      automationState.runner.status = 'error';
      automationState.runner.lastMessage = error?.message || String(error);
      await saveAutomation();
    }
  }

  els.detectProfile.addEventListener('click', detectProfile);
  els.startScan.addEventListener('click', startRelationshipScan);
  els.stopScan.addEventListener('click', stopRelationshipScan);
  els.profileUsername.addEventListener('change', async () => {
    const username = normalizeUsername(els.profileUsername.value);
    if (USERNAME_PATTERN.test(username)) {
      relationshipState.profileUsername = username;
      await saveRelationship(false);
    }
  });
  els.scanSearch.addEventListener('input', renderScanList);
  document.querySelectorAll('[data-result-tab]').forEach(button => button.addEventListener('click', () => {
    scanView = button.dataset.resultTab;
    els.scanSearch.value = '';
    renderScan();
  }));
  els.exportScan.addEventListener('click', exportCurrentScan);
  els.queueNonMutual.addEventListener('click', queueScannedNonMutual);

  els.startButton.addEventListener('click', runQueue);
  els.pauseButton.addEventListener('click', async () => {
    paused = !paused;
    automationState.runner.status = paused ? 'paused' : 'running';
    automationState.runner.lastMessage = paused ? '일시정지 요청을 처리했습니다.' : '작업을 계속합니다.';
    await saveAutomation();
  });
  els.stopButton.addEventListener('click', async () => {
    stopping = true;
    paused = false;
    runToken++;
    automationState.queue.forEach(item => { if (item.status === 'processing') { item.status = 'pending'; item.message = '중지되어 다시 대기합니다.'; } });
    automationState.runner.status = 'stopped';
    automationState.runner.currentUsername = '';
    automationState.runner.lastMessage = '작업을 중지했습니다.';
    await saveAutomation();
  });
  els.resetErrors.addEventListener('click', async () => {
    automationState.queue.forEach(item => { if (item.status === 'error') { item.status = 'pending'; item.message = '다시 처리 대기'; } });
    automationState.runner.status = 'idle';
    automationState.runner.lastMessage = '실패한 항목을 다시 대기 상태로 변경했습니다.';
    await saveAutomation();
  });

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type !== 'MATCHAL_SCAN_PROGRESS' || !relationshipState) return;
    const payload = message.payload || {};
    if (payload.username && relationshipState.profileUsername && payload.username !== relationshipState.profileUsername) return;
    relationshipState.currentKind = payload.kind || relationshipState.currentKind;
    relationshipState.progressCount = Number(payload.count || 0);
    relationshipState.progressExpected = Number.isFinite(Number(payload.expected)) ? Number(payload.expected) : null;
    if (payload.warning) relationshipState.warnings = [...relationshipState.warnings, payload.warning].slice(-5);
    renderScan();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEY]?.newValue) {
      automationState = { ...automationDefaults(), ...changes[STORAGE_KEY].newValue };
      automationState.settings = { ...automationDefaults().settings, ...(automationState.settings || {}) };
      automationState.runner = { ...automationDefaults().runner, ...(automationState.runner || {}) };
      renderAutomation();
    }
    if (changes[RELATIONSHIP_KEY]?.newValue) {
      relationshipState = { ...relationshipDefaults(), ...changes[RELATIONSHIP_KEY].newValue };
      renderScan();
    }
  });

  loadStates().catch(error => {
    els.runnerMessage.textContent = error?.message || String(error);
    els.scanMessage.textContent = error?.message || String(error);
  });
})();