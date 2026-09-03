/**
 * Fluffy Tree & Foliage Archetypes (Tiny Glade Style)
 * Creates cloud-like billowing canopies with outward-curved volumetric normals
 * and pastel spring/blossom color variants.
 */
import * as THREE from 'three';
import { getStyleMaterial } from '../render/styleMaterials.js';
import { applyWindSway } from './wind.js';

// Color variations matching Tiny Glade reference
export const FOLIAGE_THEMES = [
  // 0: Spring Lime & Golden Green
  {
    name: 'spring_lime',
    top: 0xc6e88e,
    mid: 0x76ad51,
    base: 0x3d6935,
  },
  // 1: Cherry & Apple Blossom Pink
  {
    name: 'blossom_pink',
    top: 0xf5d5cd,
    mid: 0xd9989b,
    base: 0x5a5048,
  },
  // 2: Golden Warm Amber
  {
    name: 'golden_amber',
    top: 0xfce39f,
    mid: 0xbfa052,
    base: 0x4f492b,
  },
  // 3: Lush Meadow Green
  {
    name: 'lush_green',
    top: 0xa1db88,
    mid: 0x589c44,
    base: 0x29542a,
  },
  // 4: Soft Sage & Mint
  {
    name: 'sage_mint',
    top: 0xbde3cf,
    mid: 0x629c84,
    base: 0x2e5449,
  },
];

let trunkMat = null;
const canopyMaterials = [];

function initMaterials() {
  if (trunkMat) return;

  trunkMat = getStyleMaterial('dark_timber', {
    color: 0x3a2c20,
    roughness: 0.9,
    metalness: 0.05,
  });
  applyWindSway(trunkMat, { leaves: false, strength: 0.2 });

  FOLIAGE_THEMES.forEach((theme) => {
    const matTop = getStyleMaterial('foliage', {
      color: theme.top,
      texture: 'foliage_variation',
      roughness: 0.82,
    });
    const matMid = getStyleMaterial('foliage', {
      color: theme.mid,
      texture: 'foliage_variation',
      roughness: 0.85,
    });

    applyWindSway(matTop, { leaves: true, strength: 0.65 });
    applyWindSway(matMid, { leaves: true, strength: 0.55 });

    canopyMaterials.push({ matTop, matMid, theme });
  });
}

/**
 * Creates an optimized stylized foliage geometry
 */
function createStylizedFoliageGeometry(radius, heightScale = 1.0) {
  const geo = new THREE.IcosahedronGeometry(radius, 1);
  geo.scale(1.0, heightScale, 1.0);
  geo.computeVertexNormals();
  return geo;
}

/**
 * 1. Clean Stylized Deciduous Tree
 */
export function createDeciduousTreeGroup(scale = 1.0, seed = 0, themeIndex = null) {
  initMaterials();
  const group = new THREE.Group();
  group.name = 'stylizedDeciduousTree';

  const themeIdx = themeIndex !== null ? themeIndex % canopyMaterials.length : Math.floor(Math.abs(seed * 7)) % canopyMaterials.length;
  const { matTop, matMid } = canopyMaterials[themeIdx];

  const trunkGeo = new THREE.CylinderGeometry(0.06 * scale, 0.10 * scale, 1.1 * scale, 6);
  trunkGeo.translate(0, 0.55 * scale, 0);
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  group.add(trunkMesh);

  const crownGeo = createStylizedFoliageGeometry(0.65 * scale, 1.15);
  const crownMesh = new THREE.Mesh(crownGeo, matTop);
  crownMesh.position.set(0, 1.35 * scale, 0);
  crownMesh.castShadow = true;
  crownMesh.receiveShadow = true;
  group.add(crownMesh);

  return group;
}

/**
 * 2. Clean Stylized Pine Tree
 */
export function createPineTreeGroup(scale = 1.0, seed = 0) {
  initMaterials();
  const group = new THREE.Group();
  group.name = 'stylizedPineTree';

  const matTop = canopyMaterials[3].matTop;
  const matMid = canopyMaterials[3].matMid;

  const trunkGeo = new THREE.CylinderGeometry(0.05 * scale, 0.09 * scale, 1.2 * scale, 6);
  trunkGeo.translate(0, 0.6 * scale, 0);
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  group.add(trunkMesh);

  const t1Geo = new THREE.ConeGeometry(0.65 * scale, 0.85 * scale, 6);
  const t1Mesh = new THREE.Mesh(t1Geo, matMid);
  t1Mesh.position.set(0, 1.1 * scale, 0);
  t1Mesh.castShadow = true;
  t1Mesh.receiveShadow = true;

  const t2Geo = new THREE.ConeGeometry(0.48 * scale, 0.75 * scale, 6);
  const t2Mesh = new THREE.Mesh(t2Geo, matTop);
  t2Mesh.position.set(0, 1.55 * scale, 0);
  t2Mesh.castShadow = true;
  t2Mesh.receiveShadow = true;

  group.add(t1Mesh, t2Mesh);
  return group;
}

/**
 * 3. Clean Stylized Shrub
 */
export function createShrubGroup(scale = 1.0, seed = 0) {
  initMaterials();
  const group = new THREE.Group();
  group.name = 'stylizedShrub';

  const themeIdx = Math.floor(Math.abs(seed * 3)) % canopyMaterials.length;
  const { matTop } = canopyMaterials[themeIdx];

  const geo = createStylizedFoliageGeometry(0.32 * scale, 0.8);
  const mesh = new THREE.Mesh(geo, matTop);
  mesh.position.set(0, 0.22 * scale, 0);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  return group;
}

/**
 * Creates instanced mesh parts for high performance batch rendering in ScatterProps.
 */
export function createInstancedTreeDef(key, count, seed = 1337) {
  initMaterials();

  const themeIdx = Math.floor(Math.abs(seed * 7)) % canopyMaterials.length;
  const { matTop, matMid } = canopyMaterials[themeIdx];

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();

  if (key === 'lineside-oak') {
    // Deciduous: 1 trunk + 2 stylized canopy meshes
    const trunkGeo = new THREE.CylinderGeometry(0.06, 0.10, 1.1, 6);
    trunkGeo.translate(0, 0.55, 0);

    const crownGeo = createStylizedFoliageGeometry(0.62, 1.12);
    const puffGeo = createStylizedFoliageGeometry(0.42, 0.95);

    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const crownMesh = new THREE.InstancedMesh(crownGeo, matTop, count);
    const puffMesh = new THREE.InstancedMesh(puffGeo, matMid, count);

    const meshes = [trunkMesh, crownMesh, puffMesh];
    meshes.forEach((m) => { m.castShadow = true; m.receiveShadow = true; });

    const setInstance = (idx, x, y, z, rotY, scale) => {
      const parts = [];
      quaternion.setFromEuler(new THREE.Euler(0, rotY, 0));
      scaleVec.set(scale, scale, scale);

      // Trunk
      position.set(x, y, z);
      matrix.compose(position, quaternion, scaleVec);
      trunkMesh.setMatrixAt(idx, matrix);
      parts.push({ mesh: trunkMesh, index: idx, matrix: matrix.clone() });

      // Crown
      position.set(x, y + 1.25 * scale, z);
      matrix.compose(position, quaternion, scaleVec);
      crownMesh.setMatrixAt(idx, matrix);
      parts.push({ mesh: crownMesh, index: idx, matrix: matrix.clone() });

      // Side puff
      const cos = Math.cos(rotY);
      const sin = Math.sin(rotY);
      const px = x + 0.18 * cos * scale;
      const pz = z - 0.18 * sin * scale;
      position.set(px, y + 1.05 * scale, pz);
      matrix.compose(position, quaternion, scaleVec);
      puffMesh.setMatrixAt(idx, matrix);
      parts.push({ mesh: puffMesh, index: idx, matrix: matrix.clone() });

      return parts;
    };

    return { meshes, setInstance };
  } else if (key === 'lineside-pine') {
    // Pine: 1 trunk + 2 conical tiers
    const pineTheme = canopyMaterials[3];
    const trunkGeo = new THREE.CylinderGeometry(0.05, 0.09, 1.1, 6);
    trunkGeo.translate(0, 0.55, 0);

    const t1Geo = new THREE.ConeGeometry(0.60, 0.80, 6);
    const t2Geo = new THREE.ConeGeometry(0.44, 0.70, 6);

    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const t1Mesh = new THREE.InstancedMesh(t1Geo, pineTheme.matMid, count);
    const t2Mesh = new THREE.InstancedMesh(t2Geo, pineTheme.matTop, count);

    const meshes = [trunkMesh, t1Mesh, t2Mesh];
    meshes.forEach((m) => { m.castShadow = true; m.receiveShadow = true; });

    const setInstance = (idx, x, y, z, rotY, scale) => {
      const parts = [];
      quaternion.setFromEuler(new THREE.Euler(0, rotY, 0));
      scaleVec.set(scale, scale, scale);

      position.set(x, y, z);
      matrix.compose(position, quaternion, scaleVec);
      trunkMesh.setMatrixAt(idx, matrix);
      parts.push({ mesh: trunkMesh, index: idx, matrix: matrix.clone() });

      position.set(x, y + 1.0 * scale, z);
      matrix.compose(position, quaternion, scaleVec);
      t1Mesh.setMatrixAt(idx, matrix);
      parts.push({ mesh: t1Mesh, index: idx, matrix: matrix.clone() });

      position.set(x, y + 1.45 * scale, z);
      matrix.compose(position, quaternion, scaleVec);
      t2Mesh.setMatrixAt(idx, matrix);
      parts.push({ mesh: t2Mesh, index: idx, matrix: matrix.clone() });

      return parts;
    };

    return { meshes, setInstance };
  } else {
    // Shrub: 1 clean dome
    const shrubGeo = createStylizedFoliageGeometry(0.32, 0.8);
    const shrubMesh = new THREE.InstancedMesh(shrubGeo, matTop, count);
    shrubMesh.castShadow = true;
    shrubMesh.receiveShadow = true;

    const meshes = [shrubMesh];

    const setInstance = (idx, x, y, z, rotY, scale) => {
      const parts = [];
      quaternion.setFromEuler(new THREE.Euler(0, rotY, 0));
      scaleVec.set(scale, scale, scale);

      position.set(x, y + 0.22 * scale, z);
      matrix.compose(position, quaternion, scaleVec);
      shrubMesh.setMatrixAt(idx, matrix);
      parts.push({ mesh: shrubMesh, index: idx, matrix: matrix.clone() });

      return parts;
    };

    return { meshes, setInstance };
  }
}

