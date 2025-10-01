/**
 * Track Manager - Handles track data storage and validation
 */

export class TrackManager {
  constructor() {
    this.tracks = new Map();
    this.nextId = 0;
    this.gridSize = 0.5; // Snap to half-unit grid
  }

  /**
   * Add a track to the manager
   */
  addTrack(type, position, rotation, heightOffset = 0) {
    const id = `track_${this.nextId++}`;
    const track = {
      id,
      type,
      position: { ...position },
      rotation,
      heightOffset,
      connections: { front: null, back: null },
    };
    
    this.tracks.set(id, track);
    return track;
  }

  /**
   * Remove a track
   */
  removeTrack(id) {
    const track = this.tracks.get(id);
    if (!track) return false;
    
    // Remove connections
    if (track.connections.front) {
      const frontTrack = this.tracks.get(track.connections.front);
      if (frontTrack) {
        if (frontTrack.connections.front === id) frontTrack.connections.front = null;
        if (frontTrack.connections.back === id) frontTrack.connections.back = null;
      }
    }
    if (track.connections.back) {
      const backTrack = this.tracks.get(track.connections.back);
      if (backTrack) {
        if (backTrack.connections.front === id) backTrack.connections.front = null;
        if (backTrack.connections.back === id) backTrack.connections.back = null;
      }
    }
    
    this.tracks.delete(id);
    return true;
  }

  /**
   * Get track at position
   */
  getTrackAtPosition(position, tolerance = 0.5) {
    for (const [id, track] of this.tracks) {
      const dx = Math.abs(track.position.x - position.x);
      const dz = Math.abs(track.position.z - position.z);
      
      if (dx < tolerance && dz < tolerance) {
        return track;
      }
    }
    return null;
  }

  /**
   * Check if position is valid for track placement
   */
  isValidPlacement(position, type, rotation, terrainHeight, surfaceNormal = null) {
    // Check if on terrain (not in water)
    if (terrainHeight < 2) return false;
    
    // Check if placement is on top surface only (not on sides)
    if (surfaceNormal) {
      // Normal should point mostly upward (y component should be dominant)
      // Allow some tolerance for slightly angled surfaces
      if (Math.abs(surfaceNormal.y) < 0.8) {
        return false; // Surface is too steep or is a side face
      }
    }
    
    // Check if position is already occupied
    const existing = this.getTrackAtPosition(position, 0.8);
    if (existing) return false;
    
    // Check slope (max gradient)
    const maxSlopeAngle = 15; // degrees
    // This would need terrain height checking at multiple points
    // For now, simplified validation
    
    return true;
  }

  /**
   * Snap position to grid
   */
  snapToGrid(position) {
    return {
      x: Math.round(position.x / this.gridSize) * this.gridSize,
      y: position.y,
      z: Math.round(position.z / this.gridSize) * this.gridSize,
    };
  }

  /**
   * Get all tracks
   */
  getAllTracks() {
    return Array.from(this.tracks.values());
  }

  /**
   * Clear all tracks
   */
  clear() {
    this.tracks.clear();
    this.nextId = 0;
  }

  /**
   * Export tracks data (for saving)
   */
  exportData() {
    return {
      tracks: Array.from(this.tracks.entries()),
      nextId: this.nextId,
    };
  }

  /**
   * Import tracks data (for loading)
   */
  importData(data) {
    this.tracks = new Map(data.tracks);
    this.nextId = data.nextId;
  }
}
