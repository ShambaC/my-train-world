import * as THREE from 'three';
import { VOXEL_SIZE, mulberry32 } from '../terrain.js';
import { applyWindSway } from './wind.js';
import { makeAtlasTexture } from '../utils/atlasTextures.js';

/**
 * Creates an optimized forest border using InstancedMesh.
 * Uses world units (terrainSize × VOXEL_SIZE). Seeded for determinism.
 * @param {object} terrainSize - { length, breadth } in voxels
 * @param {number} seed - world seed for tree placement
 * @param {number} rows - number of tree rows (default 6)
 * @param {number} rowSpacing - world units between rows (default 1.2)
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

  // --- 1. Ground disc: just past the outermost tree row, circular so no
  // oversized corner plane peeks out past the fog wall ---
  const borderDepth = rows * rowSpacing;
  const groundRadius = Math.max(worldHalfL, worldHalfB) + borderDepth + 1.5;
  const groundGeometry = new THREE.CircleGeometry(groundRadius, 48);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x41503a,
    roughness: 0.9,
    metalness: 0.1,
    map: makeAtlasTexture('forest_ground', [0.5, 0.5]),
  });
  const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = -0.02;
  groundPlane.receiveShadow = true;
  borderGroup.add(groundPlane);

  // --- 2. Estimate total trees for InstancedMesh allocation ---
  let totalTrees = 0;
  const baseDensity = 3.0; // trees per sq world unit
  for (let r = 0; r < rows; r++) {
    const offset = 0.3 + r * rowSpacing; // start 0.3 outside terrain edge
    const density = baseDensity * (1 - (r / rows) * 0.6);
    // Perimeter of ring at this offset
    const perimL = worldL + offset * 2;
    const perimB = worldB + offset * 2;
    const area = (perimL * perimB) - (worldL * worldB); // ring area
    totalTrees += Math.floor(area * density);
  }
  totalTrees = Math.min(totalTrees, 20000);

  // --- 3. Instanced meshes ---
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a3728,
    map: makeAtlasTexture('bark'),
  });
  applyWindSway(trunkMat, { leaves: false, strength: 0.6 });
  const coneGeos = [
    new THREE.ConeGeometry(0.8, 1.5, 6),
    new THREE.ConeGeometry(0.6, 1.3, 6),
    new THREE.ConeGeometry(0.4, 1.0, 6),
  ];
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x3a6b1f,
    flatShading: true,
    map: makeAtlasTexture('leaf_dark'),
  });
  applyWindSway(foliageMat, { strength: 1 });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, totalTrees);
  const cone1Inst = new THREE.InstancedMesh(coneGeos[0], foliageMat, totalTrees);
  const cone2Inst = new THREE.InstancedMesh(coneGeos[1], foliageMat, totalTrees);
  const cone3Inst = new THREE.InstancedMesh(coneGeos[2], foliageMat, totalTrees);

  // Border trees sit outside the play area — they never cast shadows
  // (shadow-map budget goes to the buildable region) but still receive.
  [trunkInst, cone1Inst, cone2Inst, cone3Inst].forEach(m => {
    m.receiveShadow = true;
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
      const scale = 0.7 + rng() * 0.9;
      const rotY = rng() * Math.PI * 2;
      const tilt = (rng() - 0.5) * 0.1; // slight tilt
      quaternion.setFromEuler(new THREE.Euler(tilt, rotY, tilt * 0.5));

      const setPart = (mesh, yOff) => {
        position.set(x, yOff * scale, z);
        scaleVec.set(scale, scale, scale);
        matrix.compose(position, quaternion, scaleVec);
        mesh.setMatrixAt(treeIndex, matrix);
      };
      setPart(trunkInst, 1.0);
      setPart(cone1Inst, 2.5);
      setPart(cone2Inst, 3.5);
      setPart(cone3Inst, 4.5);
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

    // North
    placeTrees(-outerL, outerL, worldHalfB + offset, worldHalfB + offset + rowSpacing, Math.floor(count * 0.25));
    // South
    placeTrees(-outerL, outerL, -worldHalfB - offset - rowSpacing, -worldHalfB - offset, Math.floor(count * 0.25));
    // East
    placeTrees(worldHalfL + offset, worldHalfL + offset + rowSpacing, -outerB, outerB, Math.floor(count * 0.25));
    // West
    placeTrees(-worldHalfL - offset - rowSpacing, -worldHalfL - offset, -outerB, outerB, Math.floor(count * 0.25));
  }

  trunkInst.instanceMatrix.needsUpdate = true;
  cone1Inst.instanceMatrix.needsUpdate = true;
  cone2Inst.instanceMatrix.needsUpdate = true;
  cone3Inst.instanceMatrix.needsUpdate = true;

  borderGroup.add(trunkInst, cone1Inst, cone2Inst, cone3Inst);

  return borderGroup;
}
