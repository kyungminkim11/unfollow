(() => {
  'use strict';

  const PAGE_SOURCE = 'MATCHAL_WEB';
  const EXTENSION_SOURCE = 'MATCHAL_EXTENSION';

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

  window.addEventListener('message', async event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.source !== PAGE_SOURCE) return;
    const type = String(event.data.type || '');

    if (type === 'MATCHAL_PING') {
      await announceReady();
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

  announceReady();
})();