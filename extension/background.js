const VERSION = '24.0.0';
const STORAGE_KEY = 'matchalAutomationStateV22';
const RELATIONSHIP_KEY = 'matchalRelationshipStateV23';
const HISTORY_KEY = 'matchalRelationshipHistoryV24';

const defaultState = () => ({
  queue: [],
  queueName: '',
  sourceType: '',
  createdAt: '',
  settings: {
    batchSize: 10,
    minDelaySeconds: 8,
    maxDelaySeconds: 15,
    restEvery: 10,
    restSeconds: 60
  },
  runner: {
    status: 'idle',
    processed: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    currentUsername: '',
    lastMessage: '',
    updatedAt: ''
  }
});

const defaultRelationshipState = () => ({
  profileUsername: '',
  status: 'idle',
  currentKind: '',
  progressCount: 0,
  progressExpected: null,
  followers: [],
  following: [],
  nonMutual: [],
  mutual: [],
  complete: false,
  warnings: [],
  lastScanAt: '',
  snapshots: []
});

async function getState() {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return { ...defaultState(), ...(stored[STORAGE_KEY] || {}) };
}

async function setState(next) {
  const state = { ...defaultState(), ...next };
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  return state;
}

async function getRelationshipState() {
  const stored = await chrome.storage.local.get(RELATIONSHIP_KEY);
  return { ...defaultRelationshipState(), ...(stored[RELATIONSHIP_KEY] || {}) };
}

async function getRelationshipHistory() {
  const stored = await chrome.storage.local.get(HISTORY_KEY);
  return Array.isArray(stored[HISTORY_KEY]) ? stored[HISTORY_KEY] : [];
}

async function getRelationshipDashboard() {
  const [current, history] = await Promise.all([getRelationshipState(), getRelationshipHistory()]);
  return { current, history };
}

function normalizeQueue(payload = {}) {
  const seen = new Set();
  const queue = [];
  for (const item of Array.isArray(payload.items) ? payload.items : []) {
    const username = String(item?.username || item || '').trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(username) || seen.has(username)) continue;
    seen.add(username);
    queue.push({
      username,
      source: String(item?.source || payload.sourceType || 'unknown').slice(0, 40),
      status: 'pending',
      message: '',
      updatedAt: ''
    });
  }
  return queue.slice(0, 50000);
}

function openPanel(sender) {
  const tabId = sender?.tab?.id;
  const windowId = sender?.tab?.windowId;
  if (Number.isInteger(tabId)) return chrome.sidePanel.open({ tabId });
  if (Number.isInteger(windowId)) return chrome.sidePanel.open({ windowId });
  return Promise.reject(new Error('사이드패널을 열 브라우저 탭을 찾지 못했습니다.'));
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  const current = await chrome.storage.local.get([STORAGE_KEY, RELATIONSHIP_KEY, HISTORY_KEY]);
  const updates = {};
  if (!current[STORAGE_KEY]) updates[STORAGE_KEY] = defaultState();
  if (!current[RELATIONSHIP_KEY]) updates[RELATIONSHIP_KEY] = defaultRelationshipState();
  if (!Array.isArray(current[HISTORY_KEY])) updates[HISTORY_KEY] = [];
  if (Object.keys(updates).length) await chrome.storage.local.set(updates);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const type = String(message?.type || '');
    if (type === 'MATCHAL_PING') {
      sendResponse({ ok: true, version: VERSION });
      return;
    }
    if (type === 'MATCHAL_GET_STATE') {
      sendResponse({ ok: true, state: await getState(), version: VERSION });
      return;
    }
    if (type === 'MATCHAL_GET_RELATIONSHIP_SCAN') {
      sendResponse({ ok: true, state: await getRelationshipState(), version: VERSION });
      return;
    }
    if (type === 'MATCHAL_GET_RELATIONSHIP_DASHBOARD') {
      sendResponse({ ok: true, ...(await getRelationshipDashboard()), version: VERSION });
      return;
    }
    if (type === 'MATCHAL_SET_STATE') {
      sendResponse({ ok: true, state: await setState(message.state || {}) });
      return;
    }
    if (type === 'MATCHAL_SAVE_QUEUE') {
      const queue = normalizeQueue(message.payload || {});
      if (!queue.length) throw new Error('저장할 계정 목록이 없습니다.');
      const panelPromise = openPanel(sender).catch(() => null);
      const previous = await getState();
      const state = await setState({
        ...previous,
        queue,
        queueName: String(message.payload?.queueName || '맞팔체커 작업 목록').slice(0, 120),
        sourceType: String(message.payload?.sourceType || 'unknown').slice(0, 40),
        createdAt: new Date().toISOString(),
        runner: { ...defaultState().runner, lastMessage: `${queue.length}개 계정을 불러왔습니다.`, updatedAt: new Date().toISOString() }
      });
      await panelPromise;
      sendResponse({ ok: true, count: queue.length, state, version: VERSION });
      return;
    }
    if (type === 'MATCHAL_OPEN_PANEL') {
      await openPanel(sender);
      sendResponse({ ok: true, version: VERSION });
      return;
    }
    if (type === 'MATCHAL_SCAN_PROGRESS') {
      sendResponse({ ok: true });
      return;
    }
    sendResponse({ ok: false, message: '지원하지 않는 요청입니다.' });
  })().catch(error => sendResponse({ ok: false, message: error?.message || String(error) }));
  return true;
});