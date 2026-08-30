import * as THREE from 'three';
import { VOXEL_SIZE, mulberry32 } from '../terrain.js';
import { applyWindSway } from './wind.js';
import { getStyleMaterial } from '../render/styleMaterials.js';
import { STYLE_PALETTE } from '../render/stylePalette.js';

/**
 * Creates an optimized forest border using InstancedMesh.
 * Uses world units (terrainSize × VOXEL_SIZE). Seeded for determinism.
 */
export function createForestBorder(terrainSize, seed = 1337, rows = 6, rowSpacing = 1.2) {
  const rng = mulberry32((((seed * 40503) >>> 0) ^ 613) >>> 0);
  const borderGroup = new THREE.Group();
  borderGroup.name = 'forestBorder';

  // Convert to world units
  const worldHalfL = (terrainSize.length / 2) * VOXEL_SIZE;
  const worldHalfB = (terrainSize.breadth / 2) * VOXEL_SIZE;
  const worldL = worldHalfL * 2;
  const worldB = worldHalfB * 2;

  // --- 1. Ground disc ---
  const borderDepth = rows * rowSpacing;
  const groundRadius = Math.max(worldHalfL, worldHalfB) + borderDepth + 1.5;
  const groundGeometry = new THREE.CircleGeometry(groundRadius, 48);
  const groundMaterial = getStyleMaterial('forest_ground', {
    color: STYLE_PALETTE.forest_ground.dark,
    roughness: 0.92,
  });

  const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = -0.02;
  groundPlane.receiveShadow = true;
  borderGroup.add(groundPlane);

  // --- 2. Estimate total trees ---
  let totalTrees = 0;
  const baseDensity = 2.8;
  for (let r = 0; r < rows; r++) {
    const offset = 0.3 + r * rowSpacing;
    const density = baseDensity * (1 - (r / rows) * 0.6);
    const perimL = worldL + offset * 2;
    const perimB = worldB + offset * 2;
    const area = (perimL * perimB) - (worldL * worldB);
    totalTrees += Math.floor(area * density);
  }
  totalTrees = Math.min(totalTrees, 16000);

  // --- 3. Instanced meshes for tree trunks and foliage clusters ---
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.6, 6);
  const trunkMat = getStyleMaterial('dark_timber', {
    color: STYLE_PALETTE.dark_timber.base,
    roughness: 0.88,
  });
  applyWindSway(trunkMat, { leaves: false, strength: 0.4 });

  const canopyGeo1 = new THREE.DodecahedronGeometry(0.75, 1);
  const canopyGeo2 = new THREE.DodecahedronGeometry(0.6, 1);
  const canopyGeo3 = new THREE.DodecahedronGeometry(0.45, 1);

  const foliageMat1 = getStyleMaterial('foliage', {
    color: STYLE_PALETTE.foliage_pine.mid,
    roughness: 0.88,
  });
  const foliageMat2 = getStyleMaterial('foliage', {
    color: STYLE_PALETTE.foliage_pine.top,
    roughness: 0.85,
  });

  applyWindSway(foliageMat1, { leaves: true, strength: 0.6 });
  applyWindSway(foliageMat2, { leaves: true, strength: 0.7 });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, totalTrees);
  const cluster1Inst = new THREE.InstancedMesh(canopyGeo1, foliageMat1, totalTrees);
  const cluster2Inst = new THREE.InstancedMesh(canopyGeo2, foliageMat1, totalTrees);
  const cluster3Inst = new THREE.InstancedMesh(canopyGeo3, foliageMat2, totalTrees);

  [trunkInst, cluster1Inst, cluster2Inst, cluster3Inst].forEach((m) => {
    m.receiveShadow = true;
    m.castShadow = false;
  });

  // --- 4. Place trees ring by ring ---
  let treeIndex = 0;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();

  const placeTrees = (startX, endX, startZ, endZ, count) => {
    const w = Math.abs(endX - startX);
    const d = Math.abs(endZ - startZ);
    for (let i = 0; i < count; i++) {
      if (treeIndex >= totalTrees) return;
      const x = startX + rng() * w;
      const z = startZ + rng() * d;
      const scale = 0.75 + rng() * 0.8;
      const rotY = rng() * Math.PI * 2;
      const tilt = (rng() - 0.5) * 0.1;
      quaternion.setFromEuler(new THREE.Euler(tilt, rotY, tilt * 0.5));

      const setPart = (mesh, yOff) => {
        position.set(x, yOff * scale, z);
        scaleVec.set(scale, scale, scale);
        matrix.compose(position, quaternion, scaleVec);
        mesh.setMatrixAt(treeIndex, matrix);
      };
      setPart(trunkInst, 0.8);
      setPart(cluster1Inst, 1.7);
      setPart(cluster2Inst, 2.4);
      setPart(cluster3Inst, 3.1);
      treeIndex++;
    }
  };

  for (let r = 0; r < rows; r++) {
    const offset = 0.3 + r * rowSpacing;
    const density = baseDensity * (1 - (r / rows) * 0.6);
    const innerL = worldHalfL + (r === 0 ? 0 : 0.3 + (r - 1) * rowSpacing);
    const innerB = worldHalfB + (r === 0 ? 0 : 0.3 + (r - 1) * rowSpacing);
    const outerL = worldHalfL + offset + rowSpacing;
    const outerB = worldHalfB + offset + rowSpacing;

    const perim = (outerL * outerB) - (innerL * innerB);
    const count = Math.floor(perim * density);

    placeTrees(-outerL, outerL, worldHalfB + offset, worldHalfB + offset + rowSpacing, Math.floor(count * 0.25));
    placeTrees(-outerL, outerL, -worldHalfB - offset - rowSpacing, -worldHalfB - offset, Math.floor(count * 0.25));
    placeTrees(worldHalfL + offset, worldHalfL + offset + rowSpacing, -outerB, outerB, Math.floor(count * 0.25));
    placeTrees(-worldHalfL - offset - rowSpacing, -worldHalfL - offset, -outerB, outerB, Math.floor(count * 0.25));
  }

  trunkInst.instanceMatrix.needsUpdate = true;
  cluster1Inst.instanceMatrix.needsUpdate = true;
  cluster2Inst.instanceMatrix.needsUpdate = true;
  cluster3Inst.instanceMatrix.needsUpdate = true;

  borderGroup.add(trunkInst, cluster1Inst, cluster2Inst, cluster3Inst);

  return borderGroup;
}
