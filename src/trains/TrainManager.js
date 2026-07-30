/**
 * Train Manager - Handles train movement and pathfinding
 */

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
      direction, // 1 = forward, -1 = backward
      progress: 0, // 0 to 1 along current track
      speed: 0.5, // units per second
      position: { ...startTrack.position },
      rotation: startTrack.rotation,
      active: false, // Default stopped per user request
    };

    this.trains.set(id, train);
    return train;
  }

  /**
   * Remove a train
   */
  removeTrain(id) {
    this.trains.delete(id);
  }

  /**
   * Update train positions
   */
  update(deltaTime) {
    for (const [id, train] of this.trains) {
      // Skip inactive trains
      if (!train.active) continue;
      
      // Update progress along current track
      train.progress += (train.speed * deltaTime * train.direction);

      const currentTrack = this.trackManager.tracks.get(train.currentTrackId);
      if (!currentTrack) {
        console.warn('Train on invalid track:', train.currentTrackId);
        continue;
      }

      // Check if train reached end of track
      if (train.progress >= 1.0) {
        // Reached Front end (progress 1)
        const nextTrackId = currentTrack.connections.front;
        if (nextTrackId) {
          const nextTrack = this.trackManager.tracks.get(nextTrackId);
          if (nextTrack) {
            train.currentTrackId = nextTrackId;
            // Check connection point on next track
            if (nextTrack.connections.back === currentTrack.id) {
              // Entering Back of next track -> Start at 0, move Forward
              train.progress = 0.01;
              train.direction = 1;
            } else if (nextTrack.connections.front === currentTrack.id) {
              // Entering Front of next track -> Start at 1, move Backward
              train.progress = 0.99;
              train.direction = -1;
            }
          }
        } else {
          // End of line, reverse
          train.direction = -1;
          train.progress = 0.99;
        }
      } else if (train.progress <= 0.0) {
        // Reached Back end (progress 0)
        const nextTrackId = currentTrack.connections.back;
        if (nextTrackId) {
          const nextTrack = this.trackManager.tracks.get(nextTrackId);
          if (nextTrack) {
            train.currentTrackId = nextTrackId;
            // Check connection point on next track
            if (nextTrack.connections.back === currentTrack.id) {
              // Entering Back of next track -> Start at 0, move Forward
              train.progress = 0.01;
              train.direction = 1;
            } else if (nextTrack.connections.front === currentTrack.id) {
              // Entering Front of next track -> Start at 1, move Backward
              train.progress = 0.99;
              train.direction = -1;
            }
          }
        } else {
          // End of line, reverse
          train.direction = 1;
          train.progress = 0.01;
        }
      }

      // Update position based on track type and progress
      this.updateTrainPosition(train, currentTrack);
    }
  }

  /**
   * Calculate train position on track
   */
  updateTrainPosition(train, track) {
    if (track.type === 'straight') {
      const angle = track.rotation; // Already in radians
      const length = 0.5; // Track length (1 voxel)
      
      const localZ = (train.progress - 0.5) * length;
      
      const x = localZ * Math.sin(angle);
      const z = localZ * Math.cos(angle);
      
      train.position.x = track.position.x + x;
      train.position.y = track.position.y; // track.position.y already contains heightOffset
      train.position.z = track.position.z + z;
      
      // Face direction of movement (radians)
      train.rotation = track.rotation + (train.direction < 0 ? Math.PI : 0);
      
    } else if (track.type === 'curved') {
      const radius = 0.25;
      const startAngle = track.rotation; // Already in radians
      
      const arcAngle = train.progress * (Math.PI / 2);
      
      // Local position relative to curved track voxel center
      // Cell center is (0, 0). Curve arc goes from (0.25, -0.25) to (-0.25, 0.25) around pivot (-0.25, -0.25)
      const localX = -0.25 + Math.cos(arcAngle) * (radius * 2);
      const localZ = -0.25 + Math.sin(arcAngle) * (radius * 2);
      
      const cosR = Math.cos(startAngle);
      const sinR = Math.sin(startAngle);
      
      const worldX = localX * cosR - localZ * sinR;
      const worldZ = localX * sinR + localZ * cosR;
      
      train.position.x = track.position.x + worldX;
      train.position.y = track.position.y; // track.position.y already contains heightOffset
      train.position.z = track.position.z + worldZ;
      
      let trainRot = arcAngle + (Math.PI / 2) + track.rotation;
      if (train.direction < 0) trainRot += Math.PI;
      
      train.rotation = trainRot;
    }
  }

  /**
   * Get all trains
   */
  getAllTrains() {
    return Array.from(this.trains.values());
  }

  /**
   * Toggle train active state
   */
  toggleTrain(id) {
    const train = this.trains.get(id);
    if (train) {
      train.active = !train.active;
      return train.active;
    }
    return false;
  }

  /**
   * Set train active state
   */
  setTrainActive(id, active) {
    const train = this.trains.get(id);
    if (train) {
      train.active = active;
    }
  }

  /**
   * Clear all trains
   */
  clear() {
    this.trains.clear();
    this.nextId = 0;
  }
}
