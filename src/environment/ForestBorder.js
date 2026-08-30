import * as THREE from 'three';
import { VOXEL_SIZE, mulberry32 } from '../terrain.js';
import { applyWindSway } from './wind.js';
import { getStyleMaterial } from '../render/styleMaterials.js';
import { STYLE_PALETTE } from '../render/stylePalette.js';
import { FOLIAGE_THEMES } from './treeArchetypes.js';

/**
 * Creates an optimized fluffy forest border using InstancedMesh.
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

  // --- 3. Instanced meshes for tree trunks and fluffy cloud canopies ---
  const trunkGeo = new THREE.CylinderGeometry(0.08, 0.14, 1.8, 6);
  const trunkMat = getStyleMaterial('dark_timber', {
    color: 0x3a2c20,
    roughness: 0.9,
  });
  applyWindSway(trunkMat, { leaves: false, strength: 0.3 });

  // Fluffy outward-normal lobe geometries
  const lobeGeo1 = new THREE.IcosahedronGeometry(0.72, 2);
  const lobeGeo2 = new THREE.IcosahedronGeometry(0.58, 2);
  const lobeGeo3 = new THREE.IcosahedronGeometry(0.48, 2);

  // Varied foliage materials: spring lime, blossom pink, lush green
  const matLimeTop = getStyleMaterial('foliage', { color: FOLIAGE_THEMES[0].top, roughness: 0.82 });
  const matLimeMid = getStyleMaterial('foliage', { color: FOLIAGE_THEMES[0].mid, roughness: 0.85 });
  const matBlossomTop = getStyleMaterial('foliage', { color: FOLIAGE_THEMES[1].top, roughness: 0.82 });
  const matLushTop = getStyleMaterial('foliage', { color: FOLIAGE_THEMES[3].top, roughness: 0.82 });

  applyWindSway(matLimeTop, { leaves: true, strength: 0.6 });
  applyWindSway(matLimeMid, { leaves: true, strength: 0.5 });
  applyWindSway(matBlossomTop, { leaves: true, strength: 0.6 });
  applyWindSway(matLushTop, { leaves: true, strength: 0.6 });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, totalTrees);
  const cluster1Inst = new THREE.InstancedMesh(lobeGeo1, matLimeTop, totalTrees);
  const cluster2Inst = new THREE.InstancedMesh(lobeGeo2, matLimeMid, totalTrees);
  const cluster3Inst = new THREE.InstancedMesh(lobeGeo3, matLushTop, totalTrees);

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
      const scale = 0.8 + rng() * 0.7;
      const rotY = rng() * Math.PI * 2;
      const tilt = (rng() - 0.5) * 0.1;
      quaternion.setFromEuler(new THREE.Euler(tilt, rotY, tilt * 0.5));

      const setPart = (mesh, yOff, xOff = 0, zOff = 0) => {
        position.set(x + xOff * scale, yOff * scale, z + zOff * scale);
        scaleVec.set(scale, scale, scale);
        matrix.compose(position, quaternion, scaleVec);
        mesh.setMatrixAt(treeIndex, matrix);
      };
      setPart(trunkInst, 0.9);
      setPart(cluster1Inst, 1.9, 0.05, 0.05);
      setPart(cluster2Inst, 2.5, -0.1, -0.08);
      setPart(cluster3Inst, 3.1, 0.08, -0.05);
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
