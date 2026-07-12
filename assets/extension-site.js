(() => {
  'use strict';

  if (window.__MATCHAL_EXTENSION_SITE_ACTIVE__) return;
  window.__MATCHAL_EXTENSION_SITE_ACTIVE__ = true;

  const ORIGIN = 'https://unfollow.lavalabs.co.kr';
  const STORE_URL = '';
  const state = { ready: false, version: '', mounted: false, pingTimer: null };
  const svg = {
    extension: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M8.2 12a3.8 3.8 0 1 0 7.6 0 3.8 3.8 0 0 0-7.6 0Z" stroke="currentColor" stroke-width="2"/><path d="M8.2 12H3.5m17 0h-4.7M9.3 8.6 6.7 6a2 2 0 0 0-2.8 2.8l2.6 2.6m8.2-2.8L17.3 6a2 2 0 1 1 2.8 2.8l-2.6 2.6M9.3 15.4 6.7 18a2 2 0 1 1-2.8-2.8l2.6-2.6m8.2 2.8 2.6 2.6a2 2 0 1 0 2.8-2.8l-2.6-2.6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    help: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M9.7 9a2.45 2.45 0 1 1 3.2 2.34c-.58.2-.9.66-.9 1.16v.35M12 16.7h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    download: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 18v2h14v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  function mount() {
    if (state.mounted || !document.body) return;
    const main = document.querySelector('.main') || document.querySelector('main') || document.body;
    const hero = document.querySelector('.hero');
    const topbar = document.querySelector('.serviceTopbar');
    const topActions = document.querySelector('.serviceTopActions');
    createGuideDialog();
    const promo = document.getElementById('chrome-extension') || createPromo();
    if (!promo.isConnected) {
      const mobileTaskFirst = window.matchMedia('(max-width: 760px)').matches;
      if (mobileTaskFirst && hero?.parentNode) hero.insertAdjacentElement('afterend', promo);
      else if (hero?.parentNode) hero.parentNode.insertBefore(promo, hero);
      else if (topbar?.parentNode) topbar.insertAdjacentElement('afterend', promo);
      else main.insertAdjacentElement('afterbegin', promo);
    }
    if (topActions && !topActions.querySelector('.extensionHeaderBtn')) {
      topActions.insertAdjacentElement('afterbegin', createHeaderButton());
    }
    bindGlobalEvents();
    state.mounted = true;
    updateUI();
    pingExtension();
  }

  function createPromo() {
    const section = document.createElement('section');
    section.className = 'extensionPromoSite';
    section.id = 'chrome-extension';
    section.setAttribute('aria-labelledby', 'extensionPromoTitle');
    section.innerHTML = `<div class="extensionPromoInner"><div class="extensionPromoCopy"><div class="extensionPromoIcon">${svg.extension}</div><div class="extensionPromoText"><p class="extensionPromoKicker">CHROME COMPANION</p><h2 class="extensionPromoTitle" id="extensionPromoTitle">Instagram 옆에서 더 편하게 검토하세요</h2><p class="extensionPromoDesc">사이트에서 ZIP을 분석한 뒤, Chrome 사이드패널에서 프로필을 확인하고 취소 완료·유지·보류를 기록할 수 있습니다.</p><span class="extensionPromoStatus" data-extension-status>확장 프로그램 확인 중</span></div></div><div class="extensionPromoActions"><button type="button" class="extensionPromoBtn" data-extension-guide>${svg.help}<span>사용법 보기</span></button><button type="button" class="extensionPromoBtn primary" data-extension-primary>${svg.extension}<span class="install-label">Chrome에 설치</span><span class="open-label">익스텐션 열기</span></button></div></div>`;
    return section;
  }

  function createHeaderButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'extensionHeaderBtn';
    button.setAttribute('data-extension-primary', '');
    button.innerHTML = '<span class="extDot"></span><span>Chrome 확장</span>';
    return button;
  }

  function createGuideDialog() {
    if (document.getElementById('extensionGuideBackdrop')) return;
    const backdrop = document.createElement('div');
    backdrop.className = 'extensionGuideBackdrop';
    backdrop.id = 'extensionGuideBackdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'extensionGuideTitle');
    backdrop.innerHTML = `<div class="extensionGuideDialog" tabindex="-1"><div class="extensionGuideHead"><div><h2 id="extensionGuideTitle">맞팔체커 Companion 사용법</h2><p>분석은 웹에서, 실제 프로필 검토는 Instagram 옆 사이드패널에서 진행합니다.</p></div><button type="button" class="extensionGuideClose" data-extension-close aria-label="닫기">${svg.close}</button></div><div class="extensionGuideBody"><div class="extensionGuideState" data-guide-state><span class="stateDot"></span><span>확장 프로그램 설치 여부를 확인하고 있습니다.</span></div><div class="extensionGuideSteps"><div class="extensionGuideStep"><span class="extensionGuideStepNum">1</span><div><strong>Instagram 공식 데이터 받기</strong><p>계정 센터에서 ‘팔로워 및 팔로잉’을 JSON·전체 기간으로 요청합니다.</p></div></div><div class="extensionGuideStep"><span class="extensionGuideStepNum">2</span><div><strong>맞팔체커에서 ZIP 분석</strong><p>다운로드한 ZIP을 압축 해제하지 않고 이 사이트에 그대로 올립니다.</p></div></div><div class="extensionGuideStep"><span class="extensionGuideStepNum">3</span><div><strong>익스텐션으로 검토 목록 보내기</strong><p>분석 결과에서 익스텐션 검토를 시작하면 로컬 저장소로 목록이 전달됩니다.</p></div></div><div class="extensionGuideStep"><span class="extensionGuideStepNum">4</span><div><strong>Instagram에서 직접 판단</strong><p>프로필을 확인하고 취소 완료·유지·보류만 기록합니다. 자동 언팔은 실행하지 않습니다.</p></div></div></div><div class="extensionGuideNotice" data-install-notice>Chrome 웹스토어 공개 심사 전에는 개발자용 압축 파일로 설치합니다. 스토어 등록이 완료되면 이 버튼이 바로 설치 페이지로 연결됩니다.</div><div class="extensionGuideActions"><a class="extensionPromoBtn" href="https://accountscenter.instagram.com/info_and_permissions/dyi/" target="_blank" rel="noopener noreferrer">${svg.download}<span>공식 데이터 받기</span></a><button type="button" class="extensionPromoBtn primary" data-extension-primary>${svg.extension}<span class="install-label">설치 안내 보기</span><span class="open-label">익스텐션 열기</span></button></div><p class="extensionGuideFoot">비밀번호·쿠키·세션 정보를 읽지 않으며, 분석 결과와 작업 기록은 브라우저 로컬에 저장됩니다.</p></div></div>`;
    document.body.appendChild(backdrop);
  }

  function bindGlobalEvents() {
    document.addEventListener('click', (event) => {
      const primary = event.target.closest('[data-extension-primary]');
      const guide = event.target.closest('[data-extension-guide]');
      const close = event.target.closest('[data-extension-close]');
      if (primary) { event.preventDefault(); state.ready ? openExtensionPanel() : openInstallFlow(); }
      if (guide) { event.preventDefault(); showGuide(); }
      if (close) { event.preventDefault(); hideGuide(); }
      if (event.target.id === 'extensionGuideBackdrop') hideGuide();
    });
    window.addEventListener('message', onExtensionMessage);
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideGuide(); });
  }

  function onExtensionMessage(event) {
    if (event.source !== window || event.origin !== ORIGIN || event.data?.source !== 'MATCHAL_EXTENSION') return;
    if (event.data.type === 'MATCHAL_READY') {
      state.ready = true;
      state.version = event.data.payload?.version || '';
      document.body.classList.add('matchal-extension-connected');
      clearTimeout(state.pingTimer);
      updateUI();
    }
  }

  function pingExtension() {
    window.postMessage({ source: 'MATCHAL_WEB', type: 'MATCHAL_PING' }, ORIGIN);
    clearTimeout(state.pingTimer);
    state.pingTimer = setTimeout(updateUI, 1200);
  }

  function openExtensionPanel() {
    window.postMessage({ source: 'MATCHAL_WEB', type: 'MATCHAL_OPEN_PANEL' }, ORIGIN);
  }

  function openInstallFlow() {
    if (STORE_URL) { window.open(STORE_URL, '_blank', 'noopener,noreferrer'); return; }
    showGuide();
  }

  function showGuide() {
    const backdrop = document.getElementById('extensionGuideBackdrop');
    if (!backdrop) return;
    backdrop.classList.add('show');
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => backdrop.querySelector('.extensionGuideDialog')?.focus());
  }

  function hideGuide() {
    const backdrop = document.getElementById('extensionGuideBackdrop');
    if (!backdrop) return;
    backdrop.classList.remove('show');
    document.body.style.overflow = '';
  }

  function updateUI() {
    document.querySelectorAll('.extensionPromoSite').forEach((element) => element.classList.toggle('is-ready', state.ready));
    document.querySelectorAll('.extensionHeaderBtn').forEach((element) => element.classList.toggle('is-ready', state.ready));
    document.querySelectorAll('[data-extension-status]').forEach((element) => {
      element.textContent = state.ready ? `설치됨${state.version ? ` · v${state.version}` : ''}` : '설치하면 사이드패널 검토를 사용할 수 있어요';
    });
    document.querySelectorAll('[data-guide-state]').forEach((element) => {
      element.classList.toggle('is-ready', state.ready);
      const label = element.querySelector('span:last-child');
      if (label) label.textContent = state.ready ? `확장 프로그램이 연결되었습니다${state.version ? ` · v${state.version}` : ''}.` : '아직 확장 프로그램이 연결되지 않았습니다.';
    });
    document.querySelectorAll('[data-install-notice]').forEach((element) => { element.hidden = state.ready; });
  }

  function boot() {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(mount, 0), { once: true });
    else setTimeout(mount, 0);
  }

  boot();
})();