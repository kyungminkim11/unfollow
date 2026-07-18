(() => {
  'use strict';

  const PAGE_SOURCE = 'MATCHAL_WEB';
  const EXTENSION_SOURCE = 'MATCHAL_EXTENSION';
  const RELATIONSHIP_KEY = 'matchalRelationshipStateV23';
  const HISTORY_KEY = 'matchalRelationshipHistoryV24';

  function post(type, payload = {}) {
    window.postMessage({ source: EXTENSION_SOURCE, type, payload }, location.origin);
  }

  async function runtimeMessage(message) {
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      return { ok: false, message: error?.message || String(error) };
    }
  }

  async function announceReady() {
    const response = await runtimeMessage({ type: 'MATCHAL_PING' });
    if (response?.ok) post('MATCHAL_READY', { version: response.version || chrome.runtime.getManifest().version });
  }

  async function announceRelationshipState() {
    const response = await runtimeMessage({ type: 'MATCHAL_GET_RELATIONSHIP_SCAN' });
    if (response?.ok) post('MATCHAL_RELATIONSHIP_SCAN', { state: response.state || {}, version: response.version || chrome.runtime.getManifest().version });
    else post('MATCHAL_ERROR', response || { message: '스캔 결과를 불러오지 못했습니다.' });
  }

  async function announceRelationshipDashboard() {
    const response = await runtimeMessage({ type: 'MATCHAL_GET_RELATIONSHIP_DASHBOARD' });
    if (response?.ok) post('MATCHAL_RELATIONSHIP_DASHBOARD', { current: response.current || {}, history: response.history || [], version: response.version || chrome.runtime.getManifest().version });
    else post('MATCHAL_ERROR', response || { message: '관계 대시보드 기록을 불러오지 못했습니다.' });
  }

  window.addEventListener('message', async event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== PAGE_SOURCE) return;
    const type = String(event.data.type || '');

    if (type === 'MATCHAL_PING') {
      await announceReady();
      return;
    }

    if (type === 'MATCHAL_GET_RELATIONSHIP_SCAN') {
      await announceRelationshipState();
      return;
    }

    if (type === 'MATCHAL_GET_RELATIONSHIP_DASHBOARD') {
      await announceRelationshipDashboard();
      return;
    }

    if (type === 'MATCHAL_OPEN_PANEL') {
      const response = await runtimeMessage({ type: 'MATCHAL_OPEN_PANEL' });
      post(response?.ok ? 'MATCHAL_PANEL_OPENED' : 'MATCHAL_ERROR', response || {});
      return;
    }

    if (type === 'MATCHAL_SAVE_QUEUE') {
      const response = await runtimeMessage({ type: 'MATCHAL_SAVE_QUEUE', payload: event.data.payload || {} });
      post(response?.ok ? 'MATCHAL_QUEUE_SAVED' : 'MATCHAL_ERROR', response || {});
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[RELATIONSHIP_KEY]?.newValue) post('MATCHAL_RELATIONSHIP_SCAN', { state: changes[RELATIONSHIP_KEY].newValue, version: chrome.runtime.getManifest().version });
    if (changes[RELATIONSHIP_KEY] || changes[HISTORY_KEY]) announceRelationshipDashboard();
  });

  announceReady();
  announceRelationshipState();
  announceRelationshipDashboard();
})();