import * as THREE from 'three';
import { VOXEL_SIZE, mulberry32 } from '../terrain.js';
import { applyWindSway } from './wind.js';
import { getStyleMaterial } from '../render/styleMaterials.js';
import { STYLE_PALETTE } from '../render/stylePalette.js';
import { FOLIAGE_THEMES } from './treeArchetypes.js';

/**
 * Creates an optimized forest border with an extended decorative ground skirt
 * matching the perimeter terrain height, with clean non-overlapping trees.
 */
export function createForestBorder(terrainSize, seed = 1337, rows = 6, rowSpacing = 1.3, terrainData = null) {
  const rng = mulberry32((((seed * 40503) >>> 0) ^ 613) >>> 0);
  const borderGroup = new THREE.Group();
  borderGroup.name = 'forestBorder';

  const len = terrainSize.length;
  const brd = terrainSize.breadth;
  const worldHalfL = (len / 2) * VOXEL_SIZE;
  const worldHalfB = (brd / 2) * VOXEL_SIZE;

  const heightMap = terrainData?.heightMap;
  const getEdgeHeight = (wx, wz) => {
    if (!heightMap) return 0.5;
    const cx = THREE.MathUtils.clamp(Math.round(wx / VOXEL_SIZE + len / 2 - 0.5), 0, len - 1);
    const cz = THREE.MathUtils.clamp(Math.round(wz / VOXEL_SIZE + brd / 2 - 0.5), 0, brd - 1);
    return Math.max(0.2, (heightMap[cx][cz] + 1) * VOXEL_SIZE);
  };

  // --- 1. Extended Solid Ground Skirt (prevents floating trees) ---
  const skirtVoxelGeo = new THREE.BoxGeometry(VOXEL_SIZE, 1.0, VOXEL_SIZE);
  skirtVoxelGeo.translate(0, -0.5, 0);
  const skirtMat = getStyleMaterial('forest_ground', {
    color: STYLE_PALETTE.forest_ground.dark,
    roughness: 0.94,
  });

  const skirtMargin = 6;
  const skirtPositions = [];
  for (let x = -skirtMargin; x < len + skirtMargin; x++) {
    for (let z = -skirtMargin; z < brd + skirtMargin; z++) {
      const isInside = x >= 0 && x < len && z >= 0 && z < brd;
      if (isInside) continue; // Only perimeter skirt cells

      const wx = (x - len / 2 + 0.5) * VOXEL_SIZE;
      const wz = (z - brd / 2 + 0.5) * VOXEL_SIZE;
      const h = getEdgeHeight(wx, wz);
      skirtPositions.push({ x: wx, y: h, z: wz });
    }
  }

  const skirtMesh = new THREE.InstancedMesh(skirtVoxelGeo, skirtMat, skirtPositions.length);
  skirtMesh.receiveShadow = true;
  skirtMesh.castShadow = false;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();

  skirtPositions.forEach((pos, i) => {
    position.set(pos.x, pos.y, pos.z);
    matrix.compose(position, quaternion, scaleVec.set(1, 1, 1));
    skirtMesh.setMatrixAt(i, matrix);
  });
  skirtMesh.instanceMatrix.needsUpdate = true;
  borderGroup.add(skirtMesh);

  // --- 2. Clean Non-Overlapping Border Trees ---
  const trunkGeo = new THREE.CylinderGeometry(0.06, 0.10, 1.2, 6);
  trunkGeo.translate(0, 0.6, 0);
  const trunkMat = getStyleMaterial('dark_timber', {
    color: 0x3a2c20,
    roughness: 0.9,
  });
  applyWindSway(trunkMat, { leaves: false, strength: 0.2 });

  // Clean stylized foliage canopies (1 canopy per tree to prevent any z-fighting)
  const canopyGeo1 = new THREE.IcosahedronGeometry(0.72, 1);
  const canopyGeo2 = new THREE.IcosahedronGeometry(0.62, 1);

  const matLime = getStyleMaterial('foliage', { color: FOLIAGE_THEMES[0].top, roughness: 0.85 });
  const matBlossom = getStyleMaterial('foliage', { color: FOLIAGE_THEMES[1].top, roughness: 0.85 });
  const matLush = getStyleMaterial('foliage', { color: FOLIAGE_THEMES[3].top, roughness: 0.85 });

  applyWindSway(matLime, { leaves: true, strength: 0.5 });
  applyWindSway(matBlossom, { leaves: true, strength: 0.5 });
  applyWindSway(matLush, { leaves: true, strength: 0.5 });

  // Distribute trees on a jittered regular grid around the perimeter
  const treeSpots = [];
  const treeSpacing = 1.35;
  const maxExtent = Math.max(worldHalfL, worldHalfB) + rows * rowSpacing;

  for (let x = -maxExtent; x <= maxExtent; x += treeSpacing) {
    for (let z = -maxExtent; z <= maxExtent; z += treeSpacing) {
      const insideTerrain = Math.abs(x) < worldHalfL - 0.2 && Math.abs(z) < worldHalfB - 0.2;
      if (insideTerrain) continue;

      const distEdge = Math.max(Math.abs(x) - worldHalfL, Math.abs(z) - worldHalfB);
      if (distEdge < 0.2 || distEdge > rows * rowSpacing) continue;

      const jx = x + (rng() - 0.5) * 0.5;
      const jz = z + (rng() - 0.5) * 0.5;
      const groundY = getEdgeHeight(jx, jz);
      const scale = 0.85 + rng() * 0.5;
      const rotY = rng() * Math.PI * 2;
      const variant = Math.floor(rng() * 3);

      treeSpots.push({ x: jx, y: groundY, z: jz, scale, rotY, variant });
    }
  }

  const totalTrees = treeSpots.length;
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, totalTrees);
  const canopy1Inst = new THREE.InstancedMesh(canopyGeo1, matLime, totalTrees);
  const canopy2Inst = new THREE.InstancedMesh(canopyGeo2, matBlossom, totalTrees);
  const canopy3Inst = new THREE.InstancedMesh(canopyGeo1, matLush, totalTrees);

  [trunkInst, canopy1Inst, canopy2Inst, canopy3Inst].forEach((m) => {
    m.receiveShadow = true;
    m.castShadow = false;
  });

  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

  treeSpots.forEach((t, i) => {
    quaternion.setFromEuler(new THREE.Euler(0, t.rotY, 0));
    scaleVec.set(t.scale, t.scale, t.scale);

    // Trunk
    position.set(t.x, t.y, t.z);
    matrix.compose(position, quaternion, scaleVec);
    trunkInst.setMatrixAt(i, matrix);

    // Single canopy variant per tree (zero-scale the other two to prevent any z-fighting)
    position.set(t.x, t.y + 1.25 * t.scale, t.z);
    matrix.compose(position, quaternion, scaleVec);

    canopy1Inst.setMatrixAt(i, t.variant === 0 ? matrix : ZERO);
    canopy2Inst.setMatrixAt(i, t.variant === 1 ? matrix : ZERO);
    canopy3Inst.setMatrixAt(i, t.variant === 2 ? matrix : ZERO);
  });

  trunkInst.instanceMatrix.needsUpdate = true;
  canopy1Inst.instanceMatrix.needsUpdate = true;
  canopy2Inst.instanceMatrix.needsUpdate = true;
  canopy3Inst.instanceMatrix.needsUpdate = true;

  borderGroup.add(trunkInst, canopy1Inst, canopy2Inst, canopy3Inst);

  return borderGroup;
}
