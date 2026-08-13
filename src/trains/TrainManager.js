/**
 * Train Manager — heading-based movement on undirected tracks.
 * Tracks have endpoints but no inherent travel direction; the engine
 * owns a heading (unit XZ vector) and facing always equals motion.
 * Coaches trail the engine along the track graph (walkBack each frame).
 */
import { pointOnTrack, tangentOnTrack } from '../tracks/trackGeometry.js';
import { COACH_LENGTH } from './coachTypes.js';

const rotLocalToWorld = (local, rotationY) => {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return {
    x: local.x * cos + local.z * sin,
    z: -local.x * sin + local.z * cos,
  };
};

export class TrainManager {
  constructor(trackManager, stationManager = null) {
    this.trackManager = trackManager;
    this.stationManager = stationManager;
    this.trains = new Map();
    this.nextId = 0;
    this.time = 0;
    this.STOP_DURATION = 5; // seconds trains dwell at stations
    this.STOP_COOLDOWN = 8; // seconds after departing before a re-stop is allowed
  }

  setStationManager(stationManager) {
    this.stationManager = stationManager;
  }

  /**
   * Add a train. direction: 1 = along track tangent, -1 = against it.
   */
  addTrain(startTrackId, direction = 1) {
    const startTrack = this.trackManager.tracks.get(startTrackId);
    if (!startTrack) {
      console.error('Start track not found:', startTrackId);
      return null;
    }

    const t = 0.5;
    const tangent = rotLocalToWorld(tangentOnTrack(startTrack.type, t), startTrack.rotation);
    const heading = {
      x: tangent.x * direction,
      z: tangent.z * direction,
    };

    const id = `train_${this.nextId++}`;
    const train = {
      id,
      currentTrackId: startTrackId,
      progress: t,
      speed: 0.5,
      heading,
      position: { ...startTrack.position },
      rotation: Math.atan2(heading.x, heading.z),
      active: false,
      dwell: null,      // { stationId, until } while stopped at a station
      cooldowns: new Map(), // stationId -> departure time (prevents re-stop)
      coaches: [],      // { id, type, spacing, position, rotation, dir }
    };

    this.trains.set(id, train);
    this.updateTrainPosition(train, startTrack);
    return train;
  }

  removeTrain(id) {
    this.trains.delete(id);
  }

  update(deltaTime) {
    this.time += deltaTime;

    for (const train of this.trains.values()) {
      const currentTrack = this.trackManager.tracks.get(train.currentTrackId);
      if (!currentTrack) {
        if (train.active) {
          console.warn('Train on invalid track:', train.currentTrackId);
          train.active = false;
        }
        continue;
      }

      // Coaches trail even while the engine is parked (active = false)
      if (!train.active) {
        this.updateCoaches(train);
        continue;
      }

      // Station dwell: hold position until the stop time is over
      if (train.dwell) {
        if (this.time < train.dwell.until) continue;
        train.cooldowns.set(train.dwell.stationId, this.time);
        train.dwell = null;
      }

      // Movement sign from heading vs track tangent
      const tangent = rotLocalToWorld(
        tangentOnTrack(currentTrack.type, train.progress),
        currentTrack.rotation
      );
      const sign = (tangent.x * train.heading.x + tangent.z * train.heading.z) >= 0 ? 1 : -1;

      train.progress += train.speed * deltaTime * sign;

      if (sign > 0 && train.progress >= 1.0) {
        this.transition(train, currentTrack, 'front');
      } else if (sign < 0 && train.progress <= 0.0) {
        this.transition(train, currentTrack, 'back');
      }

      // NO clamp here — it resets accumulation before the boundary is crossed.

      // Follow tangent so facing = motion, smooth through curves
      const newTangent = rotLocalToWorld(
        tangentOnTrack(currentTrack.type, train.progress),
        currentTrack.rotation
      );
      const newSign = (newTangent.x * train.heading.x + newTangent.z * train.heading.z) >= 0 ? 1 : -1;
      train.heading = { x: newTangent.x * newSign, z: newTangent.z * newSign };

      this.updateTrainPosition(train, currentTrack);

      // Coaches trail the engine along the track path — ALWAYS, independent
      // of station detection (which would otherwise freeze them once the
      // engine leaves the station-bound tracks).
      this.updateCoaches(train);

      // Station stop detection: only on tracks bound to a station. The train
      // stops at the FAR end of the platform — the end opposite the one it
      // enters from — never at the building/center.
      const station = this.stationManager?.getStationForTrack(currentTrack.id);
      if (!station) continue;

      const r = station.worldRect;
      const inside =
        train.position.x >= r.minX && train.position.x <= r.maxX &&
        train.position.z >= r.minZ && train.position.z <= r.maxZ &&
        Math.abs(train.position.y - station.groundY) <= 0.5;

      if (inside) {
        // Re-stop only once the departure cooldown has expired — a dead-end
        // reversal or short loop right after the station must not trigger a
        // second 5s stop.
        const lastDepart = train.cooldowns.get(station.id);
        const ready = lastDepart === undefined || (this.time - lastDepart) > this.STOP_COOLDOWN;
        if (ready) {
          const axial =
            (train.position.x - station.startWorld.x) * station.dir.x +
            (train.position.z - station.startWorld.z) * station.dir.z;
          const platformLen = station.lengthCells * 0.5;
          const towardEnd = train.heading.x * station.dir.x + train.heading.z * station.dir.z;
          const atFarEnd = towardEnd > 0 ? axial >= platformLen - 0.4 : axial <= 0.4;
          if (atFarEnd) {
            train.dwell = { stationId: station.id, until: this.time + this.STOP_DURATION };
          }
        }
      } else if (train.cooldowns.has(station.id)) {
        // Forget the cooldown only after it has expired, so a train that
        // quickly returns (dead-end just outside) cannot re-stop.
        const lastDepart = train.cooldowns.get(station.id);
        if (this.time - lastDepart > this.STOP_COOLDOWN) {
          train.cooldowns.delete(station.id);
        }
      }
    }
  }

  // ── Coaches ────────────────────────────────────────────────────────────

  /**
   * Attach a coach behind the engine. One train = one engine; a coach
   * belongs to exactly one train. Spacing is per-pair: half of the car
   * ahead + half of the new coach + gap, so coaches never overlap.
   */
  addCoach(trainId, coachType) {
    const train = this.trains.get(trainId);
    if (!train) return null;
    const prev = train.coaches[train.coaches.length - 1];
    const newHalf = (COACH_LENGTH[coachType] ?? 1.0) / 2;
    const aheadHalf = prev ? (COACH_LENGTH[prev.type] ?? 1.0) / 2 : 0.5; // engine half
    const spacing = aheadHalf + newHalf + 0.15;
    const coach = {
      id: `${train.id}_coach_${train.coaches.length}`,
      type: coachType,
      spacing,
      position: null,
      rotation: 0,
    };
    train.coaches.push(coach);
    this.updateCoaches(train);
    return coach;
  }

  trackLength(track) {
    return track.type === 'curved' ? (Math.PI / 2) * 0.25 : 0.5;
  }

  /**
   * Position every coach by walking backward from the engine along the
   * track graph by its spacing distance. Exact trailing, no drift.
   */
  updateCoaches(train) {
    let behind = 0;
    for (const coach of train.coaches) {
      behind += coach.spacing;
      const pos = this.walkBack(train, behind);
      if (!pos) {
        coach.position = null;
        continue;
      }
      const track = this.trackManager.tracks.get(pos.trackId);
      const local = pointOnTrack(track.type, pos.progress);
      const cos = Math.cos(track.rotation);
      const sin = Math.sin(track.rotation);
      coach.position = {
        x: track.position.x + local.x * cos + local.z * sin,
        y: track.position.y,
        z: track.position.z + -local.x * sin + local.z * cos,
      };
      const tangent = rotLocalToWorld(tangentOnTrack(track.type, pos.progress), track.rotation);
      coach.rotation = Math.atan2(tangent.x * pos.travelDir, tangent.z * pos.travelDir);
    }
  }

  /**
   * Walk `distance` world units backward from the engine along the path
   * (opposite its heading). Returns { trackId, progress, travelDir } where
   * travelDir is the travel (+1 = toward front) direction on the final track.
   */
  walkBack(train, distance) {
    let trackId = train.currentTrackId;
    let progress = train.progress;
    let remaining = distance;
    let guard = 0;

    let track = this.trackManager.tracks.get(trackId);
    if (!track) return null;
    const tangent = rotLocalToWorld(tangentOnTrack(track.type, train.progress), track.rotation);
    const sign = (tangent.x * train.heading.x + tangent.z * train.heading.z) >= 0 ? 1 : -1;
    let walkDir = -sign; // walk opposite the travel direction

    while (remaining > 0 && guard++ < 200) {
      track = this.trackManager.tracks.get(trackId);
      if (!track) return null;
      const len = this.trackLength(track);
      // Distance to the end in the walk direction
      const distToEnd = walkDir > 0 ? (1 - progress) * len : progress * len;

      if (remaining <= distToEnd) {
        progress += walkDir > 0 ? remaining / len : -remaining / len;
        return { trackId, progress, travelDir: -walkDir };
      }

      remaining -= distToEnd;
      const exitEnd = walkDir > 0 ? 'front' : 'back';
      const nextId = track.connections[exitEnd];
      if (!nextId) {
        // Dead end — the coach bunches up at the end
        return { trackId, progress: exitEnd === 'front' ? 1 : 0, travelDir: -walkDir };
      }

      const nextTrack = this.trackManager.tracks.get(nextId);
      if (!nextTrack) return null;
      if (nextTrack.connections.front === trackId) {
        // Entered at the next track's front — walk toward its back
        trackId = nextId;
        progress = 1;
        walkDir = -1;
      } else if (nextTrack.connections.back === trackId) {
        // Entered at the next track's back — walk toward its front
        trackId = nextId;
        progress = 0;
        walkDir = 1;
      } else {
        return null;
      }
    }
    return null;
  }

  /**
   * Move to connected track at exitEnd. At a dead end, solo engines reverse;
   * a train with coaches stays parked at the end so the train never splits
   * (the coaches trail behind and would be left at the dead end).
   */
  transition(train, currentTrack, exitEnd) {
    const nextId = currentTrack.connections[exitEnd];

    const parkAtEnd = () => {
      train.progress = exitEnd === 'front' ? 0.99 : 0.01;
    };

    const reverse = () => {
      train.heading = { x: -train.heading.x, z: -train.heading.z };
      parkAtEnd();
    };

    if (train.coaches.length > 0) {
      // Trains with coaches never reverse at a dead end
      if (!nextId) {
        parkAtEnd();
        return;
      }
    }

    if (!nextId) {
      reverse();
      return;
    }

    const nextTrack = this.trackManager.tracks.get(nextId);
    if (!nextTrack) {
      if (train.coaches.length > 0) {
        parkAtEnd();
        return;
      }
      reverse();
      return;
    }

    // Entry end of next track
    let entryEnd = null;
    if (nextTrack.connections.back === currentTrack.id) entryEnd = 'back';
    else if (nextTrack.connections.front === currentTrack.id) entryEnd = 'front';

    if (!entryEnd) {
      if (train.coaches.length > 0) {
        parkAtEnd();
        return;
      }
      reverse();
      return;
    }

    train.currentTrackId = nextId;
    train.progress = entryEnd === 'back' ? 0.01 : 0.99;
  }

  /**
   * Position + yaw from track geometry.
   */
  updateTrainPosition(train, track) {
    const local = pointOnTrack(track.type, train.progress);
    const cos = Math.cos(track.rotation);
    const sin = Math.sin(track.rotation);

    train.position.x = track.position.x + local.x * cos + local.z * sin;
    train.position.y = track.position.y;
    train.position.z = track.position.z + -local.x * sin + local.z * cos;

    train.rotation = Math.atan2(train.heading.x, train.heading.z);
  }

  getAllTrains() {
    return Array.from(this.trains.values());
  }

  getTrain(id) {
    return this.trains.get(id) || null;
  }

  toggleTrain(id) {
    const train = this.trains.get(id);
    if (train) {
      train.active = !train.active;
      return train.active;
    }
    return false;
  }

  setTrainActive(id, active) {
    const train = this.trains.get(id);
    if (train) train.active = active;
  }

  clear() {
    this.trains.clear();
    this.nextId = 0;
  }
}
