'use strict';
// ================================================================
// input-manager.js — mobile pan, pinch-zoom, tap (AoE controls)
// ================================================================

const MapInputManager = (() => {

  let _el = null;
  let _onTap = null;
  let _onChange = null;

  let _pointers = new Map();
  let _panning = false;
  let _pinching = false;
  let _lastPinchDist = 0;
  let _panStart = { x: 0, y: 0 };
  let _tapStart = null;
  const TAP_MOVE_THRESHOLD = 12;
  const TAP_TIME_MS = 320;

  function attach(el, onTap, onChange) {
    detach();
    _el = el;
    _onTap = onTap;
    _onChange = onChange;
    el.addEventListener('pointerdown', _onDown, { passive: false });
    el.addEventListener('pointermove', _onMove, { passive: false });
    el.addEventListener('pointerup', _onUp, { passive: false });
    el.addEventListener('pointercancel', _onUp, { passive: false });
    el.addEventListener('wheel', _onWheel, { passive: false });
    el.style.touchAction = 'none';
  }

  function detach() {
    if (!_el) return;
    _el.removeEventListener('pointerdown', _onDown);
    _el.removeEventListener('pointermove', _onMove);
    _el.removeEventListener('pointerup', _onUp);
    _el.removeEventListener('pointercancel', _onUp);
    _el.removeEventListener('wheel', _onWheel);
    _el = null;
  }

  function _localPos(e) {
    const r = _el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function _onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { _el.setPointerCapture(e.pointerId); } catch (_) { /* capture may fail on some browsers */ }
    const p = _localPos(e);
    _pointers.set(e.pointerId, p);

    if (_pointers.size === 1) {
      _panning = true;
      _panStart = { x: p.x, y: p.y };
      _tapStart = { x: p.x, y: p.y, t: Date.now() };
    } else if (_pointers.size === 2) {
      _panning = false;
      _pinching = true;
      _lastPinchDist = _pinchDistance();
      _tapStart = null;
    }
    e.preventDefault();
  }

  function _onMove(e) {
    if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) return;
    if (!_pointers.has(e.pointerId)) return;
    const p = _localPos(e);
    _pointers.set(e.pointerId, p);

    if (_pinching && _pointers.size >= 2) {
      const dist = _pinchDistance();
      const mid = _pinchMidpoint();
      if (_lastPinchDist > 0 && dist > 0) {
        IsoCamera.zoomAtScreen(dist / _lastPinchDist, mid.x, mid.y);
        _onChange?.();
      }
      _lastPinchDist = dist;
      e.preventDefault();
      return;
    }

    if (_panning && _pointers.size === 1) {
      const dx = p.x - _panStart.x;
      const dy = p.y - _panStart.y;
      _panStart = { x: p.x, y: p.y };
      IsoCamera.panScreenDelta(dx, dy);
      _onChange?.();
      e.preventDefault();
    }
  }

  function _onUp(e) {
    _pointers.delete(e.pointerId);
    if (_pointers.size < 2) {
      _pinching = false;
      _lastPinchDist = 0;
    }
    if (_pointers.size === 0) {
      if (_tapStart && !_pinching) {
        const p = _localPos(e);
        const dt = Date.now() - _tapStart.t;
        const dx = p.x - _tapStart.x;
        const dy = p.y - _tapStart.y;
        if (dt < TAP_TIME_MS && Math.hypot(dx, dy) < TAP_MOVE_THRESHOLD) {
          _onTap?.(p.x, p.y);
        }
      }
      _panning = false;
      _tapStart = null;
    } else if (_pointers.size === 1) {
      const only = [..._pointers.values()][0];
      _panStart = { x: only.x, y: only.y };
      _panning = true;
      _pinching = false;
    }
  }

  function _onWheel(e) {
    e.preventDefault();
    const p = _localPos(e);
    const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
    IsoCamera.zoomAtScreen(factor, p.x, p.y);
    _onChange?.();
  }

  function _pinchDistance() {
    const pts = [..._pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  }

  function _pinchMidpoint() {
    const pts = [..._pointers.values()];
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  }

  return { attach, detach };
})();
