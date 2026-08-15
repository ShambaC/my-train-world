/**
 * Traffic Manager — pooled decorative road vehicles and pedestrians.
 *
 * Visual story only: no collisions, no jams, no damage, no objectives.
 * Vehicles drive along road polylines and despawn/respawn at the ends;
 * walkers stroll the road edges. All motion is delta-time based and
 * independent of the render frame limit. Actors far from the camera freeze
 * (their transforms stay put — cheap to skip).
 */

const VEHICLE_MAX = 36;
const WALKER_MAX = 44;
const FAR = 45; // world units — beyond this actors freeze

const SPEEDS = {
  car: [0.5, 0.85],
  truck: [0.38, 0.6],
  bus: [0.45, 0.68],
  cart: [0.28, 0.42],
  bike: [0.55, 0.8],
};

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const rand = (min, max) => min + Math.random() * (max - min);

const vehicleType = () => {
  const roll = Math.random();
  if (roll < 0.4) return 'car';
  if (roll < 0.6) return 'truck';
  if (roll < 0.78) return 'bus';
  if (roll < 0.9) return 'cart';
  return 'bike';
};

/** Split a waypoint list into per-segment distance info for param walking. */
function pathOf(waypoints) {
  const pts = waypoints;
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const len = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
    segs.push({ len });
    total += len;
  }
  return { pts, segs, total };
}

/** Position + yaw at distance s along the path (clamped to ends). */
export function atDistance(path, s) {
  const { pts, segs } = path;
  if (s <= 0) {
    const a = pts[0];
    const b = pts[1] || pts[0];
    return { x: a.x, y: a.y, z: a.z, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  if (s >= path.total) {
    const a = pts[pts.length - 2] || pts[pts.length - 1];
    const b = pts[pts.length - 1];
    return { x: b.x, y: b.y, z: b.z, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
  }
  let rem = s;
  for (let i = 0; i < segs.length; i++) {
    const len = segs[i].len;
    if (rem <= len) {
      const t = rem / Math.max(len, 0.001);
      const ax = pts[i];
      const bx = pts[i + 1];
      return {
        x: ax.x + (bx.x - ax.x) * t,
        y: ax.y + (bx.y - ax.y) * t,
        z: ax.z + (bx.z - ax.z) * t,
        yaw: Math.atan2(bx.x - ax.x, bx.z - ax.z),
      };
    }
    rem -= len;
  }
  const b = pts[pts.length - 1];
  return { x: b.x, y: b.y, z: b.z, yaw: 0 };
}

/**
 * Distance along a path (s) of the point nearest to a world position.
 */
function projectOnPath(path, point) {
  const pts = path.pts;
  let bestS = 0;
  let bestD = Infinity;
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i];
    const bx = pts[i + 1];
    const abx = bx.x - ax.x;
    const abz = bx.z - ax.z;
    const len2 = abx * abx + abz * abz;
    let t = len2 > 0 ? ((point.x - ax.x) * abx + (point.z - ax.z) * abz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const cx = ax.x + abx * t;
    const cz = ax.z + abz * t;
    const d = (point.x - cx) ** 2 + (point.z - cz) ** 2;
    if (d < bestD) {
      bestD = d;
      bestS = acc + t * Math.sqrt(len2);
    }
    acc += Math.sqrt(len2);
  }
  return bestS;
}

export class TrafficManager {
  constructor() {
    this.vehicles = [];
    this.walkers = [];
    this.roadPaths = new Map();
    this.coveredRoads = new Set();
    this.nextV = 0;
    this.nextW = 0;
    this.generation = -1;
    this.resetCount = 0;
    this.time = 0;
  }

  /**
   * Spawn vehicles + walkers for one road. Called by reset/sync.
   */
  spawnForRoad(road) {
    if (!road || road.waypoints.length < 2) return;
    const path = pathOf(road.waypoints);
    const roadLen = path.total;
    if (roadLen < 0.5) return;
    this.roadPaths.set(road.id, path);

    if (road.type !== 'dirt') {
      // Vehicles: denser on longer roads, at least 1 per road.
      const count = Math.max(1, Math.min(3, Math.floor(roadLen / 5) + (Math.random() < 0.6 ? 1 : 0)));
      for (let i = 0; i < count && this.vehicles.length < VEHICLE_MAX; i++) {
        const type = vehicleType();
        const sp = SPEEDS[type];
        this.vehicles.push({
          id: `veh_${this.nextV++}`,
          type,
          roadId: road.id,
          path,
          s: Math.random() * roadLen,
          dir: Math.random() < 0.5 ? 1 : -1,
          speed: rand(sp[0], sp[1]),
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    // Walkers on the road edge (shoulder), never on the road surface.
    const wc = road.type === 'main' ? randInt(2, 3) : road.type === 'branch' ? (Math.random() < 0.7 ? 1 : 0) : 0;
    for (let i = 0; i < wc && this.walkers.length < WALKER_MAX; i++) {
      this.walkers.push({
        id: `wlk_${this.nextW++}`,
        kind: 'road',
        roadId: road.id,
        path,
        offset: road.width / 2 + 0.09,
        side: Math.random() < 0.5 ? -1 : 1,
        s: Math.random() * roadLen,
        dir: Math.random() < 0.5 ? 1 : -1,
        speed: rand(0.09, 0.16),
        pause: rand(1, 4),
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * Full rebuild of the actor pools. Called after terrain (re)generation.
   */
  reset(roadManager) {
    this.vehicles = [];
    this.walkers = [];
    this.roadPaths = new Map();
    this.coveredRoads = new Set();
    this.nextV = 0;
    this.nextW = 0;
    this.resetCount++;
    if (!roadManager?.ready) return;

    for (const road of roadManager.getRoads()) {
      this.coveredRoads.add(road.id);
      this.spawnForRoad(road);
    }
    this.time = 0;
  }

  /**
   * Incremental update after user road add/remove: spawn actors for new
   * roads, drop actors of removed roads. Existing actors keep their state.
   */
  sync(roadManager) {
    const roads = roadManager?.getRoads() || [];
    const current = new Set(roads.map((r) => r.id));

    this.vehicles = this.vehicles.filter((v) => current.has(v.roadId));
    this.walkers = this.walkers.filter((w) => current.has(w.roadId));

    for (const road of roads) {
      const oldPath = this.roadPaths.get(road.id);
      const newPath = pathOf(road.waypoints);
      const pathChanged = !oldPath ||
        Math.abs(oldPath.total - newPath.total) > 0.01 ||
        oldPath.pts.length !== newPath.pts.length;
      if (this.coveredRoads.has(road.id) && !pathChanged) continue;
      if (pathChanged && oldPath) {
        this.vehicles = this.vehicles.filter((v) => v.roadId !== road.id);
        this.walkers = this.walkers.filter((w) => w.roadId !== road.id);
        this.roadPaths.delete(road.id);
      }
      this.spawnForRoad(road);
    }
    this.coveredRoads = current;
    for (const id of this.roadPaths.keys()) {
      if (!current.has(id)) this.roadPaths.delete(id);
    }
    this.resetCount++;
  }

  /**
   * Core update — call once per frame with simulation delta + camera pos.
   * `crossingManager` (optional) makes vehicles stop before active crossings.
   */
  update(dt, cameraPosition, crossingManager) {
    this.time += dt;

    // Active crossings: vehicles hold before the barriers/gates.
    const stops = new Map(); // roadId -> [sCross, ...]
    if (crossingManager) {
      for (const c of crossingManager.getCrossings()) {
        if (c.state !== 'warning' && c.state !== 'closing' && c.state !== 'closed') continue;
        const path = this.roadPaths.get(c.roadId);
        if (!path) continue;
        if (!stops.has(c.roadId)) stops.set(c.roadId, []);
        stops.get(c.roadId).push(projectOnPath(path, c.position));
      }
    }

    for (const v of this.vehicles) {
      if (cameraPosition) {
        const pos = atDistance(v.path, v.s);
        if ((pos.x - cameraPosition.x) ** 2 + (pos.z - cameraPosition.z) ** 2 > FAR * FAR) {
          v.frozen = true;
          continue;
        }
        v.frozen = false;
      }
      // Hold at a closed crossing, but only when moving toward it.
      const roadStops = stops.get(v.roadId);
      if (roadStops) {
        let hold = false;
        for (const sCross of roadStops) {
          const d = v.s - sCross;
          if (Math.abs(d) < 0.9 && ((d < 0 && v.dir > 0) || (d > 0 && v.dir < 0))) {
            hold = true;
            break;
          }
        }
        if (hold) continue;
      }
      let next = v.s + v.speed * dt * v.dir;
      if (next <= 0 || next >= v.path.total) {
        // Reached the end — despawn, spawn a DIFFERENT vehicle from either end.
        v.s = Math.random() < 0.5 ? 0 : v.path.total;
        v.dir = v.s === 0 ? 1 : -1;
        v.type = vehicleType();
        const sp = SPEEDS[v.type];
        v.speed = rand(sp[0], sp[1]);
        continue;
      }
      v.s = next;
    }

    for (const w of this.walkers) {
      if (cameraPosition) {
        const pos = atDistance(w.path, w.s);
        if ((pos.x - cameraPosition.x) ** 2 + (pos.z - cameraPosition.z) ** 2 > FAR * FAR) {
          w.frozen = true;
          continue;
        }
        w.frozen = false;
      }
      if (w.pause > 0) {
        w.pause -= dt;
        continue;
      }
      // Hold at a closed crossing, just like vehicles.
      const wStops = stops.get(w.roadId);
      if (wStops) {
        let hold = false;
        for (const sCross of wStops) {
          const d = w.s - sCross;
          if (Math.abs(d) < 0.9 && ((d < 0 && w.dir > 0) || (d > 0 && w.dir < 0))) {
            hold = true;
            break;
          }
        }
        if (hold) continue;
      }
      let next = w.s + w.speed * dt * w.dir;
      if (next <= 0 || next >= w.path.total) {
        // Reached the end — despawn, spawn fresh from either end.
        w.s = Math.random() < 0.5 ? 0 : w.path.total;
        w.dir = w.s === 0 ? 1 : -1;
        w.side = Math.random() < 0.5 ? -1 : 1;
        w.speed = rand(0.09, 0.16);
        continue;
      }
      w.s = next;
    }
  }

  getVehicles() {
    return this.vehicles;
  }

  getWalkers() {
    return this.walkers;
  }
}
