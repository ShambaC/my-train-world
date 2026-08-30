import * as THREE from 'three';
import { VOXEL_SIZE, mulberry32 } from '../terrain.js';
import { applyWindSway } from './wind.js';
import { makeStyleTexture } from '../utils/atlasTextures.js';

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
    map: makeStyleTexture('forest_ground', [0.5, 0.5]),
  });
  const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = -0.02;
  groundPlane.receiveShadow = true;
  borderGroup.add(groundPlane);

  // --- 2. Estimate total trees for InstancedMesh allocation ---
  let totalTrees = 0;
  const baseDensity = 1.5; // trees per sq world unit
  for (let r = 0; r < rows; r++) {
    const offset = 0.3 + r * rowSpacing;
    const density = baseDensity * (1 - (r / rows) * 0.6);
    const perimL = worldL + offset * 2;
    const perimB = worldB + offset * 2;
    const area = (perimL * perimB) - (worldL * worldB);
    totalTrees += Math.floor(area * density);
  }
  totalTrees = Math.min(totalTrees, 10000);

  // Low-poly irregular blobs keep the border soft without perfect spheres.
  const foliageGeo = new THREE.IcosahedronGeometry(0.72, 1);
  const foliagePositions = foliageGeo.attributes.position;
  for (let i = 0; i < foliagePositions.count; i += 1) {
    const x = foliagePositions.getX(i);
    const y = foliagePositions.getY(i);
    const z = foliagePositions.getZ(i);
    const wobble = 1 + 0.1 * Math.sin(x * 13 + y * 7 - z * 11);
    foliagePositions.setXYZ(i, x * wobble, y * (0.92 + 0.09 * Math.cos(z * 17)), z * wobble);
  }
  foliagePositions.needsUpdate = true;
  foliageGeo.computeVertexNormals();
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x5c4637,
    map: makeStyleTexture('bark'),
    roughness: 0.95,
  });
  applyWindSway(trunkMat, { leaves: false, strength: 0.6 });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x86aa68,
    roughness: 0.94,
    flatShading: true,
    emissive: 0x1e3c1d,
    emissiveIntensity: 0.16,
    map: makeStyleTexture('leaf_light'),
  });
  applyWindSway(foliageMat, { strength: 0.75 });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, totalTrees);
  const canopyAInst = new THREE.InstancedMesh(foliageGeo, foliageMat, totalTrees);
  const canopyBInst = new THREE.InstancedMesh(foliageGeo, foliageMat, totalTrees);
  const canopyCInst = new THREE.InstancedMesh(foliageGeo, foliageMat, totalTrees);

  // Border trees sit outside play area — no shadow casting; mid/far masses
  // retain a broken, rounded silhouette without perfect cone stacks.
  [trunkInst, canopyAInst, canopyBInst, canopyCInst].forEach((mesh) => {
    mesh.receiveShadow = true;
    mesh.userData.visualOnly = true;
    mesh.raycast = () => {};
  });
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();
  let treeIndex = 0;

  const placeTrees = (startX, endX, startZ, endZ, count) => {
    const w = Math.abs(endX - startX);
    const d = Math.abs(endZ - startZ);
    for (let i = 0; i < count; i++) {
      if (treeIndex >= totalTrees) return;
      const x = startX + rng() * w;
      const z = startZ + rng() * d;
      const scale = 0.7 + rng() * 0.9;
      const rotY = rng() * Math.PI * 2;
      const tilt = (rng() - 0.5) * 0.1;
      quaternion.setFromEuler(new THREE.Euler(tilt, rotY, tilt * 0.5));

      const setPart = (mesh, yOff, xOff = 0, zOff = 0, yScale = 1) => {
        position.set(x + xOff * scale, yOff * scale, z + zOff * scale);
        scaleVec.set(scale, scale * yScale, scale);
        matrix.compose(position, quaternion, scaleVec);
        mesh.setMatrixAt(treeIndex, matrix);
      };
      setPart(trunkInst, 1.0, 0, 0, 1.1);
      setPart(canopyAInst, 2.5, -0.22, 0.02, 0.85);
      setPart(canopyBInst, 3.45, 0.18, -0.06, 0.72);
      setPart(canopyCInst, 4.25, -0.02, 0.16, 0.62);
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
  canopyAInst.instanceMatrix.needsUpdate = true;
  canopyBInst.instanceMatrix.needsUpdate = true;
  canopyCInst.instanceMatrix.needsUpdate = true;
  borderGroup.add(trunkInst, canopyAInst, canopyBInst, canopyCInst);

  return borderGroup;
}
