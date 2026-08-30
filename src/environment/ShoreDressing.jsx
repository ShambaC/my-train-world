import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { VOXEL_SIZE, WATER_LEVEL } from '../terrain.js';
import { cellKey, collectExclusionSets } from './instanceExclusion.js';
import { makeStyleMaterial } from '../render/styleMaterials.js';

function hash(x, z, seed) {
  const value = Math.sin(x * 127.1 + z * 311.7 + seed * 74.2) * 43758.5453;
  return value - Math.floor(value);
}

export default function ShoreDressing({ terrainData, trackManager, stationManager, roadManager, revision = 0 }) {
  const dressing = useMemo(() => {
    if (!terrainData?.heightMap) return null;
    const { heightMap, length, breadth, seed = 0 } = terrainData;
    const excluded = collectExclusionSets({ trackManager, stationManager, roadManager, length, breadth });
    const reeds = [];
    const stones = [];
    const wetFringe = [];
    const isWater = (x, z) => heightMap[x]?.[z] <= 3;
    for (let x = 1; x < length - 1; x += 1) {
      for (let z = 1; z < breadth - 1; z += 1) {
        const key = cellKey(x, z);
        if (excluded.tracks.has(key) || excluded.stations.has(key) || excluded.roads.has(key) || excluded.buildings.has(key)) continue;
        if (isWater(x, z)) continue;
        const adjacentWater = isWater(x - 1, z) || isWater(x + 1, z) || isWater(x, z - 1) || isWater(x, z + 1);
        if (!adjacentWater) continue;
        const y = (heightMap[x][z] + 0.5) * VOXEL_SIZE;
        const px = (x - length / 2 + 0.5) * VOXEL_SIZE;
        const pz = (z - breadth / 2 + 0.5) * VOXEL_SIZE;
        const chance = hash(x, z, seed);
        wetFringe.push({ x: px, y: y + 0.008, z: pz, scale: 0.75 + chance * 0.45 });
        if (chance > 0.35) reeds.push({ x: px + (hash(z, x, seed) - 0.5) * 0.2, y, z: pz, scale: 0.7 + chance * 0.6 });
        if (chance < 0.22) stones.push({ x: px, y: y + 0.04, z: pz, scale: 0.08 + chance * 0.18 });
      }
    }
    return { reeds, stones, wetFringe };
  }, [terrainData, trackManager, stationManager, roadManager, revision]);

  const meshes = useMemo(() => {
    if (!dressing) return null;
    const reedMaterial = makeStyleMaterial('leaf_light', { color: 0x9dbd75, roughness: 0.96, side: THREE.DoubleSide });
    const stoneMaterial = makeStyleMaterial('warm_rock', { color: 0xb39878, roughness: 0.98, emissive: 0x3b2d25, emissiveIntensity: 0.18 });
    const fringeMaterial = makeStyleMaterial('forest_ground', { color: 0x6f955f, roughness: 1 });
    const reedGeometry = new THREE.ConeGeometry(0.025, 0.38, 5);
    const stoneGeometry = new THREE.IcosahedronGeometry(0.18, 0);
    const fringeGeometry = new THREE.CircleGeometry(0.22, 8);
    fringeGeometry.rotateX(-Math.PI / 2);
    const makeInstances = (geometry, material, records, name) => {
      if (!records.length) return null;
      const mesh = new THREE.InstancedMesh(geometry, material, records.length);
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      const axis = new THREE.Vector3(0, 1, 0);
      records.forEach((record, index) => {
        quaternion.setFromAxisAngle(axis, record.x * 0.2);
        scale.set(record.scale, record.scale, record.scale);
        matrix.compose(new THREE.Vector3(record.x, record.y, record.z), quaternion, scale);
        mesh.setMatrixAt(index, matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.userData.visualOnly = true;
      mesh.name = name;
      mesh.castShadow = name === 'shoreReeds';
      mesh.receiveShadow = true;
      mesh.raycast = () => {};
      return mesh;
    };
    return {
      reeds: makeInstances(reedGeometry, reedMaterial, dressing.reeds, 'shoreReeds'),
      stones: makeInstances(stoneGeometry, stoneMaterial, dressing.stones, 'shoreStones'),
      fringe: makeInstances(fringeGeometry, fringeMaterial, dressing.wetFringe, 'shoreWetFringe'),
    };
  }, [dressing]);
  useEffect(() => () => {
    for (const mesh of Object.values(meshes || {})) {
      mesh?.geometry?.dispose();
      mesh?.material?.dispose();
    }
  }, [meshes]);

  if (!meshes) return null;
  return (
    <group userData={{ visualOnly: true }} raycast={() => null}>
      {meshes.fringe && <primitive object={meshes.fringe} />}
      {meshes.reeds && <primitive object={meshes.reeds} />}
      {meshes.stones && <primitive object={meshes.stones} />}
    </group>
  );
}
