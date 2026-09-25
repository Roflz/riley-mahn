'use strict';
// ================================================================
// map-renderer.js — Canvas 2D rendering engine for the world map
// Uses requestAnimationFrame game loop with layered biome rendering
// ================================================================

const MapRenderer = (() => {

  const WORLD_W  = 480;
  const WORLD_H  = 2100;
  const MARKER_R = 19;   // marker circle radius (world units)
  const HIT_R    = 30;   // touch target radius

  let _canvas    = null;
  let _ctx       = null;
  let _testCtx   = null; // identity-transform canvas for isPointInPath
  let _rafId     = null;
  let _dirty     = true;
  let _onHit     = null;
  let _startTime = Date.now();
  let _hitAreas  = [];   // populated each frame
  let _paths     = {};   // Path2D cache keyed by territory id
  let _boundCache = {};

  // ── Public API ─────────────────────────────────────────────────

  function init(canvasEl, onHit) {
    _canvas  = canvasEl;
    _onHit   = onHit;
    _ctx     = _canvas.getContext('2d');
    _testCtx = document.createElement('canvas').getContext('2d');

    _buildPaths();
    _applySize();
    window.addEventListener('resize', () => { _applySize(); _dirty = true; });

    _canvas.addEventListener('click',    _handleClick);
    _canvas.addEventListener('touchend', _handleTouch, { passive: true });

    _startLoop();
  }

  function markDirty() { _dirty = true; }

  function destroy() {
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    window.removeEventListener('resize', _applySize);
  }

  // ── Sizing ─────────────────────────────────────────────────────

  function _applySize() {
    if (!_canvas) return;
    const parent = _canvas.parentElement;
    // Walk up to find the first ancestor with a real measured width
    let cssW = parent ? parent.clientWidth : 0;
    if (!cssW) {
      // Screen may be hidden (display:none) — walk up the DOM
      let el = parent;
      while (el && !cssW) { cssW = el.clientWidth; el = el.parentElement; }
    }
    if (!cssW) cssW = Math.min(window.innerWidth, WORLD_W);
    cssW = Math.min(cssW, WORLD_W);
    if (cssW < 1) return; // still zero — RAF loop will retry
    const cssH = Math.round(cssW * WORLD_H / WORLD_W);
    _canvas.style.width  = cssW + 'px';
    _canvas.style.height = cssH + 'px';
    const dpr = window.devicePixelRatio || 1;
    _canvas.width  = Math.round(cssW * dpr);
    _canvas.height = Math.round(cssH * dpr);
    _boundCache = {};
  }

  function _scale() {
    return _canvas.width / WORLD_W;
  }

  // ── Path cache ─────────────────────────────────────────────────

  function _buildPaths() {
    _paths = {};
    if (typeof TERRITORY_DEFINITIONS === 'undefined') return;
    Object.values(TERRITORY_DEFINITIONS).forEach(t => {
      if (t.mapShape) _paths[t.id] = new Path2D(t.mapShape);
    });
  }

  // ── Game loop ──────────────────────────────────────────────────

  function _startLoop() {
    if (_rafId) return;
    const loop = () => {
      if (_dirty) { _dirty = false; _render(); }
      _rafId = requestAnimationFrame(loop);
    };
    _rafId = requestAnimationFrame(loop);
  }

  // ── Main render ────────────────────────────────────────────────

  function _render() {
    // If canvas was created while screen was hidden, size it now
    if (!_canvas.width || !_canvas.height) {
      _applySize();
      if (!_canvas.width || !_canvas.height) return; // still hidden — retry next frame
      _dirty = true;
    }
    const ctx = _ctx;
    const s   = _scale();
    ctx.clearRect(0, 0, _canvas.width, _canvas.height);
    ctx.save();
    ctx.scale(s, s);

    _hitAreas = [];

    _drawBackground(ctx);
    _drawTerrain(ctx);
    _drawObjects(ctx);
    _drawMarkers(ctx);
    _drawFog(ctx);
    _drawLabels(ctx);

    ctx.restore();
  }

  // ── Background ─────────────────────────────────────────────────

  function _drawBackground(ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    grad.addColorStop(0,   '#0d1c30');
    grad.addColorStop(0.3, '#091624');
    grad.addColorStop(0.7, '#060f1a');
    grad.addColorStop(1,   '#030810');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Subtle horizontal texture lines
    ctx.strokeStyle = 'rgba(30,55,80,0.07)';
    ctx.lineWidth   = 0.6;
    for (let y = 40; y < WORLD_H; y += 90) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke();
    }

    // Journey road
    ctx.save();
    ctx.strokeStyle = 'rgba(100, 80, 50, 0.16)';
    ctx.lineWidth   = 14;
    ctx.setLineDash([22, 16]);
    ctx.lineCap     = 'round';
    ctx.beginPath();
    ctx.moveTo(240, 80);
    ctx.bezierCurveTo(190, 340, 290, 600, 240, 750);
    ctx.bezierCurveTo(180, 900, 300, 1100, 240, 1350);
    ctx.bezierCurveTo(175, 1550, 305, 1750, 240, 1960);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // "WORLD OF THRONES" watermark
    ctx.fillStyle = 'rgba(180,158,100,0.12)';
    ctx.font      = '700 11px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('✦ WORLD OF THRONES ✦', WORLD_W / 2, 44);
  }

  // ── Terrain ────────────────────────────────────────────────────

  function _drawTerrain(ctx) {
    const territories = _orderedTerritories();
    territories.forEach(t => {
      const state = _terrState(t.id);
      if (state === 'undiscovered') return;
      const path  = _paths[t.id];
      if (!path) return;
      ctx.save();
      if (state === 'locked') ctx.globalAlpha = 0.55;
      _drawBiome(ctx, t, path, state === 'locked');
      ctx.restore();
    });
  }

  function _drawBiome(ctx, t, path, locked) {
    const biome = t.biomeType || 'field';
    const lbl   = t.mapLabel || { x: WORLD_W / 2, y: WORLD_H / 2 };
    const bound = _pathBound(t.id, t.mapShape, lbl);

    // --- fill clipped to territory shape ---
    ctx.save();
    ctx.clip(path);

    const bg = _biomeBg(biome, lbl, bound, locked);
    ctx.fillStyle = bg;
    ctx.fillRect(bound.minX - 10, bound.minY - 10, bound.w + 20, bound.h + 20);

    if (!locked) {
      _drawBiomeTexture(ctx, biome, t.id, bound);
      const decors = (typeof TERRAIN_DECORATIONS !== 'undefined' && TERRAIN_DECORATIONS[t.id]) || [];
      decors.forEach(d => _drawDecor(ctx, d));
    }

    ctx.restore();

    // --- border ---
    const B = BIOME_STYLES[biome] || BIOME_STYLES.field;
    ctx.strokeStyle = B.stroke;
    ctx.lineWidth   = locked ? 1.5 : 2.8;
    ctx.globalAlpha = locked ? 0.45 : 1;
    ctx.stroke(path);
    ctx.globalAlpha = 1;

    if (!locked) {
      ctx.save();
      ctx.shadowColor = B.stroke;
      ctx.shadowBlur  = 18;
      ctx.strokeStyle = B.stroke;
      ctx.lineWidth   = 1;
      ctx.globalAlpha = 0.3;
      ctx.stroke(path);
      ctx.restore();
    }
  }

  function _biomeBg(biome, lbl, bound, locked) {
    const cx = lbl.x, cy = lbl.y;
    const r  = Math.max(bound.w, bound.h) * 0.65;
    const g  = _ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.15, r * 0.05, cx, cy, r);
    const P  = _BIOME_PALETTES[biome] || _BIOME_PALETTES.field;
    if (locked) {
      g.addColorStop(0, P.lockC);
      g.addColorStop(1, P.lockE);
    } else {
      g.addColorStop(0, P.c);
      g.addColorStop(0.55, P.m);
      g.addColorStop(1, P.e);
    }
    return g;
  }

  const _BIOME_PALETTES = {
    field:     { c: '#507840', m: '#3c6030', e: '#2a4420', lockC: '#283820', lockE: '#162010' },
    hills:     { c: '#725040', m: '#5a3c2c', e: '#3c2818', lockC: '#302018', lockE: '#1c100a' },
    forest:    { c: '#285830', m: '#1e4424', e: '#142e18', lockC: '#142018', lockE: '#0c1410' },
    swamp:     { c: '#3a4828', m: '#2c3a1c', e: '#1c2810', lockC: '#181e10', lockE: '#0e1208' },
    darklands: { c: '#280e40', m: '#1a0828', e: '#0e0418', lockC: '#120820', lockE: '#08040e' },
    river:     { c: '#285078', m: '#1c3858', e: '#12283c', lockC: '#142030', lockE: '#0a1820' },
    mountains: { c: '#584858', m: '#423848', e: '#2c2830', lockC: '#221c28', lockE: '#161218' },
    ruins:     { c: '#503848', m: '#3c2c38', e: '#281e28', lockC: '#201828', lockE: '#14101a' },
  };

  function _drawBiomeTexture(ctx, biome, id, bound) {
    const rng = _rng(id + 'tex');
    switch (biome) {
      case 'field': {
        for (let i = 0; i < 70; i++) {
          const x = bound.minX + rng() * bound.w;
          const y = bound.minY + rng() * bound.h;
          const h = 3 + rng() * 5;
          ctx.fillStyle = `rgba(${50+rng()*35},${85+rng()*30},${30+rng()*20},${0.28+rng()*0.28})`;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y + h); ctx.lineTo(x + 2, y + h); ctx.fill();
        }
        break;
      }
      case 'hills': {
        for (let i = 0; i < 10; i++) {
          const x  = bound.minX + rng() * bound.w;
          const y  = bound.minY + rng() * bound.h;
          const rx = 22 + rng() * 45;
          const ry = 10 + rng() * 20;
          const g2 = ctx.createRadialGradient(x - rx * 0.25, y - ry * 0.35, 1, x, y, rx);
          g2.addColorStop(0, 'rgba(115,88,55,0.62)');
          g2.addColorStop(1, 'rgba(50,36,18,0)');
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'forest': {
        for (let i = 0; i < 28; i++) {
          const x  = bound.minX + rng() * bound.w;
          const y  = bound.minY + rng() * bound.h;
          const r  = 10 + rng() * 22;
          const g2 = ctx.createRadialGradient(x, y - r * 0.25, 1, x, y, r);
          g2.addColorStop(0, 'rgba(48,100,38,0.72)');
          g2.addColorStop(0.7, 'rgba(24,54,18,0.55)');
          g2.addColorStop(1, 'rgba(8,22,6,0)');
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'swamp': {
        for (let i = 0; i < 8; i++) {
          const x = bound.minX + rng() * bound.w;
          const y = bound.minY + rng() * bound.h;
          ctx.fillStyle = 'rgba(28,50,22,0.52)';
          ctx.beginPath(); ctx.ellipse(x, y, 30 + rng() * 28, 14 + rng() * 12, rng() * Math.PI, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case 'darklands': {
        for (let i = 0; i < 12; i++) {
          const x = bound.minX + rng() * bound.w;
          const y = bound.minY + rng() * bound.h;
          ctx.fillStyle = 'rgba(36,12,58,0.38)';
          ctx.beginPath(); ctx.arc(x, y, 8 + rng() * 18, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
    }
  }

  // ── Terrain decorations ────────────────────────────────────────

  function _drawDecor(ctx, d) {
    ctx.save();
    if (d.opacity != null) ctx.globalAlpha = d.opacity;

    switch (d.type) {

      case 'tree': {
        const s = d.s || 1;
        const TH = 11 * s, CR = 12 * s;
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.ellipse(d.x + 3, d.y + TH + 4, CR * 0.7, CR * 0.3, 0.3, 0, Math.PI * 2); ctx.fill();
        // Trunk
        ctx.fillStyle = '#3a2810';
        ctx.fillRect(d.x - 2.5 * s, d.y, 5 * s, TH);
        // Canopy — 3 layered triangles
        for (let L = 0; L < 3; L++) {
          const ly = d.y - L * 6 * s;
          const lr = (CR - L * 2 * s) * 1.1;
          ctx.fillStyle = L === 0 ? '#2e6024' : L === 1 ? '#387030' : '#42803c';
          ctx.beginPath();
          ctx.moveTo(d.x, ly - CR - L * 3 * s);
          ctx.lineTo(d.x - lr, ly);
          ctx.lineTo(d.x + lr, ly);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.5; ctx.stroke();
        }
        break;
      }

      case 'pond': {
        const rx = d.rx || 36, ry = d.ry || 22;
        const wg = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, rx);
        wg.addColorStop(0, 'rgba(45,110,175,0.88)');
        wg.addColorStop(0.55, 'rgba(30,78,128,0.78)');
        wg.addColorStop(1, 'rgba(14,40,72,0.60)');
        ctx.fillStyle = wg;
        ctx.beginPath(); ctx.ellipse(d.x, d.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(90,160,210,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
        // Animated shimmer
        const T = (Date.now() - _startTime) / 2200;
        for (let i = 0; i < 3; i++) {
          ctx.strokeStyle = `rgba(160,215,255,${0.15 + 0.1 * Math.sin(T + i * 1.5)})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.ellipse(d.x + i * rx * 0.15 - rx * 0.15, d.y + Math.sin(T + i) * ry * 0.18, rx * 0.22, ry * 0.07, 0, 0, Math.PI * 2); ctx.stroke();
        }
        _dirty = true;
        break;
      }

      case 'rock': {
        const s = d.s || 1, rx = 12 * s, ry = 8 * s;
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.ellipse(d.x + 2, d.y + ry + 2, rx * 0.8, ry * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        const rg = ctx.createRadialGradient(d.x - rx * 0.3, d.y - ry * 0.3, 1, d.x, d.y, rx);
        rg.addColorStop(0, '#959080'); rg.addColorStop(0.5, '#6a5a48'); rg.addColorStop(1, '#3c2e22');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.ellipse(d.x, d.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(185,165,135,0.32)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(d.x - rx * 0.2, d.y - ry * 0.3, rx * 0.3, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
        break;
      }

      case 'hill': {
        const s = d.s || 1, rx = 40 * s, ry = 20 * s;
        const hg = ctx.createRadialGradient(d.x - rx * 0.25, d.y - ry * 0.4, 2, d.x, d.y, rx);
        hg.addColorStop(0, 'rgba(105,82,55,0.68)');
        hg.addColorStop(0.65, 'rgba(68,52,32,0.50)');
        hg.addColorStop(1, 'rgba(38,28,14,0)');
        ctx.fillStyle = hg;
        ctx.beginPath(); ctx.ellipse(d.x, d.y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }

      case 'mine': {
        // Entrance arch
        ctx.fillStyle = 'rgba(0,0,0,0.72)';
        ctx.beginPath(); ctx.arc(d.x, d.y, 10, Math.PI, 0); ctx.lineTo(d.x + 10, d.y + 8); ctx.lineTo(d.x - 10, d.y + 8); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#5a3820'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(d.x - 10, d.y); ctx.lineTo(d.x - 10, d.y + 8);
        ctx.moveTo(d.x + 10, d.y); ctx.lineTo(d.x + 10, d.y + 8);
        ctx.moveTo(d.x - 10, d.y - 3); ctx.lineTo(d.x + 10, d.y - 3);
        ctx.stroke();
        break;
      }

      case 'river': {
        const len = d.len || 200;
        const rg = ctx.createLinearGradient(d.x, d.y - len / 2, d.x, d.y + len / 2);
        rg.addColorStop(0, 'rgba(42,95,148,0.52)'); rg.addColorStop(0.5, 'rgba(36,85,138,0.65)'); rg.addColorStop(1, 'rgba(30,72,120,0.52)');
        ctx.strokeStyle = rg; ctx.lineWidth = 18; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(d.x, d.y - len / 2); ctx.quadraticCurveTo(d.x + 28, d.y, d.x, d.y + len / 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(110,190,255,0.2)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.moveTo(d.x, d.y - len * 0.32); ctx.quadraticCurveTo(d.x + 12, d.y, d.x, d.y + len * 0.32); ctx.stroke();
        ctx.setLineDash([]);
        break;
      }

      case 'grass': {
        const r = 18 * (d.s || 1);
        ctx.fillStyle = 'rgba(65,108,48,0.2)';
        ctx.beginPath(); ctx.arc(d.x, d.y, r, 0, Math.PI * 2); ctx.fill();
        break;
      }

      case 'swamp': {
        ctx.fillStyle = 'rgba(48,68,36,0.42)';
        ctx.beginPath(); ctx.ellipse(d.x, d.y, 78 * (d.s || 1), 34 * (d.s || 1), 0, 0, Math.PI * 2); ctx.fill();
        break;
      }

      case 'dark': {
        const g2 = ctx.createRadialGradient(d.x, d.y, 5, d.x, d.y, 85 * (d.s || 1));
        g2.addColorStop(0, 'rgba(40,12,62,0.55)'); g2.addColorStop(1, 'rgba(10,4,18,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.ellipse(d.x, d.y, 85 * (d.s || 1), 38 * (d.s || 1), 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
    }

    ctx.restore();
  }

  // ── World objects (buildings & sites) ─────────────────────────

  function _drawObjects(ctx) {
    if (typeof TERRITORY_BUILD_SITE_DEFINITIONS === 'undefined') return;
    Object.values(TERRITORY_BUILD_SITE_DEFINITIONS).forEach(site => {
      if (!site.mapPosition) return;
      if (_terrState(site.territoryId) !== 'unlocked') return;
      const builtId = typeof getBuiltStructureIdAtSite === 'function' ? getBuiltStructureIdAtSite(site.id) : null;
      const job     = typeof getActiveBuildJobForSite  === 'function' ? getActiveBuildJobForSite(site.id)  : null;
      const { x, y } = site.mapPosition;
      if      (job)     _drawScaffolding(ctx, x, y);
      else if (builtId) _drawBuilding(ctx, x, y, builtId);
      else              _drawEmptySite(ctx, x, y, site);
    });
  }

  function _drawEmptySite(ctx, x, y, site) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 25, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(135,112,80,0.48)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
    ctx.strokeRect(x - 20, y - 2, 40, 22);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(110,90,62,0.55)';
    [[-20, -2], [18, -2], [-20, 18], [18, 18]].forEach(([dx, dy]) => ctx.fillRect(x + dx, y + dy, 4, 4));
  }

  function _drawScaffolding(ctx, x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(x + 2, y + 28, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a6230'; ctx.lineWidth = 2;
    ctx.strokeRect(x - 22, y - 10, 44, 36);
    ctx.beginPath();
    ctx.moveTo(x - 22, y - 10); ctx.lineTo(x + 22, y + 26);
    ctx.moveTo(x + 22, y - 10); ctx.lineTo(x - 22, y + 26);
    ctx.stroke();
    const pulse = 0.5 + 0.5 * Math.sin((Date.now() - _startTime) / 500);
    ctx.fillStyle = `rgba(212,163,50,${0.55 + pulse * 0.35})`;
    ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🔨', x, y + 10);
    _dirty = true;
  }

  function _drawBuilding(ctx, x, y, builtId) {
    const struct = typeof STRUCTURE_DEFINITIONS !== 'undefined' ? STRUCTURE_DEFINITIONS[builtId] : null;
    const icon   = struct?.icon || '🏠';
    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x + 3, y + 32, 28, 9, 0.2, 0, Math.PI * 2); ctx.fill();
    // Walls
    const wg = ctx.createLinearGradient(x - 24, y, x + 24, y);
    wg.addColorStop(0, '#503020'); wg.addColorStop(0.45, '#704030'); wg.addColorStop(1, '#3e2416');
    ctx.fillStyle = wg;
    ctx.fillRect(x - 24, y, 48, 28);
    // Stone texture on walls
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.6;
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.strokeRect(x - 24 + c * 16, y + r * 14, 16, 14);
      }
    }
    // Roof
    ctx.beginPath(); ctx.moveTo(x - 28, y); ctx.lineTo(x, y - 22); ctx.lineTo(x + 28, y); ctx.closePath();
    const rg = ctx.createLinearGradient(x, y - 22, x, y);
    rg.addColorStop(0, '#8a5038'); rg.addColorStop(1, '#623828');
    ctx.fillStyle = rg; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    // Icon
    ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y + 14);
    // Built badge
    ctx.fillStyle = 'rgba(50,175,95,0.92)';
    ctx.beginPath(); ctx.arc(x + 22, y - 6, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif';
    ctx.fillText('✓', x + 22, y - 5);
  }

  // ── Markers ────────────────────────────────────────────────────

  function _drawMarkers(ctx) {
    const territories = _orderedTerritories();
    territories.forEach(t => {
      if (_terrState(t.id) !== 'unlocked') return;
      getTerritoryMapNodes(t.id).forEach(n => { if (n.mapPosition) _drawResourceMarker(ctx, n); });
      getTerritoryMapBuildSites(t.id).forEach(s => { if (s.mapPosition) _drawBuildMarker(ctx, s); });
      getTerritoryMapBattles(t.id).forEach(b => { if (b.mapPosition) _drawBattleMarker(ctx, b); });
    });
  }

  function _drawResourceMarker(ctx, node) {
    const pos     = node.mapPosition;
    const unlocked = isTerritoryNodeUnlocked(node.id);
    const asgn    = typeof getActiveAssignmentForNode === 'function' ? getActiveAssignmentForNode(node.id) : null;
    const recent  = typeof MAP !== 'undefined' && MAP._isRecentCompletion ? MAP._isRecentCompletion(`node:${node.id}`) : false;
    const highlight = typeof MAP !== 'undefined' && MAP._isHighlighted ? MAP._isHighlighted(`node:${node.id}`) : false;

    const THEMES = {
      woodcutting: { bg: '#1e3c18', border: '#4e9030', glow: '#4e9030' },
      fishing:     { bg: '#0e2840', border: '#3c80a8', glow: '#3c80a8' },
      mining:      { bg: '#2c2218', border: '#8e6c3c', glow: '#8e6c3c' },
    };
    const theme = THEMES[node.skillType] || THEMES.woodcutting;

    _drawMarkerBase(ctx, pos.x, pos.y, {
      bg: unlocked ? theme.bg : '#181818',
      border: unlocked ? theme.border : '#3c3c3c',
      glow: unlocked ? theme.glow : null,
      icon: node.icon,
      label: node.displayName,
      locked: !unlocked,
      active: !!asgn,
      completed: recent,
      highlighted: highlight,
      progressPct: asgn ? _pct(asgn.startMs, asgn.endMs) : null,
      activityIcon: asgn ? (SKILL_ACTIVITY_ICONS?.[node.skillType] ?? null) : null,
      workerIcon:  asgn ? (CHARACTER_DEFINITIONS?.[asgn.charId]?.icon ?? null) : null,
    });
    _hitAreas.push({ type: 'resource', id: node.id, cx: pos.x, cy: pos.y, r: HIT_R, data: { unlocked } });
  }

  function _drawBuildMarker(ctx, site) {
    const pos    = site.mapPosition;
    const builtId = typeof getBuiltStructureIdAtSite === 'function' ? getBuiltStructureIdAtSite(site.id) : null;
    const built  = builtId ? STRUCTURE_DEFINITIONS?.[builtId] : null;
    const job    = typeof getActiveBuildJobForSite === 'function' ? getActiveBuildJobForSite(site.id) : null;
    const highlight = typeof MAP !== 'undefined' && MAP._isHighlighted ? MAP._isHighlighted(`site:${site.id}`) : false;

    _drawMarkerBase(ctx, pos.x, pos.y, {
      bg:     built ? '#2a2010' : '#201810',
      border: built ? '#caa230' : '#8a7050',
      glow:   built ? '#caa230' : null,
      icon:   job ? '🔨' : built ? built.icon : (site.emptyIcon || site.icon),
      label:  built ? built.displayName : site.displayName,
      active: !!job,
      completed: !!built,
      highlighted: highlight,
      progressPct: job ? _pct(job.startMs, job.endMs) : null,
      activityIcon: job ? '🔨' : null,
      workerIcon:  job ? (CHARACTER_DEFINITIONS?.[job.charId]?.icon ?? null) : null,
    });
    _hitAreas.push({ type: 'build', id: site.id, cx: pos.x, cy: pos.y, r: HIT_R, data: {} });
  }

  function _drawBattleMarker(ctx, battle) {
    const pos   = battle.mapPosition;
    const state = typeof Unlock !== 'undefined' ? Unlock.battleNodeState(battle.id) : 'available';
    const boss  = battle.isTerritoryBoss;

    const T = { bg: '#1c0c0c', border: '#c04040', glow: '#c04040', icon: '⚔️' };
    if (state === 'completed') { T.bg = '#0c2018'; T.border = '#3aaa5e'; T.glow = '#3aaa5e'; T.icon = '✓'; }
    else if (state === 'locked') { T.bg = '#181010'; T.border = '#4c2828'; T.glow = null; T.icon = '🔒'; }
    else if (boss) { T.bg = '#2a1808'; T.border = '#d4a332'; T.glow = '#d4a332'; T.icon = '👑'; }

    _drawMarkerBase(ctx, pos.x, pos.y, {
      bg: T.bg, border: T.border, glow: T.glow,
      icon: T.icon, label: battle.displayName,
      locked: state === 'locked',
      completed: state === 'completed',
      boss,
    });
    if (state !== 'locked') _hitAreas.push({ type: 'battle', id: null, cx: pos.x, cy: pos.y, r: HIT_R, data: { battleDef: battle } });
  }

  // ── Core marker draw ───────────────────────────────────────────

  function _drawMarkerBase(ctx, x, y, opts) {
    const { bg, border, glow, icon, label, locked, active, completed, boss, highlighted, progressPct, activityIcon, workerIcon } = opts;

    ctx.save();

    // Pulsing discover ring
    if (highlighted) {
      const pulse = 0.4 + 0.55 * Math.sin((Date.now() - _startTime) / 480);
      ctx.strokeStyle = `rgba(212,163,50,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, MARKER_R + 10 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
      _dirty = true;
    }

    // Boss dashed outer ring
    if (boss) {
      ctx.strokeStyle = 'rgba(212,163,50,0.7)'; ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.arc(x, y, MARKER_R + 6, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Progress arc
    if (progressPct != null && progressPct < 1) {
      const r2 = MARKER_R + 4;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y, r2, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#d4a332'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y, r2, -Math.PI / 2, -Math.PI / 2 + progressPct * Math.PI * 2); ctx.stroke();
      ctx.lineCap = 'butt';
    }

    // Glow
    if (glow && !locked) {
      ctx.shadowColor = glow;
      ctx.shadowBlur  = active ? 16 : (completed ? 10 : 8);
    }

    // Background circle with radial gradient
    const r = MARKER_R;
    const bgG = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, 1, x, y, r);
    bgG.addColorStop(0, _lighten(bg, 45));
    bgG.addColorStop(0.55, bg);
    bgG.addColorStop(1, _darken(bg, 30));
    ctx.fillStyle = locked ? '#181818' : bgG;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

    ctx.shadowBlur = 0;

    // Completion green tint
    if (completed && !active) {
      ctx.fillStyle = 'rgba(58,170,94,0.18)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }

    // Border
    ctx.strokeStyle = locked ? '#363636' : border;
    ctx.lineWidth   = locked ? 1 : (active ? 2.8 : 2);
    ctx.globalAlpha = locked ? 0.5 : 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Icon
    ctx.font = `${Math.round(r * 0.9)}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha  = locked ? 0.38 : 1;
    ctx.fillText(icon, x, y + 1);
    ctx.globalAlpha  = 1;

    // Activity badge (top-right)
    if (activityIcon) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.beginPath(); ctx.arc(x + r - 1, y - r + 1, 8, 0, Math.PI * 2); ctx.fill();
      ctx.font = '10px serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillText(activityIcon, x + r - 1, y - r + 2);
    }

    // Worker badge (top-left)
    if (workerIcon) {
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.beginPath(); ctx.arc(x - r + 1, y - r + 1, 8, 0, Math.PI * 2); ctx.fill();
      ctx.font = '10px serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillText(workerIcon, x - r + 1, y - r + 2);
    }

    // Label
    if (label) {
      ctx.shadowBlur   = 5;
      ctx.shadowColor  = 'rgba(0,0,0,0.95)';
      ctx.fillStyle    = locked ? 'rgba(110,100,90,0.55)'
        : active ? '#d4a332' : completed ? '#3aaa5e' : 'rgba(222,212,192,0.85)';
      ctx.font         = `600 7px Georgia, serif`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      const sl = label.length > 13 ? label.slice(0, 11) + '…' : label;
      ctx.fillText(sl.toUpperCase(), x, y + r + 4);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // ── Fog of war ─────────────────────────────────────────────────

  function _drawFog(ctx) {
    _orderedTerritories().forEach(t => {
      const path = _paths[t.id];
      if (!path) return;
      const state = _terrState(t.id);
      const lbl   = t.mapLabel || { x: WORLD_W / 2, y: 500 };
      const bound = _pathBound(t.id, t.mapShape, lbl);

      if (state === 'undiscovered') {
        ctx.save();
        ctx.clip(path);

        // Deep fog fill
        const fg = ctx.createRadialGradient(lbl.x, lbl.y, 12, lbl.x, lbl.y, 210);
        fg.addColorStop(0, 'rgba(8,16,28,0.93)'); fg.addColorStop(0.6, 'rgba(5,10,18,0.97)'); fg.addColorStop(1, 'rgba(2,4,8,0.99)');
        ctx.fillStyle = fg;
        ctx.fillRect(bound.minX - 10, bound.minY - 10, bound.w + 20, bound.h + 20);

        // Animated cloud wisps
        const rng = _rng(t.id + 'fog');
        const T   = (Date.now() - _startTime) / 5000;
        for (let i = 0; i < 9; i++) {
          const cx   = lbl.x - 90 + rng() * 180;
          const cy   = lbl.y - 70 + rng() * 140;
          const rx   = 32 + rng() * 55;
          const ry   = 16 + rng() * 28;
          const drift = Math.sin(T + i * 0.9) * 8;
          ctx.fillStyle = 'rgba(18,32,55,0.48)';
          ctx.beginPath(); ctx.ellipse(cx + drift, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
        }
        _dirty = true;
        ctx.restore();

        ctx.strokeStyle = 'rgba(45,65,95,0.38)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
        ctx.stroke(path); ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(135,150,175,0.52)';
        ctx.font = '700 9px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowBlur = 10; ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.fillText('UNKNOWN LANDS', lbl.x, lbl.y - 10);
        ctx.font = '16px serif'; ctx.fillText('☁️', lbl.x, lbl.y + 14);
        ctx.shadowBlur = 0;

      } else if (state === 'locked') {
        ctx.save();
        ctx.clip(path);
        ctx.fillStyle = 'rgba(2,6,14,0.55)';
        ctx.fillRect(bound.minX - 10, bound.minY - 10, bound.w + 20, bound.h + 20);
        ctx.restore();

        ctx.save();
        ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(0,0,0,0.95)';
        ctx.fillStyle = 'rgba(185,158,98,0.68)';
        ctx.font = '700 12px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('LOCKED', lbl.x, lbl.y + 18);
        ctx.restore();
      }
    });
  }

  // ── Labels ─────────────────────────────────────────────────────

  function _drawLabels(ctx) {
    _orderedTerritories().forEach(t => {
      const state = _terrState(t.id);
      if (state === 'undiscovered') return;
      const lbl      = t.mapLabel || { x: 0, y: 0 };
      const unlocked = state === 'unlocked';

      ctx.save();
      ctx.shadowBlur  = 14; ctx.shadowColor = 'rgba(0,0,0,0.98)';
      ctx.fillStyle   = unlocked ? 'rgba(240,228,205,0.92)' : 'rgba(160,145,118,0.52)';
      ctx.font        = `700 ${unlocked ? 11 : 9}px Georgia, serif`;
      ctx.textAlign   = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.displayName.toUpperCase(), lbl.x, lbl.y);

      if (unlocked) {
        const lvl = typeof getTerritoryUpgradeLevel === 'function' ? getTerritoryUpgradeLevel(t.id) : 1;
        ctx.fillStyle = 'rgba(175,155,98,0.62)';
        ctx.font = '400 7.5px Georgia, serif';
        ctx.fillText(`${t.icon}  Lv.${lvl}`, lbl.x, lbl.y + 16);
      }
      ctx.shadowBlur = 0;
      ctx.restore();

      // Territory hit area
      if (_paths[t.id]) _hitAreas.push({ type: 'territory', id: t.id, cx: lbl.x, cy: lbl.y, r: null, data: { state } });
    });
  }

  // ── Hit testing ────────────────────────────────────────────────

  function _handleClick(e) {
    const pt = _toWorld(e.clientX, e.clientY);
    _doHit(pt.x, pt.y);
  }

  function _handleTouch(e) {
    if (!e.changedTouches.length) return;
    const t  = e.changedTouches[0];
    const pt = _toWorld(t.clientX, t.clientY);
    _doHit(pt.x, pt.y);
  }

  function _doHit(wx, wy) {
    if (!_onHit) return;
    // Markers first (highest priority, circular)
    for (let i = _hitAreas.length - 1; i >= 0; i--) {
      const h = _hitAreas[i];
      if (h.r == null) continue;
      const dx = wx - h.cx, dy = wy - h.cy;
      if (dx * dx + dy * dy <= h.r * h.r) { _onHit(h.type, h.id, h.data); return; }
    }
    // Territory path test
    for (let i = _hitAreas.length - 1; i >= 0; i--) {
      const h = _hitAreas[i];
      if (h.r != null) continue;
      const path = _paths[h.id];
      if (path && _testCtx.isPointInPath(path, wx, wy)) { _onHit('territory', h.id, h.data); return; }
    }
  }

  function _toWorld(screenX, screenY) {
    const rect = _canvas.getBoundingClientRect();
    return {
      x: (screenX - rect.left) * (WORLD_W / rect.width),
      y: (screenY - rect.top)  * (WORLD_H / rect.height),
    };
  }

  // ── Helpers ────────────────────────────────────────────────────

  function _terrState(id) {
    return typeof getTerritoryMapState === 'function' ? getTerritoryMapState(id) : 'unlocked';
  }

  function _orderedTerritories() {
    if (typeof getTerritoriesInMapOrder === 'function') return getTerritoriesInMapOrder();
    return typeof TERRITORY_DEFINITIONS !== 'undefined' ? Object.values(TERRITORY_DEFINITIONS) : [];
  }

  function _pct(start, end, now = Date.now()) {
    return Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start)));
  }

  /** Simple seeded PRNG (xorshift32) — deterministic per seed string. */
  function _rng(seed) {
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 0xffffffff; };
  }

  /** Approximate bounding box by scanning path coordinates. */
  function _pathBound(id, pathStr, lbl) {
    if (_boundCache[id]) return _boundCache[id];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    if (pathStr) {
      const nums = pathStr.match(/[-\d.]+/g);
      if (nums) {
        for (let i = 0; i < nums.length - 1; i += 2) {
          const x = parseFloat(nums[i]), y = parseFloat(nums[i + 1]);
          if (!isNaN(x) && !isNaN(y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
      }
    }
    if (!isFinite(minX)) { const cx = lbl?.x ?? 240, cy = lbl?.y ?? 400; minX = cx - 180; maxX = cx + 180; minY = cy - 170; maxY = cy + 170; }
    const bb = { minX: minX - 5, maxX: maxX + 5, minY: minY - 5, maxY: maxY + 5, w: maxX - minX + 10, h: maxY - minY + 10 };
    return _boundCache[id] = bb;
  }

  function _lighten(hex, a) {
    try { const r = parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `rgb(${Math.min(255,r+a)},${Math.min(255,g+a)},${Math.min(255,b+a)})`; } catch { return hex; }
  }
  function _darken(hex, a) {
    try { const r = parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `rgb(${Math.max(0,r-a)},${Math.max(0,g-a)},${Math.max(0,b-a)})`; } catch { return hex; }
  }

  return { init, markDirty, resize: () => { _applySize(); _dirty = true; }, destroy };
})();
