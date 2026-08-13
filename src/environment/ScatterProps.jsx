import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import ModelLibrary from '../models/ModelLibrary';
import { BIOME, mulberry32, isClearingCell } from '../terrain.js';
import { applyWindSway } from './wind.js';

const VOXEL = 0.5;

// Sink amount so model bases overlap the ground (hides slope overhang)
const SINK = 0.08;

// Defs that are major buildings — the only scattered props allowed to cast
// real shadows. Everything else relies on fake contact patches.
const BUILDING_DEFS = new Set(['big-red-barn', 'goods-shed', 'crossing-keeper-hut']);

// Defs that get wind sway (instanced GLB trees/shrubs).
const WIND_DEFS = new Set(['lineside-oak', 'lineside-pine', 'lineside-shrub']);

// Shared fake-contact and window-glow resources.
const PATCH_GEO = new THREE.CircleGeometry(0.3, 16);
const PATCH_MAT = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  // Disabled: these instanced discs can sort in front of distant terrain and
  // appear as floating black circles against the sky.
  opacity: 0,
  depthWrite: false,
  toneMapped: false,
});
const GLOW_GEO = new THREE.PlaneGeometry(0.13, 0.15);
const GLOW_MAT = new THREE.MeshBasicMaterial({
  color: 0xffd9a0,
  transparent: true,
  opacity: 0.6,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
  toneMapped: false,
});
// [localX dir, localZ dir, quad yaw] for the four vertical sides
const GLOW_SIDES = [
  [1, 0, Math.PI / 2],
  [-1, 0, Math.PI / 2],
  [0, 1, 0],
  [0, -1, 0],
];

// Scatter definitions — per-biome probability per 2x2 cell block (≈1 world
// sq unit). Everything is seeded via terrainData.seed, so a fixed seed
// always scatters the same scenery.
const SCATTER_DEFS = [
  {
    key: 'lineside-oak', spacing: 3, scale: [0.85, 1.15], slope: 1, skipClearings: true,
    prob: { [BIOME.forest]: 0.085, [BIOME.meadow]: 0.03, [BIOME.highland]: 0.01 },
  },
  {
    key: 'lineside-pine', spacing: 3, scale: [0.85, 1.15], slope: 1, skipClearings: true,
    prob: { [BIOME.forest]: 0.07, [BIOME.meadow]: 0.025, [BIOME.highland]: 0.01 },
  },
  {
    key: 'lineside-shrub', spacing: 2, scale: [0.85, 1.15], slope: 1,
    prob: { [BIOME.forest]: 0.09, [BIOME.meadow]: 0.08, [BIOME.highland]: 0.04, [BIOME.wetland]: 0.14 },
  },
  {
    key: 'railway-boulder', spacing: 3, scale: [0.8, 1.3], rocky: true,
    prob: { [BIOME.highland]: 0.18, [BIOME.meadow]: 0.03, [BIOME.forest]: 0.02 },
  },
  {
    key: 'railway-boulder', spacing: 4, scale: [0.6, 0.95], shore: true,
    prob: { [BIOME.meadow]: 0.05, [BIOME.wetland]: 0.1, [BIOME.forest]: 0.04 },
  },
  {
    key: 'railway-rock-cluster', spacing: 3, scale: [0.8, 1.3], rocky: true,
    prob: { [BIOME.highland]: 0.12, [BIOME.meadow]: 0.02, [BIOME.forest]: 0.02 },
  },
  {
    key: 'big-red-barn', spacing: 10, scale: [1, 1], flat: 2,
    prob: { [BIOME.meadow]: 0.006 },
  },
  {
    key: 'goods-shed', spacing: 10, scale: [1, 1], flat: 2,
    prob: { [BIOME.meadow]: 0.006, [BIOME.industrial]: 0.03 },
  },
  {
    key: 'crossing-keeper-hut', spacing: 8, scale: [1, 1], flat: 1, nearWater: true,
    prob: { [BIOME.meadow]: 0.006, [BIOME.industrial]: 0.02 },
  },
  {
    key: 'lineside-fence-run', spacing: 6, scale: [1, 1], flat: 1, fence: true,
    prob: { [BIOME.meadow]: 0.1 },
  },
];

/**
 * Deterministically decorates the terrain with instanced GLB props, chosen
 * by biome: trees in forests, rocks on slopes/highlands, barns and sheds on
 * flat fields, fences along field boundaries. Reserved construction
 * plateaus and the track corridor stay clear of trees. Excludes water,
 * steep slopes (per def), existing tracks and station zones.
 *
 * Shadow policy: only major buildings cast real shadows; every prop gets a
 * fake contact patch; trees sway in the shared wind clock.
 */
export default function ScatterProps({ terrainData, trackManager, stationManager, trackCount, stationsVersion }) {
  const groupRef = useRef(new THREE.Group());
  const layoutRef = useRef([]);

  const length = terrainData?.length || 0;
  const breadth = terrainData?.breadth || 0;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();

  // Build scatter layout whenever terrain changes
  useMemo(() => {
    groupRef.current = new THREE.Group();
    layoutRef.current = [];

    if (!terrainData?.heightMap) return;

    const { heightMap, biomeMask, plateaus } = terrainData;
    const seed = terrainData.seed ?? 1337;
    const cells = [];
    const sharedTreePlaced = [];

    for (let x = 2; x < length - 2; x += 2) {
      for (let z = 2; z < breadth - 2; z += 2) {
        cells.push({ x, z });
      }
    }

    const isFlat = (x, z, r) => {
      const h = heightMap[x][z];
      if (h <= 3) return false;
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

    // Field boundary: meadow cell next to water or a different biome
    const isBoundary = (x, z) => {
      if (biomeMask[x * breadth + z] !== BIOME.meadow) return false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nx >= length || nz < 0 || nz >= breadth) continue;
        if (heightMap[nx][nz] <= 3 || biomeMask[nx * breadth + nz] !== BIOME.meadow) return true;
      }
      return false;
    };

    // Next to water: shoreline rocks, huts at river crossings
    const nearWater = (x, z) => {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        if (nx < 0 || nx >= length || nz < 0 || nz >= breadth) continue;
        if (heightMap[nx][nz] <= 3) return true;
      }
      return false;
    };
    for (const [defIndex, def] of SCATTER_DEFS.entries()) {
      const entry = ModelLibrary.getEntry(def.key);
      const instances = [];
      // Trees (oak/pine) share one placement list so trees never overlap
      // trees; bushes/shrubs may freely grow under or next to them.
      const isTree = def.key === 'lineside-oak' || def.key === 'lineside-pine';
      const placedList = isTree ? sharedTreePlaced : [];
      const rng = mulberry32((((seed * 2654435761) >>> 0) ^ (defIndex * 40503)) >>> 0);

      for (const { x, z } of cells) {
        const h = heightMap[x][z];
        if (h <= 3) continue; // water/river

        const biome = biomeMask[x * breadth + z];
        const baseProb = def.prob[biome];
        if (!baseProb) continue;

        const slope = slopeAt(x, z);
        if (def.slope !== undefined && slope > def.slope) continue;
        if (def.rocky && slope < 1) continue; // rocks hug slope transitions
        if (def.shore && !nearWater(x, z)) continue; // shoreline rocks
        if (def.flat && !isFlat(x, z, def.flat)) continue;
        if (def.skipClearings && isClearingCell(x, z, plateaus)) continue;

        let prob = baseProb;
        if (def.fence) prob = isBoundary(x, z) ? baseProb : 0.004;
        if (def.nearWater && nearWater(x, z)) prob = Math.min(0.05, baseProb * 4);

        let tooClose = false;
        for (const p of placedList) {
          if (Math.abs(p.x - x) < def.spacing && Math.abs(p.z - z) < def.spacing) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;

        if (rng() > prob) continue;
        placedList.push({ x, z });

        const jitter = def.scale[0] + rng() * (def.scale[1] - def.scale[0]);
        let rotY = rng() * Math.PI * 2;
        if (def.fence) rotY = rng() < 0.5 ? 0 : Math.PI / 2;
        else if (def.flat) rotY = Math.floor(rng() * 4) * (Math.PI / 2);

        instances.push({
          x: (x - length / 2 + 0.5) * VOXEL,
          y: h * VOXEL + 0.25 - SINK,
          z: (z - breadth / 2 + 0.5) * VOXEL,
          rotY,
          scale: jitter,
          cellX: x,
          cellZ: z,
        });
      }

      if (instances.length === 0) continue;

      const isBuilding = BUILDING_DEFS.has(def.key);
      const isWindy = WIND_DEFS.has(def.key);

      const mesh = new THREE.InstancedMesh(entry.geometry, entry.material, instances.length);
      // Instanced casters cost one draw call per def in the shadow pass —
      // cheap enough to give every scattered prop realtime shadows.
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (isWindy) applyWindSway(entry.material, { strength: 1 });

      const patchMesh = new THREE.InstancedMesh(PATCH_GEO, PATCH_MAT, instances.length);
      patchMesh.rotation.x = -Math.PI / 2;
      patchMesh.renderOrder = 1;

      let glowMesh = null;
      if (isBuilding) {
        glowMesh = new THREE.InstancedMesh(GLOW_GEO, GLOW_MAT, instances.length * 4);
        glowMesh.renderOrder = 2;
      }
      const b = entry.bounds;
      const hx = (b.max.x - b.min.x) / 2;
      const hz = (b.max.z - b.min.z) / 2;
      const yMid = b.max.y * 0.55;

      instances.forEach((inst, i) => {
        // Model instance
        position.set(inst.x, inst.y, inst.z);
        quaternion.setFromEuler(new THREE.Euler(0, inst.rotY, 0));
        scaleVec.set(inst.scale, inst.scale, inst.scale);
        matrix.compose(position, quaternion, scaleVec);
        mesh.setMatrixAt(i, matrix);
        layoutRef.current.push({ mesh, index: i, cellX: inst.cellX, cellZ: inst.cellZ, ox: inst.x, oy: inst.y, oz: inst.z, rotQ: quaternion.clone(), scale: inst.scale });

        // Fake contact patch
        position.set(inst.x, inst.y + 0.013, inst.z);
        matrix.compose(position, quaternion, scaleVec);
        patchMesh.setMatrixAt(i, matrix);
        layoutRef.current.push({ mesh: patchMesh, index: i, cellX: inst.cellX, cellZ: inst.cellZ, ox: inst.x, oy: inst.y + 0.013, oz: inst.z, rotQ: quaternion.clone(), scale: inst.scale });

        // Window glows (4 sides)
        if (glowMesh) {
          const cos = Math.cos(inst.rotY);
          const sin = Math.sin(inst.rotY);
          for (let s = 0; s < 4; s++) {
            const side = GLOW_SIDES[s];
            const localX = side[0] * hx * 0.62;
            const localZ = side[1] * hz * 0.62;
            const ox = inst.x + localX * cos + localZ * sin;
            const oz = inst.z - localX * sin + localZ * cos;
            const oy = inst.y + yMid * inst.scale + (rng() - 0.5) * 0.05;
            position.set(ox, oy, oz);
            quaternion.setFromEuler(new THREE.Euler(0, inst.rotY + side[2], 0));
            scaleVec.set(inst.scale, inst.scale, inst.scale);
            matrix.compose(position, quaternion, scaleVec);
            const idx = i * 4 + s;
            glowMesh.setMatrixAt(idx, matrix);
            layoutRef.current.push({ mesh: glowMesh, index: idx, cellX: inst.cellX, cellZ: inst.cellZ, ox, oy, oz, rotQ: quaternion.clone(), scale: inst.scale });
          }
        }
      });

      mesh.instanceMatrix.needsUpdate = true;
      patchMesh.instanceMatrix.needsUpdate = true;
      if (glowMesh) glowMesh.instanceMatrix.needsUpdate = true;

      groupRef.current.add(mesh, patchMesh);
      if (glowMesh) groupRef.current.add(glowMesh);
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

    for (const inst of layout) {
      const isExcluded = excluded.has(`${inst.cellX},${inst.cellZ}`);
      if (isExcluded === inst.hidden) continue;
      inst.hidden = isExcluded;

      position.set(inst.ox, inst.oy, inst.oz);
      quaternion.copy(inst.rotQ);
      scaleVec.set(isExcluded ? 0 : inst.scale, isExcluded ? 0 : inst.scale, isExcluded ? 0 : inst.scale);
      matrix.compose(position, quaternion, scaleVec);
      inst.mesh.setMatrixAt(inst.index, matrix);
      inst.mesh.instanceMatrix.needsUpdate = true;
    }
  }, [trackCount, stationsVersion, terrainData, trackManager, stationManager, length, breadth]);

  return <primitive object={groupRef.current} />;
}
