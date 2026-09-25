'use strict';
// ================================================================
// terrain-shader.js — splat-blended terrain material (Phase 11)
// ================================================================

const TerrainShader = (() => {

  function _makeCanvasTex(drawFn, size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  function createTileTextures() {
    const grass = _makeCanvasTex((ctx, s) => {
      ctx.fillStyle = '#4a8a3a';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 1200; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        ctx.fillStyle = Math.random() > 0.5 ? '#5a9a48' : '#3d7034';
        ctx.fillRect(x, y, 2, 2);
      }
    });

    const dirt = _makeCanvasTex((ctx, s) => {
      ctx.fillStyle = '#6a5438';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 800; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#7a6040' : '#5a4830';
        ctx.fillRect(Math.random() * s, Math.random() * s, 3, 2);
      }
    });

    const rock = _makeCanvasTex((ctx, s) => {
      ctx.fillStyle = '#5a5868';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 600; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#6a6878' : '#4a4858';
        ctx.fillRect(Math.random() * s, Math.random() * s, 4, 3);
      }
    });

    const path = _makeCanvasTex((ctx, s) => {
      ctx.fillStyle = '#8a7858';
      ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = '#9a8870';
        ctx.fillRect(Math.random() * s, Math.random() * s, 3, 2);
      }
    });

    return { grass, dirt, rock, path };
  }

  function createDataTextureFromMap(map, channels = 4) {
    const tex = new THREE.DataTexture(
      map.data,
      map.width,
      map.height,
      channels === 4 ? THREE.RGBAFormat : THREE.RedFormat,
    );
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  function createSplatMaterial(opts) {
    const { splatTex, heightTex, tileTextures, sunDir, uvScale } = opts;
    const sun = sunDir || new THREE.Vector3(-0.5, 0.85, 0.35).normalize();

    return new THREE.ShaderMaterial({
      uniforms: {
        uSplatMap: { value: splatTex },
        uHeightMap: { value: heightTex },
        uTexGrass: { value: tileTextures.grass },
        uTexDirt: { value: tileTextures.dirt },
        uTexRock: { value: tileTextures.rock },
        uTexPath: { value: tileTextures.path },
        uSunDir: { value: sun },
        uUvScale: { value: uvScale || new THREE.Vector2(24, 24) },
        uTexRepeat: { value: new THREE.Vector2(6, 6) },
        uDetail: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vWorldUv;
        varying vec3 vNormalW;
        varying vec3 vPosW;
        void main() {
          vWorldUv = uv;
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vPosW = wp.xyz;
          vNormalW = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform sampler2D uSplatMap;
        uniform sampler2D uTexGrass;
        uniform sampler2D uTexDirt;
        uniform sampler2D uTexRock;
        uniform sampler2D uTexPath;
        uniform vec3 uSunDir;
        uniform vec2 uUvScale;
        uniform vec2 uTexRepeat;
        uniform float uDetail;

        varying vec2 vWorldUv;
        varying vec3 vNormalW;
        varying vec3 vPosW;

        void main() {
          vec4 splat = texture2D(uSplatMap, vWorldUv);
          float wSum = splat.r + splat.g + splat.b + splat.a + 0.0001;
          vec4 w = splat / wSum;

          vec2 tuv = vWorldUv * uUvScale * uTexRepeat;
          vec3 g = texture2D(uTexGrass, tuv).rgb;
          vec3 d = texture2D(uTexDirt, tuv).rgb;
          vec3 r = texture2D(uTexRock, tuv * 1.3).rgb;
          vec3 p = texture2D(uTexPath, tuv * 0.8).rgb;
          vec3 albedo = g * w.r + d * w.g + r * w.b + p * w.a;

          vec3 n = normalize(vNormalW);
          float diff = max(dot(n, normalize(uSunDir)), 0.0);
          float hemi = 0.35 + 0.65 * clamp(n.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 lit = albedo * (0.32 + diff * 0.55) * hemi;

          float fogFactor = smoothstep(2800.0, 5200.0, length(vPosW.xz));
          vec3 fogCol = vec3(0.04, 0.09, 0.16);
          lit = mix(lit, fogCol, fogFactor * 0.85);

          gl_FragColor = vec4(lit, 1.0);
        }
      `,
    });
  }

  return { createTileTextures, createDataTextureFromMap, createSplatMaterial };
})();
