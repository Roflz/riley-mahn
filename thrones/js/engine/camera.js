'use strict';

// ================================================================

// camera.js — AoE-style pan / zoom camera (world-pixel center)

// ================================================================



const IsoCamera = (() => {



  let _cx = 0;

  let _cy = 0;

  let _zoom = 0.55;

  let _viewW = 1;

  let _viewH = 1;

  let _bounds = { minX: -500, maxX: 500, minY: -200, maxY: 800 };

  let _minZoom = 0.38;

  let _maxZoom = 0.95;

  let _pad = 100;



  function _applyBoundsFromLandmass() {

    const wb = IsoMath.landmassPixelBounds();

    _bounds = {

      minX: wb.minX - _pad,

      maxX: wb.maxX + _pad,

      minY: wb.minY - _pad,

      maxY: wb.maxY + _pad,

    };

  }



  function configure(cfg) {

    _minZoom = cfg.zoomMin ?? _minZoom;

    _maxZoom = cfg.zoomMax ?? _maxZoom;

    _zoom    = cfg.zoomStart ?? _zoom;

    _pad     = cfg.boundsPad ?? 100;

    _applyBoundsFromLandmass();

  }



  function refreshBounds() {

    _applyBoundsFromLandmass();

    _clamp();

  }



  function setViewSize(w, h) {

    _viewW = Math.max(1, w);

    _viewH = Math.max(1, h);

    _clamp();

  }



  function getState() {

    return { cx: _cx, cy: _cy, zoom: _zoom, viewW: _viewW, viewH: _viewH };

  }



  function setCenter(wx, wy, zoom) {

    _cx = wx;

    _cy = wy;

    if (zoom != null) _zoom = _clampZoom(zoom);

    _clamp();

  }



  function focusWorldPoint(wx, wy, zoom) {

    setCenter(wx, wy, zoom ?? _zoom);

  }



  function focusTerritory(territoryId) {
    focusStartAnchor();
  }

  /** Place the start-zone toe at the bottom of the viewport (journey begins here). */
  function focusStartAnchor() {
    const tip = IsoMath.startAnchorPixel();
    const margin = Math.max(56, _viewH * 0.08);
    _zoom = ISO_MAP_CONFIG.zoomStart;
    _cx = tip.x;
    _cy = tip.y - (_viewH / 2 - margin) / _zoom;
    _clamp();
  }



  function panScreenDelta(dx, dy) {

    _cx -= dx / _zoom;

    _cy -= dy / _zoom;

    _clamp();

  }



  function zoomAtScreen(factor, sx, sy) {

    const before = screenToWorld(sx, sy);

    _zoom = _clampZoom(_zoom * factor);

    const after = screenToWorld(sx, sy);

    _cx += before.x - after.x;

    _cy += before.y - after.y;

    _clamp();

  }



  function screenToWorld(sx, sy) {

    return {

      x: _cx + (sx - _viewW / 2) / _zoom,

      y: _cy + (sy - _viewH / 2) / _zoom,

    };

  }



  function worldToScreen(wx, wy) {

    return {

      x: _viewW / 2 + (wx - _cx) * _zoom,

      y: _viewH / 2 + (wy - _cy) * _zoom,

    };

  }



  function applyToContainer(container) {

    container.position.set(

      _viewW / 2 - _cx * _zoom,

      _viewH / 2 - _cy * _zoom,

    );

    container.scale.set(_zoom);

  }



  function _clampZoom(z) {

    return Math.min(_maxZoom, Math.max(_minZoom, z));

  }



  function _clamp() {

    const halfW = _viewW / (2 * _zoom);

    const halfH = _viewH / (2 * _zoom);



    let minCx = _bounds.minX + halfW;

    let maxCx = _bounds.maxX - halfW;

    let minCy = _bounds.minY + halfH;

    let maxCy = _bounds.maxY - halfH;



    // When the whole map fits in view, still allow drag in both axes (AoE feel).

    const slackX = Math.max(120, _viewW * 0.12) / _zoom;

    const slackY = Math.max(90, _viewH * 0.12) / _zoom;

    const midX = (_bounds.minX + _bounds.maxX) / 2;

    const midY = (_bounds.minY + _bounds.maxY) / 2;



    if (minCx > maxCx) {

      minCx = midX - slackX;

      maxCx = midX + slackX;

    }

    if (minCy > maxCy) {

      minCy = midY - slackY;

      maxCy = midY + slackY;

    }



    _cx = Math.min(maxCx, Math.max(minCx, _cx));

    _cy = Math.min(maxCy, Math.max(minCy, _cy));

    _zoom = _clampZoom(_zoom);

  }



  return {

    configure, refreshBounds, setViewSize, getState, setCenter, focusWorldPoint,

    focusTerritory, focusStartAnchor, panScreenDelta, zoomAtScreen,

    screenToWorld, worldToScreen, applyToContainer,

  };

})();


