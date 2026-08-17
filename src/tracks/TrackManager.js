/**
 * Track Manager - Handles track data storage and validation
 */

import * as THREE from 'three';
import { getEndpoints as getEndpointsFromGeometry } from './trackGeometry.js';
import { WATER_LEVEL } from '../terrain.js';

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
   * Automatically connect a track to nearby compatible tracks.
   * Uses closest-pair strategy to avoid asymmetric/mirrored links.
   */
  autoConnectTrack(track) {
    const tolerance = 0.5; // Increased tolerance for connection
    const endpoints = this.getEndpoints(track);

    for (const [otherId, otherTrack] of this.tracks) {
      if (otherId === track.id) continue;

      const otherEndpoints = this.getEndpoints(otherTrack);

      // Compute distances for all 4 combinations (endpoint proximity)
      const combos = [
        { d: this.distance(endpoints.front, otherEndpoints.front), myEnd: 'front', otherEnd: 'front' },
        { d: this.distance(endpoints.front, otherEndpoints.back),  myEnd: 'front', otherEnd: 'back' },
        { d: this.distance(endpoints.back, otherEndpoints.front),  myEnd: 'back',  otherEnd: 'front' },
        { d: this.distance(endpoints.back, otherEndpoints.back),   myEnd: 'back',  otherEnd: 'back' },
      ];

      // Find the closest pair
      combos.sort((a, b) => a.d - b.d);
      const best = combos[0];

      if (best.d < tolerance) {
        // Check height match at the connecting endpoints
        const myEnd = best.myEnd === 'front' ? endpoints.front : endpoints.back;
        const otherEnd = best.otherEnd === 'front' ? otherEndpoints.front : otherEndpoints.back;
        if (myEnd.y !== undefined && otherEnd.y !== undefined) {
          if (Math.abs(myEnd.y - otherEnd.y) > 0.15) continue;
        } else {
          if (Math.abs(track.position.y - otherTrack.position.y) > 0.15) continue;
        }
        // Connect even if one end is already taken (for now, allow reconnection)
        if (!track.connections[best.myEnd] && !otherTrack.connections[best.otherEnd]) {
          track.connections[best.myEnd] = otherId;
          otherTrack.connections[best.otherEnd] = track.id;
        }
      }
    }
  }
  distance(p1, p2) {
    const dx = p1.x - p2.x;
    const dz = p1.z - p2.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  getEndpoints(track) {
    return getEndpointsFromGeometry(track.type, track.position, track.rotation);
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
   * Get track at position — XZ distance from a known point.
   * For elevated tracks, also try ray-plane intersection at each track's Y.
   */
  getTrackAtPosition(position, tolerance = 0.5, raycaster, camera) {
    // First: fast XZ check from the known hit point (ground-level tracks)
    let best = null;
    let bestDist = tolerance;
    for (const [id, track] of this.tracks) {
      const dx = Math.abs(track.position.x - position.x);
      const dz = Math.abs(track.position.z - position.z);
      if (dx < bestDist && dz < bestDist) {
        bestDist = Math.max(dx, dz);
        best = track;
      }
    }
    if (best) return best;

    // Second: for elevated tracks, intersect ray with horizontal plane at each track's Y
    if (raycaster && camera) {
      const ray = raycaster.ray;
      const plane = new THREE.Plane();
      const intersectPoint = new THREE.Vector3();
      for (const [id, track] of this.tracks) {
        if (Math.abs(track.position.y - position.y) < 0.01) continue; // already checked above
        plane.setFromNormalAndCoplanarPoint(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, track.position.y, 0)
        );
        if (ray.intersectPlane(plane, intersectPoint)) {
          const dx = Math.abs(track.position.x - intersectPoint.x);
          const dz = Math.abs(track.position.z - intersectPoint.z);
          if (dx < tolerance && dz < tolerance) {
            return track;
          }
        }
      }
    }
    return null;
  }

  /**
   * Check if position is valid for track placement
   */
  isValidPlacement(position, type, rotation, terrainHeight, surfaceNormal = null) {
    // Check if on terrain (not in water) — allow over water when elevated
    // Threshold accounts for WATER_TRACK_OFFSET (0.1) + tolerance
    if (terrainHeight < WATER_LEVEL && position.y < WATER_LEVEL + 0.2) return false;

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
   * Snap position to grid. Y snaps to nearest voxel top (k*0.5 + 0.25)
   * with a small lift (+0.02) so track meshes don't z-fight the terrain.
   */
  snapToGrid(position) {
    const voxelTop = Math.round((position.y - 0.25) / 0.5) * 0.5 + 0.25;
    return {
      x: Math.round(position.x / this.gridSize) * this.gridSize,
      y: voxelTop + 0.02,
      z: Math.round(position.z / this.gridSize) * this.gridSize,
    };
  }

  /**
   * Get a track by id
   */
  getTrack(id) {
    return this.tracks.get(id) || null;
  }

  /**
   * Re-insert a track with its original id (undo/redo, save/load).
   * Auto-connects to whatever neighbors exist so links are restored.
   */
  restoreTrack(track) {
    this.tracks.set(track.id, track);
    const num = parseInt(track.id.split('_')[1], 10);
    if (!Number.isNaN(num) && num >= this.nextId) this.nextId = num + 1;
    this.autoConnectTrack(track);
    return track;
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
