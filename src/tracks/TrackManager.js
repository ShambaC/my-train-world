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
    
    // Auto-connect to nearby tracks
    this.autoConnectTrack(track);
    
    return track;
  }

  /**
   * Automatically connect a track to nearby compatible tracks
   */
  autoConnectTrack(track) {
    const connectionDistance = 0.6; // Slightly larger than track size for tolerance
    
    for (const [otherId, otherTrack] of this.tracks) {
      if (otherId === track.id) continue;
      
      // Check if tracks are at similar heights
      if (Math.abs(track.position.y - otherTrack.position.y) > 0.3) continue;
      
      // Calculate distance between tracks
      const dx = track.position.x - otherTrack.position.x;
      const dz = track.position.z - otherTrack.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      
      if (distance < connectionDistance && distance > 0.1) {
        // Tracks are close enough - determine connection points
        // Calculate angle between tracks
        const angle = Math.atan2(dz, dx) * (180 / Math.PI);
        
        // Determine which ends to connect based on track rotations and positions
        this.connectTracks(track, otherTrack, angle);
      }
    }
  }

  /**
   * Connect two tracks at appropriate ends
   */
  connectTracks(track1, track2, angleBetween) {
    // Simplified connection logic - connect if tracks are adjacent
    // Front/back determined by rotation and relative position
    
    const rot1 = track1.rotation % 360;
    const rot2 = track2.rotation % 360;
    
    // If no existing connections, create them
    if (!track1.connections.front && !track2.connections.back) {
      track1.connections.front = track2.id;
      track2.connections.back = track1.id;
    } else if (!track1.connections.back && !track2.connections.front) {
      track1.connections.back = track2.id;
      track2.connections.front = track1.id;
    }
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
    if (terrainHeight < 1) return false;
    
    // Check if placement is on top surface only (not on sides)
    if (surfaceNormal) {
      // Normal should point mostly upward (y component should be dominant)
      // Allow some tolerance for slightly angled surfaces
      if (Math.abs(surfaceNormal.y) < 0.8) {
        return false; // Surface is too steep or is a side face
      }
    }
    
    // Check if position is already occupied
    const existing = this.getTrackAtPosition(position, 0.5);
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
