'use strict';
// ================================================================
// world-engine.js — Three.js terrain + optional Pixi marker overlay
// ================================================================

const WorldEngine = (() => {

  const HIT_R = WorldTokens.marker.radiusWorld;

  let _canvas = null;
  let _pixiApp = null;
  let _pixiWorld = null;
  let _layers = {};
  let _onHit = null;
  let _hitAreas = [];
  let _ready = false;
  let _hasValidLayout = false;
  let _resizeObs = null;
  let _container = null;
  let _rafId = 0;

  // ── Public API ─────────────────────────────────────────────────

  async function init(container, onHit) {
    if (!container) throw new Error('WorldEngine: missing container');
    _onHit = onHit;

    IsoCamera.configure(ISO_MAP_CONFIG);
    _container = container;

    const initW = container.clientWidth  > 8 ? container.clientWidth  : (window.innerWidth  || 800);
    const initH = container.clientHeight > 8 ? container.clientHeight : (window.innerHeight || 600);

    _canvas = ThreeTerrain.init(container, initW, initH);
    ThreeProps.init(ThreeTerrain.getScene(), ThreeTerrain.getPropsGroup());
    ThreeProps.scatter(WORLD_PROP_SCATTER);

    if (ISO_MAP_CONFIG.showMapMarkers) {
      await _initPixiOverlay(initW, initH);
    }

    _resizeCamera();
    _rebuildDynamic();

    MapInputManager.attach(_canvas, _handleTap, _onCameraInput);
    window.addEventListener('resize', _onResize);

    if (typeof ResizeObserver !== 'undefined') {
      _resizeObs = new ResizeObserver(() => _syncLayout({ refocus: false }));
      _resizeObs.observe(container);
    }

    _startLoop();
    _syncLayout({ refocus: true });
  }

  async function _initPixiOverlay(w, h) {
    if (typeof PIXI === 'undefined') return;
    const overlay = document.createElement('div');
    overlay.id = 'world-map-overlay';
    overlay.className = 'world-map-overlay';
    _container.appendChild(overlay);

    _pixiApp = new PIXI.Application();
    await _pixiApp.init({
      width: w,
      height: h,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    overlay.appendChild(_pixiApp.canvas);

    _pixiWorld = new PIXI.Container();
    _pixiApp.stage.addChild(_pixiWorld);

    _layers.objects = new PIXI.Container();
    _layers.markers = new PIXI.Container();
    _layers.fog     = new PIXI.Container();
    _layers.labels  = new PIXI.Container();
    [_layers.objects, _layers.markers, _layers.fog, _layers.labels]
      .forEach(l => _pixiWorld.addChild(l));
  }

  function destroy() {
    cancelAnimationFrame(_rafId);
    MapInputManager.detach();
    window.removeEventListener('resize', _onResize);
    _resizeObs?.disconnect();
    _resizeObs = null;
    _container = null;
    if (_pixiApp) { _pixiApp.destroy(true); _pixiApp = null; }
    _pixiWorld = null;
    ThreeProps.dispose();
    ThreeTerrain.dispose();
    ProceduralTiles.clearCache();
    _canvas = null;
    _ready = false;
    _hasValidLayout = false;
  }

  function markDirty() { _requestRedraw(); }

  function rebuildAll() {
    if (!_ready) return;
    ThreeTerrain.buildWorld();
    ThreeProps.scatter(WORLD_PROP_SCATTER);
    _rebuildDynamic();
    _applyCamera();
  }

  function resize() {
    _syncLayout({ refocus: false });
  }

  function onMapVisible() {
    requestAnimationFrame(() => {
      _syncLayout({ refocus: true });
      requestAnimationFrame(() => _syncLayout({ refocus: true }));
    });
  }

  function focusTerritory(id) {
    IsoCamera.focusStartAnchor();
    _applyCamera();
    _requestRedraw();
  }

  function focusStart() {
    IsoCamera.focusStartAnchor();
    _applyCamera();
  }

  function entityToScreen(mapPosition, worldOffsetY = 0) {
    if (!_canvas || !mapPosition) return null;
    const px = mapPosition.tx != null
      ? IsoMath.tileToPixel(mapPosition.tx, mapPosition.ty)
      : { x: mapPosition.x, y: mapPosition.y };
    const s = IsoCamera.worldToScreen(px.x, px.y + worldOffsetY);
    const r = _canvas.getBoundingClientRect();
    return { x: r.left + s.x, y: r.top + s.y };
  }

  // ── Dynamic layers (Pixi overlay when markers enabled) ───────

  function _rebuildDynamic() {
    _hitAreas = [];
    if (!ISO_MAP_CONFIG.showMapMarkers || !_pixiApp) return;

    _layers.objects.removeChildren();
    _layers.markers.removeChildren();
    _layers.fog.removeChildren();
    _layers.labels.removeChildren();

    _drawFog();
    _drawObjects();
    _drawMarkers();
    _drawLabels();

    [_layers.objects, _layers.markers, _layers.fog, _layers.labels].forEach(l => {
      l.sortableChildren = true;
      l.sortChildren();
    });
  }

  function _drawFog() {
    const tw = ISO_MAP_CONFIG.tileWidth;
    const th = ISO_MAP_CONFIG.tileHeight;
    const hw = tw / 2;
    const hh = th / 2;

    getTerritoriesInMapOrder().forEach(t => {
      const state = getTerritoryMapState(t.id);
      if (state === 'unlocked') return;
      const region = t.isoRegion;
      if (!region) return;
      const tok = state === 'undiscovered' ? WorldTokens.fog.undiscovered : WorldTokens.fog.locked;
      const depth = WorldTokens.biomes[t.biomeType]?.tileDepth || 6;

      for (let dy = 0; dy < region.h; dy++) {
        for (let dx = 0; dx < region.w; dx++) {
          const tx = region.tx + dx;
          const ty = region.ty + dy;
          const p = IsoMath.tileToPixel(tx, ty);
          const g = new PIXI.Graphics();
          const sideA = _shadeFog(tok.color, -18);
          const sideB = _shadeFog(tok.color, -28);
          g.poly([tw, hh, hw, th, hw, th + depth, tw, hh + depth], true);
          g.fill({ color: sideB, alpha: tok.alpha });
          g.poly([0, hh, hw, th, hw, th + depth, 0, hh + depth], true);
          g.fill({ color: sideA, alpha: tok.alpha });
          g.poly([hw, 0, tw, hh, hw, th, 0, hh], true);
          g.fill({ color: tok.color, alpha: tok.alpha });
          g.position.set(p.x - tw / 2, p.y);
          g.zIndex = IsoMath.depthKey(tx, ty) + 100;
          _layers.fog.addChild(g);
        }
      }
    });
  }

  function _shadeFog(color, amount) {
    const r = Math.min(255, Math.max(0, ((color >> 16) & 0xff) + amount));
    const g = Math.min(255, Math.max(0, ((color >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (color & 0xff) + amount));
    return (r << 16) | (g << 8) | b;
  }

  function _drawObjects() {
    if (typeof TERRITORY_BUILD_SITE_DEFINITIONS === 'undefined') return;
    Object.values(TERRITORY_BUILD_SITE_DEFINITIONS).forEach(site => {
      if (!site.mapPosition) return;
      if (getTerritoryMapState(site.territoryId) !== 'unlocked') return;
      const builtId = typeof getBuiltStructureIdAtSite === 'function' ? getBuiltStructureIdAtSite(site.id) : null;
      const job = typeof getActiveBuildJobForSite === 'function' ? getActiveBuildJobForSite(site.id) : null;
      const px = IsoMath.positionToPixel(site.mapPosition);
      if (job) _drawScaffolding(px);
      else if (builtId) _drawBuilding(px, builtId);
      else _drawEmptySite(px);
    });
  }

  function _drawEmptySite(px) {
    const g = new PIXI.Graphics();
    g.ellipse(2, 18, 20, 6);
    g.fill({ color: 0x000000, alpha: 0.22 });
    g.rect(-18, -2, 36, 20);
    g.stroke({ width: 1.5, color: 0x877050, alpha: 0.5 });
    g.position.set(px.x, px.y);
    g.zIndex = _depthAt(px) + 1;
    _layers.objects.addChild(g);
  }

  function _drawScaffolding(px) {
    const g = new PIXI.Graphics();
    g.ellipse(2, 20, 22, 6);
    g.fill({ color: 0x000000, alpha: 0.25 });
    g.rect(-20, -8, 40, 32);
    g.stroke({ width: 2, color: 0x8a6230 });
    g.position.set(px.x, px.y);
    g.zIndex = _depthAt(px) + 1;
    _layers.objects.addChild(g);
  }

  function _drawBuilding(px, builtId) {
    const struct = typeof STRUCTURE_DEFINITIONS !== 'undefined' ? STRUCTURE_DEFINITIONS[builtId] : null;
    const g = new PIXI.Graphics();
    g.ellipse(3, 24, 24, 7);
    g.fill({ color: 0x000000, alpha: 0.28 });
    g.rect(-20, 0, 40, 24);
    g.fill({ color: 0x604030 });
    g.poly([-22, 0, 0, -18, 22, 0], true);
    g.fill({ color: 0x7a4830 });
    g.position.set(px.x, px.y);
    g.zIndex = _depthAt(px) + 1;
    _layers.objects.addChild(g);

    const icon = new PIXI.Text({
      text: struct?.icon || '🏠',
      style: { fontSize: 18, fill: 0xffffff },
    });
    icon.anchor.set(0.5);
    icon.position.set(px.x, px.y + 12);
    icon.zIndex = _depthAt(px) + 2;
    _layers.objects.addChild(icon);
  }

  function _drawMarkers() {
    const items = [];

    getTerritoriesInMapOrder().forEach(t => {
      const state = getTerritoryMapState(t.id);
      if (state === 'undiscovered') return;

      getTerritoryMapNodes(t.id).forEach(n => {
        if (!n.mapPosition) return;
        const px = IsoMath.positionToPixel(n.mapPosition);
        items.push({ z: IsoMath.depthKey(n.mapPosition.tx, n.mapPosition.ty), fn: () => _drawResourceMarker(n, px, state) });
      });
      getTerritoryMapBuildSites(t.id).forEach(s => {
        if (!s.mapPosition) return;
        const px = IsoMath.positionToPixel(s.mapPosition);
        items.push({ z: IsoMath.depthKey(s.mapPosition.tx, s.mapPosition.ty), fn: () => _drawBuildMarker(s, px) });
      });
      if (state === 'unlocked') {
        getTerritoryMapBattles(t.id).forEach(b => {
          if (!b.mapPosition) return;
          const px = IsoMath.positionToPixel(b.mapPosition);
          items.push({ z: IsoMath.depthKey(b.mapPosition.tx, b.mapPosition.ty), fn: () => _drawBattleMarker(b, px) });
        });
      }
    });

    items.sort((a, b) => a.z - b.z);
    items.forEach(i => i.fn());
  }

  function _drawResourceMarker(node, px, terrState) {
    const unlocked = terrState === 'unlocked' && isTerritoryNodeUnlocked(node.id);
    const asgn = typeof getActiveAssignmentForNode === 'function' ? getActiveAssignmentForNode(node.id) : null;
    const recent = typeof MAP !== 'undefined' && MAP._isRecentCompletion?.(`node:${node.id}`);
    const highlight = typeof MAP !== 'undefined' && MAP._isHighlighted?.(`node:${node.id}`);
    const theme = WorldTokens.marker.themes[node.skillType] || WorldTokens.marker.themes.woodcutting;

    _drawMarkerDisc(px, {
      bg: unlocked ? theme.bg : 0x181818,
      border: unlocked ? theme.border : 0x3c3c3c,
      glow: unlocked ? theme.glow : null,
      icon: node.icon,
      locked: !unlocked,
      active: !!asgn,
      completed: recent,
      highlighted: highlight,
      progressPct: asgn ? _pct(asgn.startMs, asgn.endMs) : null,
    });
    _hitAreas.push({ type: 'resource', id: node.id, cx: px.x, cy: px.y, r: HIT_R, data: { unlocked } });
  }

  function _drawBuildMarker(site, px) {
    const builtId = typeof getBuiltStructureIdAtSite === 'function' ? getBuiltStructureIdAtSite(site.id) : null;
    const built = builtId ? STRUCTURE_DEFINITIONS?.[builtId] : null;
    const job = typeof getActiveBuildJobForSite === 'function' ? getActiveBuildJobForSite(site.id) : null;
    const highlight = typeof MAP !== 'undefined' && MAP._isHighlighted?.(`site:${site.id}`);
    const theme = WorldTokens.marker.themes.build;

    _drawMarkerDisc(px, {
      bg: built ? 0x2a2010 : theme.bg,
      border: built ? 0xcaa230 : theme.border,
      glow: built ? 0xcaa230 : null,
      icon: job ? '🔨' : built ? built.icon : (site.emptyIcon || site.icon),
      active: !!job,
      completed: !!built,
      highlighted: highlight,
      progressPct: job ? _pct(job.startMs, job.endMs) : null,
    });
    _hitAreas.push({ type: 'build', id: site.id, cx: px.x, cy: px.y, r: HIT_R, data: {} });
  }

  function _drawBattleMarker(battle, px) {
    const state = typeof Unlock !== 'undefined' ? Unlock.battleNodeState(battle.id) : 'available';
    let bg = 0x1c0c0c, border = 0xc04040, glow = 0xc04040, icon = '⚔️';
    if (state === 'completed') { bg = 0x0c2018; border = 0x3aaa5e; glow = 0x3aaa5e; icon = '✓'; }
    else if (state === 'locked') { bg = 0x181010; border = 0x4c2828; glow = null; icon = '🔒'; }
    else if (battle.isTerritoryBoss) { bg = 0x2a1808; border = 0xd4a332; glow = 0xd4a332; icon = '👑'; }

    _drawMarkerDisc(px, {
      bg, border, glow, icon,
      locked: state === 'locked',
      completed: state === 'completed',
    });
    if (state !== 'locked') {
      _hitAreas.push({ type: 'battle', id: null, cx: px.x, cy: px.y, r: HIT_R, data: { battleDef: battle } });
    }
  }

  function _drawMarkerDisc(px, opts) {
    const r = HIT_R;
    const g = new PIXI.Graphics();

    if (opts.glow && (opts.active || opts.highlighted)) {
      g.circle(0, 0, r + 8);
      g.fill({ color: opts.glow, alpha: 0.22 });
    }

    g.circle(0, 0, r + 2);
    g.fill({ color: 0x000000, alpha: 0.35 });
    g.circle(0, 0, r);
    g.fill({ color: opts.bg });
    g.circle(0, 0, r);
    g.stroke({ width: 2.5, color: opts.border });

    if (opts.progressPct != null && opts.progressPct > 0 && opts.progressPct < 1) {
      const arc = -Math.PI / 2 + opts.progressPct * Math.PI * 2;
      g.arc(0, 0, r + 4, -Math.PI / 2, arc);
      g.stroke({ width: 3, color: 0xd4a332 });
    }

    const dk = _depthAt(px);
    g.position.set(px.x, px.y);
    g.zIndex = dk + 5;
    _layers.markers.addChild(g);

    const icon = new PIXI.Text({
      text: opts.icon || '?',
      style: { fontSize: 18, fill: 0xffffff },
    });
    icon.anchor.set(0.5);
    icon.position.set(px.x, px.y);
    icon.zIndex = dk + 6;
    _layers.markers.addChild(icon);
  }

  function _drawLabels() {
    getTerritoriesInMapOrder().forEach(t => {
      if (getTerritoryMapState(t.id) === 'undiscovered') return;
      const label = t.mapLabel;
      if (!label) return;
      const px = label.tx != null
        ? IsoMath.tileToPixel(label.tx, label.ty)
        : { x: label.x, y: label.y };

      const text = new PIXI.Text({
        text: `${t.icon || ''} ${t.displayName}`,
        style: {
          fontFamily: WorldTokens.label.fontFamily,
          fontSize: WorldTokens.label.fontSize,
          fontWeight: '700',
          fill: WorldTokens.label.fill,
          stroke: { color: WorldTokens.label.stroke, width: WorldTokens.label.strokeWidth },
        },
      });
      text.anchor.set(0.5);
      text.position.set(px.x, px.y - 28);
      text.zIndex = IsoMath.depthKey(px.x, px.y) + 8;
      _layers.labels.addChild(text);

      _hitAreas.push({ type: 'territory', id: t.id, cx: px.x, cy: px.y - 28, r: HIT_R, data: {} });
    });
  }

  // ── Input / camera ─────────────────────────────────────────────

  function _handleTap(sx, sy) {
    const w = IsoCamera.screenToWorld(sx, sy);
    const zoom = IsoCamera.getState().zoom;
    const minR = WorldTokens.touchMinScreenPx / zoom;
    const priority = { battle: 4, resource: 3, build: 3, territory: 1 };
    let best = null;
    let bestPri = -1;
    let bestD = Infinity;

    for (const h of _hitAreas) {
      const r = Math.max(h.r, minR);
      const d = Math.hypot(w.x - h.cx, w.y - h.cy);
      if (d > r) continue;
      const pri = priority[h.type] || 0;
      if (pri > bestPri || (pri === bestPri && d < bestD)) {
        best = h; bestPri = pri; bestD = d;
      }
    }

    if (best && _onHit) _onHit(best.type, best.id, best.data);
  }

  function _onCameraInput() {
    _applyCamera();
  }

  function _applyCamera() {
    const state = IsoCamera.getState();
    ThreeTerrain.syncCamera(state);
    ThreeProps.setZoomTier(state.zoom);
    if (_pixiWorld) IsoCamera.applyToContainer(_pixiWorld);
  }

  function _resizeCamera() {
    if (!_canvas) return;
    const w = _canvas.clientWidth || _canvas.width;
    const h = _canvas.clientHeight || _canvas.height;
    IsoCamera.setViewSize(w, h);
    _applyCamera();
  }

  function _onResize() {
    _syncLayout({ refocus: false });
  }

  function _syncLayout({ refocus = false } = {}) {
    if (!_canvas || !_container) return false;

    const w = _container.clientWidth;
    const h = _container.clientHeight;
    if (w < 8 || h < 8) return false;

    const needsRefocus = refocus || !_hasValidLayout;
    ThreeTerrain.resize(w, h);
    if (_pixiApp?.renderer) _pixiApp.renderer.resize(w, h);
    _hasValidLayout = true;
    _resizeCamera();
    IsoCamera.refreshBounds();
    if (needsRefocus) IsoCamera.focusStartAnchor();
    _applyCamera();

    if (!_ready) {
      _ready = true;
      _rebuildDynamic();
    } else if (needsRefocus) {
      _requestRedraw();
    }
    return true;
  }

  function _requestRedraw() {
    if (!_ready) return;
    _rebuildDynamic();
    _applyCamera();
  }

  function _startLoop() {
    const tick = () => {
      _rafId = requestAnimationFrame(tick);
      const hasWork = (typeof ASSIGNMENT !== 'undefined' && ASSIGNMENT.getActive().length)
        || (typeof CRAFTING !== 'undefined' && CRAFTING.getActive().length);
      if (hasWork) _rebuildDynamic();
      ThreeTerrain.render();
      if (_pixiApp) _pixiApp.render();
    };
    _rafId = requestAnimationFrame(tick);
  }

  function _pct(startMs, endMs) {
    const total = endMs - startMs;
    if (total <= 0) return 1;
    return Math.min(1, Math.max(0, (Date.now() - startMs) / total));
  }

  function _depthAt(px) {
    const t = IsoMath.pixelToTile(px.x, px.y);
    return IsoMath.depthKey(t.tx, t.ty);
  }

  return {
    init, destroy, markDirty, rebuildAll, resize, onMapVisible,
    focusTerritory, focusStart, entityToScreen,
    get ready() { return _ready; },
  };
})();
