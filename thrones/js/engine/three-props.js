'use strict';
// ================================================================
// three-props.js — instanced terrain props (Phase 11 MVP meshes)
// ================================================================

const ThreeProps = (() => {

  const MAX_ROCK = 120;
  const MAX_GRASS = 80;

  let _group = null;
  let _meshes = {};
  let _zoomTier = 1;
  let _allProps = [];

  function _hash(n) {
    return ((n * 1103515245) + 12345) >>> 0;
  }

  function _createRockSmGeo() {
    const g = new THREE.IcosahedronGeometry(4, 0);
    g.scale(1, 0.7, 0.85);
    return g;
  }

  function _createRockMedGeo() {
    const g = new THREE.DodecahedronGeometry(7, 0);
    g.scale(1.1, 0.75, 1);
    return g;
  }

  function _createGrassGeo() {
    const g = new THREE.PlaneGeometry(8, 10);
    g.translate(0, 5, 0);
    return g;
  }

  function _createTreeGeo() {
    const g = new THREE.ConeGeometry(6, 16, 7);
    g.translate(0, 8, 0);
    return g;
  }

  function _mat(color, flat = true, doubleSided = false) {
    return new THREE.MeshLambertMaterial({
      color,
      flatShading: flat,
      side: doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    });
  }

  function init(scene, propsGroup) {
    _group = propsGroup || new THREE.Group();
    if (!propsGroup) scene.add(_group);

    _meshes.rock_sm = new THREE.InstancedMesh(
      _createRockSmGeo(),
      _mat(0x6a6460),
      MAX_ROCK,
    );
    _meshes.rock_med = new THREE.InstancedMesh(
      _createRockMedGeo(),
      _mat(0x5a5868),
      MAX_ROCK,
    );
    _meshes.grass_clump = new THREE.InstancedMesh(
      _createGrassGeo(),
      _mat(0x4a8a38, true, true),
      MAX_GRASS,
    );
    _meshes.tree_oak = new THREE.InstancedMesh(
      _createTreeGeo(),
      _mat(0x3a6a30),
      MAX_ROCK,
    );

    Object.values(_meshes).forEach(m => {
      m.count = 0;
      m.castShadow = false;
      m.receiveShadow = false;
      _group.add(m);
    });
  }

  function scatter(propList) {
    _allProps = propList || WORLD_PROP_SCATTER || [];
    _rebuildInstances();
  }

  function _tierFromZoom(zoom) {
    if (zoom < TERRAIN_CONFIG.zoomFar) return 0;
    if (zoom > TERRAIN_CONFIG.zoomNear) return 2;
    return 1;
  }

  function setZoomTier(zoom) {
    _zoomTier = _tierFromZoom(zoom);
    _rebuildInstances();
  }

  function _propVisible(p) {
    if (p.type === 'grass_clump') return _zoomTier >= 2;
    if (p.type === 'tree_oak') return _zoomTier >= 1;
    return true;
  }

  function _rebuildInstances() {
    const counts = { rock_sm: 0, rock_med: 0, grass_clump: 0, tree_oak: 0 };
    const matrix = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scl = new THREE.Vector3();
    const yAxis = new THREE.Vector3(0, 1, 0);

    const sorted = [..._allProps].filter(_propVisible);
    const rockCap = _zoomTier === 0 ? 40 : MAX_ROCK;
    let rockUsed = 0;

    for (const p of sorted) {
      if (p.type.includes('rock') || p.type === 'tree_oak') {
        if (rockUsed >= rockCap) continue;
        rockUsed++;
      }
      const mesh = _meshes[p.type];
      if (!mesh) continue;
      const ci = counts[p.type];
      if (ci >= mesh.instanceMatrix.count) continue;

      const w = IsoMath.tileToPixel(p.tx, p.ty);
      const y = sampleHeightAtTile(p.tx, p.ty);
      pos.set(w.x, y, w.y);
      quat.setFromAxisAngle(yAxis, p.rot || 0);
      const s = (p.scale || 1) * (p.type === 'grass_clump' ? 1.2 : 1);
      scl.set(s, s, s);
      matrix.compose(pos, quat, scl);
      mesh.setMatrixAt(ci, matrix);
      counts[p.type]++;
    }

    Object.entries(_meshes).forEach(([key, mesh]) => {
      mesh.count = counts[key] || 0;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  function dispose() {
    Object.values(_meshes).forEach(m => {
      m.geometry.dispose();
      m.material.dispose();
      _group?.remove(m);
    });
    _meshes = {};
    _allProps = [];
  }

  return { init, scatter, setZoomTier, dispose };
})();
