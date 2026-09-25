'use strict';
// =============================================================
// splash.js — Opening splash / loading screen
// =============================================================

const SPLASH = (() => {
  const MIN_DURATION_MS = 2500;
  const FADE_MS           = 450;

  let _rafId        = null;
  let _loadComplete = false;
  let _startedAt    = 0;

  function _el(id) {
    return document.getElementById(id);
  }

  function show() {
    const screen = _el('screen-splash');
    if (!screen) return;

    _loadComplete = false;
    _startedAt    = performance.now();

    const fill = _el('splash-progress-fill');
    if (fill) fill.style.width = '0%';

    screen.classList.remove('splash-exiting');
    if (typeof UI !== 'undefined' && UI.showScreen) {
      UI.showScreen('screen-splash');
    } else {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      screen.classList.add('active');
    }

    _startProgressLoop();
  }

  function _startProgressLoop() {
    if (_rafId) cancelAnimationFrame(_rafId);

    const fill = _el('splash-progress-fill');
    if (!fill) return;

    const tick = () => {
      const elapsed = performance.now() - _startedAt;
      const t       = Math.min(1, elapsed / MIN_DURATION_MS);
      const eased   = 1 - Math.pow(1 - t, 2.2);
      const pct     = (_loadComplete ? 1 : eased * 0.92) * 100;
      fill.style.width = `${pct}%`;

      if (!_loadComplete || pct < 100) {
        _rafId = requestAnimationFrame(tick);
      }
    };

    _rafId = requestAnimationFrame(tick);
  }

  function signalReady() {
    _loadComplete = true;
    const fill = _el('splash-progress-fill');
    if (fill) fill.style.width = '100%';
  }

  function _wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function finish() {
    const elapsed   = performance.now() - _startedAt;
    const remaining = Math.max(0, MIN_DURATION_MS - elapsed);
    await _wait(remaining);

    const screen = _el('screen-splash');
    if (screen) screen.classList.add('splash-exiting');
    await _wait(FADE_MS);

    if (_rafId) {
      cancelAnimationFrame(_rafId);
      _rafId = null;
    }

    screen?.classList.remove('active', 'splash-exiting');
  }

  /**
   * Run boot work, keep splash visible for at least MIN_DURATION_MS, then resolve.
   * @param {() => void} bootFn
   */
  async function runBoot(bootFn) {
    show();
    try {
      bootFn();
    } catch (e) {
      console.error('[splash] boot failed:', e);
    } finally {
      signalReady();
    }
    await finish();
  }

  return { show, signalReady, finish, runBoot };
})();
