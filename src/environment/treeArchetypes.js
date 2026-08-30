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
 * Creates an outward-normal smoothed puffy lobe geometry
 */
function createPuffyLobeGeometry(radius, centerOffset = new THREE.Vector3()) {
  const geo = new THREE.IcosahedronGeometry(radius, 2);
  const posAttr = geo.attributes.position;
  const normalAttr = geo.attributes.normal;

  // Bend vertex normals outwards from canopy center for soft volumetric cloud lighting
  const vertex = new THREE.Vector3();
  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i);
    // Displace slightly for organic puffy lumpiness
    const noise = Math.sin(vertex.x * 4.0) * Math.cos(vertex.y * 4.0) * Math.sin(vertex.z * 4.0) * (radius * 0.08);
    vertex.addScaledVector(vertex.clone().normalize(), noise);
    posAttr.setXYZ(i, vertex.x, vertex.y, vertex.z);

    // Normal points outwards from tree center
    const outNormal = vertex.clone().add(centerOffset).normalize();
    normalAttr.setXYZ(i, outNormal.x, outNormal.y, outNormal.z);
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * 1. Fluffy Billowing Deciduous Tree (Tiny Glade cloud canopy)
 */
export function createDeciduousTreeGroup(scale = 1.0, seed = 0, themeIndex = null) {
  initMaterials();
  const group = new THREE.Group();
  group.name = 'fluffyDeciduousTree';

  const themeIdx = themeIndex !== null ? themeIndex % canopyMaterials.length : Math.floor(Math.abs(seed * 7)) % canopyMaterials.length;
  const { matTop, matMid } = canopyMaterials[themeIdx];

  // Slender curved timber trunk with slight organic lean
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.04 * scale, 0.4 * scale, 0.02 * scale),
    new THREE.Vector3(-0.02 * scale, 0.8 * scale, -0.03 * scale),
    new THREE.Vector3(0, 1.15 * scale, 0),
  ]);
  const trunkGeo = new THREE.TubeGeometry(trunkCurve, 8, 0.065 * scale, 6, false);
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  group.add(trunkMesh);

  // Cloud-like overlapping puffy canopy lobes
  const lobes = [
    // [x, y, z, radius, material]
    [0.0, 1.45 * scale, 0.0, 0.52 * scale, matTop],
    [0.24 * scale, 1.28 * scale, 0.18 * scale, 0.42 * scale, matTop],
    [-0.22 * scale, 1.25 * scale, -0.15 * scale, 0.40 * scale, matMid],
    [-0.18 * scale, 1.35 * scale, 0.22 * scale, 0.38 * scale, matTop],
    [0.2 * scale, 1.32 * scale, -0.2 * scale, 0.36 * scale, matMid],
    [0.05 * scale, 1.65 * scale, 0.05 * scale, 0.38 * scale, matTop],
    [0.12 * scale, 1.05 * scale, 0.08 * scale, 0.32 * scale, matMid],
    [-0.1 * scale, 1.08 * scale, -0.1 * scale, 0.30 * scale, matMid],
  ];

  lobes.forEach(([x, y, z, r, mat]) => {
    const lobeGeo = createPuffyLobeGeometry(r, new THREE.Vector3(x, y - 1.35 * scale, z));
    const mesh = new THREE.Mesh(lobeGeo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  return group;
}

/**
 * 2. Soft Tiered Pine Tree
 */
export function createPineTreeGroup(scale = 1.0, seed = 0) {
  initMaterials();
  const group = new THREE.Group();
  group.name = 'softPineTree';

  const matTop = canopyMaterials[3].matTop;
  const matMid = canopyMaterials[3].matMid;

  // Slender trunk
  const trunkGeo = new THREE.CylinderGeometry(0.045 * scale, 0.09 * scale, 1.3 * scale, 6);
  trunkGeo.translate(0, 0.65 * scale, 0);
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  group.add(trunkMesh);

  // Soft stacked puffy rounded cone layers
  const tiers = [
    [0.95 * scale, 0.55 * scale, matMid],
    [1.32 * scale, 0.44 * scale, matMid],
    [1.65 * scale, 0.34 * scale, matTop],
    [1.92 * scale, 0.24 * scale, matTop],
    [2.15 * scale, 0.14 * scale, matTop],
  ];

  tiers.forEach(([y, r, mat]) => {
    const tierGeo = createPuffyLobeGeometry(r, new THREE.Vector3(0, y - 1.5 * scale, 0));
    const mesh = new THREE.Mesh(tierGeo, mat);
    mesh.position.set(0, y, 0);
    mesh.scale.set(1.0, 0.75, 1.0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  return group;
}

/**
 * 3. Fluffy Shrub / Undergrowth
 */
export function createShrubGroup(scale = 1.0, seed = 0) {
  initMaterials();
  const group = new THREE.Group();
  group.name = 'fluffyShrub';

  const themeIdx = Math.floor(Math.abs(seed * 3)) % canopyMaterials.length;
  const { matTop, matMid } = canopyMaterials[themeIdx];

  const clusters = [
    [0, 0.22 * scale, 0, 0.28 * scale, matTop],
    [0.15 * scale, 0.16 * scale, 0.1 * scale, 0.22 * scale, matTop],
    [-0.14 * scale, 0.18 * scale, -0.08 * scale, 0.20 * scale, matMid],
    [0.1 * scale, 0.19 * scale, -0.12 * scale, 0.18 * scale, matMid],
  ];

  clusters.forEach(([x, y, z, r, mat]) => {
    const geo = createPuffyLobeGeometry(r);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });

  return group;
}
