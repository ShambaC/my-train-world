import { scatterRegistry } from './scatterRegistry.js';

export const cellKey = (x, z) => `${x},${z}`;

export function markCell(set, x, z, radius) {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      set.add(cellKey(x + dx, z + dz));
    }
  }
}

export function collectExclusionSets({ trackManager, stationManager, roadManager, length, breadth }) {
  const tracks = new Set();
  for (const track of trackManager?.getAllTracks?.() ?? []) {
    const cx = Math.round(track.position.x / 0.5 + length / 2 - 0.5);
    const cz = Math.round(track.position.z / 0.5 + breadth / 2 - 0.5);
    markCell(tracks, cx, cz, 2);
  }

  const stations = new Set();
  for (const station of stationManager?.getAllStations?.() ?? []) {
    const r = station.voxelRect;
    for (let x = r.minX - 1; x <= r.maxX + 1; x++) {
      for (let z = r.minZ - 1; z <= r.maxZ + 1; z++) {
        stations.add(cellKey(x, z));
      }
    }
  }

  const roads = new Set();
  if (roadManager?.ready) {
    for (const cell of roadManager.getRoadCells()) {
      const [x, z] = cell.split(',').map(Number);
      markCell(roads, x, z, 1);
    }
  }

  const buildings = new Set();
  for (const building of scatterRegistry.buildings) {
    markCell(buildings, building.cellX, building.cellZ, 1);
  }

  return { tracks, stations, roads, buildings };
}

export function addSetDiff(previous, next, affected) {
  for (const key of previous) {
    if (!next.has(key)) affected.add(key);
  }
  for (const key of next) {
    if (!previous.has(key)) affected.add(key);
  }
}
