/**
 * Train Manager — heading-based movement on undirected tracks.
 * Tracks have endpoints but no inherent travel direction; the engine
 * owns a heading (unit XZ vector) and facing always equals motion.
 * Coaches trail the engine along the track graph (walkBack each frame).
 */
import { pointOnTrack, tangentOnTrack } from '../tracks/trackGeometry.js';
import { DEFAULT_ENGINE } from './engineTypes.js';
import { COACH_LENGTH } from './coachTypes.js';
import { MAX_STATION_LATERAL } from '../stations/StationManager.js';

export const DEFAULT_TRAIN_SPEED = 0.5;
export const MIN_TRAIN_SPEED = 0.1;
export const MAX_TRAIN_SPEED = 1.5;
export const TRAIN_SPEED_STEP = 0.05;

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

  setTrainSpeed(trainId, value) {
    const train = this.trains.get(trainId);
    if (!train) return false;
    const speed = Number(value);
    if (!Number.isFinite(speed)) return false;
    train.speedMax = Math.min(MAX_TRAIN_SPEED, Math.max(MIN_TRAIN_SPEED, speed));
    return true;
  }

  setStationManager(stationManager) {
    this.stationManager = stationManager;
  }

  /**
   * Add a train. direction: 1 = along track tangent, -1 = against it.
   */
  addTrain(startTrackId, direction = 1, engineType = DEFAULT_ENGINE) {
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
      engineType: engineType || DEFAULT_ENGINE,
      currentTrackId: startTrackId,
      progress: t,
      speed: 0,          // eased toward speedMax each frame (smooth motion)
      speedMax: DEFAULT_TRAIN_SPEED,
      heading,
      position: { ...startTrack.position },
      rotation: Math.atan2(heading.x, heading.z),
      bank: 0,           // curve roll, eased by the renderer-facing update
      active: false,
      dwell: null,      // { stationId, until } while stopped at a station
      cooldowns: new Map(), // stationId -> departure time (prevents re-stop)
      coaches: [],      // { id, type, spacing, position, rotation, dir }
    };

    this.trains.set(id, train);
    this.updateTrainPosition(train, startTrack);
    return train;
  }

  setEngineType(trainId, engineType) {
    const train = this.trains.get(trainId);
    if (!train) return false;
    train.engineType = engineType;
    return true;
  }

  removeTrain(id) {
    this.trains.delete(id);
  }

  /**
   * Re-insert a train with its original id (undo/redo, save/load).
   * Data is plain JSON-safe; cooldowns may arrive as {} (times are
   * meaningless across reloads and are dropped on restore).
   */
  restoreTrain(data) {
    const train = {
      ...data,
      engineType: data.engineType || DEFAULT_ENGINE,
      speedMax: Number.isFinite(Number(data.speedMax))
        ? Math.min(MAX_TRAIN_SPEED, Math.max(MIN_TRAIN_SPEED, Number(data.speedMax)))
        : DEFAULT_TRAIN_SPEED,
      heading: { ...data.heading },
      position: { ...data.position },
      cooldowns: data.cooldowns instanceof Map ? data.cooldowns : new Map(Object.entries(data.cooldowns || {})),
      coaches: (data.coaches || []).map((c) => ({ ...c })),
    };
    this.trains.set(train.id, train);
    const num = parseInt(train.id.split('_')[1], 10);
    if (!Number.isNaN(num) && num >= this.nextId) this.nextId = num + 1;
    this.updateTrainPosition(train, this.trackManager.tracks.get(train.currentTrackId));
    this.updateCoaches(train);
    return train;
  }

  /**
   * Flip the train's heading (reverse). Always allowed — no route rules.
   */
  reverseTrain(id) {
    const train = this.trains.get(id);
    if (!train) return false;
    train.heading = { x: -train.heading.x, z: -train.heading.z };
    return true;
  }

  /**
   * Remove one coach (keeps the rest of the consist untouched).
   */
  removeCoach(trainId, coachId) {
    const train = this.trains.get(trainId);
    if (!train) return false;
    const idx = train.coaches.findIndex((c) => c.id === coachId);
    if (idx < 0) return false;
    train.coaches.splice(idx, 1);
    this.updateCoaches(train);
    return true;
  }

  /**
   * Re-insert a coach at its original index (undo of removeCoach).
   */
  restoreCoach(trainId, coach, index) {
    const train = this.trains.get(trainId);
    if (!train) return false;
    train.coaches.splice(Math.min(index, train.coaches.length), 0, { ...coach });
    this.updateCoaches(train);
    return true;
  }

  update(deltaTime) {
    this.time += deltaTime;

    for (const train of this.trains.values()) {
      let currentTrack = this.trackManager.tracks.get(train.currentTrackId);
      if (!currentTrack) {
        if (train.active) {
          console.warn('Train on invalid track:', train.currentTrackId);
          train.active = false;
        }
        continue;
      }

      // Update cooldown exit state across all stations for this train
      for (const [sId, record] of Array.from(train.cooldowns.entries())) {
        const s = this.stationManager?.getStation(sId);
        const departTime = typeof record === 'number' ? record : record?.departTime;
        if (!s) {
          train.cooldowns.delete(sId);
          continue;
        }
        const platformLen = s.lengthCells * 0.5;
        const dx = train.position.x - s.startWorld.x;
        const dz = train.position.z - s.startWorld.z;
        const a = dx * s.dir.x + dz * s.dir.z;
        const lat = Math.abs(dx * s.dir.z - dz * s.dir.x);
        const dy = Math.abs(train.position.y - s.groundY);
        const inZone = a >= -1.0 && a <= platformLen + 1.0 && lat <= MAX_STATION_LATERAL && dy <= 0.8;
        if (!inZone) {
          if (typeof record === 'object' && record) record.hasExited = true;
          if (departTime === undefined || this.time - departTime > 2.0) {
            train.cooldowns.delete(sId);
          }
        }
      }

      // Station dwell check: hold position and 0 speed until dwell duration completes
      if (train.dwell) {
        if (this.time < train.dwell.until) {
          train.speed = 0;
          this.updateCoaches(train);
          const dwellStation = this.stationManager?.getStation(train.dwell.stationId);
          let dwellAxial = 0, dwellLateral = 0, dwellDy = 0;
          if (dwellStation) {
            const dx = train.position.x - dwellStation.startWorld.x;
            const dz = train.position.z - dwellStation.startWorld.z;
            dwellAxial = dx * dwellStation.dir.x + dz * dwellStation.dir.z;
            dwellLateral = Math.abs(dx * dwellStation.dir.z - dz * dwellStation.dir.x);
            dwellDy = Math.abs(train.position.y - dwellStation.groundY);
          }
          train.debug = {
            currentTrackId: train.currentTrackId,
            stationBound: this.stationManager?.getStationForTrack(currentTrack.id)?.id || null,
            stationNear: this.stationManager?.getStationNearPosition(train.position, MAX_STATION_LATERAL)?.id || null,
            activeStationId: train.dwell.stationId,
            axial: Number(dwellAxial.toFixed(2)),
            lateral: Number(dwellLateral.toFixed(2)),
            dy: Number(dwellDy.toFixed(2)),
            insideStationZone: true,
            cooldownRemaining: 0,
            dwellState: {
              stationId: train.dwell.stationId,
              remaining: Number(Math.max(0, train.dwell.until - this.time).toFixed(1)),
            },
            speed: 0,
            speedTarget: 0,
          };
          continue;
        }
        train.cooldowns.set(train.dwell.stationId, { departTime: this.time, hasExited: false });
        train.dwell = null;
      }

      // Station lookup (bound track or proximity)
      const stationBound = this.stationManager?.getStationForTrack(currentTrack.id);
      const stationNear = this.stationManager?.getStationNearPosition(train.position, MAX_STATION_LATERAL);
      let station = stationBound || stationNear;

      let axial = 0;
      let lateral = 0;
      let dy = 0;
      let inside = false;
      let ready = false;
      let towardEnd = 1;
      let stopAxial = 0;

      if (station) {
        const platformLen = station.lengthCells * 0.5;
        const dx = train.position.x - station.startWorld.x;
        const dz = train.position.z - station.startWorld.z;
        axial = dx * station.dir.x + dz * station.dir.z;
        lateral = Math.abs(dx * station.dir.z - dz * station.dir.x);
        dy = Math.abs(train.position.y - station.groundY);
        inside =
          axial >= -1.0 &&
          axial <= platformLen + 1.0 &&
          lateral <= MAX_STATION_LATERAL &&
          dy <= 0.8;

        if (inside) {
          const cd = train.cooldowns.get(station.id);
          const departTime = typeof cd === 'number' ? cd : cd?.departTime;
          const hasExited = typeof cd === 'object' ? cd?.hasExited : (departTime ? (this.time - departTime) > this.STOP_COOLDOWN : true);
          ready = departTime === undefined || (hasExited && (this.time - departTime) > 2.0);

          towardEnd = train.heading.x * station.dir.x + train.heading.z * station.dir.z;
          stopAxial = towardEnd >= 0 ? platformLen - 0.75 : 0.75;
        }
      }

      // If parked / inactive, populate telemetry and skip movement
      if (!train.active) {
        this.updateCoaches(train);
        const currentCd = station ? train.cooldowns.get(station.id) : null;
        const cdTime = typeof currentCd === 'number' ? currentCd : currentCd?.departTime;
        const cooldownRemaining = cdTime ? Math.max(0, (cdTime + this.STOP_COOLDOWN) - this.time) : 0;
        train.debug = {
          currentTrackId: train.currentTrackId,
          stationBound: stationBound?.id || null,
          stationNear: stationNear?.id || null,
          activeStationId: station?.id || null,
          axial: Number(axial.toFixed(2)),
          lateral: Number(lateral.toFixed(2)),
          dy: Number(dy.toFixed(2)),
          insideStationZone: inside,
          cooldownRemaining: Number(cooldownRemaining.toFixed(1)),
          dwellState: null,
          speed: 0,
          speedTarget: 0,
        };
        continue;
      }

      // Movement sign from heading vs track tangent
      const tangent = rotLocalToWorld(
        tangentOnTrack(currentTrack.type, train.progress),
        currentTrack.rotation
      );
      const sign = (tangent.x * train.heading.x + tangent.z * train.heading.z) >= 0 ? 1 : -1;

      // Active Train Movement: Speed Target & Deceleration
      let speedTarget = train.speedMax;
      if (station && inside && ready) {
        const distToStop = towardEnd >= 0 ? stopAxial - axial : axial - stopAxial;
        if (distToStop > 0 && distToStop < 2.0) {
          speedTarget = Math.min(speedTarget, Math.max(0.04, distToStop * 0.6));
        }
      }

      const trackLen = this.trackLength(currentTrack);
      const distToBoundary = sign > 0 ? (1 - train.progress) * trackLen : train.progress * trackLen;
      // Ease down ONLY at true dead ends
      const endId = sign > 0 ? currentTrack.connections.front : currentTrack.connections.back;
      if (!endId && distToBoundary < 0.12) {
        speedTarget = Math.min(speedTarget, Math.max(0.02, distToBoundary * 1.2));
      }
      train.speed += (speedTarget - train.speed) * (1 - Math.exp(-2.5 * deltaTime));

      train.progress += train.speed * deltaTime * sign;

      if (sign > 0 && train.progress >= 1.0) {
        this.transition(train, currentTrack, 'front');
      } else if (sign < 0 && train.progress <= 0.0) {
        this.transition(train, currentTrack, 'back');
      }

      currentTrack = this.trackManager.tracks.get(train.currentTrackId) || currentTrack;
      const updatedBound = this.stationManager?.getStationForTrack(currentTrack.id);
      const updatedNear = this.stationManager?.getStationNearPosition(train.position, MAX_STATION_LATERAL);
      station = updatedBound || updatedNear;

      // Follow tangent so facing = motion, smooth through curves
      const newTangent = rotLocalToWorld(
        tangentOnTrack(currentTrack.type, train.progress),
        currentTrack.rotation
      );
      const newSign = (newTangent.x * train.heading.x + newTangent.z * train.heading.z) >= 0 ? 1 : -1;
      train.heading = { x: newTangent.x * newSign, z: newTangent.z * newSign };

      // Curve banking
      let bankTarget = 0;
      if (currentTrack.type === 'curved') {
        const tA = tangentOnTrack('curved', train.progress);
        const tB = tangentOnTrack('curved', Math.min(1, train.progress + 0.02));
        const cross = tA.x * tB.z - tA.z * tB.x;
        const speedF = Math.min(1, train.speed / Math.max(0.01, train.speedMax));
        bankTarget = -Math.sign(cross) * 0.055 * speedF;
      }
      train.bank += (bankTarget - train.bank) * (1 - Math.exp(-5 * deltaTime));

      this.updateTrainPosition(train, currentTrack);
      this.updateCoaches(train);

      // Station stop detection: triggers when train reaches or crosses stop threshold
      if (station) {
        const platformLen = station.lengthCells * 0.5;
        const dx = train.position.x - station.startWorld.x;
        const dz = train.position.z - station.startWorld.z;
        axial = dx * station.dir.x + dz * station.dir.z;
        lateral = Math.abs(dx * station.dir.z - dz * station.dir.x);
        dy = Math.abs(train.position.y - station.groundY);
        inside =
          axial >= -1.0 &&
          axial <= platformLen + 1.0 &&
          lateral <= MAX_STATION_LATERAL &&
          dy <= 0.8;

        if (inside) {
          const cd = train.cooldowns.get(station.id);
          const departTime = typeof cd === 'number' ? cd : cd?.departTime;
          const hasExited = typeof cd === 'object' ? cd?.hasExited : (departTime ? (this.time - departTime) > this.STOP_COOLDOWN : true);
          ready = departTime === undefined || (hasExited && (this.time - departTime) > 2.0);

          if (ready) {
            towardEnd = train.heading.x * station.dir.x + train.heading.z * station.dir.z;
            stopAxial = towardEnd >= 0 ? platformLen - 0.75 : 0.75;
            const atFarEnd = towardEnd >= 0 ? axial >= stopAxial : axial <= stopAxial;
            if (atFarEnd) {
              train.dwell = { stationId: station.id, until: this.time + this.STOP_DURATION };
              train.speed = 0;
              train.cooldowns.set(station.id, { departTime: this.time, hasExited: false });
            }
          }
        }
      }

      // Telemetry object for debug HUD and selection inspection
      const currentCd = station ? train.cooldowns.get(station.id) : null;
      const cdTime = typeof currentCd === 'number' ? currentCd : currentCd?.departTime;
      const cooldownRemaining = cdTime ? Math.max(0, (cdTime + this.STOP_COOLDOWN) - this.time) : 0;

      train.debug = {
        currentTrackId: train.currentTrackId,
        stationBound: updatedBound?.id || stationBound?.id || null,
        stationNear: updatedNear?.id || stationNear?.id || null,
        activeStationId: station?.id || null,
        axial: Number(axial.toFixed(2)),
        lateral: Number(lateral.toFixed(2)),
        dy: Number(dy.toFixed(2)),
        insideStationZone: inside,
        cooldownRemaining: Number(cooldownRemaining.toFixed(1)),
        dwellState: train.dwell ? {
          stationId: train.dwell.stationId,
          remaining: Number(Math.max(0, train.dwell.until - this.time).toFixed(1)),
        } : null,
        speed: Number(train.speed.toFixed(2)),
        speedTarget: Number(speedTarget.toFixed(2)),
      };
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
        y: track.position.y + (local.y || 0),
        z: track.position.z + -local.x * sin + local.z * cos,
      };
      const tangent = rotLocalToWorld(tangentOnTrack(track.type, pos.progress), track.rotation);
      coach.rotation = Math.atan2(tangent.x * pos.travelDir, tangent.z * pos.travelDir);
      const coachTangent = tangentOnTrack(track.type, pos.progress);
      coach.pitch = coachTangent.y ? -Math.atan2(coachTangent.y, coachTangent.z) * (pos.travelDir >= 0 ? 1 : -1) : 0;
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
   * Position + yaw + pitch from track geometry.
   */
  updateTrainPosition(train, track) {
    const local = pointOnTrack(track.type, train.progress);
    const cos = Math.cos(track.rotation);
    const sin = Math.sin(track.rotation);

    train.position.x = track.position.x + local.x * cos + local.z * sin;
    train.position.y = track.position.y + (local.y || 0);
    train.position.z = track.position.z + -local.x * sin + local.z * cos;

    train.rotation = Math.atan2(train.heading.x, train.heading.z);

    // Pitch from tangent y component (ramp tracks).
    // Positive pitch = nose DOWN in Three.js, so negate for uphill = nose UP.
    const tangent = tangentOnTrack(track.type, train.progress);
    if (tangent.y) {
      const sign = (train.heading.x * Math.sin(track.rotation) + train.heading.z * Math.cos(track.rotation)) >= 0 ? 1 : -1;
      train.pitch = -Math.atan2(tangent.y, tangent.z) * sign;
    } else {
      train.pitch = 0;
    }
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
