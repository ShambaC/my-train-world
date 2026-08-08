import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import ModelLibrary from '../models/ModelLibrary';

const VOXEL = 0.5;

// Scatter definitions — probability per 2x2 cell block (≈1 world sq unit)
const SCATTER_DEFS = [
  { key: 'lineside-oak', prob: 0.045, spacing: 3, scale: [0.85, 1.15], slope: 2 },
  { key: 'lineside-pine', prob: 0.035, spacing: 3, scale: [0.85, 1.15], slope: 2 },
  { key: 'lineside-shrub', prob: 0.09, spacing: 2, scale: [0.85, 1.15], slope: 2 },
  { key: 'railway-boulder', prob: 0.05, spacing: 3, scale: [0.8, 1.3], slope: 0, rockyOnly: true },
  { key: 'railway-rock-cluster', prob: 0.04, spacing: 3, scale: [0.8, 1.3], slope: 0, rockyOnly: true },
  { key: 'big-red-barn', prob: 0.004, spacing: 10, scale: [1, 1], slope: 0, flat: 2 },
  { key: 'goods-shed', prob: 0.006, spacing: 10, scale: [1, 1], slope: 0, flat: 2 },
  { key: 'crossing-keeper-hut', prob: 0.008, spacing: 8, scale: [1, 1], slope: 0, flat: 2 },
  { key: 'lineside-fence-run', prob: 0.02, spacing: 6, scale: [1, 1], slope: 0, flat: 1, fence: true },
];

/**
 * Randomly decorates the terrain with instanced GLB props.
 * Excludes water, steep slopes (per def), existing tracks and station zones.
 */
export default function ScatterProps({ terrainData, trackManager, stationManager, trackCount, stationsVersion }) {
  const groupRef = useRef(new THREE.Group());
  const layoutRef = useRef([]);

  const length = terrainData?.length || 0;
  const breadth = terrainData?.breadth || 0;

  // Build scatter layout whenever terrain changes
  useMemo(() => {
    groupRef.current = new THREE.Group();
    layoutRef.current = [];

    if (!terrainData?.heightMap) return;

    const { heightMap } = terrainData;
    const cells = [];

    for (let x = 2; x < length - 2; x += 2) {
      for (let z = 2; z < breadth - 2; z += 2) {
        cells.push({ x, z });
      }
    }

    for (const def of SCATTER_DEFS) {
      const entry = ModelLibrary.getEntry(def.key);
      const instances = [];
      const placedList = [];

      const isFlat = (x, z, r) => {
        const h = heightMap[x][z];
        if (h <= 2) return false;
        for (let dx = -r; dx <= r; dx++) {
          for (let dz = -r; dz <= r; dz++) {
            if (heightMap[x + dx][z + dz] !== h) return false;
          }
        }
        return true;
      };

      const slopeAt = (x, z) => {
        const h = heightMap[x][z];
        return Math.max(
          Math.abs(h - heightMap[x - 1][z]),
          Math.abs(h - heightMap[x + 1][z]),
          Math.abs(h - heightMap[x][z - 1]),
          Math.abs(h - heightMap[x][z + 1])
        );
      };

      for (const { x, z } of cells) {
        const h = heightMap[x][z];
        if (h <= 2) continue; // water/river

        const slope = slopeAt(x, z);
        if (def.slope !== undefined && slope > def.slope) continue;
        if (def.rockyOnly && !(slope >= 1 || h > 5)) continue;
        if (def.flat) {
          const r = def.flat;
          if (!isFlat(x, z, r)) continue;
        }

        let tooClose = false;
        for (const p of placedList) {
          if (Math.abs(p.x - x) < def.spacing && Math.abs(p.z - z) < def.spacing) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        if (Math.random() > def.prob) continue;
        placedList.push({ x, z });

        const jitter = def.scale[0] + Math.random() * (def.scale[1] - def.scale[0]);
        let rotY = Math.random() * Math.PI * 2;
        if (def.fence) rotY = Math.random() < 0.5 ? 0 : Math.PI / 2;
        else if (def.flat) rotY = Math.floor(Math.random() * 4) * (Math.PI / 2);

        instances.push({
          x: (x - length / 2 + 0.5) * VOXEL,
          y: h * VOXEL + 0.25,
          z: (z - breadth / 2 + 0.5) * VOXEL,
          rotY,
          scale: jitter,
          cellX: x,
          cellZ: z,
        });
      }

      if (instances.length > 0) {
        const mesh = new THREE.InstancedMesh(entry.geometry, entry.material, instances.length);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        instances.forEach((inst, i) => {
          layoutRef.current.push({ mesh, index: i, ...inst });
        });
        groupRef.current.add(mesh);
      }
    }

    layoutRef.current._needsExclusion = true;
  }, [terrainData, length, breadth]);

  // Exclusion pass: hide instances that collide with tracks or stations
  useEffect(() => {
    const layout = layoutRef.current;
    if (!layout.length) return;

    const excluded = new Set();
    const markCell = (x, z, r) => {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          excluded.add(`${x + dx},${z + dz}`);
        }
      }
    };

    for (const track of trackManager.getAllTracks()) {
      const cx = Math.round(track.position.x / VOXEL + length / 2 - 0.5);
      const cz = Math.round(track.position.z / VOXEL + breadth / 2 - 0.5);
      markCell(cx, cz, 2);
    }

    for (const station of stationManager.getAllStations()) {
      const r = station.voxelRect;
      for (let x = r.minX - 1; x <= r.maxX + 1; x++) {
        for (let z = r.minZ - 1; z <= r.maxZ + 1; z++) {
          excluded.add(`${x},${z}`);
        }
      }
    }

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scaleVec = new THREE.Vector3();

    for (const inst of layout) {
      const isExcluded = excluded.has(`${inst.cellX},${inst.cellZ}`);
      if (isExcluded === inst.hidden) continue;
      inst.hidden = isExcluded;

      if (isExcluded) {
        position.set(inst.x, inst.y, inst.z);
        quaternion.setFromEuler(new THREE.Euler(0, inst.rotY, 0));
        scaleVec.set(0, 0, 0);
      } else {
        position.set(inst.x, inst.y, inst.z);
        quaternion.setFromEuler(new THREE.Euler(0, inst.rotY, 0));
        scaleVec.set(inst.scale, inst.scale, inst.scale);
      }
      matrix.compose(position, quaternion, scaleVec);
      inst.mesh.setMatrixAt(inst.index, matrix);
      inst.mesh.instanceMatrix.needsUpdate = true;
    }
  }, [trackCount, stationsVersion, terrainData, trackManager, stationManager, length, breadth]);

  return <primitive object={groupRef.current} />;
}
