/**
 * Crossing Manager — road/rail crossing detection + gate state machine.
 *
 * Crossings are pure scenery with safety-flavored animation: gates close
 * as a train approaches and stay closed until the WHOLE consist (engine +
 * every coach) clears the crossing plus a margin. A stopped or reversed
 * train never triggers an unsafe opening. Signals never slow or stop the
 * train — the crossing only animates around it.
 *
 * States: open → warning → closing → closed → opening → open.
 */
import { pointOnTrack, tangentOnTrack } from '../tracks/trackGeometry.js';
import { distanceAlongTrack, trackPointWorld } from '../tracks/pathDistance.js';
import { trainAudio } from '../audio/trainAudio.js';

const WARN_R = 2.6;   // approach radius where warning starts (along track)
const CLOSE_R = 1.2;  // radius where gates start closing
const OCCUPY_R = 0.6; // a train part within this (XZ) counts as on the crossing
const EXIT_R = 0.85;  // clearing margin for whole-train exit
const Y_TOL = 0.6;    // height tolerance for occupancy (bridges excluded)
const CLOSE_TIME = 0.9;
const OPEN_TIME = 0.9;

const rotLocalToWorld = (local, rotationY) => {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return {
    x: local.x * cos + local.z * sin,
    z: -local.x * sin + local.z * cos,
  };
};

export class CrossingManager {
  constructor(trackManager, roadManager) {
    this.trackManager = trackManager;
    this.roadManager = roadManager;
    this.crossings = new Map();
    this.nextId = 0;
    this.time = 0;
  }

  /**
   * Recompute every crossing from the current tracks + roads.
   * Called after track placement/deletion and after road (re)generation.
   */
  rebuild() {
    this.crossings.clear();
    this.nextId = 0;
    const roads = this.roadManager?.ready ? this.roadManager.getSegments() : [];
    if (!roads.length) return;

    const tracks = this.trackManager.getAllTracks();
    const SAMPLES = 9;

    for (const track of tracks) {
      const hits = [];
      for (let i = 0; i < SAMPLES; i++) {
        const t = i / (SAMPLES - 1);
        const local = pointOnTrack(track.type, t);
        const cos = Math.cos(track.rotation);
        const sin = Math.sin(track.rotation);
        const px = track.position.x + local.x * cos + local.z * sin;
        const pz = track.position.z + -local.x * sin + local.z * cos;
        const py = track.position.y;

      for (const seg of roads) {
        // Crossing tolerance ≈ road half width + small margin. A track
        // running BESIDE a road must not create a crossing.
        const halfW = seg.type === 'main' ? 0.5 : seg.type === 'branch' ? 0.375 : 0.275;
        const tol = halfW + 0.08;
        // Distance from sample point to the road segment (XZ + height).
        const ax = seg.a.x;
        const az = seg.a.z;
        const bx = seg.b.x;
        const bz = seg.b.z;
        const abx = bx - ax;
        const abz = bz - az;
        const len2 = abx * abx + abz * abz;
        const u = len2 > 0 ? ((px - ax) * abx + (pz - az) * abz) / len2 : 0;
        const uu = Math.max(0, Math.min(1, u));
        const cx = ax + abx * uu;
        const cz = az + abz * uu;
        const dx = px - cx;
        const dz = pz - cz;
        if (dx * dx + dz * dz > tol * tol) continue;
        const roadY = seg.a.y + (seg.b.y - seg.a.y) * uu;
        if (Math.abs(py - roadY) > 0.35) continue; // bridge over road — no gate
        hits.push({ t, px, pz, py, seg, roadY });
        break;
      }
      }

      // Group consecutive hits into one crossing per road intersection.
      const groups = [];
      let current = null;
      let lastT = -Infinity;
      for (const h of hits) {
        if (current && h.t - lastT <= 0.4 && h.seg.roadId === current.seg.roadId) {
          current.hits.push(h);
          current.sum += h.t;
        } else {
          current = { hits: [h], sum: h.t, seg: h.seg };
          groups.push(current);
        }
        lastT = h.t;
      }

      for (const g of groups) {
        const progress = g.sum / g.hits.length;
        const local = pointOnTrack(track.type, progress);
        const cos = Math.cos(track.rotation);
        const sin = Math.sin(track.rotation);
        const x = track.position.x + local.x * cos + local.z * sin;
        const z = track.position.z + -local.x * sin + local.z * cos;
        const tan = rotLocalToWorld(tangentOnTrack(track.type, progress), track.rotation);
        const segDir = {
          x: (g.seg.b.x - g.seg.a.x) / Math.max(0.001, Math.hypot(g.seg.b.x - g.seg.a.x, g.seg.b.z - g.seg.a.z)),
          z: (g.seg.b.z - g.seg.a.z) / Math.max(0.001, Math.hypot(g.seg.b.x - g.seg.a.x, g.seg.b.z - g.seg.a.z)),
        };
        const id = `crossing_${this.nextId++}`;
        this.crossings.set(id, {
          id,
          trackId: track.id,
          trackRefs: [{ trackId: track.id, progress }],
          roadId: g.seg.roadId,
          progress,
          roadWidth: 0.75 + (g.seg.type === 'main' ? 0.25 : 0),
          position: { x, y: track.position.y, z },
          trackTangent: tan,
          roadTangent: segDir,
          state: 'open',
          anim: 0, // 0 = open (arms up), 1 = closed (arms down)
          clearTimer: 0,
          lastBell: 0,
          whistlePlayed: false,
        });
      }
    }

    // Merge crossings that belong to the same track LINE over the same
    // road: one continuous multi-track run over a road must yield a single
    // crossing with one gate pair, not one gate per track piece.
    this._mergeAdjacent();
  }

  /**
   * Merge crossings sharing a road when their tracks are connected
   * (end-to-end) and the intersection centers are close.
   */
  _mergeAdjacent() {
    const list = this.getCrossings();
    const merged = new Map();
    const tracksConnected = (a, b, trackManager) => {
      if (a === b) return true;
      const seen = new Set();
      const stack = [a];
      while (stack.length) {
        const id = stack.pop();
        if (seen.has(id)) continue;
        seen.add(id);
        const tr = trackManager.tracks.get(id);
        if (!tr) continue;
        for (const conn of [tr.connections.front, tr.connections.back]) {
          if (conn === b) return true;
          if (conn && !seen.has(conn)) stack.push(conn);
        }
      }
      return false;
    };

    for (const c of list) {
      let host = null;
      for (const h of merged.values()) {
        const d = Math.hypot(c.position.x - h.position.x, c.position.z - h.position.z);
        if (
          c.roadId === h.roadId &&
          d <= 1.2 &&
          tracksConnected(c.trackId, h.trackId, this.trackManager)
        ) {
          host = h;
          break;
        }
      }
      if (!host) {
        merged.set(c.id, {
          ...c,
          position: { ...c.position },
          trackRefs: [...c.trackRefs],
        });
      } else {
        // Merge: average position, keep all track refs for approach checks.
        const n = host.trackRefs.length + 1;
        host.position = {
          x: (host.position.x * (n - 1) + c.position.x) / n,
          y: (host.position.y * (n - 1) + c.position.y) / n,
          z: (host.position.z * (n - 1) + c.position.z) / n,
        };
        host.trackRefs.push(...c.trackRefs);
        // Primary ref = the one closest to the merged center.
        let best = host.trackRefs[0];
        let bestD = Infinity;
        for (const ref of host.trackRefs) {
          const p = trackPointWorld(this.trackManager, ref.trackId, ref.progress);
          if (!p) continue;
          const d = (p.x - host.position.x) ** 2 + (p.z - host.position.z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = ref;
          }
        }
        host.trackId = best.trackId;
        host.progress = best.progress;
        const tan = rotLocalToWorld(
          tangentOnTrack(this.trackManager.tracks.get(best.trackId).type, best.progress),
          this.trackManager.tracks.get(best.trackId).rotation
        );
        host.trackTangent = tan;
      }
    }

    this.crossings = new Map();
    for (const c of merged.values()) this.crossings.set(c.id, c);
  }

  /**
   * Is any part of the consist inside the crossing's occupied zone?
   */
  _occupied(train, crossing) {
    const parts = [train, ...(train.coaches || [])];
    for (const part of parts) {
      if (!part.position) continue;
      const dx = part.position.x - crossing.position.x;
      const dz = part.position.z - crossing.position.z;
      if (dx * dx + dz * dz < OCCUPY_R * OCCUPY_R && Math.abs(part.position.y - crossing.position.y) < Y_TOL) {
        return true;
      }
    }
    return false;
  }

  /**
   * Whole-train exit: no part of the consist inside the exit margin.
   */
  _allClear(train, crossing) {
    if (!train) return true;
    const parts = [train, ...(train.coaches || [])];
    for (const part of parts) {
      if (!part.position) continue;
      const dx = part.position.x - crossing.position.x;
      const dz = part.position.z - crossing.position.z;
      if (dx * dx + dz * dz < EXIT_R * EXIT_R && Math.abs(part.position.y - crossing.position.y) < Y_TOL) {
        return false;
      }
    }
    return true;
  }

  /**
   * Nearest train approach data: { d (along track), movingToward, occupied }.
   * d = min over every track ref of the merged crossing (multi-track lines).
   */
  _approach(train, crossing) {
    let d = Infinity;
    for (const ref of crossing.trackRefs) {
      const dist = distanceAlongTrack(
        this.trackManager,
        ref.trackId,
        ref.progress,
        train.currentTrackId,
        train.progress,
        WARN_R + 6
      );
      if (dist < d) d = dist;
    }
    const dx = crossing.position.x - train.position.x;
    const dz = crossing.position.z - train.position.z;
    const movingToward = (train.heading.x * dx + train.heading.z * dz) > 0;
    return { d, movingToward, occupied: this._occupied(train, crossing) };
  }

  /** Per-frame state machine for every crossing. */
  update(dt, trainManager) {
    this.time += dt;
    const trains = trainManager.getAllTrains();

    for (const crossing of this.crossings.values()) {
      let best = { d: Infinity, movingToward: false, occupied: false, train: null };
      let occupiedAny = false;
      let consistsClear = true;
      for (const train of trains) {
        const a = this._approach(train, crossing);
        occupiedAny ||= a.occupied;
        if (!this._allClear(train, crossing)) consistsClear = false;
        if (a.d < best.d) {
          best = { ...a, train };
        }
      }

      const s = crossing.state;

      if (s === 'open') {
        if (occupiedAny || (best.d <= WARN_R && best.movingToward)) {
          crossing.state = 'warning';
          crossing.whistlePlayed = false;
        }
      } else if (s === 'warning') {
        if (occupiedAny || (best.d <= CLOSE_R && best.movingToward)) {
          crossing.state = 'closing';
        } else if (!occupiedAny && best.d > WARN_R) {
          crossing.state = 'open'; // train moved away / never committed
        }
      } else if (s === 'closing') {
        crossing.anim += dt / CLOSE_TIME;
        if (crossing.anim >= 1) {
          crossing.anim = 1;
          crossing.state = 'closed';
          crossing.clearTimer = 0;
        } else if (!occupiedAny && best.d > WARN_R && !best.movingToward) {
          crossing.state = 'opening'; // abort — train gone
        }
      } else if (s === 'closed') {
        if (occupiedAny || !consistsClear) {
          crossing.clearTimer = 0;
        } else {
          crossing.clearTimer += dt;
          if (crossing.clearTimer > 0.3) {
            crossing.state = 'opening';
          }
        }
      } else if (s === 'opening') {
        crossing.anim -= dt / OPEN_TIME;
        if (crossing.anim <= 0) {
          crossing.anim = 0;
          crossing.state = 'open';
        } else if (occupiedAny || !consistsClear) {
          crossing.state = 'closed'; // re-occupied mid-open
          crossing.anim = 1;
          crossing.clearTimer = 0;
        }
      }

      // Audio: whistle once on approach, bell with state cadence, gate motor.
      if (s !== 'warning' && crossing.state === 'warning' && !crossing.whistlePlayed) {
        crossing.whistlePlayed = true;
        trainAudio.whistle();
      }
      const active = crossing.state === 'warning' || crossing.state === 'closing' || crossing.state === 'closed';
      if (active) {
        const cadence = crossing.state === 'warning' ? 0.9 : 0.5;
        if (this.time - crossing.lastBell > cadence) {
          crossing.lastBell = this.time;
          trainAudio.crossingBell();
        }
      }
      if ((s === 'open' && crossing.state === 'closing') ||
          (s === 'warning' && crossing.state === 'closing') ||
          (s === 'closed' && crossing.state === 'opening')) {
        trainAudio.gateMotor();
      }
    }
  }

  getCrossings() {
    return Array.from(this.crossings.values());
  }

  clear() {
    this.crossings.clear();
    this.nextId = 0;
  }
}
