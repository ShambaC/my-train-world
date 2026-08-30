/**
 * Shoreline Dressing
 * Visual-only reeds, small rocks, and lily pads placed along water edges.
 * Never interacts with raycasting or gameplay systems.
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

    const reedGeo = new THREE.PlaneGeometry(0.35, 0.65);
    reedGeo.translate(0, 0.325, 0);

    const reedTex = getStyleTexture('reed_cluster_a');
    const reedMat = new THREE.MeshStandardMaterial({
      map: reedTex,
      transparent: true,
      alphaTest: 0.25,
      side: THREE.DoubleSide,
      roughness: 0.85,
    });
    applyWindSway(reedMat, { leaves: true, strength: 0.5 });

    const lilyTex = getStyleTexture('pond_rings');
    const lilyGeo = new THREE.CircleGeometry(0.22, 8);
    const lilyMat = new THREE.MeshStandardMaterial({
      color: 0x4a7a3b,
      map: lilyTex,
      transparent: true,
      roughness: 0.6,
      depthWrite: false,
    });

    const reedTransforms = [];
    const lilyTransforms = [];

    for (let x = 2; x < length - 2; x++) {
      for (let z = 2; z < breadth - 2; z++) {
        const h = heightMap[x][z];

        // Shoreline cells (height 3 is water level, 4 is shore edge)
        if (h === WATER_LEVEL_VOXEL + 1) {
          if (rng() < 0.28) {
            const wx = (x - length / 2 + (rng() - 0.5) * 0.6) * VOXEL_SIZE;
            const wy = h * VOXEL_SIZE + 0.25;
            const wz = (z - breadth / 2 + (rng() - 0.5) * 0.6) * VOXEL_SIZE;
            const rotY = rng() * Math.PI * 2;
            const scale = 0.75 + rng() * 0.5;

            reedTransforms.push({ x: wx, y: wy, z: wz, rotY, scale });
          }
        } else if (h === WATER_LEVEL_VOXEL) {
          // Sheltered shallow water - lily pads
          if (rng() < 0.08) {
            const wx = (x - length / 2 + (rng() - 0.5) * 0.8) * VOXEL_SIZE;
            const wy = 2.0 + 0.01;
            const wz = (z - breadth / 2 + (rng() - 0.5) * 0.8) * VOXEL_SIZE;
            const rotY = rng() * Math.PI * 2;

            lilyTransforms.push({ x: wx, y: wy, z: wz, rotY, scale: 0.8 + rng() * 0.4 });
          }
        }
      }
    }

    if (reedTransforms.length > 0) {
      const reedMesh = new THREE.InstancedMesh(reedGeo, reedMat, reedTransforms.length);
      reedMesh.raycast = () => {};
      reedMesh.castShadow = false;
      reedMesh.receiveShadow = true;

      const mat4 = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const sc = new THREE.Vector3();

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

    if (lilyTransforms.length > 0) {
      const lilyMesh = new THREE.InstancedMesh(lilyGeo, lilyMat, lilyTransforms.length);
      lilyMesh.raycast = () => {};
      lilyMesh.castShadow = false;
      lilyMesh.receiveShadow = false;

      const mat4 = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      const sc = new THREE.Vector3();

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

    return group;
  }, [terrainData]);

  return <primitive object={meshGroup} />;
}
