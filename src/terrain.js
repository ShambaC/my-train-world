import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { applyWindSway } from './environment/wind.js';
import { makeStyleMaterial } from './render/styleMaterials.js';

// Voxel size - smaller than Minecraft for higher resolution
export const VOXEL_SIZE = 0.5;

// Water surface world height (raised twice: 1.0 -> 1.5 -> 2.0)
export const WATER_LEVEL = 2.0;
// Voxel index at/under which columns are submerged (top of index 3 = 1.75 < 2.0)
export const WATER_LEVEL_VOXEL = 3;


// Deterministic biome ids (shared with ScatterProps for prop selection)
export const BIOME = {
  water: 0,
  meadow: 1,
  forest: 2,
  highland: 3,
  wetland: 4,
  industrial: 5,
};

// Terrain colors based on height + biome
const TERRAIN_COLORS = {
  water: 0x4a90e2,
  sand: 0xd9b878,
  grass: 0x79b85f,
  rock: 0x948a7c,
  snow: 0xffffff,
  dirt: 0x8f694d,
  // Biome surface colors
  forest: 0x64975e,
  highland: 0x8d8a83,
  wetland: 0x9a8060,
  industrial: 0x9a9489,
  // Vegetation colors
  treeLeaf: 0x4d7c48,
  treeTrunk: 0x8b5a3c,
  bush: 0x5f9654,
};

/**
 * Deterministic PRNG (mulberry32). All persistent scenery/terrain decisions
 * must go through this so a fixed seed always produces the same world.
 */
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * True inside a reserved construction plateau (disk interior or corridor
 * strip). Used to keep smoothing, forest and vegetation out of build areas.
 */
export function isClearingCell(x, z, plateaus) {
  for (const p of plateaus || []) {
    if (p.type === 'disk') {
      const nx = (x - p.cx) / p.rx;
      const nz = (z - p.cz) / p.rz;
      if (nx * nx + nz * nz < 0.64) return true; // d < 0.8 * radius
    } else if (Math.abs(x - p.cx) < p.rx - 2 && Math.abs(z - p.cz) < p.rz - 2) {
      return true;
    }
  }
  return false;
}

// --- generateVegetation: biome-aware, keeps build areas clear ---
function generateVegetation(terrain, heightMap, biomeMask, plateaus, length, breadth, seed, waterLevel) {
  const noise2D = createNoise2D(() => seed * 2);
  const trunks = [];
  const deciduousClusters = [];
  const pineClusters = [];
  const bushes = [];
  const BIOME_TREE_DENSITY = {
    [BIOME.forest]: 0.2,
    [BIOME.meadow]: 0.055,
    [BIOME.highland]: 0.02,
    [BIOME.wetland]: 0.05,
    [BIOME.industrial]: 0,
  };
  const minSpacing = 3;
  const placedVegetation = [];
  const trunkGeo = new THREE.CylinderGeometry(0.045, 0.075, 0.55, 6);
  const foliageGeo = new THREE.IcosahedronGeometry(0.42, 1);
  const bushGeo = new THREE.IcosahedronGeometry(0.3, 1);
  foliageGeo.translate(0, 0.02, 0);
  bushGeo.translate(0, 0.02, 0);
  for (const geometry of [foliageGeo, bushGeo]) {
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const wobble = 1 + 0.12 * Math.sin(x * 17.0 + z * 11.0 + y * 7.0);
      position.setXYZ(i, x * wobble, y * (0.94 + 0.08 * Math.cos(x * 13.0 - z * 9.0)), z * wobble);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  const trunkMat = makeStyleMaterial('bark', { color: 0x684c3c, roughness: 0.95 });
  const deciduousMat = makeStyleMaterial('leaf_light', { color: 0x9cbd76, roughness: 0.92, emissive: 0x2d5c27, emissiveIntensity: 0.3 });
  const pineMat = makeStyleMaterial('leaf_dark', { color: 0x78a964, roughness: 0.94, emissive: 0x275022, emissiveIntensity: 0.25 });
  const bushMat = makeStyleMaterial('bush', { color: 0x91bd70, roughness: 0.94, emissive: 0x397033, emissiveIntensity: 0.5 });
  applyWindSway(trunkMat, { leaves: false, strength: 0.45 });
  applyWindSway(deciduousMat, { strength: 0.9 });
  applyWindSway(pineMat, { strength: 0.75 });
  applyWindSway(bushMat, { strength: 0.65 });

  for (let x = 1; x < length - 1; x += 2) {
    for (let z = 1; z < breadth - 1; z += 2) {
      const height = heightMap[x][z];
      if (height <= waterLevel || isClearingCell(x, z, plateaus)) continue;
      const biome = biomeMask[x * breadth + z];
      const density = BIOME_TREE_DENSITY[biome];
      if (!density) continue;
      const vegetationNoise = noise2D(x * 0.1, z * 0.1);
      const threshold = 1 - density * 2;
      if (vegetationNoise < threshold) continue;
      if (placedVegetation.some((placed) => Math.hypot(x - placed.x, z - placed.z) < minSpacing)) continue;

      const worldX = (x - length / 2) * VOXEL_SIZE;
      const worldY = (height + 0.5) * VOXEL_SIZE;
      const worldZ = (z - breadth / 2) * VOXEL_SIZE;
      const rng = mulberry32((seed ^ (x * 73856093) ^ (z * 19349663)) >>> 0);
      const isBush = biome === BIOME.wetland || biome === BIOME.highland ||
        vegetationNoise < threshold + (1 - threshold) * 0.5;
      if (isBush) {
        const bushScale = 0.72 + rng() * 0.38;
        for (let cluster = 0; cluster < 3; cluster += 1) {
          const angle = rng() * Math.PI * 2;
          const radius = cluster === 0 ? 0.02 : 0.12 + rng() * 0.18;
          bushes.push({
            x: worldX + Math.cos(angle) * radius,
            y: worldY + 0.14 + (cluster % 2) * 0.06,
            z: worldZ + Math.sin(angle) * radius,
            scale: bushScale * (0.78 + rng() * 0.3),
            rotation: rng() * Math.PI * 2,
          });
        }
      } else {
        trunks.push({ x: worldX, y: worldY + 0.25, z: worldZ, scale: 0.85 + rng() * 0.25 });
        const isPine = biome === BIOME.forest && rng() > 0.42;
        const clusters = 5 + Math.floor(rng() * 5);
        for (let cluster = 0; cluster < clusters; cluster += 1) {
          const angle = rng() * Math.PI * 2;
          const radius = cluster === 0 ? 0.05 : 0.2 + rng() * 0.42;
          const y = 0.34 + (cluster % 4) * 0.2 + rng() * 0.16;
          const scale = 0.58 + rng() * 0.38;
          (isPine ? pineClusters : deciduousClusters).push({
            x: worldX + Math.cos(angle) * radius,
            y: worldY + y,
            z: worldZ + Math.sin(angle) * radius,
            scale: isPine ? { x: scale * 0.78, y: scale * 1.05, z: scale * 0.78 } : { x: scale, y: scale * (0.8 + rng() * 0.35), z: scale * 0.9 },
            rotation: rng() * Math.PI * 2,
          });
        }
      }
      placedVegetation.push({ x, z });
    }
  }

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const axis = new THREE.Vector3(0, 1, 0);
  const addInstances = (geometry, material, records, name) => {
    if (!records.length) return;
    const mesh = new THREE.InstancedMesh(geometry, material, records.length);
    records.forEach((record, index) => {
      quaternion.setFromAxisAngle(axis, record.rotation || 0);
      const scale = typeof record.scale === 'number'
        ? new THREE.Vector3(record.scale, record.scale, record.scale)
        : new THREE.Vector3(record.scale.x, record.scale.y, record.scale.z);
      matrix.compose(new THREE.Vector3(record.x, record.y, record.z), quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.castShadow = name !== 'foliageFar';
    mesh.userData.visualOnly = true;
    mesh.name = name;
    terrain.add(mesh);
  };
  addInstances(trunkGeo, trunkMat, trunks, 'visualTreeTrunks');
  addInstances(foliageGeo, deciduousMat, deciduousClusters, 'visualDeciduousCanopy');
  addInstances(foliageGeo, pineMat, pineClusters, 'visualPineCanopy');
  addInstances(bushGeo, bushMat, bushes, 'visualShrubClusters');
}

/**
 * Carve a meandering river from one edge of the map to the opposite edge.
 * Flows along the longer axis; riverbed is carved to 0 with sloped banks.
 * Optionally pinned to cross a chosen plateau center (pin = {t, across}).
 * Shallow shelf rings (2) give gradual bank shelves under water.
 */
function carveRiver(heightMap, length, breadth, waterLevel, seed, pin) {
  const riverNoise = createNoise2D(() => seed * 7.7);
  const horizontal = breadth >= length; // flow along Z axis when true
  const along = horizontal ? breadth : length;
  const across = horizontal ? length : breadth;
  const acrossHalf = across / 2;

  for (let t = 0; t < along; t++) {
    const noise = riverNoise(t * 0.06, 0);
    let meander = Math.sin(t * 0.05 + seed * 10) * 2.5 + noise * 3.5;
    if (pin) {
      // Blend the centerline toward the pinned plateau around pin.t
      const w = Math.max(0, 1 - Math.abs(t - pin.t) / pin.range);
      meander += (pin.across - acrossHalf - meander) * w;
    }
    const center = Math.max(4, Math.min(across - 5, acrossHalf + meander));
    // Wider variable bed: 1.6..3.0 half-width with slow width wobble
    const width = 1.6 + Math.abs(riverNoise(t * 0.15, 1)) * 1.4;

    for (let s = 0; s < across; s++) {
      const d = Math.abs(s - center);
      let target = null;
      if (d <= width) {
        target = 0; // riverbed
      } else if (d <= width + 1.0) {
        target = 1; // submerged bank edge
      } else if (d <= width + 2.0) {
        target = 2; // shallow shelf under water
      } else if (d <= width + 3.0) {
        target = 4; // dry mud bank (wetland biome)
      }
      if (target === null) continue;
      if (horizontal) {
        heightMap[s][t] = Math.min(heightMap[s][t], target);
      } else {
        heightMap[t][s] = Math.min(heightMap[t][s], target);
      }
    }
  }
}

/**
 * Smooth the height map with a 5-cell cross average.
 * Plateau interiors are locked so smoothing cannot drift them.
 */
function smoothHeightMap(heightMap, length, breadth, plateaus) {
  const next = heightMap.map((row) => row.slice());
  for (let pass = 0; pass < 3; pass++) {
    for (let x = 0; x < length; x++) {
      for (let z = 0; z < breadth; z++) {
        if (isClearingCell(x, z, plateaus)) {
          next[x][z] = heightMap[x][z];
          continue;
        }
        let sum = heightMap[x][z];
        let count = 1;
        if (x > 0) { sum += heightMap[x - 1][z]; count++; }
        if (x < length - 1) { sum += heightMap[x + 1][z]; count++; }
        if (z > 0) { sum += heightMap[x][z - 1]; count++; }
        if (z < breadth - 1) { sum += heightMap[x][z + 1]; count++; }
        next[x][z] = Math.round(sum / count);
      }
    }
    for (let x = 0; x < length; x++) {
      for (let z = 0; z < breadth; z++) {
        heightMap[x][z] = next[x][z];
      }
    }
  }
}

/**
 * Quantize heights to even steps — turns the terrain into large flat
 * plateaus that are perfect for station strips and track runs.
 * Water cells (already carved below the water level) keep their value.
 */
function quantizeHeights(heightMap, length, breadth) {
  for (let x = 0; x < length; x++) {
    for (let z = 0; z < breadth; z++) {
      const h = heightMap[x][z];
      heightMap[x][z] = h <= WATER_LEVEL_VOXEL ? h : Math.max(4, Math.round(h / 2) * 2);
    }
  }
}

/**
 * Break up long monotone voxel staircases with occasional 3-wide terrace
 * ledges. Keeps low-poly look while avoiding endless uniform steps.
 */
function terraceStaircases(heightMap, length, breadth) {
  const flattenRun = (run) => {
    const n = run.length;
    if (n < 6) return;
    const mid = Math.floor(n / 2);
    const midH = heightMap[run[mid][0]][run[mid][1]];
    for (let k = mid - 1; k <= mid + 1; k++) {
      if (k < 0 || k >= n) continue;
      heightMap[run[k][0]][run[k][1]] = midH;
    }
  };
  const scan = (cells) => {
    let i = 0;
    while (i < cells.length - 4) {
      const h0 = heightMap[cells[i][0]][cells[i][1]];
      const step = heightMap[cells[i + 1][0]][cells[i + 1][1]] - h0;
      if (Math.abs(step) !== 2) { i++; continue; }
      let j = i + 1;
      while (j < cells.length) {
        const prev = heightMap[cells[j - 1][0]][cells[j - 1][1]];
        const cur = heightMap[cells[j][0]][cells[j][1]];
        if (cur - prev !== step) break;
        j++;
      }
      flattenRun(cells.slice(i, j));
      i = j;
    }
  };
  for (let z = 0; z < breadth; z++) {
    const row = [];
    for (let x = 0; x < length; x++) row.push([x, z]);
    scan(row);
  }
  for (let x = 0; x < length; x++) {
    const col = [];
    for (let z = 0; z < breadth; z++) col.push([x, z]);
    scan(col);
  }
}

/** Blend a circular/elliptical low-slope region into the heightmap. */
function blendDisk(heightMap, length, breadth, p) {
  const x0 = Math.max(0, Math.floor(p.cx - p.rx - 3));
  const x1 = Math.min(length - 1, Math.ceil(p.cx + p.rx + 3));
  const z0 = Math.max(0, Math.floor(p.cz - p.rz - 3));
  const z1 = Math.min(breadth - 1, Math.ceil(p.cz + p.rz + 3));
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      const nx = (x - p.cx) / p.rx;
      const nz = (z - p.cz) / p.rz;
      const d = Math.sqrt(nx * nx + nz * nz);
      if (d >= 1.05) continue;
      const w = d < 0.8 ? 1 : Math.max(0, 1 - (d - 0.8) / 0.25);
      heightMap[x][z] = Math.round(heightMap[x][z] * (1 - w) + p.hp * w);
    }
  }
}

/** Blend a rectangular corridor strip (long flat run for tracks). */
function blendCorridor(heightMap, length, breadth, p) {
  const x0 = Math.max(0, Math.floor(p.cx - p.rx - 4));
  const x1 = Math.min(length - 1, Math.ceil(p.cx + p.rx + 4));
  const z0 = Math.max(0, Math.floor(p.cz - p.rz - 4));
  const z1 = Math.min(breadth - 1, Math.ceil(p.cz + p.rz + 4));
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      const dx = Math.abs(x - p.cx);
      const dz = Math.abs(z - p.cz);
      const wx = dx < p.rx - 2 ? 1 : Math.max(0, 1 - (dx - (p.rx - 2)) / 4);
      const wz = dz < p.rz - 2 ? 1 : Math.max(0, 1 - (dz - (p.rz - 2)) / 4);
      const w = Math.min(wx, wz);
      if (w <= 0) continue;
      heightMap[x][z] = Math.round(heightMap[x][z] * (1 - w) + p.hp * w);
    }
  }
}

/**
 * Restore plateau interiors after river/pond carving (only where carving
 * did not turn them into water). Keeps build areas intact.
 */
function reflattenPlateaus(heightMap, length, breadth, plateaus) {
  for (const p of plateaus) {
    const x0 = Math.max(0, Math.floor(p.cx - p.rx - 3));
    const x1 = Math.min(length - 1, Math.ceil(p.cx + p.rx + 3));
    const z0 = Math.max(0, Math.floor(p.cz - p.rz - 3));
    const z1 = Math.min(breadth - 1, Math.ceil(p.cz + p.rz + 3));
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        if (!isClearingCell(x, z, [p])) continue;
        if (heightMap[x][z] > WATER_LEVEL_VOXEL) heightMap[x][z] = p.hp;
      }
    }
  }
}

/**
 * Carve a few ponds (submerged depressions). Ponds never touch plateau
 * interiors or the reserved track corridor. Depths 1..3 sit below water.
 */
function carvePonds(heightMap, length, breadth, seed, attempt, plateaus) {
  const rng = mulberry32((((seed * 7919) >>> 0) ^ (attempt * 104729) ^ 13) >>> 0);
  const pondCount = 2 + Math.floor(rng() * 3); // 2..4 ponds
  let placed = 0;

  const collides = (cx, cz, rad) => {
    for (const p of plateaus) {
      if (p.type === 'disk') {
        if (Math.hypot(p.cx - cx, p.cz - cz) < p.rx * 0.8 + rad + 2) return true;
      } else {
        const dx = Math.max(Math.abs(cx - p.cx) - p.rx, 0);
        const dz = Math.max(Math.abs(cz - p.cz) - p.rz, 0);
        if (Math.hypot(dx, dz) < rad + 2) return true;
      }
    }
    return false;
  };

  for (let p = 0; p < pondCount; p++) {
    for (let tries = 0; tries < 40; tries++) {
      const cx = 8 + rng() * (length - 16);
      const cz = 8 + rng() * (breadth - 16);
      const radius = 3 + rng() * 2; // 3..5 cells
      if (collides(cx, cz, radius + 2)) continue;
      if (heightMap[Math.floor(cx)][Math.floor(cz)] <= WATER_LEVEL_VOXEL) continue;
      const r2 = radius + 1.5; // wet shelf beyond the rim
      const r3 = radius + 2.5; // dry mud ring (wetland)
      for (let x = Math.max(1, Math.floor(cx - r3)); x <= Math.min(length - 2, Math.ceil(cx + r3)); x++) {
        for (let z = Math.max(1, Math.floor(cz - r3)); z <= Math.min(breadth - 2, Math.ceil(cz + r3)); z++) {
          const d = Math.sqrt((x - cx) * (x - cx) + (z - cz) * (z - cz));
          let target = null;
          if (d <= radius * 0.55) target = 1; // deep center
          else if (d <= radius * 0.85) target = 2; // shallow
          else if (d <= r2) target = 3; // wet edge
          else if (d <= r3) target = 4; // dry mud shelf
          if (target !== null) heightMap[x][z] = Math.min(heightMap[x][z], target);
        }
      }
      placed++;
      break;
    }
  }
  return placed;
}

/**
 * Plan construction plateaus deterministically from the seed.
 * - One disk sits near the river midline (river is pinned through it).
 * - Other disks are pushed far from the river midline (stay dry).
 * - One long corridor strip is reserved parallel to the river for long
 *   track runs. Measured against StationBuilder limits (MIN 8 / MAX 40
 *   voxel stations, STATION_WIDTH 3): interiors ≥ 20 cells across, corridor
 *   ≈ 0.76 × max side length. No station objects are ever created here.
 */
function planPlateaus(length, breadth, seed, attempt, riverPlan) {
  const rng = mulberry32((((seed * 2654435761) >>> 0) ^ (attempt * 7919)) >>> 0);
  const maxSide = Math.max(length, breadth);
  const minSide = Math.min(length, breadth);
  // Build-area targets: small ≥ 2, medium ≥ 4, large ≥ 6 (corridor counts)
  const count = Math.max(2, Math.min(6, Math.round((length + breadth) / 110)));
  const margin = Math.max(12, Math.round(maxSide * 0.08));
  const riverAway = Math.max(10, Math.round(maxSide * 0.16));
  const radiusScale = 1 + attempt * 0.09;
  const along = riverPlan.along;
  const across = riverPlan.across;
  const aHalf = across / 2;
  // River reach: meander ±6 plus the widest bank ring (width 3.0 + shelf 3.0)
  const RIVER_REACH = 12;
  const pickHp = () => 6 + 2 * Math.floor(rng() * 3); // 6 / 8 / 10 (even → survives quantization)
  const plateaus = [];

  // --- 1. Track corridor: long flat strip, parallel to the river, dry side ---
  const corrHalf = Math.round(maxSide * 0.38);
  const corrHalfW = Math.max(8, Math.round(minSide * 0.09));
  const corrSide = rng() < 0.5 ? -1 : 1;
  let corrAcross = Math.round(aHalf + corrSide * (riverAway + corrHalfW + margin));
  if (corrAcross > across - margin - corrHalfW) corrAcross = margin + corrHalfW;
  if (corrAcross < margin + corrHalfW) corrAcross = across - margin - corrHalfW;
  const corridor = {
    type: 'corridor',
    cx: riverPlan.horizontal ? corrAcross : Math.round(along / 2),
    cz: riverPlan.horizontal ? Math.round(along / 2) : corrAcross,
    rx: riverPlan.horizontal ? corrHalfW : corrHalf,
    rz: riverPlan.horizontal ? corrHalf : corrHalfW,
    hp: pickHp(),
  };
  plateaus.push(corridor);

  const distToCorridor = (x, z) => {
    const dx = Math.max(Math.abs(x - corridor.cx) - corridor.rx, 0);
    const dz = Math.max(Math.abs(z - corridor.cz) - corridor.rz, 0);
    return Math.hypot(dx, dz);
  };

  const sampleCenter = (constraint) => {
    for (let i = 0; i < 80; i++) {
      const cx = margin + rng() * (length - 2 * margin);
      const cz = margin + rng() * (breadth - 2 * margin);
      if (constraint && !constraint(cx, cz)) continue;
      const spaced = plateaus.every((p) => {
        if (p.type === 'corridor') return distToCorridor(cx, cz) >= 10;
        return Math.hypot(p.cx - cx, p.cz - cz) >= p.r + 8;
      });
      if (spaced) return { cx, cz };
    }
    return null;
  };

  const pushDisk = (r, hp, constraint) => {
    const center = sampleCenter(constraint);
    if (!center) return null;
    const a = riverPlan.horizontal ? center.cx : center.cz;
    const b = riverPlan.horizontal ? center.cz : center.cx;
    const pad = margin + r;
    const aClamped = Math.max(pad, Math.min(across - pad, a));
    const bClamped = Math.max(pad, Math.min(along - pad, b));
    const disk = {
      type: 'disk',
      cx: riverPlan.horizontal ? aClamped : bClamped,
      cz: riverPlan.horizontal ? bClamped : aClamped,
      rx: r,
      rz: r,
      r,
      hp,
    };
    plateaus.push(disk);
    return disk;
  };

  // --- 2. River plateau — near the river midline, river is pinned through it ---
  const riverDisk = pushDisk(
    Math.min(maxSide * (0.16 + rng() * 0.06) * radiusScale, Math.max(8, aHalf - margin - 8)),
    pickHp(),
    (cx, cz) => {
      const a = riverPlan.horizontal ? cx : cz;
      return Math.abs(a - aHalf) <= 8;
    }
  );

  // --- 3. Landmarks: occasional elevated ridge + sunken basin (scenic
  // variety). Both are infrequent — most of the map stays rolling fields. ---
  if (rng() < 0.5) {
    pushDisk(maxSide * (0.1 + rng() * 0.04) * radiusScale, 8 + 2 * Math.floor(rng() * 2), () => true);
  }
  if (rng() < 0.5) {
    pushDisk(maxSide * (0.08 + rng() * 0.04) * radiusScale, 4 + 2 * Math.floor(rng() * 2), () => true);
  }

  // --- 4. Extra dry plateaus — outside the river's reach ---
  const maxAwayR = Math.max(8, (across - margin - aHalf - RIVER_REACH) / 2 - 2);
  const extras = Math.max(0, Math.min(4, Math.round((length + breadth) / 170) - 2));
  for (let i = 0; i < extras; i++) {
    const r = Math.min(maxSide * (0.16 + rng() * 0.06) * radiusScale, maxAwayR);
    pushDisk(r, pickHp(), (cx, cz) => {
      const a = riverPlan.horizontal ? cx : cz;
      return Math.abs(a - aHalf) >= Math.ceil(RIVER_REACH + 1 + r);
    });
  }

  const riverPin = riverDisk
    ? {
        t: riverPlan.horizontal ? riverDisk.cz : riverDisk.cx,
        across: riverPlan.horizontal ? riverDisk.cx : riverDisk.cz,
        range: 30,
      }
    : null;

  return { plateaus, count, riverPin };
}

/**
 * Multi-scale heightmap: broad hills, mid plateau regions, weak detail.
 * Amplitudes are deliberately gentle — the world reads as rolling fields
 * with large same-level flats (quantization does the rest), and mountains
 * are rare landmarks instead of the default.
 */
function generateHeightMap(length, breadth, seed) {
  const noiseLow = createNoise2D(() => seed);
  const noiseMid = createNoise2D(() => seed * 1.7);
  const noiseHigh = createNoise2D(() => seed * 3.1);
  const heightMap = [];
  for (let x = 0; x < length; x++) {
    heightMap[x] = [];
    for (let z = 0; z < breadth; z++) {
      const broad = noiseLow(x * 0.02, z * 0.02) * 2.1;
      const mid = noiseMid(x * 0.055, z * 0.055) * 1.0;
      const detail = noiseHigh(x * 0.13, z * 0.13) * 0.3;
      heightMap[x][z] = Math.max(0, Math.round(broad + mid + detail + 8.5));
    }
  }
  return heightMap;
}

/** Deterministic biome mask (appearance only — no gameplay restrictions). */
function computeBiomes(heightMap, length, breadth, seed, plateaus) {
  const rng = mulberry32((((seed * 9301) >>> 0) ^ 97) >>> 0);
  const nForest = createNoise2D(() => seed * 3.7);
  const maxSide = Math.max(length, breadth);
  const mask = new Int8Array(length * breadth);

  // Small industrial zones (gravel/shed props, no restriction)
  const zoneCount = Math.max(1, Math.min(3, Math.round((length * breadth) / 40000)));
  const zones = [];
  for (let i = 0; i < zoneCount; i++) {
    for (let t = 0; t < 60; t++) {
      const cx = Math.floor(8 + rng() * (length - 16));
      const cz = Math.floor(8 + rng() * (breadth - 16));
      if (heightMap[cx][cz] <= 4) continue;
      if (isClearingCell(cx, cz, plateaus)) continue;
      const r = 6 + rng() * 5;
      const overlap = zones.some((z2) => Math.hypot(z2.cx - cx, z2.cz - cz) < z2.r + r);
      if (overlap) continue;
      zones.push({ cx, cz, r });
      break;
    }
  }

  // One large seeded forest region (landmark: "dense forest"), plus the
  // noise-based forest elsewhere. Blend factor eases meadow→forest borders.
  const blend = new Uint8Array(length * breadth);
  const forestZoneR = maxSide * (0.16 + rng() * 0.06);
  let forestZone = null;
  for (let t = 0; t < 60; t++) {
    const cx = Math.floor(10 + rng() * (length - 20));
    const cz = Math.floor(10 + rng() * (breadth - 20));
    if (heightMap[cx][cz] <= 4) continue;
    if (isClearingCell(cx, cz, plateaus)) continue;
    forestZone = { cx, cz, r: forestZoneR };
    break;
  }

  for (let x = 0; x < length; x++) {
    for (let z = 0; z < breadth; z++) {
      const i = x * breadth + z;
      const h = heightMap[x][z];
      if (h <= WATER_LEVEL_VOXEL) {
        mask[i] = BIOME.water;
      } else if (isClearingCell(x, z, plateaus)) {
        mask[i] = BIOME.meadow; // build areas read as fields
      } else if (h >= 9) {
        mask[i] = BIOME.highland;
      } else if (h === 4) {
        mask[i] = BIOME.wetland; // mud ring around water
      } else if (zones.some((z2) => Math.hypot(x - z2.cx, z - z2.cz) < z2.r)) {
        mask[i] = BIOME.industrial;
      } else {
        const f = nForest(x * 0.06, z * 0.06);
        const inForestZone = forestZone && Math.hypot(x - forestZone.cx, z - forestZone.cz) < forestZone.r;
        if (inForestZone || f > 0.1) {
          mask[i] = BIOME.forest;
        } else {
          mask[i] = BIOME.meadow;
        }
        // 0..255 meadow→forest gradient for the surface palette
        blend[i] = Math.max(0, Math.min(255, Math.round(((f - 0.08) / 0.05) * 255)));
      }
    }
  }
  return { mask, zones, blend };
}

/**
 * Development-only flat-area analysis (also shown in the debug overlay).
 *  - connected equal-height regions above water
 *  - largest flat region area
 *  - longest axis-aligned flat corridor
 *  - candidate build regions (large enough for station + approach tracks)
 *  - regions adjacent to water ("partially cut by rivers or ponds")
 */
function computeFlatDiagnostics(heightMap, length, breadth) {
  const waterLevel = WATER_LEVEL_VOXEL;
  const visited = new Uint8Array(length * breadth);
  const stack = [];
  let regionCount = 0;
  let largestArea = 0;
  let candidates = 0;
  let waterCut = 0;
  let longestCorridor = 0;

  // Longest axis-aligned equal-height run above water
  for (let x = 0; x < length; x++) {
    let run = 0;
    for (let z = 0; z < breadth; z++) {
      const h = heightMap[x][z];
      if (h > waterLevel) {
        run = z > 0 && heightMap[x][z - 1] === h ? run + 1 : 1;
        if (run > longestCorridor) longestCorridor = run;
      } else {
        run = 0;
      }
    }
  }
  for (let z = 0; z < breadth; z++) {
    let run = 0;
    for (let x = 0; x < length; x++) {
      const h = heightMap[x][z];
      if (h > waterLevel) {
        run = x > 0 && heightMap[x - 1][z] === h ? run + 1 : 1;
        if (run > longestCorridor) longestCorridor = run;
      } else {
        run = 0;
      }
    }
  }

  // Connected equal-height regions (4-directional flood fill)
  for (let x = 0; x < length; x++) {
    for (let z = 0; z < breadth; z++) {
      const idx = x * breadth + z;
      if (visited[idx] || heightMap[x][z] <= waterLevel) continue;
      const h = heightMap[x][z];
      let area = 0;
      let minX = x, maxX = x, minZ = z, maxZ = z;
      let touchesWater = false;
      stack.length = 0;
      stack.push([x, z]);
      visited[idx] = 1;
      while (stack.length > 0) {
        const [cx, cz] = stack.pop();
        area++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cz < minZ) minZ = cz;
        if (cz > maxZ) maxZ = cz;
        if (cx > 0) {
          const n = (cx - 1) * breadth + cz;
          if (!visited[n]) {
            if (heightMap[cx - 1][cz] === h) { visited[n] = 1; stack.push([cx - 1, cz]); }
            else if (heightMap[cx - 1][cz] <= waterLevel) touchesWater = true;
          }
        }
        if (cx < length - 1) {
          const n = (cx + 1) * breadth + cz;
          if (!visited[n]) {
            if (heightMap[cx + 1][cz] === h) { visited[n] = 1; stack.push([cx + 1, cz]); }
            else if (heightMap[cx + 1][cz] <= waterLevel) touchesWater = true;
          }
        }
        if (cz > 0) {
          const n = cx * breadth + cz - 1;
          if (!visited[n]) {
            if (heightMap[cx][cz - 1] === h) { visited[n] = 1; stack.push([cx, cz - 1]); }
            else if (heightMap[cx][cz - 1] <= waterLevel) touchesWater = true;
          }
        }
        if (cz < breadth - 1) {
          const n = cx * breadth + cz + 1;
          if (!visited[n]) {
            if (heightMap[cx][cz + 1] === h) { visited[n] = 1; stack.push([cx, cz + 1]); }
            else if (heightMap[cx][cz + 1] <= waterLevel) touchesWater = true;
          }
        }
      }
      regionCount++;
      if (area > largestArea) largestArea = area;
      // Candidate build region: comfortably larger than a MAX station (40
      // cells) plus approach room in the long axis and STATION_WIDTH in the
      // short one (StationBuilder: MIN 8 / MAX 40, width 3).
      const w = maxX - minX + 1;
      const d = maxZ - minZ + 1;
      if (area >= 120 && Math.max(w, d) >= 20 && Math.min(w, d) >= 12) candidates++;
      if (touchesWater) waterCut++;
    }
  }

  return { regionCount, largestArea, longestCorridor, candidates, waterCut };
}

function createRiverPlan(length, breadth) {
  const horizontal = breadth >= length;
  return {
    horizontal,
    along: horizontal ? breadth : length,
    across: horizontal ? length : breadth,
  };
}

function buildWorld(length, breadth, seed, attempt, riverPlan) {
  const heightMap = generateHeightMap(length, breadth, seed);
  const { plateaus, riverPin } = planPlateaus(length, breadth, seed, attempt, riverPlan);
  smoothHeightMap(heightMap, length, breadth, plateaus);
  carvePonds(heightMap, length, breadth, seed, attempt, plateaus);
  carveRiver(heightMap, length, breadth, WATER_LEVEL_VOXEL, seed, riverPin);
  reflattenPlateaus(heightMap, length, breadth, plateaus);
  quantizeHeights(heightMap, length, breadth);
  terraceStaircases(heightMap, length, breadth);
  const biome = computeBiomes(heightMap, length, breadth, seed, plateaus);
  const diagnostics = computeFlatDiagnostics(heightMap, length, breadth);
  return { heightMap, plateaus, biomeMask: biome.mask, zones: biome.zones, blend: biome.blend, diagnostics };
}


function createTerrainSurfaceShell(heightMap, biomeMask, blend, length, breadth, surfaceColor, sideColor) {
  const positions = [];
  const normals = [];
  const colors = [];
  const uvs = [];
  const indices = [];
  const addQuad = (vertices, normal, color) => {
    const offset = positions.length / 3;
    vertices.forEach(([x, y, z], index) => {
      positions.push(x, y, z);
      normals.push(...normal);
      colors.push(color.r, color.g, color.b);
      uvs.push(index === 0 || index === 3 ? 0 : 1, index < 2 ? 0 : 1);
    });
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  };
  const topAt = (x, z) => (heightMap[x][z] + 0.5) * VOXEL_SIZE;
  const worldX = (x) => (x - length / 2) * VOXEL_SIZE;
  const worldZ = (z) => (z - breadth / 2) * VOXEL_SIZE;
  for (let x = 0; x < length; x += 1) {
    for (let z = 0; z < breadth; z += 1) {
      const y = topAt(x, z);
      const h = heightMap[x][z];
      const neighbors = [
        x > 0 ? heightMap[x - 1][z] : -1,
        x < length - 1 ? heightMap[x + 1][z] : -1,
        z > 0 ? heightMap[x][z - 1] : -1,
        z < breadth - 1 ? heightMap[x][z + 1] : -1,
      ];
      const slope = Math.max(...neighbors.map((neighbor) => Math.abs(h - neighbor)));
      const topColor = new THREE.Color(surfaceColor(biomeMask[x * breadth + z], blend?.[x * breadth + z] ?? 0));
      const x0 = worldX(x);
      const x1 = worldX(x + 1);
      const z0 = worldZ(z);
      const z1 = worldZ(z + 1);
      addQuad([[x0, y, z0], [x0, y, z1], [x1, y, z1], [x1, y, z0]], [0, 1, 0], topColor);
      const lowerFaces = [
        [neighbors[0], [[x0, y, z1], [x0, y, z0], [x0, topAt(x, z) - (h - neighbors[0]) * VOXEL_SIZE, z0], [x0, topAt(x, z) - (h - neighbors[0]) * VOXEL_SIZE, z1]], [1, 0, 0]],
        [neighbors[1], [[x1, y, z0], [x1, y, z1], [x1, topAt(x, z) - (h - neighbors[1]) * VOXEL_SIZE, z1], [x1, topAt(x, z) - (h - neighbors[1]) * VOXEL_SIZE, z0]], [-1, 0, 0]],
        [neighbors[2], [[x1, y, z0], [x0, y, z0], [x0, topAt(x, z) - (h - neighbors[2]) * VOXEL_SIZE, z0], [x1, topAt(x, z) - (h - neighbors[2]) * VOXEL_SIZE, z0]], [0, 0, 1]],
        [neighbors[3], [[x0, y, z1], [x1, y, z1], [x1, topAt(x, z) - (h - neighbors[3]) * VOXEL_SIZE, z1], [x0, topAt(x, z) - (h - neighbors[3]) * VOXEL_SIZE, z1]], [0, 0, -1]],
      ];
      for (const [neighbor, face, normal] of lowerFaces) {
        if (neighbor < h) addQuad(face, normal, new THREE.Color(sideColor(biomeMask[x * breadth + z])));
      }
      if (slope >= 3) topColor.multiplyScalar(0.92);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, makeStyleMaterial('meadow', { vertexColors: true, roughness: 0.98, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  mesh.userData.visualOnly = true;
  mesh.name = 'terrainVisualSurface';
  mesh.raycast = () => {};
  return mesh;
}

export function generateTerrain(length, breadth, seed = 1337) {
  const terrain = new THREE.Group();
  const riverPlan = createRiverPlan(length, breadth);
  const maxSide = Math.max(length, breadth);
  const targetCount = Math.max(2, Math.min(6, Math.round((length + breadth) / 110)));
  const minCorridor = Math.round(maxSide * 0.7);
  const waterLevel = WATER_LEVEL_VOXEL;

  // Build until flat-area metrics pass (or take the best of 5 attempts)
  let best = null;
  let usedAttempt = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const world = buildWorld(length, breadth, seed, attempt, riverPlan);
    world.pass =
      world.diagnostics.candidates >= targetCount &&
      world.diagnostics.longestCorridor >= minCorridor;
    const score = world.diagnostics.candidates * 1000 + world.diagnostics.longestCorridor;
    const currentBest = best;
    if (
      !currentBest ||
      (world.pass && !currentBest.pass) ||
      (!world.pass && !currentBest.pass && score > currentBest._score)
    ) {
      best = world;
      best._score = score;
      usedAttempt = attempt;
    }
    if (world.pass) break;
  }

  const { heightMap, biomeMask, plateaus, blend } = best;
  const surfaceColor = (biome) => {
    switch (biome) {
      case BIOME.forest: return TERRAIN_COLORS.forest;
      case BIOME.highland: return TERRAIN_COLORS.highland;
      case BIOME.wetland: return TERRAIN_COLORS.wetland;
      case BIOME.industrial: return TERRAIN_COLORS.industrial;
      default: return TERRAIN_COLORS.grass;
    }
  };
  const sideColor = (biome) => {
    if (biome === BIOME.highland) return TERRAIN_COLORS.rock;
    if (biome === BIOME.industrial) return TERRAIN_COLORS.industrial;
    return TERRAIN_COLORS.dirt;
  };


  // Generate trees and bushes on the now-generated terrain surface
  generateVegetation(terrain, heightMap, biomeMask, plateaus, length, breadth, seed, waterLevel);

  // Attach height data for water shader + scenery
  terrain.userData = {
    heightMap,
    length,
    breadth,
    waterLevel,
    seed,
    biomeMask,
    plateaus,
    surfaceBlend: blend,
    riverPlan,
    diagnostics: best.diagnostics,
  };

  terrain.add(createTerrainSurfaceShell(heightMap, biomeMask, blend, length, breadth, surfaceColor, sideColor));
  // Exact gameplay proxy. Visual voxels remain visible but never intercept
  // placement or selection raycasts.
  const interactionGeometry = new THREE.BoxGeometry(VOXEL_SIZE, 0.01, VOXEL_SIZE);
  const interactionMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    depthTest: false,
  });
  const interactionSurface = new THREE.InstancedMesh(
    interactionGeometry,
    interactionMaterial,
    length * breadth,
  );
  const interactionMatrix = new THREE.Matrix4();
  let interactionIndex = 0;
  for (let x = 0; x < length; x += 1) {
    for (let z = 0; z < breadth; z += 1) {
      const top = (heightMap[x][z] + 0.5) * VOXEL_SIZE;
      interactionMatrix.makeTranslation(
        (x - length / 2 + 0.5) * VOXEL_SIZE,
        top - 0.005,
        (z - breadth / 2 + 0.5) * VOXEL_SIZE,
      );
      interactionSurface.setMatrixAt(interactionIndex, interactionMatrix);
      interactionIndex += 1;
    }
  }
  interactionSurface.instanceMatrix.needsUpdate = true;
  interactionSurface.userData.interactionSurface = true;
  interactionSurface.name = 'terrainInteractionSurface';
  interactionSurface.castShadow = false;
  interactionSurface.receiveShadow = false;
  interactionSurface.computeBoundingBox();
  interactionSurface.computeBoundingSphere();
  terrain.add(interactionSurface);
  terrain.userData.interactionSurface = interactionSurface;

  terrain.traverse((child) => {
    if (child !== interactionSurface && child.isMesh) {
      child.userData.visualOnly = true;
      child.raycast = () => {};
    }
  });

  if (import.meta.env.DEV) {
    const d = best.diagnostics;
    console.log(
      `[Terrain] ${length}x${breadth} seed=${seed} attempt=${usedAttempt} pass=${best.pass} | ` +
      `regions=${d.regionCount} largest=${d.largestArea} corridor=${d.longestCorridor} ` +
      `buildSpots=${d.candidates} waterCut=${d.waterCut}`
    );
  }

  return terrain;
}

/**
 * Create a simple grid helper for reference
 */
export function createGrid(size) {
  const gridHelper = new THREE.GridHelper(size * VOXEL_SIZE, size, 0x888888, 0x444444);
  gridHelper.position.y = 0;
  return gridHelper;
}
