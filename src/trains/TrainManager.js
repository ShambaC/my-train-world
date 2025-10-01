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
        // Try to move to next track
        const nextTrackId = train.direction > 0 
          ? currentTrack.connections.front 
          : currentTrack.connections.back;

        if (nextTrackId) {
          train.currentTrackId = nextTrackId;
          train.progress = 0;
          
          // Update rotation for new track
          const nextTrack = this.trackManager.tracks.get(nextTrackId);
          if (nextTrack) {
            train.rotation = nextTrack.rotation;
          }
        } else {
          // No connection, reverse direction
          train.direction *= -1;
          train.progress = 1.0;
        }
      } else if (train.progress <= 0) {
        // Moving backward, reached start
        const prevTrackId = train.direction < 0 
          ? currentTrack.connections.front 
          : currentTrack.connections.back;

        if (prevTrackId) {
          train.currentTrackId = prevTrackId;
          train.progress = 1.0;
          
          const prevTrack = this.trackManager.tracks.get(prevTrackId);
          if (prevTrack) {
            train.rotation = prevTrack.rotation;
          }
        } else {
          // No connection, reverse direction
          train.direction *= -1;
          train.progress = 0;
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
      
      const startZ = track.position.z - (length / 2) * Math.cos(angle);
      const startX = track.position.x - (length / 2) * Math.sin(angle);
      
      train.position.x = startX + (length * train.progress * Math.sin(angle));
      train.position.y = track.position.y + track.heightOffset;
      train.position.z = startZ + (length * train.progress * Math.cos(angle));
      train.rotation = track.rotation;
      
    } else if (track.type === 'curved') {
      // Arc interpolation for curved tracks
      const radius = 0.5;
      const startAngle = (track.rotation * Math.PI) / 180;
      const arcAngle = train.progress * (Math.PI / 2); // 90 degrees
      
      train.position.x = track.position.x + radius * Math.sin(startAngle + arcAngle);
      train.position.y = track.position.y + track.heightOffset;
      train.position.z = track.position.z + radius * Math.cos(startAngle + arcAngle);
      train.rotation = track.rotation + (arcAngle * 180) / Math.PI;
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
