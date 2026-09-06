import { WATER_LEVEL_VOXEL, VOXEL_SIZE } from '../terrain.js';
import { buildStation } from '../stations/StationBuilder.js';

const ROUTE_LENGTH = 34;
const STATION_LENGTH = 16;
const STATION_LATERAL = 4;
const ROUTE_MARGIN = 8;
const CORRIDOR_RADIUS = 5;
const MAX_WATER_GAP = 10;

const toWorld = (cellX, cellZ, terrainData) => ({
  x: (cellX - terrainData.length / 2) * VOXEL_SIZE,
  z: (cellZ - terrainData.breadth / 2) * VOXEL_SIZE,
});

const topY = (height) => height * VOXEL_SIZE + 0.25 + 0.02;

function cellHeight(terrainData, x, z) {
  if (x < 0 || z < 0 || x >= terrainData.length || z >= terrainData.breadth) return null;
  return terrainData.heightMap[x][z];
}

function inspectCandidate(terrainData, startX, startZ, allowWater) {
  const { length, breadth, heightMap } = terrainData;
  const endX = startX + ROUTE_LENGTH - 1;
  if (startX < ROUTE_MARGIN || endX >= length - ROUTE_MARGIN) return null;
  if (startZ < ROUTE_MARGIN || startZ + STATION_LATERAL + 2 >= breadth - ROUTE_MARGIN) return null;

  const stationHeight = heightMap[startX + 4]?.[startZ + STATION_LATERAL];
  let landHeight = stationHeight > WATER_LEVEL_VOXEL ? stationHeight : null;
  let maxLandHeight = landHeight;
  let waterCount = 0;
  let waterStart = Infinity;
  let waterEnd = -1;
  for (let i = 0; i < ROUTE_LENGTH; i += 1) {
    const x = startX + i;
    const h = heightMap[x][startZ];
    if (h <= WATER_LEVEL_VOXEL) {
      waterCount += 1;
      waterStart = Math.min(waterStart, i);
      waterEnd = Math.max(waterEnd, i);
      continue;
    }
    if (landHeight == null) landHeight = h;
    maxLandHeight = Math.max(maxLandHeight ?? h, h);
  }
  if (landHeight == null || waterCount > MAX_WATER_GAP) return null;
  if (maxLandHeight !== landHeight) return null;
  if (!allowWater && waterCount > 0) return null;

  // Camera corridor only needs valid cells; the rail deck intentionally
  // bridges uneven and submerged terrain between the flat station banks.
  for (let i = 0; i < ROUTE_LENGTH; i += 1) {
    for (let dz = -CORRIDOR_RADIUS; dz <= CORRIDOR_RADIUS; dz += 1) {
      if (cellHeight(terrainData, startX + i, startZ + dz) == null) return null;
    }
  }

  const stationStartX = startX + 4;
  const stationStartZ = startZ + STATION_LATERAL;
  for (let x = stationStartX; x < stationStartX + STATION_LENGTH; x += 1) {
    for (let z = stationStartZ - 1; z <= stationStartZ + 1; z += 1) {
      if (cellHeight(terrainData, x, z) !== landHeight) return null;
    }
  }

  const crossingIndex = (() => {
    const preferred = Math.floor(ROUTE_LENGTH * 0.58);
    for (let offset = 0; offset < ROUTE_LENGTH; offset += 1) {
      for (const index of [preferred - offset, preferred + offset]) {
        if (index >= 2 && index < ROUTE_LENGTH - 2 && heightMap[startX + index][startZ] > WATER_LEVEL_VOXEL) return index;
      }
    }
    return null;
  })();
  if (crossingIndex == null) return null;

  const centerDistance = Math.abs(startZ - breadth / 2) + Math.abs(startX + ROUTE_LENGTH / 2 - length / 2) * 0.2;
  const bridgeScore = waterCount > 0 ? 100 : 0;
  return {
    startX,
    startZ,
    endX,
    landHeight,
    waterCount,
    waterStart,
    waterEnd,
    crossingIndex,
    score: bridgeScore + waterCount * 8 - centerDistance,
  };
}

function findCorridor(terrainData) {
  const waterCandidates = [];
  const landCandidates = [];
  for (let z = ROUTE_MARGIN; z < terrainData.breadth - ROUTE_MARGIN - STATION_LATERAL - 2; z += 1) {
    for (let x = ROUTE_MARGIN; x < terrainData.length - ROUTE_LENGTH - ROUTE_MARGIN; x += 1) {
      const water = inspectCandidate(terrainData, x, z, true);
      if (water) {
        (water.waterCount > 0 ? waterCandidates : landCandidates).push(water);
      }
    }
  }
  const candidates = waterCandidates.length ? waterCandidates : landCandidates;
  candidates.sort((a, b) => b.score - a.score || a.startZ - b.startZ || a.startX - b.startX);
  return candidates[0] || null;
}

export function buildTrailerLayout(terrainData) {
  const corridor = findCorridor(terrainData);
  if (!corridor) {
    const fallback = {
      startX: Math.max(ROUTE_MARGIN, Math.floor(terrainData.length / 2) - ROUTE_LENGTH / 2),
      startZ: Math.max(ROUTE_MARGIN, Math.floor(terrainData.breadth / 2) - 6),
      endX: Math.floor(terrainData.length / 2) + ROUTE_LENGTH / 2,
      landHeight: WATER_LEVEL_VOXEL + 2,
      waterCount: 0,
      waterStart: Infinity,
      waterEnd: -1,
      crossingIndex: Math.floor(ROUTE_LENGTH * 0.58),
    };
    console.error('[Trailer] No valid corridor found for pinned terrain seed', {
      seed: terrainData.seed,
      length: terrainData.length,
      breadth: terrainData.breadth,
    });
    return createLayout(terrainData, fallback);
  }
  return createLayout(terrainData, corridor);
}

function createLayout(terrainData, corridor) {
  const groundY = topY(corridor.landHeight);
  const routeY = groundY;
  const route = [];
  for (let i = 0; i < ROUTE_LENGTH; i += 1) {
    const world = toWorld(corridor.startX + i, corridor.startZ, terrainData);
    route.push({
      key: `main-${i}`,
      index: i,
      type: 'straight',
      cell: { x: corridor.startX + i, z: corridor.startZ },
      position: { x: world.x, y: routeY, z: world.z },
      rotation: Math.PI / 2,
      water: i >= corridor.waterStart && i <= corridor.waterEnd,
    });
  }

  const curveCell = { x: corridor.endX, z: corridor.startZ };
  const curveWorld = toWorld(curveCell.x, curveCell.z, terrainData);
  route.push({
    key: 'turn',
    index: ROUTE_LENGTH,
    type: 'curved',
    cell: curveCell,
    position: { x: curveWorld.x, y: routeY, z: curveWorld.z },
    rotation: 0,
    water: false,
  });
  for (let i = 1; i <= 4; i += 1) {
    const cell = { x: corridor.endX, z: corridor.startZ + i };
    const world = toWorld(cell.x, cell.z, terrainData);
    route.push({
      key: `tail-${i}`,
      index: ROUTE_LENGTH + i,
      type: 'straight',
      cell,
      position: { x: world.x, y: routeY, z: world.z },
      rotation: 0,
      water: false,
    });
  }

  const stationDir = { x: -1, z: 0 };
  const stationStartCell = {
    x: corridor.startX + 4 + STATION_LENGTH - 1,
    z: corridor.startZ + STATION_LATERAL,
  };
  const stationEndCell = {
    x: stationStartCell.x + stationDir.x * (STATION_LENGTH - 1),
    z: stationStartCell.z,
  };
  const stationWorld = toWorld(stationStartCell.x, stationStartCell.z, terrainData);
  const stationCenterWorld = {
    x: stationWorld.x + stationDir.x * VOXEL_SIZE * STATION_LENGTH / 2,
    z: stationWorld.z,
  };
  const crossingWorld = toWorld(corridor.startX + corridor.crossingIndex, corridor.startZ, terrainData);
  return {
    seed: terrainData.seed,
    corridor,
    route,
    bridgeRange: { start: corridor.waterStart, end: corridor.waterEnd },
    spawnIndex: 12,
    crossingIndex: corridor.crossingIndex,
    crossing: { ...crossingWorld, y: routeY },
    station: {
      startCell: stationStartCell,
      endCell: stationEndCell,
      dir: stationDir,
      lengthCells: STATION_LENGTH,
      startHeight: corridor.landHeight,
      trackSide: 1,
      centerWorld: { ...stationCenterWorld, y: routeY },
      terrainLength: terrainData.length,
      terrainBreadth: terrainData.breadth,
      world: { ...stationWorld, y: routeY },
    },
  };
}

export function addRoutePiece(layout, trackManager, index) {
  const piece = layout.route[index];
  if (!piece) return null;
  const track = trackManager.addTrack(piece.type, piece.position, piece.rotation, 0);
  piece.trackId = track.id;
  return track;
}

export function addRoute(layout, trackManager) {
  const tracks = [];
  for (let i = 0; i < layout.route.length; i += 1) {
    const track = addRoutePiece(layout, trackManager, i);
    if (track) tracks.push(track);
  }
  return tracks;
}

export function addTrailerStation(layout, stationManager) {
  const built = buildStation(layout.station);
  const station = stationManager.addStation(built.station);
  station.group = built.group;
  station.animStart = null;
  stationManager.setRole(station.id, 'city');
  return station;
}

export function addTrailerTrain(layout, trainManager, engineType = 'steam-engine') {
  const spawnPiece = layout.route[layout.spawnIndex];
  if (!spawnPiece?.trackId) return null;
  const train = trainManager.addTrain(spawnPiece.trackId, 1, engineType);
  if (!train) return null;
  trainManager.addCoach(train.id, 'passenger-coach');
  trainManager.addCoach(train.id, 'container-coach');
  trainManager.addCoach(train.id, 'viewdeck-coach');
  return train;
}

export function addTrailerRoadCrossing(layout, roadManager) {
  const { crossing } = layout;
  const roads = [];
  for (let i = -5; i <= 5; i += 1) {
    const road = roadManager.addRoad(
      { x: crossing.x, y: crossing.y, z: crossing.z + i * VOXEL_SIZE },
      0,
    );
    if (road) roads.push(road);
  }
  return roads;
}

export function resetTrailerWorld({ trackManager, stationManager, trainManager, roadManager }) {
  trainManager.clear();
  stationManager.clear();
  trackManager.clear();
  if (roadManager) roadManager.importUserData({ userRoads: [], userNextId: 0 });
}

function connectedTrackCount(trackManager, startId) {
  if (!startId) return 0;
  const seen = new Set();
  const stack = [startId];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    const track = trackManager.getTrack(id);
    if (!track) continue;
    for (const next of [track.connections.front, track.connections.back]) if (next) stack.push(next);
  }
  return seen.size;
}

export function validateTrailerLayout(layout, terrainData, trackManager, roadManager, requireCrossing = false) {
  const errors = [];
  for (const piece of layout.route) {
    const { x, z } = piece.cell;
    if (x < 0 || z < 0 || x >= terrainData.length || z >= terrainData.breadth) {
      errors.push(`route ${piece.key} outside terrain at ${x},${z}`);
      continue;
    }
    const h = terrainData.heightMap[x][z];
    if (!piece.water && h <= WATER_LEVEL_VOXEL) errors.push(`land route ${piece.key} is underwater at ${x},${z}`);
  }
  const stationHeight = layout.station.startHeight;
  for (let x = layout.station.startCell.x; x <= layout.station.endCell.x; x += 1) {
    for (let z = layout.station.startCell.z - 1; z <= layout.station.startCell.z + 1; z += 1) {
      if (terrainData.heightMap[x]?.[z] !== stationHeight) errors.push(`station footprint not flat at ${x},${z}`);
    }
  }
  const routeStart = layout.route[0]?.trackId;
  if (routeStart && connectedTrackCount(trackManager, routeStart) < layout.route.length) {
    errors.push(`railway graph disconnected: ${connectedTrackCount(trackManager, routeStart)}/${layout.route.length} tracks connected`);
  }
  if (!layout.route[layout.spawnIndex]?.trackId) errors.push('train spawn track missing');
  if (layout.spawnIndex < 6) errors.push('insufficient track behind train spawn');
  if (requireCrossing && roadManager && !roadManager.getSegments().some((segment) => segment.waypoints?.some((point) => Math.abs(point.x - layout.crossing.x) < 0.01))) {
    errors.push('crossing road was not created');
  }
  if (errors.length) console.error('[Trailer] Layout validation failed', errors);
  return errors;
}
