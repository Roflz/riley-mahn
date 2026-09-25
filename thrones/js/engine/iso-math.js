'use strict';
// ================================================================
// iso-math.js — 2:1 dimetric projection (Age of Empires style)
// ================================================================

const IsoMath = (() => {

  function tw() { return ISO_MAP_CONFIG.tileWidth; }
  function th() { return ISO_MAP_CONFIG.tileHeight; }

  /** Tile grid → world pixel (iso projection origin at 0,0). */
  function tileToPixel(tx, ty) {
    return {
      x: (tx - ty) * (tw() / 2),
      y: (tx + ty) * (th() / 2),
    };
  }

  /** World pixel → fractional tile coordinates. */
  function pixelToTile(px, py) {
    const hw = tw() / 2;
    const hh = th() / 2;
    return {
      tx: (px / hw + py / hh) / 2,
      ty: (py / hh - px / hw) / 2,
    };
  }

  /** Center pixel of a tile region. */
  function regionCenter(region) {
    return tileToPixel(region.tx + region.w / 2, region.ty + region.h / 2);
  }

  /** Axis-aligned bounds in world pixels for an iso tile rectangle. */
  function regionPixelBounds(region) {
    const corners = [
      tileToPixel(region.tx, region.ty),
      tileToPixel(region.tx + region.w, region.ty),
      tileToPixel(region.tx, region.ty + region.h),
      tileToPixel(region.tx + region.w, region.ty + region.h),
    ];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    corners.forEach(c => {
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
      minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
    });
    return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
  }

  /** World pixel bounds for the configured grid (legacy / fallback). */
  function worldPixelBounds() {
    const cfg = ISO_MAP_CONFIG;
    return regionPixelBounds({ tx: 0, ty: 0, w: cfg.worldTilesW, h: cfg.worldTilesH });
  }

  /** Bounds of the playable land — used for camera clamping. */
  function landmassPixelBounds() {
    const region = (typeof WORLD_BOUNDS !== 'undefined' && WORLD_BOUNDS.w)
      ? WORLD_BOUNDS
      : (typeof WORLD_LAND !== 'undefined' && WORLD_LAND.w ? WORLD_LAND : null);
    if (region) {
      const b = regionPixelBounds(region);
      const yPad = (typeof TERRAIN_CONFIG !== 'undefined' ? TERRAIN_CONFIG.heightScale : 48) + 20;
      return { ...b, maxY: b.maxY + yPad, height: b.height + yPad };
    }
    return worldPixelBounds();
  }

  /** World Y at tile — delegates to world-map-data.js heightmap sampler. */
  function heightAtTile(tx, ty) {
    if (typeof sampleHeightAtTile === 'function') return sampleHeightAtTile(tx, ty);
    return 0;
  }

  /** South-east tip of the start zone (lowest point on screen). */
  function startAnchorPixel() {
    const z = typeof START_ZONE !== 'undefined' ? START_ZONE : { tx: 0, ty: 0, w: 0, h: 0 };
    return tileToPixel(z.tx + z.w, z.ty + z.h);
  }

  /** Depth sort key — higher draws on top. */
  function depthKey(tx, ty) { return tx + ty; }

  /** Map position may use tx/ty or legacy x/y — normalize to pixel. */
  function positionToPixel(pos) {
    if (!pos) return null;
    if (pos.tx != null) return tileToPixel(pos.tx, pos.ty);
    return { x: pos.x, y: pos.y };
  }

  /** Iso grid → Three.js world (Y-up: X/Z ground plane, Y height). */
  function tileToWorld3D(tx, ty, y = 0) {
    const p = tileToPixel(tx, ty);
    return { x: p.x, y, z: p.y };
  }

  /** 2D iso pixel → Three.js ground position. */
  function pixelToWorld3D(px, py, y = 0) {
    return { x: px, y, z: py };
  }

  return {
    tileToPixel, pixelToTile, regionCenter, regionPixelBounds,
    worldPixelBounds, landmassPixelBounds, startAnchorPixel, depthKey, positionToPixel,
    tileToWorld3D, pixelToWorld3D, heightAtTile,
  };
})();
