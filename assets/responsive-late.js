(() => {
  'use strict';

  const STYLE_ID = 'matchal-responsive-final-late';
  let lastMode = '';

  function ensureLateStylesheet() {
    document.getElementById(STYLE_ID)?.remove();
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = `/assets/responsive-final.css?v=1`;
    document.head.appendChild(link);
  }

  function getWidths() {
    const viewportWidth = Math.round(
      window.visualViewport?.width ||
      document.documentElement.clientWidth ||
      window.innerWidth
    );

    const main = document.querySelector('.main') || document.querySelector('main');
    const mainWidth = main
      ? Math.round(main.getBoundingClientRect().width)
      : viewportWidth;

    return { viewportWidth, mainWidth };
  }

  function updateNarrowState() {
    const body = document.body;
    if (!body) return;

    const { viewportWidth, mainWidth } = getWidths();
    const extensionConnected = body.classList.contains('matchal-extension-connected');

    /*
      The original hero needs substantially more width than a normal two-column
      dashboard. Switch earlier so the upload card never becomes a thin column.
    */
    const narrow =
      viewportWidth <= 1480 ||
      mainWidth <= 1320 ||
      (extensionConnected && viewportWidth <= 1800);

    const veryNarrow =
      viewportWidth <= 900 ||
      mainWidth <= 860;

    body.classList.toggle('matchal-compact', narrow);
    body.classList.toggle('matchal-very-narrow', veryNarrow);
    body.dataset.layoutViewport = String(viewportWidth);
    body.dataset.layoutMain = String(mainWidth);

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
      }
    });

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(updateNarrowState);
      observer.observe(document.documentElement);
      const main = document.querySelector('.main') || document.querySelector('main');
      if (main) observer.observe(main);
    }

    /* The reconstructed app adds some sections after the first paint. */
    [50, 150, 350, 800, 1600].forEach((delay) => {
      setTimeout(updateNarrowState, delay);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
