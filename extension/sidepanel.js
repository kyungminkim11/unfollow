(() => {
  'use strict';

  const STORAGE_KEY = 'matchalAutomationStateV22';
  const q = selector => document.querySelector(selector);
  const els = {
    queueName: q('#queueName'), runnerBadge: q('#runnerBadge'), countTotal: q('#countTotal'), countSuccess: q('#countSuccess'),
    countSkipped: q('#countSkipped'), countFailed: q('#countFailed'), progressBar: q('#progressBar'), runnerMessage: q('#runnerMessage'),
    batchSize: q('#batchSize'), minDelay: q('#minDelay'), maxDelay: q('#maxDelay'), restEvery: q('#restEvery'), restSeconds: q('#restSeconds'),
    confirmRun: q('#confirmRun'), startButton: q('#startButton'), pauseButton: q('#pauseButton'), stopButton: q('#stopButton'),
    queueSummary: q('#queueSummary'), queueList: q('#queueList'), resetErrors: q('#resetErrors')
  };

  let state = null;
  let runToken = 0;
  let paused = false;
  let stopping = false;

  const defaults = () => ({
    queue: [], queueName: '', sourceType: '', createdAt: '',
    settings: { batchSize: 10, minDelaySeconds: 8, maxDelaySeconds: 15, restEvery: 10, restSeconds: 60 },
    runner: { status: 'idle', processed: 0, succeeded: 0, skipped: 0, failed: 0, currentUsername: '', lastMessage: '', updatedAt: '' }
  });

  const clamp = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const randomBetween = (min, max) => Math.floor(min + Math.random() * (Math.max(min, max) - min + 1));

  async function loadState() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    state = { ...defaults(), ...(stored[STORAGE_KEY] || {}) };
    state.settings = { ...defaults().settings, ...(state.settings || {}) };
    state.runner = { ...defaults().runner, ...(state.runner || {}) };
    if (state.runner.status === 'running' || state.runner.status === 'paused') {
      state.runner.status = 'stopped';
      state.runner.lastMessage = '사이드패널이 닫혀 이전 실행이 중지되었습니다.';
      await saveState();
    }
    syncInputs();
    render();
  }

  async function saveState() {
    state.runner.updatedAt = new Date().toISOString();
    await chrome.storage.local.set({ [STORAGE_KEY]: state });
    render();
  }

  function syncInputs() {
    els.batchSize.value = state.settings.batchSize;
    els.minDelay.value = state.settings.minDelaySeconds;
    els.maxDelay.value = state.settings.maxDelaySeconds;
    els.restEvery.value = state.settings.restEvery;
    els.restSeconds.value = state.settings.restSeconds;
  }

  function readSettings() {
    const minDelaySeconds = clamp(els.minDelay.value, 5, 120, 8);
    const maxDelaySeconds = clamp(els.maxDelay.value, minDelaySeconds + 1, 180, 15);
    state.settings = {
      batchSize: clamp(els.batchSize.value, 1, 30, 10),
      minDelaySeconds,
      maxDelaySeconds,
      restEvery: clamp(els.restEvery.value, 1, 30, 10),
      restSeconds: clamp(els.restSeconds.value, 30, 900, 60)
    };
    syncInputs();
  }

  function render() {
    if (!state) return;
    const queue = Array.isArray(state.queue) ? state.queue : [];
    const succeeded = queue.filter(item => item.status === 'success').length;
    const skipped = queue.filter(item => item.status === 'skipped').length;
    const failed = queue.filter(item => item.status === 'error').length;
    const done = succeeded + skipped + failed;
    const status = state.runner.status || 'idle';
    const labels = { idle: '대기', running: '실행 중', paused: '일시정지', stopped: '중지', completed: '완료', error: '오류 중지' };

    els.queueName.textContent = state.queueName || '작업 목록 없음';
    els.runnerBadge.textContent = labels[status] || status;
    els.runnerBadge.dataset.state = status;
    els.countTotal.textContent = queue.length.toLocaleString('ko-KR');
    els.countSuccess.textContent = succeeded.toLocaleString('ko-KR');
    els.countSkipped.textContent = skipped.toLocaleString('ko-KR');
    els.countFailed.textContent = failed.toLocaleString('ko-KR');
    els.progressBar.style.width = `${queue.length ? Math.round(done / queue.length * 100) : 0}%`;
    els.runnerMessage.textContent = state.runner.lastMessage || '맞팔체커 웹에서 목록을 보내 주세요.';
    els.queueSummary.textContent = `${queue.length.toLocaleString('ko-KR')}개 · 대기 ${queue.filter(item => item.status === 'pending').length.toLocaleString('ko-KR')}개`;

    const active = status === 'running' || status === 'paused';
    els.startButton.disabled = active || !queue.some(item => item.status === 'pending');
    els.pauseButton.disabled = !active;
    els.pauseButton.textContent = status === 'paused' ? '계속하기' : '일시정지';
    els.stopButton.disabled = !active;
    [els.batchSize, els.minDelay, els.maxDelay, els.restEvery, els.restSeconds].forEach(input => { input.disabled = active; });

    els.queueList.replaceChildren();
    if (!queue.length) {
      const empty = document.createElement('div');
      empty.className = 'queueEmpty';
      empty.textContent = '웹에서 비맞팔 또는 팔로워 이탈 목록을 보내면 여기에 표시됩니다.';
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

  async function findOrCreateInstagramTab() {
    const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/*' });
    if (tabs.length) return tabs[0];
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

  async function sendWithRetry(tabId, message) {
    let lastError;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await chrome.tabs.sendMessage(tabId, message);
      } catch (error) {
        lastError = error;
        await sleep(500 + attempt * 500);
      }
    }
    throw lastError || new Error('Instagram 작업 스크립트와 연결하지 못했습니다.');
  }

  async function waitInterruptible(seconds, token, label) {
    for (let remaining = seconds; remaining > 0; remaining--) {
      if (token !== runToken || stopping) return false;
      while (paused && token === runToken && !stopping) {
        state.runner.status = 'paused';
        state.runner.lastMessage = '일시정지되었습니다. 계속하기를 누르면 현재 목록부터 이어집니다.';
        await saveState();
        await sleep(300);
      }
      if (token !== runToken || stopping) return false;
      state.runner.status = 'running';
      state.runner.lastMessage = `${label} · ${remaining}초`;
      await saveState();
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
    if (!els.confirmRun.checked) {
      state.runner.lastMessage = '자동 클릭 작업 확인란을 먼저 선택해 주세요.';
      await saveState();
      return;
    }

    const pending = state.queue.filter(item => item.status === 'pending').slice(0, state.settings.batchSize);
    if (!pending.length) return;
    const token = ++runToken;
    paused = false;
    stopping = false;
    state.runner = { ...defaults().runner, status: 'running', lastMessage: `${pending.length}개 계정 작업을 시작합니다.` };
    await saveState();

    let tab;
    let consecutiveErrors = 0;
    try {
      tab = await findOrCreateInstagramTab();
      for (let index = 0; index < pending.length; index++) {
        if (token !== runToken || stopping) break;
        const item = state.queue.find(row => row.username === pending[index].username);
        if (!item || item.status !== 'pending') continue;

        item.status = 'processing';
        item.message = 'Instagram 프로필을 여는 중입니다.';
        item.updatedAt = new Date().toISOString();
        state.runner.currentUsername = item.username;
        state.runner.lastMessage = `${index + 1}/${pending.length} · @${item.username} 처리 중`;
        await saveState();

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
        state.runner.processed++;
        state.runner.succeeded = state.queue.filter(row => row.status === 'success').length;
        state.runner.skipped = state.queue.filter(row => row.status === 'skipped').length;
        state.runner.failed = state.queue.filter(row => row.status === 'error').length;
        await saveState();

        if (['challenge', 'login_required'].includes(result?.code)) {
          state.runner.status = 'error';
          state.runner.lastMessage = result.message;
          await saveState();
          return;
        }
        if (consecutiveErrors >= 2) {
          state.runner.status = 'error';
          state.runner.lastMessage = '연속 오류가 감지되어 안전을 위해 중지했습니다. Instagram 화면과 언어를 확인해 주세요.';
          await saveState();
          return;
        }
        if (index === pending.length - 1) continue;

        const processedNow = index + 1;
        if (processedNow % state.settings.restEvery === 0) {
          if (!await waitInterruptible(state.settings.restSeconds, token, '요청 간격 보호 휴식 중')) break;
        } else {
          const delay = randomBetween(state.settings.minDelaySeconds, state.settings.maxDelaySeconds);
          if (!await waitInterruptible(delay, token, '다음 계정까지 대기 중')) break;
        }
      }

      if (token !== runToken || stopping) {
        state.runner.status = 'stopped';
        state.runner.lastMessage = '사용자가 작업을 중지했습니다.';
      } else {
        state.runner.status = 'completed';
        state.runner.lastMessage = `이번 실행이 끝났습니다. 완료 ${state.runner.succeeded}개 · 건너뜀 ${state.runner.skipped}개 · 실패 ${state.runner.failed}개`;
      }
      state.runner.currentUsername = '';
      await saveState();
    } catch (error) {
      state.runner.status = 'error';
      state.runner.lastMessage = error?.message || String(error);
      await saveState();
    }
  }

  els.startButton.addEventListener('click', runQueue);
  els.pauseButton.addEventListener('click', async () => {
    paused = !paused;
    state.runner.status = paused ? 'paused' : 'running';
    state.runner.lastMessage = paused ? '일시정지 요청을 처리했습니다.' : '작업을 계속합니다.';
    await saveState();
  });
  els.stopButton.addEventListener('click', async () => {
    stopping = true;
    paused = false;
    runToken++;
    state.queue.forEach(item => { if (item.status === 'processing') { item.status = 'pending'; item.message = '중지되어 다시 대기합니다.'; } });
    state.runner.status = 'stopped';
    state.runner.currentUsername = '';
    state.runner.lastMessage = '작업을 중지했습니다.';
    await saveState();
  });
  els.resetErrors.addEventListener('click', async () => {
    state.queue.forEach(item => { if (item.status === 'error') { item.status = 'pending'; item.message = '다시 처리 대기'; } });
    state.runner.status = 'idle';
    state.runner.lastMessage = '실패한 항목을 다시 대기 상태로 변경했습니다.';
    await saveState();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]?.newValue) return;
    state = { ...defaults(), ...changes[STORAGE_KEY].newValue };
    state.settings = { ...defaults().settings, ...(state.settings || {}) };
    state.runner = { ...defaults().runner, ...(state.runner || {}) };
    render();
  });

  loadState().catch(error => {
    els.runnerMessage.textContent = error?.message || String(error);
  });
})();