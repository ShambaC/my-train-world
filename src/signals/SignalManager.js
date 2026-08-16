/**
 * Signal Manager — user-placed and auto-scattered lineside signals.
 *
 * Signals are visual storytelling only: states derive from nearby train
 * occupancy and NEVER stop or restrict a train. State set:
 *   clear      — open track
 *   approaching — train moving nearby (along the track)
 *   occupied   — train on/near the signal
 *   departing  — train just left the approach zone
 */
import { pointOnTrack, tangentOnTrack } from '../tracks/trackGeometry.js';
import { distanceAlongTrack, trackPointWorld } from '../tracks/pathDistance.js';
import { mulberry32 } from '../terrain.js';

const SIDE_OFFSET = 0.42;
const APPROACH_R = 7;
const OCCUPY_R = 1.3;
const DEPART_TIME = 3;

const rotLocalToWorld = (local, rotationY) => {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return {
    x: local.x * cos + local.z * sin,
    z: -local.x * sin + local.z * cos,
  };
};

export class SignalManager {
  constructor(trackManager = null) {
    this.trackManager = trackManager;
    this.signals = new Map();
    this.nextId = 0;
  }

  /**
   * Create a signal record beside a track (used by the auto-scatter).
   */
  _create(trackId, progress, side, type, auto) {
    const track = this.trackManager.tracks.get(trackId);
    if (!track) return null;
    const pos = trackPointWorld(this.trackManager, trackId, progress);
    const tan = rotLocalToWorld(tangentOnTrack(track.type, progress), track.rotation);
    const perp = { x: -tan.z, z: tan.x };
    const signal = {
      id: auto ? `sig_auto_${this.nextId++}` : `sig_${this.nextId++}`,
      auto,
      trackId,
      progress,
      side,
      type,
      position: {
        x: pos.x + perp.x * side * SIDE_OFFSET,
        y: pos.y,
        z: pos.z + perp.z * side * SIDE_OFFSET,
      },
      rotation: Math.atan2(tan.x, tan.z),
      state: 'clear',
      litLamp: 'green',
      departTimer: 0,
    };
    this.signals.set(signal.id, signal);
    return signal;
  }

  removeSignal(id) {
    return this.signals.delete(id);
  }

  /** Remove every signal sitting on a deleted track (user + auto). */
  removeForTrack(trackId) {
    for (const [id, s] of this.signals) {
      if (s.trackId === trackId) this.signals.delete(id);
    }
  }

  /**
   * Deterministic auto-scatter beside long track runs. Recomputes ALL auto
   * signals from the current layout — user signals are never touched.
   * Seed-based, so the same track layout + world seed = same signals.
   */
  rebuildAuto(trackManager, seed) {
    this.trackManager = trackManager;
    for (const [id, s] of this.signals) {
      if (s.auto) this.signals.delete(id);
    }
    const tracks = trackManager.getAllTracks();
    if (tracks.length < 4) return;

    // Connected components of the undirected track graph.
    const seen = new Set();
    const components = [];
    for (const t of tracks) {
      if (seen.has(t.id)) continue;
      const comp = [];
      const stack = [t.id];
      seen.add(t.id);
      while (stack.length) {
        const id = stack.pop();
        comp.push(id);
        const tr = trackManager.tracks.get(id);
        for (const conn of [tr.connections.front, tr.connections.back]) {
          if (conn && !seen.has(conn)) {
            seen.add(conn);
            stack.push(conn);
          }
        }
      }
      components.push(comp);
    }

    components.forEach((comp, ci) => {
      if (comp.length < 5) return;
      const rng = mulberry32((((seed * 2654435761) >>> 0) ^ (ci * 1013)) >>> 0);

      // DFS order through the component for evenly spaced signals.
      const order = [];
      const visited = new Set();
      const stack = [comp[0]];
      while (stack.length) {
        const id = stack.pop();
        if (visited.has(id)) continue;
        visited.add(id);
        order.push(id);
        const tr = trackManager.tracks.get(id);
        for (const conn of [tr.connections.front, tr.connections.back]) {
          if (conn && comp.includes(conn) && !visited.has(conn)) stack.push(conn);
        }
      }

      const placed = [];
      const clearOf = (x, z) => {
        for (const p of placed) {
          if ((p.x - x) ** 2 + (p.z - z) ** 2 < 1.4) return false;
        }
        for (const s of this.signals.values()) {
          if ((s.position.x - x) ** 2 + (s.position.z - z) ** 2 < 1.4) return false;
        }
        return true;
      };

      // Signals every 15th track along the run (keeps lineside clutter low
      // next to the electrification gantries, which sit every 5 tracks).
      for (let i = 5; i < order.length; i += 15) {
        const trackId = order[i];
        const tr = trackManager.tracks.get(trackId);
        const passThrough = tr.connections.front && tr.connections.back;
        const type = passThrough
          ? (rng() < 0.35 ? 'junction' : 'two')
          : rng() < 0.4 ? 'three' : 'two';
        const side = rng() < 0.5 ? -1 : 1;
        const pos = trackPointWorld(trackManager, trackId, 0.5);
        if (!clearOf(pos.x, pos.z)) continue;
        const sig = this._create(trackId, 0.5, side, type, true);
        if (sig) placed.push({ x: sig.position.x, z: sig.position.z });
      }

      // Signals at dead ends of the run (facing along the line).
      for (const trackId of comp) {
        const tr = trackManager.tracks.get(trackId);
        for (const end of ['front', 'back']) {
          if (tr.connections[end]) continue;
          const progress = end === 'front' ? 0.92 : 0.08;
          const pos = trackPointWorld(trackManager, trackId, progress);
          if (!clearOf(pos.x, pos.z)) continue;
          const sig = this._create(trackId, progress, rng() < 0.5 ? -1 : 1, 'two', true);
          if (sig) placed.push({ x: sig.position.x, z: sig.position.z });
        }
      }
    });
  }

  setTrackManager(trackManager) {
    this.trackManager = trackManager;
  }

  /** Per-frame state update from train proximity (visual only). */
  update(trainManager, dt) {
    const trains = trainManager.getAllTrains();
    for (const signal of this.signals.values()) {
      let best = Infinity;
      let occupied = false;

      for (const train of trains) {
        // Occupancy: any part of the consist near the signal.
        const parts = [train, ...(train.coaches || [])];
        for (const part of parts) {
          if (!part.position) continue;
          const dx = part.position.x - signal.position.x;
          const dz = part.position.z - signal.position.z;
          if (dx * dx + dz * dz < OCCUPY_R * OCCUPY_R) {
            occupied = true;
            break;
          }
        }
        if (occupied) break;

        const d = distanceAlongTrack(
          this.trackManager,
          signal.trackId,
          signal.progress,
          train.currentTrackId,
          train.progress,
          APPROACH_R + 4
        );
        if (d < best) best = d;
      }

      let state;
      if (occupied) {
        state = 'occupied';
      } else if (best <= APPROACH_R) {
        state = 'approaching';
        signal.departTimer = DEPART_TIME;
      } else if (signal.departTimer > 0) {
        signal.departTimer -= dt;
        state = signal.departTimer > 0 ? 'departing' : 'clear';
      } else {
        state = 'clear';
      }
      signal.state = state;

      // Aspect mapping (visual only, never enforces anything).
      if (signal.type === 'junction') {
        signal.litLamp = occupied ? 'red' : 'yellow';
      } else if (signal.type === 'three') {
        signal.litLamp = state === 'occupied' ? 'red' : state === 'approaching' ? 'yellow' : 'green';
      } else {
        // two-aspect / platform: green = clear/departing, red = occupied/approaching
        signal.litLamp = state === 'occupied' || state === 'approaching' ? 'red' : 'green';
      }
    }
  }

  getSignals() {
    return Array.from(this.signals.values());
  }

  /** Nearest signal within `tol` world units of a position (delete tool). */
  findAtPosition(pos, tol = 0.5) {
    let best = null;
    let bestD = tol * tol;
    for (const s of this.signals.values()) {
      const dx = s.position.x - pos.x;
      const dz = s.position.z - pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  clear() {
    this.signals.clear();
    this.nextId = 0;
  }
}
