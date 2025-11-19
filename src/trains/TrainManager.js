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
      active: true, // New: whether train is moving
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
      // Linear interpolation for straight tracks
      const angle = (track.rotation * Math.PI) / 180;
      const length = 0.5; // Track length (1 voxel)
      
      // Straight track goes from Back (0, -0.25) to Front (0, 0.25)
      // Local Z goes from -0.25 to 0.25
      // progress 0 -> z = -0.25
      // progress 1 -> z = 0.25
      
      const localZ = (train.progress - 0.5) * length;
      
      // Rotate local position
      const x = localZ * Math.sin(angle);
      const z = localZ * Math.cos(angle);
      
      train.position.x = track.position.x + x;
      train.position.y = track.position.y + track.heightOffset;
      train.position.z = track.position.z + z;
      
      // Face direction of movement
      train.rotation = track.rotation + (train.direction < 0 ? 180 : 0);
      
    } else if (track.type === 'curved') {
      // Arc interpolation for curved tracks
      const radius = 0.25; // Correct radius for 1x1 voxel track
      const startAngle = (track.rotation * Math.PI) / 180;
      
      // Curved track goes from Back (0.25, 0) [Angle 0] to Front (0, 0.25) [Angle 90]
      // progress 0 -> angle 0
      // progress 1 -> angle 90 (PI/2)
      
      const arcAngle = train.progress * (Math.PI / 2);
      
      // Local position (before track rotation)
      // x = cos(a) * r, z = sin(a) * r ? No, TrackModels uses x=cos, z=sin?
      // TrackModels: x = cos(angle)*radius, z = sin(angle)*radius
      // At angle 0: (0.25, 0). At angle 90: (0, 0.25).
      // This matches our definition of Back (0.25, 0) and Front (0, 0.25).
      
      const localX = Math.cos(arcAngle) * radius; // Wait, at 0 this is 0.25. At 90 this is 0.
      const localZ = Math.sin(arcAngle) * radius; // Wait, at 0 this is 0. At 90 this is 0.25.
      
      // But TrackModels uses x=cos, z=sin.
      // Let's verify TrackModels again.
      // x = cos(angle)*radius, z = sin(angle)*radius.
      // Angle 0: x=r, z=0.
      // Angle 90: x=0, z=r.
      // Yes.
      
      // Now rotate this local position by track.rotation
      // x' = x*cos(R) - z*sin(R)
      // z' = x*sin(R) + z*cos(R)
      
      const cosR = Math.cos(startAngle);
      const sinR = Math.sin(startAngle);
      
      const worldX = localX * cosR - localZ * sinR;
      const worldZ = localX * sinR + localZ * cosR;
      
      train.position.x = track.position.x + worldX;
      train.position.y = track.position.y + track.heightOffset;
      train.position.z = track.position.z + worldZ;
      
      // Rotation
      // Tangent angle at arcAngle.
      // dx/da = -sin(a)*r
      // dz/da = cos(a)*r
      // Tangent angle = atan2(dz, dx) = atan2(cos, -sin) = a + 90 degrees?
      // At a=0: dx=0, dz=r. Angle 90. (Pointing +Z)
      // At a=90: dx=-r, dz=0. Angle 180. (Pointing -X)
      
      // So local rotation is arcAngle + 90 degrees.
      // Add track rotation.
      // Add 180 if moving backwards.
      
      let trainRot = (arcAngle * 180 / Math.PI) + 90 + track.rotation;
      if (train.direction < 0) trainRot += 180;
      
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
