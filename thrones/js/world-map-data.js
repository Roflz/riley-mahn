'use strict';
// =============================================================
// world-map-data.js — AoE-style isometric world layout
// =============================================================

/** Isometric map configuration (2:1 dimetric, landscape AoE). */
const ISO_MAP_CONFIG = {
  tileWidth: 64,
  tileHeight: 32,
  worldTilesW: 66,
  worldTilesH: 66,
  zoomMin: 0.32,
  zoomMax: 1.65,
  zoomStart: 0.58,
  boundsPad: 120,
  /** When false, map shows terrain only (no markers / fog / labels). */
  showMapMarkers: false,
};

/** Continuous world grid (Phase 11 — heightmap terrain). */
const WORLD_BOUNDS = { tx: 0, ty: 0, w: 128, h: 128 };

const TERRAIN_CHUNK_SIZE = 32;

const TERRAIN_CONFIG = {
  heightScale: 52,
  waterLevel: 0.06,
  segmentsLod0: 32,
  segmentsLod1: 10,
  zoomFar: 0.45,
  zoomNear: 0.95,
};

/**
 * Active playable land inside WORLD_BOUNDS.
 * South-east corner is the “lowest” point on screen (journey starts there).
 */
const WORLD_LAND = {
  tx: 8,
  ty: 8,
  w: 50,
  h: 50,
  biome: 'field',
};

/** Height 0…1 and splat RGBA per tile texel — filled by generateWorldTerrain(). */
let WORLD_HEIGHTMAP = null;
let WORLD_SPLATMAP = null;
let WORLD_PROP_SCATTER = [];

/** Starting zone — bottom corner anchors the camera (home base at map toe). */
const START_ZONE = {
  tx: 45,
  ty: 47,
  w: 13,
  h: 11,
};

const BIOME_STYLES = {
  field:     { fill: '#5a9a48', fillLocked: '#3a5a34', stroke: '#7ab860', accent: '#c8d878' },
  hills:     { fill: '#a08058', fillLocked: '#5a4838', stroke: '#c0a070', accent: '#d49040' },
  forest:    { fill: '#2d6a40', fillLocked: '#1a3828', stroke: '#4a8a58', accent: '#1a3020' },
  swamp:     { fill: '#4a5a38', fillLocked: '#2a3420', stroke: '#6a7a50', accent: '#5a8a78' },
  darklands: { fill: '#3a2850', fillLocked: '#1a1028', stroke: '#6a4890', accent: '#9a60c8' },
  river:     { fill: '#2a5870', fillLocked: '#1a3848', stroke: '#4a90a8', accent: '#68b8d0' },
  mountains: { fill: '#6a6878', fillLocked: '#3a3848', stroke: '#9a98a8', accent: '#bab8c8' },
  ruins:     { fill: '#5a5060', fillLocked: '#302838', stroke: '#8a7a90', accent: '#a090a8' },
};

const TERRAIN_DECORATIONS = {};

/** Game-logic layout only — not rendered as separate map regions for now. */
function initWorldMapLayout() {
  const layouts = {
    territory_starting_field: {
      biomeType: 'field',
      mapOrder: 1,
      discoverFromStart: true,
    },
    territory_copper_hills: {
      biomeType: 'hills',
      mapOrder: 2,
      previewWhenLocked: true,
    },
    territory_riverwood: {
      biomeType: 'forest',
      mapOrder: 3,
      fogUntilDiscovered: true,
    },
    territory_ancient_marsh: {
      biomeType: 'swamp',
      mapOrder: 4,
      fogUntilDiscovered: true,
    },
    territory_shadow_lands: {
      biomeType: 'darklands',
      mapOrder: 5,
      fogUntilDiscovered: true,
    },
  };

  Object.entries(layouts).forEach(([id, layout]) => {
    if (TERRITORY_DEFINITIONS[id]) Object.assign(TERRITORY_DEFINITIONS[id], layout);
  });
}

// ── Discovery helpers (game logic unchanged) ──────────────────

function ensureDiscoveredTerritories() {
  if (!PLAYER_DATA.discoveredTerritories) {
    PLAYER_DATA.discoveredTerritories = getDefaultDiscoveredTerritories();
  }
}

function isTerritoryDiscovered(territoryId) {
  ensureDiscoveredTerritories();
  const t = TERRITORY_DEFINITIONS[territoryId];
  if (!t) return false;
  if (t.discoverFromStart || t.unlockedByDefault) return true;
  if (t.previewWhenLocked) return true;
  return PLAYER_DATA.discoveredTerritories.includes(territoryId);
}

function discoverTerritory(territoryId) {
  ensureDiscoveredTerritories();
  if (!PLAYER_DATA.discoveredTerritories.includes(territoryId)) {
    PLAYER_DATA.discoveredTerritories.push(territoryId);
  }
}

function getTerritoryMapState(territoryId) {
  if (!isTerritoryDiscovered(territoryId)) return 'undiscovered';
  if (!isTerritoryUnlocked(territoryId)) return 'locked';
  return 'unlocked';
}

function getTerritoryMapBattles(territoryId) {
  const t = TERRITORY_DEFINITIONS[territoryId];
  if (!t?.battleIds) return [];
  return t.battleIds
    .map(id => BATTLE_DEFINITIONS.find(b => b.id === id))
    .filter(Boolean);
}

function getTerritoryMapNodes(territoryId) {
  return Object.values(TERRITORY_NODE_DEFINITIONS).filter(n => n.territoryId === territoryId);
}

function getTerritoryMapBuildSites(territoryId) {
  return Object.values(TERRITORY_BUILD_SITE_DEFINITIONS).filter(s => s.territoryId === territoryId);
}

function getBuiltStructureIdAtSite(siteId) {
  return PLAYER_DATA.builtStructures?.[siteId] || null;
}

function getTerritoriesInMapOrder() {
  return Object.values(TERRITORY_DEFINITIONS)
    .filter(t => t.mapOrder != null)
    .sort((a, b) => (a.mapOrder || 99) - (b.mapOrder || 99));
}

function checkTerritoryDiscoveries() {
  ensureDiscoveredTerritories();
  const newly = [];
  Object.values(TERRITORY_DEFINITIONS).forEach(t => {
    if (isTerritoryDiscovered(t.id)) return;
    if (t.discoverBattleId && Unlock.isBattleCompleted(t.discoverBattleId)) {
      discoverTerritory(t.id);
      newly.push(t.id);
    }
    if (t.unlockBattleId && Unlock.isBattleCompleted(t.unlockBattleId)) {
      discoverTerritory(t.id);
      if (!newly.includes(t.id)) newly.push(t.id);
    }
  });
  return newly;
}

// ── Phase 11: procedural height / splat / props ─────────────────

function _terrainHash(x, y) {
  return ((x * 374761393) ^ (y * 668265263) ^ 12345) >>> 0;
}

function _terrainNoise(x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = _terrainHash(ix, iy) / 4294967295;
  const b = _terrainHash(ix + 1, iy) / 4294967295;
  const c = _terrainHash(ix, iy + 1) / 4294967295;
  const d = _terrainHash(ix + 1, iy + 1) / 4294967295;
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function _terrainFbm(x, y, octaves) {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * _terrainNoise(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2.1;
  }
  return v;
}

function _inLandMask(tx, ty) {
  const pad = 6;
  const l = WORLD_LAND;
  return tx >= l.tx - pad && ty >= l.ty - pad
    && tx <= l.tx + l.w + pad && ty <= l.ty + l.h + pad;
}

function generateWorldTerrain() {
  const b = WORLD_BOUNDS;
  const w = b.w;
  const h = b.h;
  const height = new Float32Array(w * h);
  const splat = new Uint8Array(w * h * 4);
  const startTx = START_ZONE.tx + START_ZONE.w * 0.5;
  const startTy = START_ZONE.ty + START_ZONE.h * 0.5;

  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const i = ty * w + tx;
      const nx = tx / w;
      const ny = ty / h;
      const distStart = Math.hypot(tx - startTx, ty - startTy) / (w * 0.45);
      const ridge = _terrainFbm(tx * 0.06, ty * 0.06, 4);
      const detail = _terrainFbm(tx * 0.18 + 40, ty * 0.18, 3) * 0.35;
      const mountains = Math.max(0, (1 - nx * 0.85 - ny * 0.15) * 1.1 - 0.25);
      let elev = ridge * 0.45 + detail + mountains * 0.55;
      elev -= Math.max(0, 1 - distStart) * 0.22;
      elev = Math.max(0, Math.min(1, elev));

      if (!_inLandMask(tx, ty)) {
        elev *= 0.35;
        if (tx < b.tx + 4 || ty < b.ty + 4 || tx > b.tx + b.w - 5 || ty > b.ty + b.h - 5) {
          elev = Math.min(elev, TERRAIN_CONFIG.waterLevel * 0.5);
        }
      }

      height[i] = elev;

      const hL = tx > 0 ? height[ty * w + tx - 1] : elev;
      const hU = ty > 0 ? height[(ty - 1) * w + tx] : elev;
      const slope = Math.abs(elev - hL) + Math.abs(elev - hU);

      let grass = 1;
      let dirt = 0;
      let rock = 0;
      let path = 0;

      if (elev < TERRAIN_CONFIG.waterLevel + 0.02) {
        grass = 0.2; dirt = 0.3; rock = 0.1;
      } else if (elev > 0.62 || slope > 0.18) {
        rock = Math.min(1, (elev - 0.5) * 1.8 + slope * 2);
        grass = Math.max(0, 1 - rock);
        dirt = grass * 0.25;
      } else if (elev < 0.28 || distStart < 0.35) {
        dirt = 0.35 + (0.28 - elev) * 0.8;
        grass = 1 - dirt * 0.7;
      } else {
        grass = 0.75 + _terrainNoise(tx * 0.3, ty * 0.3) * 0.25;
        dirt = 0.15 + detail * 0.2;
      }

      const si = i * 4;
      splat[si]     = Math.round(grass * 255);
      splat[si + 1] = Math.round(dirt * 255);
      splat[si + 2] = Math.round(rock * 255);
      splat[si + 3] = Math.round(path * 255);
    }
  }

  WORLD_HEIGHTMAP = { width: w, height: h, data: height };
  WORLD_SPLATMAP = { width: w, height: h, data: splat };
  WORLD_PROP_SCATTER = generateWorldPropScatter(height, splat, w, h);
}

function sampleWorldHeight(tx, ty, data, w, h) {
  const x = Math.max(0, Math.min(w - 1, Math.floor(tx)));
  const y = Math.max(0, Math.min(h - 1, Math.floor(ty)));
  return data[y * w + x];
}

function sampleHeightAtTile(tx, ty) {
  if (!WORLD_HEIGHTMAP) return 0;
  const w = WORLD_HEIGHTMAP.width;
  const h = WORLD_HEIGHTMAP.height;
  const fx = Math.max(0, Math.min(w - 1.001, tx));
  const fy = Math.max(0, Math.min(h - 1.001, ty));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const txf = fx - x0;
  const tyf = fy - y0;
  const d = WORLD_HEIGHTMAP.data;
  const h00 = d[y0 * w + x0];
  const h10 = d[y0 * w + x1];
  const h01 = d[y1 * w + x0];
  const h11 = d[y1 * w + x1];
  const v = h00 + (h10 - h00) * txf + (h01 - h00) * tyf + (h00 - h10 - h01 + h11) * txf * tyf;
  return v * TERRAIN_CONFIG.heightScale;
}

function sampleSplatAtTile(tx, ty) {
  if (!WORLD_SPLATMAP) return { grass: 1, dirt: 0, rock: 0, path: 0 };
  const w = WORLD_SPLATMAP.width;
  const h = WORLD_SPLATMAP.height;
  const x = Math.max(0, Math.min(w - 1, Math.round(tx)));
  const y = Math.max(0, Math.min(h - 1, Math.round(ty)));
  const si = (y * w + x) * 4;
  const d = WORLD_SPLATMAP.data;
  const s = 1 / 255;
  return { grass: d[si] * s, dirt: d[si + 1] * s, rock: d[si + 2] * s, path: d[si + 3] * s };
}

function generateWorldPropScatter(height, splat, w, h) {
  const props = [];
  const l = WORLD_LAND;

  for (let ty = l.ty; ty < l.ty + l.h; ty++) {
    for (let tx = l.tx; tx < l.tx + l.w; tx++) {
      const i = ty * w + tx;
      const elev = height[i];
      if (elev < TERRAIN_CONFIG.waterLevel + 0.03) continue;

      const si = i * 4;
      const rockW = splat[si + 2] / 255;
      const grassW = splat[si] / 255;
      const r = _terrainHash(tx, ty) % 1000 / 1000;

      if (rockW > 0.45 && r < 0.08) {
        props.push({ type: 'rock_med', tx: tx + 0.5, ty: ty + 0.5, rot: r * 6.28, scale: 0.8 + r * 0.5 });
      } else if (rockW > 0.2 && r < 0.06) {
        props.push({ type: 'rock_sm', tx: tx + 0.5, ty: ty + 0.5, rot: r * 6.28, scale: 0.7 + r * 0.4 });
      } else if (grassW > 0.55 && r < 0.04) {
        props.push({ type: 'grass_clump', tx: tx + 0.5, ty: ty + 0.5, rot: r * 6.28, scale: 0.9 + r * 0.3 });
      } else if (grassW > 0.4 && elev > 0.2 && elev < 0.55 && r < 0.012) {
        props.push({ type: 'tree_oak', tx: tx + 0.5, ty: ty + 0.5, rot: r * 6.28, scale: 0.85 + r * 0.35 });
      }
    }
  }

  props.push(
    { type: 'rock_med', tx: START_ZONE.tx + 4, ty: START_ZONE.ty + 3, rot: 0.5, scale: 1.1 },
    { type: 'rock_sm', tx: START_ZONE.tx + 8, ty: START_ZONE.ty + 6, rot: 1.2, scale: 1 },
    { type: 'grass_clump', tx: START_ZONE.tx + 6, ty: START_ZONE.ty + 5, rot: 2.1, scale: 1 },
  );
  return props;
}

generateWorldTerrain();

initWorldMapLayout();
