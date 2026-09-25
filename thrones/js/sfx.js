'use strict';
// =============================================================
// sfx.js — Procedural sound effects via Web Audio API
// No audio files required — all sounds are synthesised in-browser.
// Browsers require a user gesture before audio plays; the AudioContext
// is lazily created on first call and resumed automatically.
// =============================================================

const SFX = (() => {
  let _ctx = null;
  const MUSIC_KEY = 'of_thrones_music';
  let _musicOn     = localStorage.getItem(MUSIC_KEY) !== 'false';
  let _musicNodes  = null;

  // ── Lazy AudioContext initialisation ──────────────────────────
  function _getCtx() {
    if (!_ctx) {
      try {
        _ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (_) {
        return null;
      }
    }
    if (_ctx.state === 'suspended') _ctx.resume().catch(() => {});
    return _ctx;
  }

  // ── Low-level helpers ─────────────────────────────────────────
  // Play a simple oscillator burst.
  // type: 'sine'|'square'|'sawtooth'|'triangle'
  function _tone(freq, duration, type = 'sine', gainPeak = 0.18, decay = duration * 0.8) {
    const ctx = _getCtx();
    if (!ctx) return;
    const now  = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type      = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  // Two-tone chord
  function _chord(f1, f2, duration, type = 'sine', gain = 0.14) {
    _tone(f1, duration, type, gain);
    _tone(f2, duration, type, gain);
  }

  // Frequency sweep (for whoosh / power-up effects)
  function _sweep(freqStart, freqEnd, duration, type = 'sine', gain = 0.15) {
    const ctx = _getCtx();
    if (!ctx) return;
    const now  = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const g    = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration * 0.8);

    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  // Noise burst (for impact / hit)
  function _noise(duration, gain = 0.12) {
    const ctx = _getCtx();
    if (!ctx) return;
    const buf    = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    const g    = ctx.createGain();
    const filt = ctx.createBiquadFilter();

    filt.type            = 'highpass';
    filt.frequency.value = 800;

    src.buffer = buf;
    const now  = ctx.currentTime;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration);
  }

  // ── Public sound events ───────────────────────────────────────

  // Short melee thud
  function attack() {
    _noise(0.08, 0.16);
    _tone(120, 0.12, 'triangle', 0.14);
  }

  // Sword heavy-hit crack
  function heavyAttack() {
    _noise(0.14, 0.22);
    _tone(80, 0.2, 'sawtooth', 0.12);
    _sweep(220, 110, 0.2, 'triangle', 0.1);
  }

  // Magic fire bolt whoosh
  function magic() {
    _sweep(400, 900, 0.18, 'sine', 0.14);
    _sweep(600, 1200, 0.22, 'sine', 0.10);
    _tone(800, 0.12, 'triangle', 0.08);
  }

  // Ranged shot zip
  function ranged() {
    _sweep(600, 300, 0.12, 'sawtooth', 0.12);
    _tone(250, 0.08, 'triangle', 0.08);
  }

  // Shield buff / protect
  function buff() {
    _tone(440, 0.18, 'sine', 0.14);
    _tone(660, 0.22, 'sine', 0.10);
  }

  // Healing light chime
  function heal() {
    _tone(523, 0.15, 'sine', 0.14);
    _tone(659, 0.18, 'sine', 0.12);
    _tone(784, 0.22, 'sine', 0.10);
  }

  // Enemy takes a hit
  function enemyHit() {
    _noise(0.07, 0.12);
    _tone(160, 0.09, 'sawtooth', 0.10);
  }

  // Unit defeated
  function unitDown() {
    _sweep(300, 100, 0.3, 'triangle', 0.14);
    _tone(100, 0.3, 'sine', 0.10);
  }

  // Skill level-up chime
  function levelUp() {
    const ctx = _getCtx();
    if (!ctx) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => _tone(freq, 0.18, 'sine', 0.16, 0.18), i * 80);
    });
  }

  // Victory fanfare
  function victory() {
    const seq = [
      { f: 523, t: 0   },
      { f: 659, t: 120 },
      { f: 784, t: 240 },
      { f: 659, t: 360 },
      { f: 1047,t: 480 },
    ];
    seq.forEach(({ f, t }) => setTimeout(() => _tone(f, 0.25, 'sine', 0.18), t));
  }

  // Defeat low drone
  function defeat() {
    _sweep(280, 100, 0.6, 'sine', 0.14);
    setTimeout(() => _sweep(200, 80, 0.5, 'triangle', 0.10), 200);
  }

  // UI click tick
  function uiClick() {
    _tone(880, 0.06, 'sine', 0.08, 0.06);
  }

  // Item drop chime
  function itemDrop() {
    _tone(659, 0.12, 'sine', 0.14);
    setTimeout(() => _tone(880, 0.15, 'sine', 0.12), 100);
  }

  // Unlock fanfare
  function unlock() {
    _tone(440, 0.15, 'sine', 0.14);
    setTimeout(() => _tone(554, 0.15, 'sine', 0.14), 100);
    setTimeout(() => _tone(659, 0.20, 'sine', 0.16), 200);
  }

  function isMusicEnabled() { return _musicOn; }

  function setMusicEnabled(on) {
    _musicOn = !!on;
    localStorage.setItem(MUSIC_KEY, _musicOn ? 'true' : 'false');
    if (_musicOn) _startMusic(); else _stopMusic();
  }

  function _stopMusic() {
    if (!_musicNodes) return;
    _musicNodes.forEach(n => { try { n.stop(); n.disconnect(); } catch (_) {} });
    _musicNodes = null;
  }

  function _startMusic() {
    if (!_musicOn) return;
    const ctx = _getCtx();
    if (!ctx) return;
    _stopMusic();

    const now  = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.04, now);
    gain.connect(ctx.destination);

    const freqs = [110, 164.81, 220];
    _musicNodes = freqs.map((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.33 - i * 0.08, now);
      osc.connect(g);
      g.connect(gain);
      osc.start(now);
      return osc;
    });
  }

  function startMusicIfEnabled() {
    if (_musicOn) _startMusic();
  }

  return {
    attack,
    heavyAttack,
    magic,
    ranged,
    buff,
    heal,
    enemyHit,
    unitDown,
    levelUp,
    victory,
    defeat,
    uiClick,
    itemDrop,
    unlock,
    isMusicEnabled,
    setMusicEnabled,
    startMusicIfEnabled,
  };
})();
