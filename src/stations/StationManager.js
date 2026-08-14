/**
 * Station Manager — stores station data and binds adjacent tracks for stops.
 */
import { DEFAULT_ROLE } from './stationRoles';

export class StationManager {
  constructor() {
    this.stations = new Map();
    this.nextId = 0;
    this.trackBindings = new Map(); // trackId -> stationId
  }

  addStation(data) {
    const id = `station_${this.nextId++}`;
    const station = { id, role: DEFAULT_ROLE, ...data };
    this.stations.set(id, station);
    return station;
  }

  setRole(id, role) {
    const station = this.stations.get(id);
    if (!station) return null;
    station.role = role;
    return station;
  }

  removeStation(id) {
    this.stations.delete(id);
    this.rebuildBindings();
  }

  getStation(id) {
    return this.stations.get(id);
  }

  getAllStations() {
    return Array.from(this.stations.values());
  }

  clear() {
    this.stations.clear();
    this.nextId = 0;
    this.trackBindings.clear();
  }

  /**
   * Find station whose expanded rect contains a world position.
   */
  getStationAtPosition(worldPos, tolerance = 1.0) {
    for (const s of this.stations.values()) {
      const r = s.worldRect;
      if (
        worldPos.x >= r.minX - tolerance && worldPos.x <= r.maxX + tolerance &&
        worldPos.z >= r.minZ - tolerance && worldPos.z <= r.maxZ + tolerance
      ) {
        return s;
      }
    }
    return null;
  }

  /**
   * Recompute which tracks run right beside a station (a stop happens there).
   * Track must be laterally 0.75..2.5 units from the strip, axially overlapping,
   * and at the station ground height (bridges excluded).
   */
  rebuildBindings(trackManager) {
    this.trackBindings.clear();
    for (const station of this.stations.values()) {
      const along = station.lengthCells * 0.5;
      for (const track of trackManager.getAllTracks()) {
        const dx = track.position.x - station.startWorld.x;
        const dz = track.position.z - station.startWorld.z;
        const t = dx * station.dir.x + dz * station.dir.z;
        const lateral = Math.abs(dx * station.dir.z - dz * station.dir.x);
        if (Math.abs(track.position.y - station.groundY) > 0.3) continue;
        if (Math.abs(t) > along + 0.75) continue;
        if (lateral < 0.75 || lateral > 2.5) continue;
        this.trackBindings.set(track.id, station.id);
      }
    }
  }

  getStationForTrack(trackId) {
    const stationId = this.trackBindings.get(trackId);
    return stationId ? this.stations.get(stationId) : null;
  }
}
