/**
 * Train Manager — heading-based movement on undirected tracks.
 * Tracks have endpoints but no inherent travel direction; the engine
 * owns a heading (unit XZ vector) and facing always equals motion.
 */
import { pointOnTrack, tangentOnTrack } from '../tracks/trackGeometry.js';

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
      if (!train.active) continue;

      const currentTrack = this.trackManager.tracks.get(train.currentTrackId);
      if (!currentTrack) {
        console.warn('Train on invalid track:', train.currentTrackId);
        train.active = false;
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
        if (!train.cooldowns.has(station.id)) {
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
      } else {
        // Left the zone — allow a future stop again
        train.cooldowns.delete(station.id);
      }
    }
  }

  /**
   * Move to connected track at exitEnd; reverse if no connection.
   */
  transition(train, currentTrack, exitEnd) {
    const nextId = currentTrack.connections[exitEnd];
    if (!nextId) {
      train.heading = { x: -train.heading.x, z: -train.heading.z };
      train.progress = exitEnd === 'front' ? 0.99 : 0.01;
      return;
    }

    const nextTrack = this.trackManager.tracks.get(nextId);
    if (!nextTrack) {
      train.heading = { x: -train.heading.x, z: -train.heading.z };
      train.progress = exitEnd === 'front' ? 0.99 : 0.01;
      return;
    }

    // Entry end of next track
    let entryEnd = null;
    if (nextTrack.connections.back === currentTrack.id) entryEnd = 'back';
    else if (nextTrack.connections.front === currentTrack.id) entryEnd = 'front';

    if (!entryEnd) {
      train.heading = { x: -train.heading.x, z: -train.heading.z };
      train.progress = exitEnd === 'front' ? 0.99 : 0.01;
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
