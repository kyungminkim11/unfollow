(() => {
  'use strict';

  if (window.__MATCHAL_AUTOMATION_PARSER_V22__) return;
  window.__MATCHAL_AUTOMATION_PARSER_V22__ = true;

  const LIMITS = { zip: 80 * 1024 * 1024, entry: 25 * 1024 * 1024, total: 50 * 1024 * 1024, entries: 10000, ratio: 300 };
  const state = { single: null, previous: null, current: null, singleFile: '', previousFile: '', currentFile: '', errors: {} };

  window.__MATCHAL_AUTOMATION__ = {
    getCurrent: () => ({
      loaded: Boolean(state.single),
      sourceName: state.singleFile,
      nonMutual: state.single ? difference(state.single.following, state.single.followers) : [],
      error: state.errors.single || ''
    })
  };

  window.MatchalComparisonV22 = {
    getCandidates: () => {
      if (!state.previous || !state.current) return { ready: false, sourceName: '', lostFollowerTargets: [], currentNonMutual: [], error: state.errors.comparison || '' };
      const lostFollowers = difference(state.previous.followers, state.current.followers);
      return {
        ready: true,
        sourceName: `${state.previousFile} → ${state.currentFile}`,
        lostFollowerTargets: lostFollowers.filter(username => state.current.following.has(username)),
        currentNonMutual: difference(state.current.following, state.current.followers),
        error: ''
      };
    }
  };

  function difference(a, b) {
    return [...a].filter(value => !b.has(value)).sort();
  }

  function notify(type) {
    window.dispatchEvent(new CustomEvent(type === 'single' ? 'matchal:analysis-ready' : 'matchal:comparison-ready'));
  }

  function isPrimaryInput(input) {
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return false;
    if (input.id === 'comparePreviousV13' || input.id === 'compareCurrentV13') return false;
    if (/progress|import|restore|backup/i.test(input.id || input.name || '')) return false;
    return input.id === 'zipInput' || Boolean(input.closest('.drop,.v14PrimaryDrop,.uploadPanel'));
  }

  document.addEventListener('change', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    const file = input.files?.[0];
    if (input.id === 'comparePreviousV13') {
      if (!file) { state.previous = null; state.previousFile = ''; notify('comparison'); return; }
      parseInto('previous', file);
      return;
    }
    if (input.id === 'compareCurrentV13') {
      if (!file) { state.current = null; state.currentFile = ''; notify('comparison'); return; }
      parseInto('current', file);
      return;
    }
    if (isPrimaryInput(input) && file) parseInto('single', file);
  }, true);

  async function parseInto(slot, file) {
    try {
      const parsed = await parseRelationshipZip(file);
      state[slot] = parsed;
      state[`${slot}File`] = file.name;
      delete state.errors[slot === 'single' ? 'single' : 'comparison'];
      notify(slot === 'single' ? 'single' : 'comparison');
    } catch (error) {
      state[slot] = null;
      state[`${slot}File`] = file?.name || '';
      state.errors[slot === 'single' ? 'single' : 'comparison'] = friendlyError(error);
      notify(slot === 'single' ? 'single' : 'comparison');
    }
  }

  async function parseRelationshipZip(file) {
    if (!file || file.size > LIMITS.zip) throw new Error('ZIP_LIMIT');
    const buffer = await file.arrayBuffer();
    const zip = parseZipEntries(buffer);
    const followingEntries = zip.entries.filter(entry => /(^|\/)following\.json$/i.test(entry.name));
    const followerEntries = zip.entries.filter(entry => /(^|\/)followers_\d+\.json$/i.test(entry.name));
    if (!followingEntries.length || !followerEntries.length) throw new Error('FILES_MISSING');
    const following = new Set();
    const followers = new Set();
    for (const entry of followingEntries) extractUsers(JSON.parse(await inflateEntry(zip, entry))).forEach(value => following.add(value));
    for (const entry of followerEntries) extractUsers(JSON.parse(await inflateEntry(zip, entry))).forEach(value => followers.add(value));
    return { following, followers };
  }

  function parseZipEntries(buffer) {
    if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 22) throw new Error('ZIP_INVALID');
    const view = new DataView(buffer);
    const eocd = findEocd(view);
    const total = view.getUint16(eocd + 10, true);
    const centralSize = view.getUint32(eocd + 12, true);
    const centralOffset = view.getUint32(eocd + 16, true);
    if (total > LIMITS.entries || centralOffset + centralSize > buffer.byteLength) throw new Error('ZIP_INVALID');
    const decoder = new TextDecoder();
    const entries = [];
    let offset = centralOffset;
    let totalJson = 0;
    for (let index = 0; index < total; index++) {
      if (offset + 46 > buffer.byteLength || view.getUint32(offset, true) !== 0x02014b50) throw new Error('ZIP_INVALID');
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const uncompressedSize = view.getUint32(offset + 24, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const next = offset + 46 + nameLength + extraLength + commentLength;
      if (next > buffer.byteLength || localOffset + 30 > buffer.byteLength) throw new Error('ZIP_INVALID');
      const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));
      if (/\.json$/i.test(name)) {
        if (uncompressedSize > LIMITS.entry) throw new Error('JSON_LIMIT');
        totalJson += uncompressedSize;
        if (totalJson > LIMITS.total) throw new Error('JSON_TOTAL_LIMIT');
        if (uncompressedSize > 1024 && (!compressedSize || uncompressedSize / compressedSize > LIMITS.ratio)) throw new Error('ZIP_RATIO');
      }
      entries.push({ name, method, compressedSize, uncompressedSize, localOffset });
      offset = next;
    }
    return { buffer, entries };
  }

  function findEocd(view) {
    const minimum = Math.max(0, view.byteLength - 65557);
    for (let offset = view.byteLength - 22; offset >= minimum; offset--) if (view.getUint32(offset, true) === 0x06054b50) return offset;
    throw new Error('ZIP_INVALID');
  }

  async function inflateEntry(zip, entry) {
    const view = new DataView(zip.buffer);
    if (view.getUint32(entry.localOffset, true) !== 0x04034b50) throw new Error('ZIP_INVALID');
    const nameLength = view.getUint16(entry.localOffset + 26, true);
    const extraLength = view.getUint16(entry.localOffset + 28, true);
    const start = entry.localOffset + 30 + nameLength + extraLength;
    if (start + entry.compressedSize > zip.buffer.byteLength) throw new Error('ZIP_INVALID');
    const compressed = new Uint8Array(zip.buffer.slice(start, start + entry.compressedSize));
    if (entry.method === 0) return new TextDecoder().decode(compressed);
    if (entry.method !== 8 || !('DecompressionStream' in window)) throw new Error('ZIP_UNSUPPORTED');
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const output = await new Response(stream).arrayBuffer();
    if (output.byteLength > LIMITS.entry) throw new Error('JSON_LIMIT');
    return new TextDecoder().decode(output);
  }

  function extractUsers(data) {
    let rows = [];
    if (Array.isArray(data)) rows = data;
    else if (Array.isArray(data?.relationships_following)) rows = data.relationships_following;
    else if (Array.isArray(data?.relationships_followers)) rows = data.relationships_followers;
    const users = [];
    rows.forEach(row => {
      const value = String(row?.string_list_data?.[0]?.value || row?.title || '').trim().replace(/^@/, '').toLowerCase();
      if (/^[a-z0-9._]{1,30}$/.test(value)) users.push(value);
    });
    return users;
  }

  function friendlyError(error) {
    const messages = {
      ZIP_LIMIT: 'ZIP 파일은 80MB 이하만 사용할 수 있습니다.',
      ZIP_INVALID: 'ZIP 파일이 손상됐거나 Instagram 데이터 형식이 아닙니다.',
      FILES_MISSING: 'followers_*.json 또는 following.json을 찾지 못했습니다.',
      JSON_LIMIT: 'ZIP 안의 JSON 파일이 너무 큽니다.',
      JSON_TOTAL_LIMIT: 'ZIP 안의 JSON 전체 크기가 50MB를 초과합니다.',
      ZIP_RATIO: '비정상적으로 압축률이 높은 ZIP은 처리하지 않습니다.',
      ZIP_UNSUPPORTED: '이 브라우저에서는 ZIP 압축을 해제할 수 없습니다.'
    };
    return messages[String(error?.message || error)] || '자동화 목록을 준비하지 못했습니다.';
  }
})();