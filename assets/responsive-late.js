(() => {
  'use strict';

  const STYLE_ID = 'matchal-responsive-shell-late';

  function ensureLateStylesheet() {
    document.getElementById(STYLE_ID)?.remove();
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = `/assets/responsive-shell.css?v=4`;
    document.head.appendChild(link);
  }

  function updateNarrowState() {
    const body = document.body;
    if (!body) return;

    const viewportWidth = Math.round(
      window.visualViewport?.width ||
      document.documentElement.clientWidth ||
      window.innerWidth
    );

    const main = document.querySelector('.main') || document.querySelector('main');
    const mainWidth = main
      ? Math.round(main.getBoundingClientRect().width)
      : viewportWidth;

    const narrow = viewportWidth <= 1320 || mainWidth <= 1120;
    const veryNarrow = viewportWidth <= 820 || mainWidth <= 760;

    body.classList.toggle('matchal-compact', narrow);
    body.classList.toggle('matchal-very-narrow', veryNarrow);
  }

  function boot() {
    ensureLateStylesheet();
    updateNarrowState();

    window.addEventListener('resize', updateNarrowState, { passive: true });
    window.visualViewport?.addEventListener('resize', updateNarrowState, { passive: true });

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(updateNarrowState);
      observer.observe(document.documentElement);
      const main = document.querySelector('.main') || document.querySelector('main');
      if (main) observer.observe(main);
    }

    setTimeout(updateNarrowState, 100);
    setTimeout(updateNarrowState, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
