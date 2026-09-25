'use strict';
// ================================================================
// world-tokens.js — design tokens for the iso world renderer
// (design-systems: semantic colors, consistent biome identity)
// ================================================================

const WorldTokens = {
  touchMinScreenPx: 44,

  fog: {
    undiscovered: { color: 0x080810, alpha: 0.92 },
    locked:       { color: 0x101018, alpha: 0.72 },
  },

  marker: {
    radiusWorld: 22,
    ringWidth: 3,
    themes: {
      woodcutting: { bg: 0x1e3c18, border: 0x4e9030, glow: 0x4e9030 },
      fishing:     { bg: 0x0e2840, border: 0x3c80a8, glow: 0x3c80a8 },
      mining:      { bg: 0x2c2218, border: 0x8e6c3c, glow: 0x8e6c3c },
      battle:      { bg: 0x1c0c0c, border: 0xc04040, glow: 0xc04040 },
      build:       { bg: 0x201810, border: 0x8a7050, glow: 0xcaa230 },
    },
  },

  label: {
    fontFamily: 'system-ui, sans-serif',
    fontSize: 13,
    fill: 0xf0e8d0,
    stroke: 0x1a1008,
    strokeWidth: 3,
  },

  sky: {
    background: 0x04101c,
    vignetteAlpha: 0.35,
  },

  /**
   * Biome render tokens — matched to territory identity in data.js.
   * motif drives procedural surface detail on the top face.
   */
  biomes: {
    field: {
      label: 'Meadow',
      top: '#5a9a48',
      topLocked: '#3a5a34',
      leftFace: '#3d6a34',
      rightFace: '#2e5230',
      edge: '#7ab860',
      accent: '#c8d878',
      tileDepth: 6,
      motif: 'meadow',
    },
    hills: {
      label: 'Copper hills',
      top: '#a08058',
      topLocked: '#5a4838',
      leftFace: '#6a5038',
      rightFace: '#4a3828',
      edge: '#c0a070',
      accent: '#d49040',
      tileDepth: 10,
      motif: 'hills',
    },
    forest: {
      label: 'Riverwood',
      top: '#2d6a40',
      topLocked: '#1a3828',
      leftFace: '#1f4a30',
      rightFace: '#143820',
      edge: '#4a8a58',
      accent: '#1a3020',
      tileDepth: 7,
      motif: 'forest',
    },
    swamp: {
      label: 'Ancient marsh',
      top: '#4a5a38',
      topLocked: '#2a3420',
      leftFace: '#3a4830',
      rightFace: '#2a3824',
      edge: '#6a7a50',
      accent: '#5a8a78',
      tileDepth: 4,
      motif: 'swamp',
    },
    darklands: {
      label: 'Shadow lands',
      top: '#3a2850',
      topLocked: '#1a1028',
      leftFace: '#281838',
      rightFace: '#1a1024',
      edge: '#6a4890',
      accent: '#9a60c8',
      tileDepth: 8,
      motif: 'shadow',
    },
  },
};
