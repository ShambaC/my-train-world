/**
 * Procedural Tree & Shrub Archetypes
 * Generates clustered, painterly foliage volumes inspired by Tiny Glade.
 */
import * as THREE from 'three';
import { getStyleMaterial } from '../render/styleMaterials.js';
import { STYLE_PALETTE } from '../render/stylePalette.js';
import { applyWindSway } from './wind.js';

// ── Shared Materials ──────────────────────────────────────────────────────
let trunkMat = null;
let deciduousMatTop = null;
let deciduousMatMid = null;
let pineMatTop = null;
let pineMatMid = null;
let shrubMat = null;

function initMaterials() {
  if (trunkMat) return;

  trunkMat = getStyleMaterial('dark_timber', {
    color: STYLE_PALETTE.dark_timber.base,
    roughness: 0.88,
    metalness: 0.05,
  });

  deciduousMatTop = getStyleMaterial('foliage', {
    color: STYLE_PALETTE.foliage_deciduous.top,
    texture: 'deciduous_clump_a',
    roughness: 0.85,
  });

  deciduousMatMid = getStyleMaterial('foliage', {
    color: STYLE_PALETTE.foliage_deciduous.mid,
    texture: 'deciduous_clump_b',
    roughness: 0.88,
  });

  pineMatTop = getStyleMaterial('foliage', {
    color: STYLE_PALETTE.foliage_pine.top,
    texture: 'pine_clump_a',
    roughness: 0.85,
  });

  pineMatMid = getStyleMaterial('foliage', {
    color: STYLE_PALETTE.foliage_pine.mid,
    texture: 'pine_clump_b',
    roughness: 0.88,
  });

  shrubMat = getStyleMaterial('foliage', {
    color: STYLE_PALETTE.foliage_shrub.mid,
    texture: 'shrub_clump_a',
    roughness: 0.9,
  });

  applyWindSway(trunkMat, { leaves: false, strength: 0.25 });
  applyWindSway(deciduousMatTop, { leaves: true, strength: 0.6 });
  applyWindSway(deciduousMatMid, { leaves: true, strength: 0.5 });
  applyWindSway(pineMatTop, { leaves: true, strength: 0.4 });
  applyWindSway(pineMatMid, { leaves: true, strength: 0.35 });
  applyWindSway(shrubMat, { leaves: true, strength: 0.3 });
}

/**
 * 1. Rounded Deciduous Tree
 * Multi-cluster organic canopy with curved trunk
 */
export function createDeciduousTreeGroup(scale = 1.0, seed = 0) {
  initMaterials();
  const group = new THREE.Group();

  // Tapered trunk
  const trunkGeo = new THREE.CylinderGeometry(0.06 * scale, 0.12 * scale, 0.9 * scale, 7);
  trunkGeo.translate(0, 0.45 * scale, 0);
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  group.add(trunkMesh);

  // 6-8 overlapping canopy clusters
  const clusterCount = 7;
  const clusterOffsets = [
    [0, 1.15, 0, 0.48, deciduousMatTop],
    [0.22, 0.95, 0.15, 0.38, deciduousMatMid],
    [-0.2, 0.98, -0.12, 0.36, deciduousMatMid],
    [-0.15, 1.05, 0.22, 0.35, deciduousMatTop],
    [0.18, 1.02, -0.18, 0.34, deciduousMatMid],
    [0.0, 1.35, 0.05, 0.32, deciduousMatTop],
    [0.1, 0.85, 0.0, 0.3, deciduousMatMid],
  ];

  clusterOffsets.forEach(([ox, oy, oz, r, mat]) => {
    const geo = new THREE.DodecahedronGeometry(r * scale, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ox * scale, oy * scale, oz * scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  return group;
}

/**
 * 2. Soft Pine Tree
 * Layered organic conical volumes
 */
export function createPineTreeGroup(scale = 1.0, seed = 0) {
  initMaterials();
  const group = new THREE.Group();

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.05 * scale, 0.1 * scale, 1.1 * scale, 6);
  trunkGeo.translate(0, 0.55 * scale, 0);
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  group.add(trunkMesh);

  // Stacked rounded cone layers
  const layers = [
    [0.9, 0.55, 0.45, pineMatMid],
    [1.25, 0.45, 0.42, pineMatMid],
    [1.55, 0.35, 0.38, pineMatTop],
    [1.8, 0.22, 0.35, pineMatTop],
  ];

  layers.forEach(([y, r, h, mat]) => {
    const geo = new THREE.ConeGeometry(r * scale, h * scale, 7);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, y * scale, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  return group;
}

/**
 * 3. Shrub / Undergrowth
 */
export function createShrubGroup(scale = 1.0) {
  initMaterials();
  const group = new THREE.Group();

  const clusters = [
    [0, 0.2, 0, 0.28],
    [0.16, 0.15, 0.12, 0.22],
    [-0.14, 0.16, -0.1, 0.2],
    [0.12, 0.18, -0.14, 0.18],
  ];

  clusters.forEach(([ox, oy, oz, r]) => {
    const geo = new THREE.DodecahedronGeometry(r * scale, 1);
    const mesh = new THREE.Mesh(geo, shrubMat);
    mesh.position.set(ox * scale, oy * scale, oz * scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  return group;
}
