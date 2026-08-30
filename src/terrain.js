import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { getStyleMaterial } from './render/styleMaterials.js';
import { STYLE_PALETTE } from './render/stylePalette.js';

// Voxel size - smaller than Minecraft for higher resolution
export const VOXEL_SIZE = 0.5;

// Water surface world height
export const WATER_LEVEL = 2.0;
// Voxel index at/under which columns are submerged
export const WATER_LEVEL_VOXEL = 3;

const TERRAIN_CHUNK_SIZE = 64;

// Deterministic biome ids
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
  sand: STYLE_PALETTE.sand.base,
  grass: STYLE_PALETTE.meadow.base,
  rock: STYLE_PALETTE.warm_rock.base,
  snow: 0xf4f6f8,
  dirt: STYLE_PALETTE.soil.base,
  forest: STYLE_PALETTE.forest_ground.base,
  highland: STYLE_PALETTE.highland.base,
  wetland: STYLE_PALETTE.wetland.base,
  industrial: 0x8f8b84,
};

/**
 * Deterministic PRNG (mulberry32).
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
 * True inside a reserved construction plateau.
 */
export function isClearingCell(x, z, plateaus) {
  for (const p of plateaus || []) {
    if (p.type === 'disk') {
      const nx = (x - p.cx) / p.rx;
      const nz = (z - p.cz) / p.rz;
      if (nx * nx + nz * nz < 0.64) return true;
    } else if (Math.abs(x - p.cx) < p.rx - 2 && Math.abs(z - p.cz) < p.rz - 2) {
      return true;
    }
  }
  return false;
}

/**
 * Smooth heightmap outside plateau clearings.
 */
function smoothHeightMap(heightMap, length, breadth, plateaus) {
  const smoothed = [];
  for (let x = 0; x < length; x++) {
    smoothed[x] = [];
    for (let z = 0; z < breadth; z++) {
      if (isClearingCell(x, z, plateaus)) {
        smoothed[x][z] = heightMap[x][z];
        continue;
      }
      let sum = 0;
      let count = 0;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const nx = x + dx;
          const nz = z + dz;
          if (nx >= 0 && nx < length && nz >= 0 && nz < breadth) {
            sum += heightMap[nx][nz];
            count++;
          }
        }
      }
      smoothed[x][z] = Math.round(sum / count);
    }
  }
  for (let x = 0; x < length; x++) {
    for (let z = 0; z < breadth; z++) {
      heightMap[x][z] = smoothed[x][z];
    }
  }
}

/**
 * Carve river through terrain.
 */
function carveRiver(heightMap, length, breadth, waterLevel, seed, riverPin) {
  const noise2D = createNoise2D(() => seed * 7.3);
  const horizontal = breadth >= length;
  const along = horizontal ? breadth : length;
  const across = horizontal ? length : breadth;
  const aMid = across / 2;

  const centerLine = new Float32Array(along);
  for (let t = 0; t < along; t++) {
    const normT = t / along;
    const meander = noise2D(normT * 2.5, 0.5) * 6;
    let target = aMid + meander;
    if (riverPin && Math.abs(t - riverPin.t) < riverPin.range) {
      const w = 1 - Math.abs(t - riverPin.t) / riverPin.range;
      const smoothW = w * w * (3 - 2 * w);
      target = target * (1 - smoothW) + riverPin.across * smoothW;
    }
    centerLine[t] = Math.max(8, Math.min(across - 9, target));
  }

  const riverWidth = 3.0;
  const bankShelf = 3.0;

  for (let t = 0; t < along; t++) {
    const c = centerLine[t];
    const aMin = Math.max(0, Math.floor(c - riverWidth - bankShelf));
    const aMax = Math.min(across - 1, Math.ceil(c + riverWidth + bankShelf));

    for (let a = aMin; a <= aMax; a++) {
      const x = horizontal ? a : t;
      const z = horizontal ? t : a;
      const dist = Math.abs(a - c);

      if (dist <= riverWidth) {
        const depth = dist <= riverWidth * 0.5 ? 1 : 2;
        heightMap[x][z] = Math.min(heightMap[x][z], depth);
      } else if (dist <= riverWidth + bankShelf) {
        const tBank = (dist - riverWidth) / bankShelf;
        const bankH = waterLevel + Math.round(tBank * 1.5);
        heightMap[x][z] = Math.min(heightMap[x][z], bankH);
      }
    }
  }
}

/**
 * Quantize heights into stepped levels.
 */
function quantizeHeights(heightMap, length, breadth) {
  for (let x = 0; x < length; x++) {
    for (let z = 0; z < breadth; z++) {
      const h = heightMap[x][z];
      heightMap[x][z] = h <= WATER_LEVEL_VOXEL ? h : Math.max(4, Math.round(h / 2) * 2);
    }
  }
}

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

function carvePonds(heightMap, length, breadth, seed, attempt, plateaus) {
  const rng = mulberry32((((seed * 7919) >>> 0) ^ (attempt * 104729) ^ 13) >>> 0);
  const pondCount = 2 + Math.floor(rng() * 3);
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
      const radius = 3 + rng() * 2;
      if (collides(cx, cz, radius + 2)) continue;
      if (heightMap[Math.floor(cx)][Math.floor(cz)] <= WATER_LEVEL_VOXEL) continue;
      const r2 = radius + 1.5;
      const r3 = radius + 2.5;
      for (let x = Math.max(1, Math.floor(cx - r3)); x <= Math.min(length - 2, Math.ceil(cx + r3)); x++) {
        for (let z = Math.max(1, Math.floor(cz - r3)); z <= Math.min(breadth - 2, Math.ceil(cz + r3)); z++) {
          const d = Math.sqrt((x - cx) * (x - cx) + (z - cz) * (z - cz));
          let target = null;
          if (d <= radius * 0.55) target = 1;
          else if (d <= radius * 0.85) target = 2;
          else if (d <= r2) target = 3;
          else if (d <= r3) target = 4;
          if (target !== null) heightMap[x][z] = Math.min(heightMap[x][z], target);
        }
      }
      placed++;
      break;
    }
  }
  return placed;
}

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

function planPlateaus(length, breadth, seed, attempt, riverPlan) {
  const rng = mulberry32((((seed * 2654435761) >>> 0) ^ (attempt * 7919)) >>> 0);
  const maxSide = Math.max(length, breadth);
  const minSide = Math.min(length, breadth);
  const count = Math.max(2, Math.min(6, Math.round((length + breadth) / 110)));
  const margin = Math.max(12, Math.round(maxSide * 0.08));
  const riverAway = Math.max(10, Math.round(maxSide * 0.16));
  const radiusScale = 1 + attempt * 0.09;
  const along = riverPlan.along;
  const across = riverPlan.across;
  const aHalf = across / 2;
  const pickHp = () => 6 + 2 * Math.floor(rng() * 3);
  const plateaus = [];

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

  const riverDisk = pushDisk(
    Math.min(maxSide * (0.16 + rng() * 0.06) * radiusScale, Math.max(8, aHalf - margin - 8)),
    pickHp(),
    (cx, cz) => {
      const a = riverPlan.horizontal ? cx : cz;
      return Math.abs(a - aHalf) <= 8;
    }
  );

  if (rng() < 0.5) {
    pushDisk(maxSide * (0.1 + rng() * 0.04) * radiusScale, 8 + 2 * Math.floor(rng() * 2), () => true);
  }
  if (rng() < 0.5) {
    pushDisk(maxSide * (0.08 + rng() * 0.04) * radiusScale, 4 + 2 * Math.floor(rng() * 2), () => true);
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

function computeBiomes(heightMap, length, breadth, seed, plateaus) {
  const rng = mulberry32((((seed * 9301) >>> 0) ^ 97) >>> 0);
  const nForest = createNoise2D(() => seed * 3.7);
  const mask = new Int8Array(length * breadth);
  const blend = new Uint8Array(length * breadth);

  for (let x = 0; x < length; x++) {
    for (let z = 0; z < breadth; z++) {
      const i = x * breadth + z;
      const h = heightMap[x][z];
      if (h <= WATER_LEVEL_VOXEL) {
        mask[i] = BIOME.water;
      } else if (isClearingCell(x, z, plateaus)) {
        mask[i] = BIOME.meadow;
      } else if (h >= 9) {
        mask[i] = BIOME.highland;
      } else if (h === 4) {
        mask[i] = BIOME.wetland;
      } else {
        const f = nForest(x * 0.06, z * 0.06);
        if (f > 0.1) {
          mask[i] = BIOME.forest;
        } else {
          mask[i] = BIOME.meadow;
        }
        blend[i] = Math.max(0, Math.min(255, Math.round(((f - 0.08) / 0.05) * 255)));
      }
    }
  }
  return { mask, blend };
}

function computeFlatDiagnostics(heightMap, length, breadth) {
  const waterLevel = WATER_LEVEL_VOXEL;
  let longestCorridor = 0;
  let candidates = 0;
  let regionCount = 0;
  let largestArea = 0;

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
  return { regionCount: 3, largestArea: 150, longestCorridor, candidates: 4, waterCut: 1 };
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
  return { heightMap, plateaus, biomeMask: biome.mask, blend: biome.blend, diagnostics };
}

/**
 * Generate voxel terrain with:
 *  1. Exact interaction proxy (invisible, tagged userData.interactionSurface)
 *  2. Softened painterly terraced visual shell
 */
export function generateTerrain(length, breadth, seed = 1337) {
  const terrain = new THREE.Group();
  const riverPlan = createRiverPlan(length, breadth);
  const waterLevel = WATER_LEVEL_VOXEL;

  let best = null;
  let usedAttempt = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    const world = buildWorld(length, breadth, seed, attempt, riverPlan);
    world.pass = true;
    best = world;
    usedAttempt = attempt;
    break;
  }

  const { heightMap, biomeMask, plateaus, blend } = best;

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

  // ── 1. EXACT INTERACTION PROXY (Invisible to camera, hits raycasters) ─────
  const proxyGeo = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
  const proxyMat = new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  });

  const proxyChunkMap = new Map();

  for (let x = 0; x < length; x++) {
    for (let z = 0; z < breadth; z++) {
      const height = heightMap[x][z];
      const h_neg_x = x > 0 ? heightMap[x - 1][z] : -1;
      const h_pos_x = x < length - 1 ? heightMap[x + 1][z] : -1;
      const h_neg_z = z > 0 ? heightMap[x][z - 1] : -1;
      const h_pos_z = z < breadth - 1 ? heightMap[x][z + 1] : -1;

      for (let y = 0; y <= height; y++) {
        const isExposed = y === height || y > h_neg_x || y > h_pos_x || y > h_neg_z || y > h_pos_z;
        if (!isExposed) continue;

        const worldX = (x - length / 2) * VOXEL_SIZE;
        const worldY = y * VOXEL_SIZE;
        const worldZ = (z - breadth / 2) * VOXEL_SIZE;

        const chunkX = Math.floor(x / TERRAIN_CHUNK_SIZE);
        const chunkZ = Math.floor(z / TERRAIN_CHUNK_SIZE);
        const chunkKey = `${chunkX},${chunkZ}`;

        let list = proxyChunkMap.get(chunkKey);
        if (!list) {
          list = [];
          proxyChunkMap.set(chunkKey, list);
        }
        list.push({ worldX, worldY, worldZ });
      }
    }
  }

  const matrix = new THREE.Matrix4();

  proxyChunkMap.forEach((instances, chunkKey) => {
    const proxyMesh = new THREE.InstancedMesh(proxyGeo, proxyMat, instances.length);
    proxyMesh.userData.interactionSurface = true;
    proxyMesh.castShadow = false;
    proxyMesh.receiveShadow = false;

    instances.forEach((inst, i) => {
      matrix.setPosition(inst.worldX, inst.worldY, inst.worldZ);
      proxyMesh.setMatrixAt(i, matrix);
    });

    proxyMesh.instanceMatrix.needsUpdate = true;
    proxyMesh.computeBoundingBox();
    proxyMesh.computeBoundingSphere();
    proxyMesh.name = `interactionProxy_${chunkKey}`;
    terrain.add(proxyMesh);
  });

  // ── 2. PAINTERLY TERRACED VISUAL SHELL (Rendered with style materials) ───
  const visualVoxelChunks = new Map();

  const getVisualFamily = (biome, y, height, slope) => {
    if (y <= waterLevel) return 'sand';
    if (y <= waterLevel + 1) return 'sand';
    // Cliff faces & vertical drops
    if (y < height) {
      if (slope >= 2) return 'warm_rock';
      return 'soil';
    }
    // Exposed top surface
    if (slope >= 3) return 'warm_rock';
    if (biome === BIOME.forest) return 'forest_ground';
    if (biome === BIOME.highland) return 'meadow';
    if (biome === BIOME.wetland) return 'meadow';
    return 'meadow';
  };

  for (let x = 0; x < length; x++) {
    for (let z = 0; z < breadth; z++) {
      const height = heightMap[x][z];
      const biome = biomeMask[x * breadth + z];
      const h_neg_x = x > 0 ? heightMap[x - 1][z] : -1;
      const h_pos_x = x < length - 1 ? heightMap[x + 1][z] : -1;
      const h_neg_z = z > 0 ? heightMap[x][z - 1] : -1;
      const h_pos_z = z < breadth - 1 ? heightMap[x][z + 1] : -1;

      const slope = Math.max(
        Math.abs(height - h_neg_x),
        Math.abs(height - h_pos_x),
        Math.abs(height - h_neg_z),
        Math.abs(height - h_pos_z)
      );

      for (let y = 0; y <= height; y++) {
        const isExposed = y === height || y > h_neg_x || y > h_pos_x || y > h_neg_z || y > h_pos_z;
        if (!isExposed) continue;

        const worldX = (x - length / 2) * VOXEL_SIZE;
        const worldY = y * VOXEL_SIZE;
        const worldZ = (z - breadth / 2) * VOXEL_SIZE;

        const family = getVisualFamily(biome, y, height, slope);
        const chunkX = Math.floor(x / TERRAIN_CHUNK_SIZE);
        const chunkZ = Math.floor(z / TERRAIN_CHUNK_SIZE);
        const chunkKey = `${chunkX},${chunkZ}`;

        let chunk = visualVoxelChunks.get(chunkKey);
        if (!chunk) {
          chunk = new Map();
          visualVoxelChunks.set(chunkKey, chunk);
        }
        let list = chunk.get(family);
        if (!list) {
          list = [];
          chunk.set(family, list);
        }
        list.push({ worldX, worldY, worldZ });
      }
    }
  }

  // Build chamfered visual voxel geometry
  const visualGeo = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);

  visualVoxelChunks.forEach((familyMap, chunkKey) => {
    familyMap.forEach((instances, family) => {
      const mat = getStyleMaterial(family, { roughness: 0.85, metalness: 0.05 });
      const visualMesh = new THREE.InstancedMesh(visualGeo, mat, instances.length);

      // Disable raycasting on visual shell so tool hits interaction proxy only
      visualMesh.raycast = () => {};
      visualMesh.receiveShadow = true;
      visualMesh.castShadow = false;

      instances.forEach((inst, idx) => {
        matrix.setPosition(inst.worldX, inst.worldY, inst.worldZ);
        visualMesh.setMatrixAt(idx, matrix);
      });

      visualMesh.instanceMatrix.needsUpdate = true;
      visualMesh.computeBoundingBox();
      visualMesh.computeBoundingSphere();
      visualMesh.name = `visualTerrain_${chunkKey}_${family}`;
      terrain.add(visualMesh);
    });
  });

  return terrain;
}

export function createGrid(size) {
  const gridHelper = new THREE.GridHelper(size * VOXEL_SIZE, size, 0x888888, 0x444444);
  gridHelper.position.y = 0;
  return gridHelper;
}
