/**
 * Train Manager — Handles train movement and pathfinding.
 * Uses shared track geometry from trackGeometry.js.
 */
import { pointOnTrack, tangentOnTrack, localToWorld } from '../tracks/trackGeometry.js';

export class TrainManager {
  constructor(trackManager) {
    this.trackManager = trackManager;
    this.trains = new Map();
    this.nextId = 0;
  }

  /**
   * Add a train to the system
   */
  addTrain(startTrackId, direction = 1) {
    const startTrack = this.trackManager.tracks.get(startTrackId);
    if (!startTrack) {
      console.error('Start track not found:', startTrackId);
      return null;
    }

    const id = `train_${this.nextId++}`;
    const train = {
      id,
      currentTrackId: startTrackId,
      direction,
      progress: 0.5,
      speed: 0.5,
      position: { ...startTrack.position },
      rotation: startTrack.rotation,
      active: false,
    };

    this.trains.set(id, train);
    this.updateTrainPosition(train, startTrack);
    return train;
  }

  removeTrain(id) {
    this.trains.delete(id);
  }

  /**
   * Update all active trains.
   */
  update(deltaTime) {
    for (const [id, train] of this.trains) {
      if (!train.active) continue;

      const currentTrack = this.trackManager.tracks.get(train.currentTrackId);
      if (!currentTrack) {
        console.warn('Train on invalid track:', train.currentTrackId);
        train.active = false;
        continue;
      }

      train.progress += train.speed * deltaTime * train.direction;

      // Check if train reached end of track
      if (train.progress >= 1.0) {
        this.advanceToTrack(train, currentTrack, 'front');
      } else if (train.progress <= 0.0) {
        this.advanceToTrack(train, currentTrack, 'back');
      }

      // Belt-and-braces: always clamp progress
      train.progress = Math.max(0.01, Math.min(0.99, train.progress));

      this.updateTrainPosition(train, currentTrack);
    }
  }

  /**
   * Attempt to advance train from currentTrack at the given exitEnd.
   * If no valid connection, reverse direction in place.
   */
  advanceToTrack(train, currentTrack, exitEnd) {
    const nextTrackId = currentTrack.connections[exitEnd];

    if (nextTrackId) {
      const nextTrack = this.trackManager.tracks.get(nextTrackId);
      if (nextTrack) {
        // Determine which end of nextTrack connects back to currentTrack
        let enterEnd = null;
        if (nextTrack.connections.back === currentTrack.id) {
          enterEnd = 'back';
        } else if (nextTrack.connections.front === currentTrack.id) {
          enterEnd = 'front';
        }

        if (enterEnd) {
          // Valid connection: transition
          train.currentTrackId = nextTrackId;
          if (enterEnd === 'back') {
            // Entering back of next track → start at 0, move forward
            train.progress = 0.01;
            train.direction = 1;
          } else {
            // Entering front of next track → start at 1, move backward
            train.progress = 0.99;
            train.direction = -1;
          }
          return;
        }
      }
    }

    // Fallback: no valid connection — reverse in place
    if (exitEnd === 'front') {
      train.direction = -1;
      train.progress = 0.99;
    } else {
      train.direction = 1;
      train.progress = 0.01;
    }
  }

  /**
   * Calculate train world position and yaw from track + progress.
   */
  updateTrainPosition(train, track) {
    const t = train.progress;
    const local = pointOnTrack(track.type, t);
    const world = localToWorld(local, track.position, track.rotation);

    train.position.x = world.x;
    train.position.y = track.position.y;
    train.position.z = world.z;

    // Compute yaw from tangent direction
    const tangent = tangentOnTrack(track.type, t);
    // Rotate tangent by track rotation
    const cosR = Math.cos(track.rotation);
    const sinR = Math.sin(track.rotation);
    const tangentWorld = {
      x: tangent.x * cosR + tangent.z * sinR,
      z: -tangent.x * sinR + tangent.z * cosR,
    };
    train.rotation = Math.atan2(tangentWorld.x, tangentWorld.z);
    if (train.direction < 0) train.rotation += Math.PI;
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
