'use strict';
// ================================================================
// procedural-tiles.js — extruded 3D iso tiles with biome motifs
// Swap textures for sprite sheets later; callers stay the same.
// ================================================================

const ProceduralTiles = (() => {

  const _cache = new Map();
  const CACHE_VER = 3;

  function hexToNum(hex) {
    if (typeof hex === 'number') return hex;
    return parseInt(String(hex).replace('#', ''), 16);
  }

  function shade(color, amount) {
    const r = Math.min(255, Math.max(0, ((color >> 16) & 0xff) + amount));
    const g = Math.min(255, Math.max(0, ((color >> 8) & 0xff) + amount));
    const b = Math.min(255, Math.max(0, (color & 0xff) + amount));
    return (r << 16) | (g << 8) | b;
  }

  function hash(tx, ty) {
    return ((tx * 73856093) ^ (ty * 19349663)) >>> 0;
  }

  function biomeStyle(biomeKey) {
    return WorldTokens.biomes[biomeKey]
      || WorldTokens.biomes.field;
  }

  // ── Motif painters (top-face detail) ───────────────────────────

  function _paintMotif(g, motif, hw, hh, tw, th, base, accent, variant, h, locked) {
    const alpha = locked ? 0.18 : 0.42;

    switch (motif) {
      case 'meadow':
        for (let i = 0; i < 5; i++) {
          const sx = hw + ((h + i * 17) % 20) - 10;
          const sy = hh + ((h + i * 11) % 12) - 6;
          g.moveTo(sx, sy);
          g.lineTo(sx + (((i + variant) % 2) ? 3 : -3), sy - 5);
          g.stroke({ width: 1.2, color: shade(base, 18), alpha });
        }
        if (!locked && variant === 1) {
          g.circle(hw + 6, hh - 2, 2);
          g.fill({ color: hexToNum(accent), alpha: 0.55 });
        }
        break;

      case 'hills':
        for (let i = 0; i < 4; i++) {
          const rx = hw + ((h + i * 13) % 18) - 9;
          const ry = hh + ((h + i * 19) % 10) - 4;
          g.roundRect(rx, ry, 5 + (i % 2), 3, 1);
          g.fill({ color: shade(base, -12 - i * 3), alpha: alpha + 0.15 });
        }
        if (!locked && (variant === 0 || variant === 2)) {
          g.circle(hw - 4 + variant * 3, hh + 2, 1.8);
          g.fill({ color: hexToNum(accent), alpha: 0.7 });
        }
        break;

      case 'forest':
        g.circle(hw - 6, hh - 1, 7);
        g.fill({ color: hexToNum(accent), alpha: locked ? 0.2 : 0.35 });
        g.circle(hw + 8, hh + 3, 6);
        g.fill({ color: shade(base, -22), alpha: locked ? 0.15 : 0.3 });
        for (let i = 0; i < 3; i++) {
          g.circle(hw + ((h + i * 23) % 16) - 8, hh + ((h + i * 9) % 8) - 2, 1.5);
          g.fill({ color: shade(base, 8), alpha: 0.25 });
        }
        break;

      case 'swamp':
        g.ellipse(hw + 2, hh + 4, 10, 5);
        g.fill({ color: hexToNum(accent), alpha: locked ? 0.12 : 0.28 });
        for (let i = 0; i < 3; i++) {
          const rx = hw + ((h + i * 29) % 14) - 7;
          g.moveTo(rx, hh + 6);
          g.lineTo(rx + 1, hh - 4);
          g.stroke({ width: 1, color: shade(base, -8), alpha: alpha });
        }
        break;

      case 'shadow':
        g.moveTo(hw - 8, hh);
        g.lineTo(hw + 2, hh + 6);
        g.lineTo(hw + 10, hh - 2);
        g.stroke({ width: 1, color: hexToNum(accent), alpha: locked ? 0.15 : 0.4 });
        for (let i = 0; i < 4; i++) {
          g.circle(hw + ((h + i * 31) % 18) - 9, hh + ((h + i * 7) % 10) - 3, 1.2);
          g.fill({ color: hexToNum(accent), alpha: locked ? 0.1 : 0.25 });
        }
        break;

      default:
        break;
    }
  }

  function _drawExtrudedTile(g, tok, variant, locked, tw, th) {
    const hw = tw / 2;
    const hh = th / 2;
    const depth = tok.tileDepth || 6;
    const top = hexToNum(locked ? tok.topLocked : tok.top);
    const left = hexToNum(tok.leftFace);
    const right = hexToNum(tok.rightFace);
    const edge = hexToNum(tok.edge);
    const accent = tok.accent;
    const h = hash(variant, variant * 7);
    const topVar = shade(top, (h % 14) - 7);

    // Right extruded face (drawn first — behind)
    g.poly([tw, hh, hw, th, hw, th + depth, tw, hh + depth], true);
    g.fill({ color: right });
    g.poly([tw, hh, hw, th, hw, th + depth, tw, hh + depth], false);
    g.stroke({ width: 1, color: shade(right, -20), alpha: 0.45 });

    // Left extruded face
    g.poly([0, hh, hw, th, hw, th + depth, 0, hh + depth], true);
    g.fill({ color: left });
    g.poly([0, hh, hw, th, hw, th + depth, 0, hh + depth], false);
    g.stroke({ width: 1, color: shade(left, -20), alpha: 0.45 });

    // Top diamond face
    g.poly([hw, 0, tw, hh, hw, th, 0, hh], true);
    g.fill({ color: topVar });

    _paintMotif(g, tok.motif, hw, hh, tw, th, topVar, accent, variant, h, locked);

    // Sun highlight (top-left) + ambient shadow (bottom-right)
    g.poly([hw, 1, tw - 1, hh, hw, hh], true);
    g.fill({ color: 0xffffff, alpha: locked ? 0.04 : 0.1 });
    g.poly([hw, hh, tw - 1, hh, hw, th - 1], true);
    g.fill({ color: 0x000000, alpha: locked ? 0.12 : 0.18 });

    // Rim
    g.poly([hw, 0, tw, hh, hw, th, 0, hh], false);
    g.stroke({ width: 1.2, color: edge, alpha: locked ? 0.35 : 0.65 });

    // Bottom edge where block meets void
    g.moveTo(0, hh + depth);
    g.lineTo(hw, th + depth);
    g.lineTo(tw, hh + depth);
    g.stroke({ width: 1, color: 0x000000, alpha: 0.35 });
  }

  function getTileTexture(renderer, biomeKey, tx, ty, locked) {
    const variant = hash(tx, ty) % 4;
    const key = `${CACHE_VER}:${biomeKey}:${locked ? 'L' : 'U'}:${variant}`;
    if (_cache.has(key)) return _cache.get(key);

    const tok = biomeStyle(biomeKey);
    const tw = ISO_MAP_CONFIG.tileWidth;
    const th = ISO_MAP_CONFIG.tileHeight;
    const depth = tok.tileDepth || 6;
    const texH = th + depth + 2;

    const g = new PIXI.Graphics();
    _drawExtrudedTile(g, tok, variant, locked, tw, th);

    const tex = renderer.generateTexture({
      target: g,
      resolution: 1,
      frame: new PIXI.Rectangle(0, 0, tw, texH),
    });
    g.destroy();
    _cache.set(key, tex);
    return tex;
  }

  function clearCache() {
    _cache.forEach(t => t.destroy(true));
    _cache.clear();
  }

  return { getTileTexture, clearCache };
})();
