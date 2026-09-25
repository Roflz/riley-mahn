'use strict';
// ================================================================
// three-terrain.js — chunked heightmap terrain (Phase 11)
// ================================================================

const ThreeTerrain = (() => {

  const BASE_CAM_DIST = 1180;
  const ISO_PITCH = 0.72;
  const ISO_AZIMUTH = Math.PI / 4;

  let _renderer = null;
  let _scene = null;
  let _camera = null;
  let _terrainGroup = null;
  let _propsGroup = null;
  let _canvas = null;
  let _chunks = [];
  let _sharedMaterial = null;
  let _textures = null;
  let _zoomTier = 1;
  let _lastSegments = -1;
  let _frustum = new THREE.Frustum();
  let _projScreen = new THREE.Matrix4();

  function init(container, width, height) {
    _canvas = document.createElement('canvas');
    _canvas.id = 'world-map-canvas';
    container.innerHTML = '';
    container.appendChild(_canvas);

    _renderer = new THREE.WebGLRenderer({ canvas: _canvas, antialias: true, alpha: false });
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    _renderer.setSize(width, height, false);
    _renderer.setClearColor(0x0a1828, 1);
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.35;

    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x0a1828);
    _scene.fog = new THREE.Fog(0x0a1828, 1600, 5200);

    _camera = new THREE.PerspectiveCamera(38, width / height, 2, 9000);

    _scene.add(new THREE.HemisphereLight(0x9ec8ff, 0x3a6a30, 0.72));
    _scene.add(new THREE.AmbientLight(0x607888, 0.35));

    const sun = new THREE.DirectionalLight(0xfff4dc, 1.85);
    sun.position.set(-1.6, 2.8, 1.2);
    _scene.add(sun);

    const rim = new THREE.DirectionalLight(0xc8e0ff, 0.45);
    rim.position.set(1.5, 1.0, -1.2);
    _scene.add(rim);

    _terrainGroup = new THREE.Group();
    _propsGroup = new THREE.Group();
    _scene.add(_terrainGroup);
    _scene.add(_propsGroup);

    _textures = TerrainShader.createTileTextures();
    const splatTex = TerrainShader.createDataTextureFromMap(WORLD_SPLATMAP, 4);

    _sharedMaterial = TerrainShader.createSplatMaterial({
      splatTex,
      tileTextures: _textures,
      uvScale: new THREE.Vector2(WORLD_BOUNDS.w, WORLD_BOUNDS.h),
    });

    _lastSegments = TERRAIN_CONFIG.segmentsLod0;
    buildWorld();

    return _canvas;
  }

  function getScene() { return _scene; }
  function getCamera() { return _camera; }
  function getPropsGroup() { return _propsGroup; }
  function getRenderer() { return _renderer; }

  function _segmentsForTier(tier) {
    const cfg = TERRAIN_CONFIG;
    return tier === 0 ? cfg.segmentsLod1 : cfg.segmentsLod0;
  }

  function _tierFromZoom(zoom) {
    if (zoom < TERRAIN_CONFIG.zoomFar) return 0;
    if (zoom > TERRAIN_CONFIG.zoomNear) return 2;
    return 1;
  }

  function setZoomTier(zoom) {
    const tier = _tierFromZoom(zoom);
    _zoomTier = tier;
    const seg = _segmentsForTier(tier);
    if (_sharedMaterial) {
      _sharedMaterial.uniforms.uDetail.value = tier === 2 ? 1.0 : tier === 1 ? 0.85 : 0.65;
    }
    if (seg !== _lastSegments) {
      _lastSegments = seg;
      buildWorld();
    }
  }

  function _disposeChunks() {
    _chunks.forEach(c => {
      c.mesh.geometry.dispose();
      _terrainGroup.remove(c.mesh);
    });
    _chunks = [];
  }

  function _buildChunkMesh(cx, cy, segments) {
    const b = WORLD_BOUNDS;
    const cs = TERRAIN_CHUNK_SIZE;
    const tileX0 = b.tx + cx * cs;
    const tileY0 = b.ty + cy * cs;
    const verts = segments + 1;
    const positions = new Float32Array(verts * verts * 3);
    const normals = new Float32Array(verts * verts * 3);
    const uvs = new Float32Array(verts * verts * 2);
    const indices = [];

    let vi = 0;
    for (let j = 0; j < verts; j++) {
      for (let i = 0; i < verts; i++) {
        const tx = tileX0 + (i / segments) * cs;
        const ty = tileY0 + (j / segments) * cs;
        const p = IsoMath.tileToPixel(tx, ty);
        const y = sampleHeightAtTile(tx, ty);
        const idx = vi * 3;
        positions[idx] = p.x;
        positions[idx + 1] = y;
        positions[idx + 2] = p.y;
        uvs[vi * 2] = (tx - b.tx) / b.w;
        uvs[vi * 2 + 1] = (ty - b.ty) / b.h;
        vi++;
      }
    }

    for (let j = 0; j < segments; j++) {
      for (let i = 0; i < segments; i++) {
        const a = j * verts + i;
        const b0 = a + 1;
        const c = a + verts;
        const d = c + 1;
        indices.push(a, c, b0, b0, c, d);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    const mesh = new THREE.Mesh(geom, _sharedMaterial);
    mesh.frustumCulled = true;

    const box = new THREE.Box3().setFromObject(mesh);
    return { mesh, box, cx, cy };
  }

  function buildWorld() {
    if (!_terrainGroup || !WORLD_HEIGHTMAP) return;
    _disposeChunks();

    const b = WORLD_BOUNDS;
    const cs = TERRAIN_CHUNK_SIZE;
    const chunksX = Math.ceil(b.w / cs);
    const chunksY = Math.ceil(b.h / cs);
    const segments = _lastSegments > 0 ? _lastSegments : TERRAIN_CONFIG.segmentsLod0;

    for (let cy = 0; cy < chunksY; cy++) {
      for (let cx = 0; cx < chunksX; cx++) {
        const chunk = _buildChunkMesh(cx, cy, segments);
        _terrainGroup.add(chunk.mesh);
        _chunks.push(chunk);
      }
    }
  }

  /** @deprecated use buildWorld */
  function buildLandmass() {
    _lastSegments = TERRAIN_CONFIG.segmentsLod0;
    buildWorld();
  }

  function _updateChunkVisibility() {
    if (!_camera || !_chunks.length) return;
    _projScreen.multiplyMatrices(_camera.projectionMatrix, _camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projScreen);
    _chunks.forEach(c => {
      c.mesh.visible = _frustum.intersectsBox(c.box);
    });
  }

  function syncCamera(isoState) {
    if (!_camera) return;
    const { cx, cy, zoom, viewW, viewH } = isoState;
    const target = new THREE.Vector3(cx, 0, cy);
    const dist = BASE_CAM_DIST / Math.max(zoom, 0.2);
    const horiz = Math.cos(ISO_PITCH);

    _camera.position.set(
      target.x + dist * horiz * Math.cos(ISO_AZIMUTH),
      target.y + dist * Math.sin(ISO_PITCH),
      target.z + dist * horiz * Math.sin(ISO_AZIMUTH),
    );
    _camera.lookAt(target);
    _camera.aspect = viewW / viewH;
    _camera.updateProjectionMatrix();
    _camera.updateMatrixWorld();

    setZoomTier(zoom);
    _updateChunkVisibility();
  }

  function resize(w, h) {
    if (!_renderer || !_camera) return;
    _renderer.setSize(w, h, false);
    _camera.aspect = w / h;
    _camera.updateProjectionMatrix();
  }

  function render() {
    if (_renderer && _scene && _camera) {
      _updateChunkVisibility();
      _renderer.render(_scene, _camera);
    }
  }

  function dispose() {
    _disposeChunks();
    _sharedMaterial?.dispose();
    Object.values(_textures || {}).forEach(t => t.dispose());
    _renderer?.dispose();
    _renderer = null;
    _scene = null;
    _camera = null;
    _terrainGroup = null;
    _propsGroup = null;
    _canvas = null;
    _sharedMaterial = null;
    _textures = null;
  }

  function getCanvas() { return _canvas; }

  return {
    init, buildWorld, buildLandmass, setZoomTier, syncCamera, resize, render, dispose, getCanvas,
    getScene, getCamera, getPropsGroup, getRenderer,
  };
})();
