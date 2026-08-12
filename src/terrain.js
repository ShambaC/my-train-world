import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

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
  sand: 0xddc490,
  grass: 0x5cb85c,
  rock: 0x808080,
  snow: 0xffffff,
  dirt: 0x7b5b3a, // vertical sides and cut faces
  // Biome surface colors
  forest: 0x4d9444, // darker ground under forest
  highland: 0x7a7a7a, // rock grey
  wetland: 0x8a7358, // mud
  industrial: 0x8f8b84, // gravel
  // Vegetation colors
  treeLeaf: 0x2d5a2d,
  treeTrunk: 0x8b4513,
  bush: 0x3a7a7a,
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
  const treeTrunks = [];
  const treeCones1 = [];
  const treeCones2 = [];
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

  const trunkGeo = new THREE.CylinderGeometry(0.04, 0.07, 0.5, 5);
  const cone1Geo = new THREE.ConeGeometry(0.35, 0.5, 5);
  const cone2Geo = new THREE.ConeGeometry(0.25, 0.4, 5);
  const bushGeo = new THREE.DodecahedronGeometry(0.2, 0);

  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2e18, flatShading: true });
  const leafMat1 = new THREE.MeshLambertMaterial({ color: 0x2d5a2d, flatShading: true });
  const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x3a7a3a, flatShading: true });
  const bushMat = new THREE.MeshLambertMaterial({ color: 0x448844, flatShading: true });

  for (let x = 1; x < length - 1; x += 2) {
    for (let z = 1; z < breadth - 1; z += 2) {
      const height = heightMap[x][z];

      if (height <= waterLevel) continue; // Skip water level
      if (isClearingCell(x, z, plateaus)) continue; // Keep build areas clear

      const biome = biomeMask[x * breadth + z];
      const vegetationDensity = BIOME_TREE_DENSITY[biome];
      if (!vegetationDensity) continue;

      const vegetationNoise = noise2D(x * 0.1, z * 0.1);
      const threshold = 1 - vegetationDensity * 2;
      if (vegetationNoise < threshold) continue;

      let tooClose = false;
      for (const placed of placedVegetation) {
        const dist = Math.sqrt(Math.pow(x - placed.x, 2) + Math.pow(z - placed.z, 2));
        if (dist < minSpacing) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      const worldX = (x - length / 2) * VOXEL_SIZE;
      const worldY = (height + 0.5) * VOXEL_SIZE;
      const worldZ = (z - breadth / 2) * VOXEL_SIZE;

      // Wetlands and highlands read as scrub/reeds, not trees. Otherwise the
      // upper half of the placement band is trees, the lower half bushes.
      const isBush =
        biome === BIOME.wetland ||
        biome === BIOME.highland ||
        vegetationNoise < threshold + (1 - threshold) * 0.5;

      if (isBush) {
        bushes.push(new THREE.Vector3(worldX, worldY, worldZ));
      } else {
        treeTrunks.push(new THREE.Vector3(worldX, worldY + 0.25, worldZ));
        treeCones1.push(new THREE.Vector3(worldX, worldY + 0.6, worldZ));
        treeCones2.push(new THREE.Vector3(worldX, worldY + 0.95, worldZ));
      }
      placedVegetation.push({ x, z });
    }
  }

  const matrix = new THREE.Matrix4();

  // Trunks
  if (treeTrunks.length > 0) {
    const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeTrunks.length);
    treeTrunks.forEach((pos, i) => {
      matrix.setPosition(pos);
      trunkMesh.setMatrixAt(i, matrix);
    });
    trunkMesh.instanceMatrix.needsUpdate = true;
    trunkMesh.castShadow = true;
    terrain.add(trunkMesh);
  }

  // Cone Layer 1
  if (treeCones1.length > 0) {
    const cone1Mesh = new THREE.InstancedMesh(cone1Geo, leafMat1, treeCones1.length);
    treeCones1.forEach((pos, i) => {
      matrix.setPosition(pos);
      cone1Mesh.setMatrixAt(i, matrix);
    });
    cone1Mesh.instanceMatrix.needsUpdate = true;
    cone1Mesh.castShadow = true;
    terrain.add(cone1Mesh);
  }

  // Cone Layer 2
  if (treeCones2.length > 0) {
    const cone2Mesh = new THREE.InstancedMesh(cone2Geo, leafMat2, treeCones2.length);
    treeCones2.forEach((pos, i) => {
      matrix.setPosition(pos);
      cone2Mesh.setMatrixAt(i, matrix);
    });
    cone2Mesh.instanceMatrix.needsUpdate = true;
    cone2Mesh.castShadow = true;
    terrain.add(cone2Mesh);
  }

  // Bushes
  if (bushes.length > 0) {
    const bushMesh = new THREE.InstancedMesh(bushGeo, bushMat, bushes.length);
    bushes.forEach((pos, i) => {
      matrix.setPosition(pos);
      bushMesh.setMatrixAt(i, matrix);
    });
    bushMesh.instanceMatrix.needsUpdate = true;
    bushMesh.castShadow = true;
    terrain.add(bushMesh);
  }
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

  // --- 3. Landmarks: elevated ridge + sunken basin (scenic variety) ---
  pushDisk(maxSide * (0.1 + rng() * 0.04) * radiusScale, 10 + 2 * Math.floor(rng() * 2), () => true);
  pushDisk(maxSide * (0.08 + rng() * 0.04) * radiusScale, 4 + 2 * Math.floor(rng() * 2), () => true);

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

/** Multi-scale heightmap: broad hills, mid plateau regions, weak detail. */
function generateHeightMap(length, breadth, seed) {
  const noiseLow = createNoise2D(() => seed);
  const noiseMid = createNoise2D(() => seed * 1.7);
  const noiseHigh = createNoise2D(() => seed * 3.1);
  const heightMap = [];
  for (let x = 0; x < length; x++) {
    heightMap[x] = [];
    for (let z = 0; z < breadth; z++) {
      const broad = noiseLow(x * 0.02, z * 0.02) * 3.4;
      const mid = noiseMid(x * 0.055, z * 0.055) * 1.5;
      const detail = noiseHigh(x * 0.13, z * 0.13) * 0.5;
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

/**
 * Generate voxel terrain using multi-scale simplex noise (OPTIMIZED)
 * @param {number} length - Length of the terrain (X axis)
 * @param {number} breadth - Breadth of the terrain (Z axis)
 * @param {number} seed - Random seed for terrain generation (deterministic)
 * @returns {THREE.Group} Group containing all terrain voxels
 */
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
  const voxelGeometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
  const voxelInstances = new Map();

  // Precomputed meadow→forest gradient (avoids per-voxel color math)
  const grassColor = new THREE.Color(TERRAIN_COLORS.grass);
  const forestColor = new THREE.Color(TERRAIN_COLORS.forest);
  const forestLerp = new Array(256);
  for (let b = 0; b < 256; b++) {
    forestLerp[b] = grassColor.clone().lerp(forestColor, b / 255).getHex();
  }

  const surfaceColor = (biome, b) => {
    switch (biome) {
      case BIOME.forest: return TERRAIN_COLORS.forest;
      case BIOME.highland: return TERRAIN_COLORS.highland;
      case BIOME.wetland: return TERRAIN_COLORS.wetland;
      case BIOME.industrial: return TERRAIN_COLORS.industrial;
      default: return forestLerp[b];
    }
  };
  const sideColor = (biome) => {
    if (biome === BIOME.highland) return TERRAIN_COLORS.rock;
    if (biome === BIOME.industrial) return TERRAIN_COLORS.industrial;
    return TERRAIN_COLORS.dirt; // darker dirt on vertical/cut faces
  };

  // =================================================================
  // OPTIMIZATION PHASE 2: Iterate again and generate ONLY visible voxels.
  // A voxel is visible if any of its 6 faces is exposed to air.
  // =================================================================
  for (let x = 0; x < length; x++) {
    for (let z = 0; z < breadth; z++) {
      const height = heightMap[x][z];
      const biome = biomeMask[x * breadth + z];

      // Get heights of neighbours, handling edges of the map.
      const h_neg_x = (x > 0) ? heightMap[x - 1][z] : -1;
      const h_pos_x = (x < length - 1) ? heightMap[x + 1][z] : -1;
      const h_neg_z = (z > 0) ? heightMap[x][z - 1] : -1;
      const h_pos_z = (z < breadth - 1) ? heightMap[x][z + 1] : -1;

      // Stack voxels from bottom to top for this (x, z) column
      for (let y = 0; y <= height; y++) {
        const isExposed =
          y === height ||
          y > h_neg_x ||
          y > h_pos_x ||
          y > h_neg_z ||
          y > h_pos_z;

        if (!isExposed) continue;

        const worldX = (x - length / 2) * VOXEL_SIZE;
        const worldY = y * VOXEL_SIZE;
        const worldZ = (z - breadth / 2) * VOXEL_SIZE;

        let color;
        if (y <= waterLevel) {
          color = TERRAIN_COLORS.sand; // Lakebed: sand underwater
        } else if (y <= waterLevel + 1) {
          color = TERRAIN_COLORS.sand; // shoreline shelf
        } else if (y < height) { // A side-block
          color = sideColor(biome);
        } else { // The top-most block — biome surface, rock on steep drops
          const slope = Math.max(
            Math.abs(height - h_neg_x),
            Math.abs(height - h_pos_x),
            Math.abs(height - h_neg_z),
            Math.abs(height - h_pos_z)
          );
          color = slope >= 3 ? TERRAIN_COLORS.rock : surfaceColor(biome, blend ? blend[x * breadth + z] : 0);
        }

        const colorKey = color.toString();
        if (!voxelInstances.has(colorKey)) {
          voxelInstances.set(colorKey, []);
        }
        voxelInstances.get(colorKey).push({
          position: new THREE.Vector3(worldX, worldY, worldZ),
        });
      }
    }
  }

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

  // Create instanced meshes
  voxelInstances.forEach((instances, colorKey) => {
    const color = parseInt(colorKey);
    const material = new THREE.MeshLambertMaterial({
      color,
      flatShading: true,
    });

    const instancedMesh = new THREE.InstancedMesh(
      voxelGeometry,
      material,
      instances.length
    );

    const matrix = new THREE.Matrix4();
    instances.forEach((instance, index) => {
      matrix.setPosition(instance.position);
      instancedMesh.setMatrixAt(index, matrix);
    });

    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    terrain.add(instancedMesh);
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
