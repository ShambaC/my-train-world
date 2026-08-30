/**
 * Road Network — deterministic scenery roads generated from terrain data.
 *
 * Roads are pure scenery: no graph behavior, no validation, no gameplay.
 * They follow flat meadow/industrial terrain, avoid construction plateaus
 * (clearing cells stay usable for user tracks/stations), connect the
 * scattered buildings registered in `scatterRegistry`, and cross tracks
 * freely (a track over a road becomes a crossing — handled elsewhere).
 *
 * Road representation is lightweight: each road is a polyline of world
 * waypoints (plus the underlying cell list for rebuilding). Roads are
 * generated once per terrain, seeded by the world seed.
 */
import * as THREE from 'three';
import { mulberry32, BIOME, isClearingCell, WATER_LEVEL_VOXEL } from '../terrain.js';
import { scatterRegistry } from './scatterRegistry.js';
import { makeStyleMaterial } from '../render/styleMaterials.js';

const VOXEL = 0.5;
export const ROAD_TILE_LENGTH = VOXEL;
export const ROAD_SHOULDER = 0.22;
const LIFT = 0.015; // keep road quads clear of the voxel tops

export const ROAD_WIDTH = {
  main: 1.0,
  branch: 0.75,
  dirt: 0.55,
};

const MAX_REGIONS = 12;
const MIN_REGION = 10;
const MIN_RUN = 3;
const LINK_RANGE = 34;
const MAX_LINKS = 24;
const MAX_SPURS = 20;
const SPUR_RANGE = 18;

// ── Road data ────────────────────────────────────────────────────────────

/**
 * Turn a flat cell into a world-space waypoint (voxel top + lift).
 */
function cellToWorld(x, z, h, length, breadth) {
  return {
    x: (x - length / 2 + 0.5) * VOXEL,
    y: h * VOXEL + 0.25 + LIFT,
    z: (z - breadth / 2 + 0.5) * VOXEL,
  };
}

/**
 * Deterministic road layout from terrain heightmap/biomes/plateaus.
 * @param {object} terrainData — generateTerrain().userData
 * @returns {{roads: Array}}
 */
export function buildRoadNetwork(terrainData) {
  const { heightMap, biomeMask, plateaus, seed, length, breadth } = terrainData;
  const rng = mulberry32((((seed * 2654435761) >>> 0) ^ 0x5f356495) >>> 0);

  const slopeAt = (x, z) => Math.max(
    Math.abs(heightMap[x][z] - heightMap[x - 1][z]),
    Math.abs(heightMap[x][z] - heightMap[x + 1][z]),
    Math.abs(heightMap[x][z] - heightMap[x][z - 1]),
    Math.abs(heightMap[x][z] - heightMap[x][z + 1])
  );

  const roadable = (x, z) => {
    if (x < 1 || z < 1 || x >= length - 1 || z >= breadth - 1) return false;
    const h = heightMap[x][z];
    if (h <= WATER_LEVEL_VOXEL) return false;
    if (isClearingCell(x, z, plateaus)) return false; // keep build areas free
    if (slopeAt(x, z) > 1) return false;
    // Roads may thread through fields, forest and mud — only steep slopes
    // and water block them.
    const biome = biomeMask[x * breadth + z];
    return biome !== BIOME.highland;
  };

  // ── Flat region clustering (connected roadable cells) ──
  const visited = new Uint8Array(length * breadth);
  const regions = [];
  for (let x = 1; x < length - 1; x++) {
    for (let z = 1; z < breadth - 1; z++) {
      const idx = x * breadth + z;
      if (visited[idx] || !roadable(x, z)) continue;
      const stack = [[x, z]];
      visited[idx] = 1;
      const cells = [];
      let sumX = 0;
      let sumZ = 0;
      while (stack.length) {
        const [cx, cz] = stack.pop();
        cells.push([cx, cz]);
        sumX += cx;
        sumZ += cz;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const nz = cz + dz;
          const ni = nx * breadth + nz;
          if (nx > 0 && nz > 0 && nx < length - 1 && nz < breadth - 1 && !visited[ni] && roadable(nx, nz)) {
            visited[ni] = 1;
            stack.push([nx, nz]);
          }
        }
      }
      if (cells.length >= MIN_REGION) {
        regions.push({ cells, cx: sumX / cells.length, cz: sumZ / cells.length });
      }
    }
  }
  regions.sort((a, b) => b.cells.length - a.cells.length);
  regions.length = Math.min(regions.length, MAX_REGIONS);

  // ── Axis roads through region centroids ──
  const claimed = new Set();
  const roads = [];
  let nextId = 0;
  const claimRoad = (cells, type) => {
    const fresh = cells.filter(([x, z]) => !claimed.has(`${x},${z}`));
    if (fresh.length < MIN_RUN) return null;
    for (const [x, z] of fresh) claimed.add(`${x},${z}`);
    const waypoints = fresh.map(([x, z]) => cellToWorld(x, z, heightMap[x][z], length, breadth));
    const road = {
      id: `road_${nextId++}`,
      type,
      cells: fresh,
      waypoints,
      width: ROAD_WIDTH[type],
    };
    roads.push(road);
    return road;
  };

  // Collect axis runs of roadable cells crossing the region centroid.
  const axisRuns = (region, axis) => {
    const lines = new Map();
    for (const [x, z] of region.cells) {
      const key = axis === 'x' ? z : x;
      const val = axis === 'x' ? x : z;
      if (!lines.has(key)) lines.set(key, []);
      lines.get(key).push(val);
    }
    const runs = [];
    for (const [key, vals] of lines) {
      vals.sort((a, b) => a - b);
      let run = [];
      for (const v of vals) {
        if (run.length && v !== run[run.length - 1] + 1) {
          if (run.length >= MIN_RUN) runs.push({ key, vals: run, axis });
          run = [];
        }
        run.push(v);
      }
      if (run.length >= MIN_RUN) runs.push({ key, vals: run, axis });
    }
    return runs;
  };

  for (const region of regions) {
    const minX = Math.min(...region.cells.map((c) => c[0]));
    const maxX = Math.max(...region.cells.map((c) => c[0]));
    const minZ = Math.min(...region.cells.map((c) => c[1]));
    const maxZ = Math.max(...region.cells.map((c) => c[1]));
    const wide = maxX - minX >= maxZ - minZ;
    const cKey = wide ? 'cz' : 'cx';
    const cVal = Math.round(region[cKey]);

    // Main road along the wider axis through the centroid.
    const mainRun = axisRuns(region, wide ? 'x' : 'z')
      .filter((r) => r.key === cVal && r.vals.includes(Math.round(region[wide ? 'cx' : 'cz'])))
      .sort((a, b) => b.vals.length - a.vals.length)[0];
    if (mainRun) {
      const cells = mainRun.vals.map((v) => (wide ? [v, mainRun.key] : [mainRun.key, v]));
      claimRoad(cells, 'main');
    }

    // Branch road across the short axis of big regions.
    if (region.cells.length >= 40) {
      const perpKey = wide ? 'cx' : 'cz';
      const perpVal = Math.round(region[perpKey]);
      const perpRun = axisRuns(region, wide ? 'z' : 'x')
        .filter((r) => r.key === perpVal)
        .sort((a, b) => b.vals.length - a.vals.length)[0];
      if (perpRun) {
        const cells = perpRun.vals.map((v) => (wide ? [perpRun.key, v] : [v, perpRun.key]));
        claimRoad(cells, 'branch');
      }
    }
  }

  // ── Endpoint links (connect roads into a loose network) ──
  const endpoints = [];
  for (const road of roads) {
    const first = road.cells[0];
    const last = road.cells[road.cells.length - 1];
    endpoints.push({ road, cell: first, end: 'start' });
    endpoints.push({ road, cell: last, end: 'end' });
  }

  // Axis-aligned L path between two cells, staying on roadable cells.
  // Tries both axis orders; returns the cell list (excluding the target,
  // which is already a road cell).
  const linkCells = (a, b) => {
    const orders = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? [['x', 'z'], ['z', 'x']] : [['z', 'x'], ['x', 'z']];
    for (const order of orders) {
      const attempt = [];
      let ax = a[0];
      let az = a[1];
      let ok = true;
      for (const axis of order) {
        const target = axis === 'x' ? b[0] : b[1];
        const delta = Math.sign(target - (axis === 'x' ? ax : az));
        let guard = 0;
        while (Math.abs((axis === 'x' ? ax : az) - target) > 0 && guard++ < 80) {
          if (!roadable(ax, az)) {
            ok = false;
            break;
          }
          attempt.push([ax, az]);
          if (axis === 'x') ax += delta;
          else az += delta;
        }
        if (!ok) break;
      }
      if (ok) return attempt;
    }
    return null;
  };

  let links = 0;
  for (const ep of endpoints) {
    if (links >= MAX_LINKS) break;
    if (rng() < 0.5) continue; // not every endpoint grows a link
    const nearest = endpoints
      .filter((o) => o.road !== ep.road)
      .map((o) => ({ o, d: Math.max(Math.abs(o.cell[0] - ep.cell[0]), Math.abs(o.cell[1] - ep.cell[1])) }))
      .filter((m) => m.d > 3 && m.d <= LINK_RANGE)
      .sort((a, b) => a.d - b.d)[0];
    if (!nearest) continue;
    const path = linkCells(ep.cell, nearest.o.cell);
    if (!path) continue;
    if (path.length < 2) continue;
    if (claimRoad(path, 'branch')) links++;
  }

  // ── Building spurs (dirt paths from scattered buildings to roads) ──
  const roadCellSet = claimed;
  let spurs = 0;
  for (const b of scatterRegistry.buildings) {
    if (spurs >= MAX_SPURS) break;
    const bx = b.cellX;
    const bz = b.cellZ;
    // Nearest road cell within range (chebyshev)
    let nearest = null;
    let bestD = Infinity;
    for (const key of roadCellSet) {
      const [rx, rz] = key.split(',').map(Number);
      const d = Math.max(Math.abs(rx - bx), Math.abs(rz - bz));
      if (d < bestD && d <= SPUR_RANGE) {
        bestD = d;
        nearest = [rx, rz];
      }
    }
    if (!nearest) continue;
    const path = linkCells(nearest, [bx, bz]);
    if (!path || path.length < 2) continue;
    const spur = path.slice(0, Math.max(2, path.length - 1));
    if (claimRoad(spur, 'dirt')) spurs++;
  }

  // ── Lamps on every other road tile (main + branch, not dirt paths) ──
  const lamps = [];
  for (const road of roads) {
    if (road.type === 'dirt') continue;
    let side = 1;
    for (let i = 1; i < road.cells.length - 1; i += 2) {
      const [x, z] = road.cells[i];
      // Road direction at this cell → perpendicular offset for the lamp.
      const prev = road.cells[i - 1];
      const next = road.cells[i + 1];
      const dx = next[0] - prev[0];
      const dz = next[1] - prev[1];
      const len = Math.hypot(dx, dz) || 1;
      const perpX = (-dz / len) * side;
      const perpZ = (dx / len) * side;
      if (claimed.has(`${x},${z}`)) {
        const h = heightMap[x][z];
        lamps.push({
          x: (x - length / 2 + 0.5) * VOXEL + perpX * 0.55,
          y: h * VOXEL + 0.25 + LIFT,
          z: (z - breadth / 2 + 0.5) * VOXEL + perpZ * 0.55,
        });
      }
      side = -side;
    }
  }

  // ── Signs at dead ends + intersections ──
  const signs = [];
  const intersectionCells = new Map();
  for (const road of roads) {
    for (const [x, z] of road.cells) {
      const key = `${x},${z}`;
      intersectionCells.set(key, (intersectionCells.get(key) || 0) + 1);
    }
  }
  for (const road of roads) {
    const ends = [road.cells[0], road.cells[road.cells.length - 1]];
    for (const [x, z] of ends) {
      const key = `${x},${z}`;
      if (intersectionCells.get(key) > 1) continue;
      const h = heightMap[x][z];
      // Direction inward along the road from this end.
      let dir;
      const first = road.cells[0];
      const last = road.cells[road.cells.length - 1];
      if (x === first[0] && z === first[1]) {
        const n = road.cells[1];
        dir = [x - n[0], z - n[1]];
      } else if (road.cells.length > 1) {
        const n = road.cells[road.cells.length - 2];
        dir = [x - n[0], z - n[1]];
      } else {
        dir = [0, -1];
      }
      // Set back slightly from the dead end, on the side of the road.
      const perp = [-dir[1], dir[0]];
      signs.push({
        x: (x - length / 2 + 0.5) * VOXEL + perp[0] * 0.35,
        y: h * VOXEL + 0.25 + LIFT,
        z: (z - breadth / 2 + 0.5) * VOXEL + perp[1] * 0.35,
        rotY: Math.atan2(dir[0], dir[1]),
      });
    }
  }

  return { roads, lamps, signs };
}

// ── Road meshes (instanced, shared resources) ────────────────────────────

const QUAD_GEO = new THREE.PlaneGeometry(1, 1);
const POLE_GEO = new THREE.CylinderGeometry(0.014, 0.02, 0.55, 6);
const LAMP_HEAD_GEO = new THREE.SphereGeometry(0.045, 8, 8);
const GLOW_CORE_GEO = new THREE.SphereGeometry(0.055, 8, 8);
const GLOW_HALO_GEO = new THREE.SphereGeometry(0.11, 8, 8);
const SIGN_POST_GEO = new THREE.CylinderGeometry(0.012, 0.016, 0.42, 6);
const SIGN_BOARD_GEO = new THREE.BoxGeometry(0.15, 0.1, 0.02);

// Road quads span ~0.5-1 world unit each; repeat ~0.35 keeps the texture
// tile at roughly 1.5-3 units so the pattern reads, not screams.
const ASPHALT_MAT = makeStyleMaterial('asphalt', { repeat: [0.35, 0.35] });
const SHOULDER_MAT = makeStyleMaterial('shoulder', { repeat: [0.3, 0.3] });
const DIRT_MAT = makeStyleMaterial('road_dirt', { repeat: [0.3, 0.3] });
const POLE_MAT = makeStyleMaterial('lamp_post');
const LAMP_HEAD_MAT = new THREE.MeshLambertMaterial({ color: 0x2c2c2c, flatShading: true });
const GLOW_CORE_MAT = new THREE.MeshBasicMaterial({
  color: 0xffd9a0,
  transparent: true,
  opacity: 0.85,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});
GLOW_CORE_MAT.userData = { nightGlow: true, baseOpacity: 0.85 };
const GLOW_HALO_MAT = new THREE.MeshBasicMaterial({
  color: 0xffb86a,
  transparent: true,
  opacity: 0.35,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});
GLOW_HALO_MAT.userData = { nightGlow: true, baseOpacity: 0.35 };
const SIGN_POST_MAT = new THREE.MeshLambertMaterial({ color: 0x2b2b2b, flatShading: true });
const SIGN_BOARD_MAT = makeStyleMaterial('green_sign');

const MESH_FLAGS = { castShadow: true, receiveShadow: true };

const ROAD_FLAT_QUAT = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  -Math.PI / 2
);
const WORLD_Y_AXIS = new THREE.Vector3(0, 1, 0);

const compose = (matrix, px, py, pz, rotY, sx, sy, sz) => {
  // Flatten PlaneGeometry first, then rotate around world Y. Euler XYZ
  // composition made roads aligned on Z stand vertically edge-on.
  const quat = new THREE.Quaternion().setFromAxisAngle(WORLD_Y_AXIS, rotY);
  quat.multiply(ROAD_FLAT_QUAT);
  matrix.compose(
    new THREE.Vector3(px, py, pz),
    quat,
    new THREE.Vector3(sx, sy, sz)
  );
};

/**
 * Build the instanced road geometry group for a road layout.
 * @param {{roads: Array, lamps: Array, signs: Array}} layout
 * @returns {THREE.Group}
 */
export function createRoadMeshes(layout) {
  const group = new THREE.Group();
  if (!layout) return group;

  // Crossroad cells: claimed by 2+ roads. Shoulders are skipped there, and
  // the later road's asphalt is lifted slightly to avoid z-fighting.
  const cellCount = new Map();
  const firstClaim = new Map();
  for (const road of layout.roads) {
    for (const [x, z] of road.cells) {
      const key = `${x},${z}`;
      const n = (cellCount.get(key) || 0) + 1;
      cellCount.set(key, n);
      if (n === 1) firstClaim.set(key, road.id);
    }
  }
  const isCross = (x, z) => (cellCount.get(`${x},${z}`) || 0) >= 2;
  const isFirst = (roadId, x, z) => firstClaim.get(`${x},${z}`) === roadId;

  const asphaltQuads = [];
  const shoulderQuads = [];
  const dirtQuads = [];
  for (const road of layout.roads) {
    const wp = road.waypoints;
    for (let i = 0; i < wp.length - 1; i++) {
      const a = wp[i];
      const b = wp[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.01) continue;
      const midX = (a.x + b.x) / 2;
      const midZ = (a.z + b.z) / 2;
      const yaw = Math.atan2(b.z - a.z, b.x - a.x);
      const w = road.width;

      // Does this segment touch a crossroad cell?
      let crossing = false;
      let lifted = false;
      if (road.cells && (road.userTiles ? road.cells.length > 0 : road.cells.length > 1)) {
        const cells = road.userTiles
          ? [road.cells[i]]
          : [road.cells[i], road.cells[i + 1]];
        for (const cell of cells) {
          if (!cell) continue;
          const [cx, cz] = cell;
          if (isCross(cx, cz)) {
            crossing = true;
            if (!isFirst(road.id, cx, cz)) lifted = true;
          }
        }
      }

      if (road.type === 'dirt') {
        dirtQuads.push({ x: midX, y: a.y, z: midZ, yaw, len, w });
      } else {
        if (!crossing) {
          shoulderQuads.push({ x: midX, y: a.y, z: midZ, yaw, len, w: w + ROAD_SHOULDER });
        }
        asphaltQuads.push({ x: midX, y: a.y + 0.004 + (lifted ? 0.01 : 0), z: midZ, yaw, len, w });
      }
    }
  }

  const matrix = new THREE.Matrix4();
  const addInstanced = (geo, mat, entries) => {
    if (!entries.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, entries.length);
    entries.forEach((e, i) => {
      compose(matrix, e.x, e.y, e.z, -e.yaw, e.len, e.w, 1);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    Object.assign(mesh, MESH_FLAGS);
    group.add(mesh);
    return mesh;
  };

  const addPlacedInstanced = (geo, mat, entries) => {
    if (!entries.length) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, entries.length);
    entries.forEach((e, i) => {
      const quat = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0, e.rotY || 0, 0)
      );
      matrix.compose(
        new THREE.Vector3(e.x, e.y, e.z),
        quat,
        new THREE.Vector3(1, 1, 1)
      );
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    Object.assign(mesh, MESH_FLAGS);
    group.add(mesh);
    return mesh;
  };

  addInstanced(QUAD_GEO, SHOULDER_MAT, shoulderQuads);
  addInstanced(QUAD_GEO, ASPHALT_MAT, asphaltQuads);
  addInstanced(QUAD_GEO, DIRT_MAT, dirtQuads);

  // Lamps: pole + head + additive glow (faded by Roads.jsx with nightness)
  const lampPoles = layout.lamps.map((l) => ({ ...l }));
  const lampGlows = layout.lamps.map((l) => ({ ...l, y: l.y + 0.55 }));
  addPlacedInstanced(POLE_GEO, POLE_MAT, lampPoles.map((l) => ({ ...l, y: l.y + 0.275 })));
  addPlacedInstanced(LAMP_HEAD_GEO, LAMP_HEAD_MAT, lampGlows);
  const glowCore = addPlacedInstanced(GLOW_CORE_GEO, GLOW_CORE_MAT, lampGlows);
  const glowHalo = addPlacedInstanced(GLOW_HALO_GEO, GLOW_HALO_MAT, lampGlows);
  if (glowCore) glowCore.renderOrder = 2;
  if (glowHalo) glowHalo.renderOrder = 2;

  // Signs: post + board, rotated to face along the road
  const signPosts = layout.signs.map((s) => ({ ...s, y: s.y + 0.21 }));
  const signBoards = layout.signs.map((s) => ({ ...s, y: s.y + 0.44 }));
  const postMesh = addPlacedInstanced(SIGN_POST_GEO, SIGN_POST_MAT, signPosts);
  const boardMesh = addPlacedInstanced(SIGN_BOARD_GEO, SIGN_BOARD_MAT, signBoards);
  if (postMesh) postMesh.castShadow = false;
  if (boardMesh) boardMesh.castShadow = false;

  group.userData = { glowCore, glowHalo };
  return group;
}

/**
 * Road Manager — stores the generated + user-built road layout and exposes
 * world-space segments for crossing detection. Natural roads are rebuilt on
 * terrain changes; user roads (Road tool) are kept separate and merged in.
 */
export class RoadManager {
  constructor() {
    this.layout = { roads: [], lamps: [], signs: [] };
    this.naturalLayout = { roads: [], lamps: [], signs: [] };
    this.userRoads = [];
    this.userNextId = 0;
    this.version = 0;
    this.generation = 0;
    this.ready = false;
    this.length = 0;
    this.breadth = 0;
  }

  build(terrainData) {
    this.naturalLayout = terrainData ? buildRoadNetwork(terrainData) : { roads: [], lamps: [], signs: [] };
    this.userRoads = [];
    this.length = terrainData?.length || 0;
    this.breadth = terrainData?.breadth || 0;
    this.rebuildLayout();
    this.ready = !!terrainData;
    this.generation++;
    this.version++;
  }

  clear() {
    this.naturalLayout = { roads: [], lamps: [], signs: [] };
    this.userRoads = [];
    this.rebuildLayout();
    this.ready = false;
    this.generation++;
    this.version++;
  }

  rebuildLayout() {
    this.layout = {
      roads: [...this.naturalLayout.roads, ...this.mergeUserRoads()],
      lamps: [...this.naturalLayout.lamps, ...this.userLamps()],
      signs: this.naturalLayout.signs,
    };
  }

  /**
   * Lamp posts on every other user road tile, alternating road sides.
   */
  userLamps() {
    const lamps = [];
    for (const road of this.mergeUserRoads()) {
      let side = 1;
      for (let i = 1; i < road.waypoints.length - 1; i += 2) {
        const a = road.waypoints[i];
        const b = road.waypoints[i + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz) || 1;
        const perpX = (-dz / len) * side;
        const perpZ = (dx / len) * side;
        lamps.push({
          x: (a.x + b.x) / 2 + perpX * 0.55,
          y: a.y,
          z: (a.z + b.z) / 2 + perpZ * 0.55,
        });
        side = -side;
      }
    }
    return lamps;
  }

  /** Merge contiguous collinear user tiles into one traffic/render path. */
  mergeUserRoads() {
    const remaining = this.userRoads.slice();
    const merged = [];
    const near = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) < 0.01;
    const direction = (tile, forward = true) => {
      const a = tile.waypoints[forward ? 0 : 1];
      const b = tile.waypoints[forward ? 1 : 0];
      return { x: b.x - a.x, z: b.z - a.z };
    };
    const collinear = (a, b) => Math.abs(a.x * b.z - a.z * b.x) < 0.01;

    while (remaining.length) {
      const seed = remaining.shift();
      const chain = [{ tile: seed, forward: true }];
      let start = seed.waypoints[0];
      let end = seed.waypoints[1];
      let changed = true;

      while (changed) {
        changed = false;
        const chainDir = direction(chain[0].tile, chain[0].forward);

        for (let i = 0; i < remaining.length; i++) {
          const tile = remaining[i];
          if (!collinear(chainDir, direction(tile, true))) continue;
          if (near(tile.waypoints[0], end)) {
            chain.push({ tile, forward: true });
            end = tile.waypoints[1];
            remaining.splice(i, 1);
            changed = true;
            break;
          }
          if (near(tile.waypoints[1], end)) {
            chain.push({ tile, forward: false });
            end = tile.waypoints[0];
            remaining.splice(i, 1);
            changed = true;
            break;
          }
          if (near(tile.waypoints[1], start)) {
            chain.unshift({ tile, forward: true });
            start = tile.waypoints[0];
            remaining.splice(i, 1);
            changed = true;
            break;
          }
          if (near(tile.waypoints[0], start)) {
            chain.unshift({ tile, forward: false });
            start = tile.waypoints[1];
            remaining.splice(i, 1);
            changed = true;
            break;
          }
        }
      }

      merged.push({
        id: chain[0].tile.id,
        tileIds: chain.map((entry) => entry.tile.id),
        tileCells: chain.map((entry) => entry.tile.cells[0]),
        type: 'branch',
        source: 'user',
        userTiles: true,
        cells: chain.map((entry) => entry.tile.cells[0]),
        waypoints: [
          { ...start },
          ...chain.map((entry) => ({ ...entry.tile.waypoints[entry.forward ? 1 : 0] })),
        ],
        width: ROAD_WIDTH.branch,
      });
    }
    return merged;
  }

  /**
   * Place one user road segment (axis-aligned, straight only) at a snapped
   * world position. Roads may overlap/cross freely — crossings are allowed.
   */
  addRoad(position, rotation) {
    if (!this.length) return null;
    const dirX = Math.abs(Math.sin(rotation)) > 0.5 ? 1 : 0;
    const dirZ = Math.abs(Math.cos(rotation)) > 0.5 ? 1 : 0;
    const cx = Math.round(position.x / 0.5 + this.length / 2 - 0.5);
    const cz = Math.round(position.z / 0.5 + this.breadth / 2 - 0.5);
    // Use snapped world center directly. Recomputing center from cell math
    // can move ghost and placed tile apart at half-grid boundaries.
    const centerX = position.x;
    const centerZ = position.z;
    const worldDir = { x: dirX, z: dirZ };
    const y = position.y - 0.005; // snapToGrid lifts +0.02; roads use +0.015
    const cells = [[cx, cz]];
    const waypoints = [
      { x: centerX - worldDir.x * ROAD_TILE_LENGTH / 2, y, z: centerZ - worldDir.z * ROAD_TILE_LENGTH / 2 },
      { x: centerX + worldDir.x * ROAD_TILE_LENGTH / 2, y, z: centerZ + worldDir.z * ROAD_TILE_LENGTH / 2 },
    ];
    const road = {
      id: `user_road_${this.userNextId++}`,
      type: 'branch',
      source: 'user',
      cells,
      waypoints,
      width: ROAD_WIDTH.branch,
    };
    this.userRoads.push(road);
    this.rebuildLayout();
    this.version++;
    return road;
  }

  /** Same-axis road tile already occupies this cell; perpendicular crossing allowed. */
  isRoadPlacementValid(position, rotation) {
    if (!this.length) return false;
    const cx = Math.round(position.x / VOXEL + this.length / 2 - 0.5);
    const cz = Math.round(position.z / VOXEL + this.breadth / 2 - 0.5);
    const axis = Math.abs(Math.sin(rotation)) > 0.5 ? 'x' : 'z';
    for (const road of this.layout.roads) {
      if (!road.cells?.some(([x, z]) => x === cx && z === cz)) continue;
      const a = road.waypoints?.[0];
      const b = road.waypoints?.[1];
      if (!a || !b) continue;
      const roadAxis = Math.abs(b.x - a.x) > Math.abs(b.z - a.z) ? 'x' : 'z';
      if (roadAxis === axis) return false;
    }
    return true;
  }

  removeRoad(id) {
    const before = this.userRoads.length;
    this.userRoads = this.userRoads.filter((r) => r.id !== id);
    if (this.userRoads.length !== before) {
      this.rebuildLayout();
      this.version++;
      return true;
    }
    const natural = this.naturalLayout.roads;
    const idx = natural.findIndex((r) => r.id === id);
    if (idx >= 0) {
      natural.splice(idx, 1);
      this.rebuildLayout();
      this.version++;
      return true;
    }
    return false;
  }

  /** Re-insert a user road with its original id (undo/redo, save/load). */
  restoreUserRoad(road) {
    this.userRoads.push(road);
    const num = parseInt(road.id.split('_')[2] || road.id.split('_')[1], 10);
    if (!Number.isNaN(num) && num >= this.userNextId) this.userNextId = num + 1;
    this.rebuildLayout();
    this.version++;
    return road;
  }

  /** User-placed roads only — the natural network regenerates from terrain. */
  exportUserData() {
    return {
      userRoads: this.userRoads,
      userNextId: this.userNextId,
    };
  }

  /** Restore user roads after the natural network has been (re)built. */
  importUserData(data) {
    if (data) {
      this.userRoads = Array.isArray(data.userRoads) ? data.userRoads : [];
      this.userNextId = data.userNextId || 0;
    } else {
      this.userRoads = [];
      this.userNextId = 0;
    }
    this.rebuildLayout();
    this.version++;
  }

  /**
   * Nearest road whose cells cover a world position (delete tool).
   * @returns {{road, center:{x,y,z}, rotation:number} | null}
   */
  findRoadAtPosition(pos, tolCells = 0.7) {
    if (!this.length) return null;
    const cx = Math.round(pos.x / 0.5 + this.length / 2 - 0.5);
    const cz = Math.round(pos.z / 0.5 + this.breadth / 2 - 0.5);
    for (const road of this.layout.roads) {
      for (const [x, z] of road.cells) {
        if (Math.abs(x - cx) <= tolCells && Math.abs(z - cz) <= tolCells) {
          const tileIndex = road.tileCells
            ? road.tileCells.findIndex(([tx, tz]) => tx === x && tz === z)
            : -1;
          const tileId = tileIndex >= 0 ? road.tileIds[tileIndex] : road.id;
          const a = road.cells[0];
          const b = road.cells[road.cells.length - 1];
          const centerCell = tileIndex >= 0 ? road.tileCells[tileIndex] : null;
          const centerX = centerCell ? centerCell[0] : (a[0] + b[0]) / 2;
          const centerZ = centerCell ? centerCell[1] : (a[1] + b[1]) / 2;
          return {
            road,
            id: tileId,
            center: {
              x: (centerX - this.length / 2 + 0.5) * VOXEL,
              y: road.waypoints[0]?.y || pos.y,
              z: (centerZ - this.breadth / 2 + 0.5) * VOXEL,
            },
            rotation: Math.atan2(b[0] - a[0], b[1] - a[1]),
          };
        }
      }
    }
    return null;
  }

  getRoads() {
    return this.layout.roads;
  }

  /**
   * All road cells as "x,z" keys — used by ScatterProps to keep scattered
   * props (trees, rocks, buildings) off the road surface.
   */
  getRoadCells() {
    const cells = new Set();
    for (const road of this.layout.roads) {
      for (const [x, z] of road.cells) cells.add(`${x},${z}`);
    }
    return cells;
  }

  /**
   * World-space road segments {a:{x,y,z}, b:{x,y,z}, roadId, type}.
   */
  getSegments() {
    const out = [];
    for (const road of this.layout.roads) {
      const wp = road.waypoints;
      for (let i = 0; i < wp.length - 1; i++) {
        out.push({ a: wp[i], b: wp[i + 1], roadId: road.id, type: road.type });
      }
    }
    return out;
  }
}
