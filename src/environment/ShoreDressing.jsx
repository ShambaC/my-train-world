/**
 * Shoreline Dressing (Tiny Glade Style)
 * Visual-only submerged wooden stepping posts, floating water lily pads with blossoms,
 * shoreline reeds with cattails, and smooth river stones.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { VOXEL_SIZE, WATER_LEVEL_VOXEL, mulberry32 } from '../terrain.js';
import { getStyleMaterial } from '../render/styleMaterials.js';
import { getStyleTexture } from '../utils/atlasTextures.js';
import { applyWindSway } from './wind.js';

export default function ShoreDressing({ terrainData, lighting }) {
  const meshGroup = useMemo(() => {
    const group = new THREE.Group();
    group.name = 'shoreDressing';

    if (!terrainData?.heightMap) return group;

    const { heightMap, length, breadth, seed = 1337 } = terrainData;
    const rng = mulberry32((((seed * 9187) >>> 0) ^ 439) >>> 0);

    // ── 1. Shore Reeds with Cattail Tops ────────────────────────────────────
    const reedGeo = new THREE.PlaneGeometry(0.3, 0.65);
    reedGeo.translate(0, 0.325, 0);

    const reedTex = getStyleTexture('reed_cluster_a');
    const reedMat = new THREE.MeshStandardMaterial({
      map: reedTex,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
      roughness: 0.85,
    });
    applyWindSway(reedMat, { leaves: true, strength: 0.45 });

    // ── 2. Floating Water Lily Pads with Flower Blossoms ────────────────────
    const lilyGeo = new THREE.CircleGeometry(0.22, 10);
    const lilyTex = getStyleTexture('pond_rings');
    const lilyMat = new THREE.MeshStandardMaterial({
      color: 0x488a42,
      map: lilyTex,
      transparent: true,
      roughness: 0.55,
      depthWrite: false,
    });

    const blossomGeo = new THREE.DodecahedronGeometry(0.06, 0);
    const blossomMatPink = new THREE.MeshStandardMaterial({
      color: 0xf2adc0,
      roughness: 0.6,
      depthWrite: false,
    });
    const blossomMatGold = new THREE.MeshStandardMaterial({
      color: 0xf7e279,
      roughness: 0.6,
      depthWrite: false,
    });

    // ── 3. Submerged Wooden Stepping Posts (like in reference image) ────────
    const postGeo = new THREE.CylinderGeometry(0.06, 0.07, 0.55, 6);
    postGeo.translate(0, 0.275, 0);
    const postMat = getStyleMaterial('dark_timber', {
      color: 0x4a3b2b,
      roughness: 0.88,
    });

    // ── 4. Shoreline Stepping River Stones ──────────────────────────────────
    const stoneGeo = new THREE.DodecahedronGeometry(0.16, 1);
    stoneGeo.scale(1.2, 0.6, 1.0);
    const stoneMat = getStyleMaterial('warm_rock', {
      color: 0x8a8274,
      roughness: 0.85,
    });

    const reedTransforms = [];
    const lilyTransforms = [];
    const blossomTransforms = [];
    const postTransforms = [];
    const stoneTransforms = [];

    for (let x = 2; x < length - 2; x++) {
      for (let z = 2; z < breadth - 2; z++) {
        const h = heightMap[x][z];

        // Shallow river banks (h === 4 is ground edge right above water)
        if (h === WATER_LEVEL_VOXEL + 1) {
          // Reeds along shore
          if (rng() < 0.35) {
            const wx = (x - length / 2 + (rng() - 0.5) * 0.7) * VOXEL_SIZE;
            const wy = h * VOXEL_SIZE + 0.22;
            const wz = (z - breadth / 2 + (rng() - 0.5) * 0.7) * VOXEL_SIZE;
            const rotY = rng() * Math.PI * 2;
            const scale = 0.75 + rng() * 0.5;
            reedTransforms.push({ x: wx, y: wy, z: wz, rotY, scale });
          }

          // Stepping river stones
          if (rng() < 0.18) {
            const wx = (x - length / 2 + (rng() - 0.5) * 0.8) * VOXEL_SIZE;
            const wy = h * VOXEL_SIZE + 0.12;
            const wz = (z - breadth / 2 + (rng() - 0.5) * 0.8) * VOXEL_SIZE;
            const rotY = rng() * Math.PI * 2;
            const scale = 0.8 + rng() * 0.6;
            stoneTransforms.push({ x: wx, y: wy, z: wz, rotY, scale });
          }
        } else if (h === WATER_LEVEL_VOXEL) {
          // Shallow submerged water cells
          // Lily pads with tiny blossoms
          if (rng() < 0.22) {
            const wx = (x - length / 2 + (rng() - 0.5) * 0.8) * VOXEL_SIZE;
            const wy = 2.0 + 0.008;
            const wz = (z - breadth / 2 + (rng() - 0.5) * 0.8) * VOXEL_SIZE;
            const rotY = rng() * Math.PI * 2;
            const scale = 0.7 + rng() * 0.6;
            lilyTransforms.push({ x: wx, y: wy, z: wz, rotY, scale });

            // Flower blossom sitting in lily pad
            if (rng() < 0.55) {
              blossomTransforms.push({
                x: wx,
                y: wy + 0.04,
                z: wz,
                scale: 0.8 + rng() * 0.4,
                isPink: rng() < 0.6,
              });
            }
          }

          // Wooden stepping posts in shallows (as in Tiny Glade reference)
          if (rng() < 0.12) {
            const wx = (x - length / 2 + (rng() - 0.5) * 0.6) * VOXEL_SIZE;
            const wy = 1.65; // base buried in sand, top sticks 0.1 above water
            const wz = (z - breadth / 2 + (rng() - 0.5) * 0.6) * VOXEL_SIZE;
            const rotY = (rng() - 0.5) * 0.2;
            postTransforms.push({ x: wx, y: wy, z: wz, rotY, scale: 0.85 + rng() * 0.3 });
          }
        }
      }
    }

    const mat4 = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const sc = new THREE.Vector3();

    // Add Reeds
    if (reedTransforms.length > 0) {
      const reedMesh = new THREE.InstancedMesh(reedGeo, reedMat, reedTransforms.length);
      reedMesh.raycast = () => {};
      reedMesh.castShadow = false;
      reedMesh.receiveShadow = true;
      reedTransforms.forEach((t, i) => {
        pos.set(t.x, t.y, t.z);
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rotY);
        sc.set(t.scale, t.scale, t.scale);
        mat4.compose(pos, quat, sc);
        reedMesh.setMatrixAt(i, mat4);
      });
      reedMesh.instanceMatrix.needsUpdate = true;
      group.add(reedMesh);
    }

    // Add Lily Pads
    if (lilyTransforms.length > 0) {
      const lilyMesh = new THREE.InstancedMesh(lilyGeo, lilyMat, lilyTransforms.length);
      lilyMesh.raycast = () => {};
      lilyMesh.castShadow = false;
      lilyMesh.receiveShadow = false;
      lilyTransforms.forEach((t, i) => {
        pos.set(t.x, t.y, t.z);
        quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
        sc.set(t.scale, t.scale, t.scale);
        mat4.compose(pos, quat, sc);
        lilyMesh.setMatrixAt(i, mat4);
      });
      lilyMesh.instanceMatrix.needsUpdate = true;
      group.add(lilyMesh);
    }

    // Add Blossoms
    if (blossomTransforms.length > 0) {
      const pinks = blossomTransforms.filter((b) => b.isPink);
      const golds = blossomTransforms.filter((b) => !b.isPink);

      if (pinks.length > 0) {
        const pinkMesh = new THREE.InstancedMesh(blossomGeo, blossomMatPink, pinks.length);
        pinkMesh.raycast = () => {};
        pinkMesh.castShadow = false;
        pinks.forEach((t, i) => {
          pos.set(t.x, t.y, t.z);
          sc.set(t.scale, t.scale * 0.7, t.scale);
          mat4.compose(pos, quat.identity(), sc);
          pinkMesh.setMatrixAt(i, mat4);
        });
        pinkMesh.instanceMatrix.needsUpdate = true;
        group.add(pinkMesh);
      }

      if (golds.length > 0) {
        const goldMesh = new THREE.InstancedMesh(blossomGeo, blossomMatGold, golds.length);
        goldMesh.raycast = () => {};
        goldMesh.castShadow = false;
        golds.forEach((t, i) => {
          pos.set(t.x, t.y, t.z);
          sc.set(t.scale, t.scale * 0.7, t.scale);
          mat4.compose(pos, quat.identity(), sc);
          goldMesh.setMatrixAt(i, mat4);
        });
        goldMesh.instanceMatrix.needsUpdate = true;
        group.add(goldMesh);
      }
    }

    // Add Stepping Posts
    if (postTransforms.length > 0) {
      const postMesh = new THREE.InstancedMesh(postGeo, postMat, postTransforms.length);
      postMesh.raycast = () => {};
      postMesh.castShadow = true;
      postMesh.receiveShadow = true;
      postTransforms.forEach((t, i) => {
        pos.set(t.x, t.y, t.z);
        quat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), t.rotY);
        sc.set(t.scale, t.scale, t.scale);
        mat4.compose(pos, quat, sc);
        postMesh.setMatrixAt(i, mat4);
      });
      postMesh.instanceMatrix.needsUpdate = true;
      group.add(postMesh);
    }

    // Add River Stones
    if (stoneTransforms.length > 0) {
      const stoneMesh = new THREE.InstancedMesh(stoneGeo, stoneMat, stoneTransforms.length);
      stoneMesh.raycast = () => {};
      stoneMesh.castShadow = true;
      stoneMesh.receiveShadow = true;
      stoneTransforms.forEach((t, i) => {
        pos.set(t.x, t.y, t.z);
        quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rotY);
        sc.set(t.scale, t.scale, t.scale);
        mat4.compose(pos, quat, sc);
        stoneMesh.setMatrixAt(i, mat4);
      });
      stoneMesh.instanceMatrix.needsUpdate = true;
      group.add(stoneMesh);
    }

    return group;
  }, [terrainData]);

  return <primitive object={meshGroup} />;
}
