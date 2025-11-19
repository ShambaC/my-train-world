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
    const endpoints = this.getEndpoints(track);
    const tolerance = 0.1; // Tolerance for connection

    for (const [otherId, otherTrack] of this.tracks) {
      if (otherId === track.id) continue;
      
      // Check height difference
      if (Math.abs(track.position.y - otherTrack.position.y) > 0.1) continue;

      const otherEndpoints = this.getEndpoints(otherTrack);

      // Check all 4 combinations: Front-Front, Front-Back, Back-Front, Back-Back
      
      // Track Front -> Other Front
      if (!track.connections.front && !otherTrack.connections.front && 
          this.distance(endpoints.front, otherEndpoints.front) < tolerance) {
        track.connections.front = otherId;
        otherTrack.connections.front = track.id;
      }
      // Track Front -> Other Back
      else if (!track.connections.front && !otherTrack.connections.back && 
               this.distance(endpoints.front, otherEndpoints.back) < tolerance) {
        track.connections.front = otherId;
        otherTrack.connections.back = track.id;
      }
      
      // Track Back -> Other Front
      if (!track.connections.back && !otherTrack.connections.front && 
          this.distance(endpoints.back, otherEndpoints.front) < tolerance) {
        track.connections.back = otherId;
        otherTrack.connections.front = track.id;
      }
      // Track Back -> Other Back
      else if (!track.connections.back && !otherTrack.connections.back && 
               this.distance(endpoints.back, otherEndpoints.back) < tolerance) {
        track.connections.back = otherId;
        otherTrack.connections.back = track.id;
      }
    }
  }

  distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  getEndpoints(track) {
    const pos = track.position;
    // Convert rotation to radians (negative because Three.js rotation is CCW but our grid logic might be different? 
    // Actually standard math is CCW. Let's assume standard.)
    const rotRad = (track.rotation * Math.PI) / 180;
    const cos = Math.cos(rotRad);
    const sin = Math.sin(rotRad);

    const rotate = (x, z) => ({
      x: x * cos - z * sin,
      z: x * sin + z * cos
    });

    if (track.type === 'straight') {
      // Straight track is aligned along Z axis by default?
      // In TrackModels, createStraightTrack creates geometry along Z axis (-0.25 to 0.25)
      // So Front is (0, 0.25), Back is (0, -0.25)
      const front = rotate(0, 0.25);
      const back = rotate(0, -0.25);
      return {
        front: { x: pos.x + front.x, z: pos.z + front.z },
        back: { x: pos.x + back.x, z: pos.z + back.z }
      };
    } else {
      // Curved track
      // In TrackModels, it goes from (0.25, 0) to (0, 0.25)
      // Let's define Front as (0, 0.25) [Angle 90] and Back as (0.25, 0) [Angle 0]
      const front = rotate(0, 0.25);
      const back = rotate(0.25, 0);
      return {
        front: { x: pos.x + front.x, z: pos.z + front.z },
        back: { x: pos.x + back.x, z: pos.z + back.z }
      };
    }
  }

  /**
   * Connect two tracks at appropriate ends
   */
  connectTracks(track1, track2, angleBetween) {
    // Deprecated - logic moved to autoConnectTrack
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
