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
import { tangentOnTrack } from '../tracks/trackGeometry.js';
import { classifyTrackRoadContact, CROSSING_CONTACT } from './crossingGeometry.js';
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

    for (const track of this.trackManager.getAllTracks()) {
      const result = classifyTrackRoadContact(track, roads);
      // Legacy invalid layouts remain loaded, but never receive gates.
      for (const contact of result.contacts) {
        if (contact.kind !== CROSSING_CONTACT.PERPENDICULAR) continue;
        const progress = contact.progress;
        const x = contact.point.x;
        const z = contact.point.z;
        const tan = rotLocalToWorld(tangentOnTrack(track.type, progress), track.rotation);
        const segDir = {
          x: (contact.segment.b.x - contact.segment.a.x) /
            Math.max(0.001, Math.hypot(contact.segment.b.x - contact.segment.a.x, contact.segment.b.z - contact.segment.a.z)),
          z: (contact.segment.b.z - contact.segment.a.z) /
            Math.max(0.001, Math.hypot(contact.segment.b.x - contact.segment.a.x, contact.segment.b.z - contact.segment.a.z)),
        };
        const id = `crossing_${this.nextId++}`;
        this.crossings.set(id, {
          id,
          trackId: track.id,
          trackRefs: [{ trackId: track.id, progress }],
          roadId: contact.segment.roadId,
          progress,
          roadWidth: 0.75 + (contact.segment.type === 'main' ? 0.25 : 0),
          position: { x, y: contact.point.y, z },
          trackTangent: tan,
          roadTangent: segDir,
          state: 'open',
          anim: 0,
          clearTimer: 0,
          lastBell: 0,
          whistlePlayed: false,
        });
      }
    }

    // Merge crossings that belong to the same track LINE over the same road.
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

      // Audio: approach horn, warning bell loop, gate movement.
      if (s !== 'warning' && crossing.state === 'warning' && !crossing.whistlePlayed) {
        crossing.whistlePlayed = true;
        trainAudio.crossingWarning(crossing.position);
      }
      const active = crossing.state === 'warning' || crossing.state === 'closing' || crossing.state === 'closed';
      if (active) {
        trainAudio.startCrossing(crossing.id, crossing.position);
      } else {
        trainAudio.stopCrossing(crossing.id);
      }
      if ((s === 'open' && crossing.state === 'closing') ||
          (s === 'warning' && crossing.state === 'closing') ||
          (s === 'closed' && crossing.state === 'opening')) {
        trainAudio.gateMotor(crossing.state === 'opening' ? 'raise' : 'lower', crossing.position);
      }
      if ((s === 'closing' && crossing.state === 'closed') ||
          (s === 'opening' && crossing.state === 'open')) {
        trainAudio.gateStop(crossing.position);
      }
    }
  }

  getCrossings() {
    return Array.from(this.crossings.values());
  }

  clear() {
    for (const crossing of this.crossings.values()) trainAudio.stopCrossing(crossing.id);
    this.crossings.clear();
    this.nextId = 0;
  }
}
