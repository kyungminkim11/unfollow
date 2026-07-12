(() => {
  'use strict';

  const STYLE_ID = 'matchal-responsive-final-late';
  let lastMode = '';

  function ensureLateStylesheet() {
    document.getElementById(STYLE_ID)?.remove();
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = `/assets/responsive-final.css?v=3`;
    document.head.appendChild(link);
  }

  function getMetrics() {
    const viewportWidth = Math.round(
      window.visualViewport?.width ||
      document.documentElement.clientWidth ||
      window.innerWidth
    );

    const main = document.querySelector('.main') || document.querySelector('main');
    const hero = document.querySelector('.hero');
    const uploadPanel = document.querySelector('.uploadPanel');

    return {
      viewportWidth,
      mainWidth: main ? Math.round(main.getBoundingClientRect().width) : viewportWidth,
      heroWidth: hero ? Math.round(hero.getBoundingClientRect().width) : 0,
      uploadWidth: uploadPanel ? Math.round(uploadPanel.getBoundingClientRect().width) : 0,
      main,
      hero,
      uploadPanel
    };
  }

  function setImportant(element, property, value) {
    element?.style.setProperty(property, value, 'important');
  }

  function clearProperties(element, properties) {
    if (!element) return;
    properties.forEach((property) => element.style.removeProperty(property));
  }

  function enforceCompactLayout(metrics, compact) {
    const { hero, uploadPanel } = metrics;
    const heroMain = document.querySelector('.heroMain');

    if (compact) {
      setImportant(hero, 'display', 'grid');
      setImportant(hero, 'grid-template-columns', 'minmax(0, 1fr)');
      setImportant(hero, 'gap', '14px');
      setImportant(hero, 'width', '100%');

      [heroMain, uploadPanel].forEach((element) => {
        setImportant(element, 'width', '100%');
        setImportant(element, 'max-width', 'none');
        setImportant(element, 'min-width', '0');
      });

      if (uploadPanel) {
        setImportant(uploadPanel, 'display', 'grid');
        setImportant(uploadPanel, 'grid-template-columns', 'minmax(0, 1fr)');

        Array.from(uploadPanel.children).forEach((child) => {
          setImportant(child, 'grid-column', '1 / -1');
          setImportant(child, 'width', '100%');
          setImportant(child, 'max-width', 'none');
          setImportant(child, 'min-width', '0');
        });
      }

      const summary = document.querySelector('.heroSummaryV8');
      if (summary) {
        setImportant(summary, 'display', 'grid');
        setImportant(summary, 'grid-template-columns', 'repeat(4, minmax(0, 1fr))');
        setImportant(summary, 'gap', '10px');
      }

      const quickStart = uploadPanel?.querySelector('.quickStart');
      if (quickStart) {
        setImportant(quickStart, 'display', 'grid');
        setImportant(quickStart, 'grid-template-columns', 'minmax(0, 1fr)');
        setImportant(quickStart, 'gap', '9px');
        Array.from(quickStart.children).forEach((child) => {
          setImportant(child, 'width', '100%');
          setImportant(child, 'min-width', '0');
        });
      }
    } else {
      clearProperties(hero, ['display', 'grid-template-columns', 'gap', 'width']);
      [heroMain, uploadPanel].forEach((element) => {
        clearProperties(element, ['width', 'max-width', 'min-width']);
      });
      clearProperties(uploadPanel, ['display', 'grid-template-columns']);
      Array.from(uploadPanel?.children || []).forEach((child) => {
        clearProperties(child, ['grid-column', 'width', 'max-width', 'min-width']);
      });
      const summary = document.querySelector('.heroSummaryV8');
      clearProperties(summary, ['display', 'grid-template-columns', 'gap']);
      const quickStart = uploadPanel?.querySelector('.quickStart');
      clearProperties(quickStart, ['display', 'grid-template-columns', 'gap']);
      Array.from(quickStart?.children || []).forEach((child) => {
        clearProperties(child, ['width', 'min-width']);
      });
    }
  }

  function updateNarrowState() {
    const body = document.body;
    if (!body) return;

    const metrics = getMetrics();
    const extensionConnected = body.classList.contains('matchal-extension-connected');

    /*
      The hero is considered squeezed whenever the upload panel falls below a
      usable width. This works even when Chrome reports a wider viewport while
      its Side Panel has already reduced the page content area.
    */
    const squeezedHero =
      metrics.heroWidth > 0 &&
      metrics.uploadWidth > 0 &&
      metrics.uploadWidth < 560;

    const narrow =
      metrics.viewportWidth <= 1560 ||
      metrics.mainWidth <= 1380 ||
      squeezedHero ||
      (extensionConnected && metrics.viewportWidth <= 1900);

    const veryNarrow =
      metrics.viewportWidth <= 900 ||
      metrics.mainWidth <= 860;

    body.classList.toggle('matchal-compact', narrow);
    body.classList.toggle('matchal-very-narrow', veryNarrow);
    body.dataset.layoutViewport = String(metrics.viewportWidth);
    body.dataset.layoutMain = String(metrics.mainWidth);
    body.dataset.layoutHero = String(metrics.heroWidth);
    body.dataset.layoutUpload = String(metrics.uploadWidth);

    enforceCompactLayout(metrics, narrow);

    const mode = veryNarrow ? 'very-narrow' : narrow ? 'compact' : 'wide';
    if (mode !== lastMode) {
      body.dataset.layoutMode = mode;
      lastMode = mode;
    }
  }

  function boot() {
    ensureLateStylesheet();
    updateNarrowState();

    window.addEventListener('resize', updateNarrowState, { passive: true });
    window.visualViewport?.addEventListener('resize', updateNarrowState, { passive: true });
    window.addEventListener('message', (event) => {
      if (event.source === window && event.data?.source === 'MATCHAL_EXTENSION') {
        setTimeout(updateNarrowState, 0);
        setTimeout(updateNarrowState, 120);
      }
    });

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(updateNarrowState);
      observer.observe(document.documentElement);
      const main = document.querySelector('.main') || document.querySelector('main');
      const hero = document.querySelector('.hero');
      if (main) observer.observe(main);
      if (hero) observer.observe(hero);
    }

    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(updateNarrowState);
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    [50, 150, 350, 800, 1600, 3000].forEach((delay) => {
      setTimeout(updateNarrowState, delay);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
