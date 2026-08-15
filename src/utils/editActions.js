/**
 * Shared world-edit actions with undo/redo entries.
 * Every action captures minimal serializable before/after data and pushes
 * a history entry; managers keep their IDs across undo/redo.
 */
import { buildStation } from '../stations/StationBuilder';

/** Deep clone plain data (tracks, roads, marker data — never THREE objects). */
export const clone = (o) => JSON.parse(JSON.stringify(o));

/** Station marker data only — group/pieces/smoke are rebuilt on restore. */
export const stripStation = (s) => ({
  id: s.id,
  role: s.role,
  startCell: s.startCell,
  endCell: s.endCell,
  dir: s.dir,
  lengthCells: s.lengthCells,
  startHeight: s.startHeight,
  terrainLength: s.terrainLength,
  terrainBreadth: s.terrainBreadth,
});

/** Rebuild a station object (with its THREE group) from marker data. */
export function rebuildStation(marker, stationManager) {
  const { station, group } = buildStation({
    startCell: marker.startCell,
    endCell: marker.endCell,
    dir: marker.dir,
    lengthCells: marker.lengthCells,
    startHeight: marker.startHeight,
    terrainLength: marker.terrainLength,
    terrainBreadth: marker.terrainBreadth,
  });
  station.id = marker.id;
  station.role = marker.role;
  station.group = group;
  stationManager.restoreStation(station);
  return station;
}

/**
 * Delete any target the delete tool understands (train, track, station,
 * road) with a compound undo entry (trains sitting on a deleted track are
 * restored together with the track).
 */
export function deleteEntity({ target, trackManager, stationManager, trainManager, signalManager, roadManager, history }) {
  if (!target || !history) return;

  if (target.kind === 'train') {
    const train = trainManager.getTrain(target.id);
    if (!train) return;
    const snapshot = clone(train);
    history.push({
      undo: () => trainManager.restoreTrain(snapshot),
      redo: () => trainManager.removeTrain(target.id),
    });
    trainManager.removeTrain(target.id);
    return;
  }

  if (target.kind === 'track') {
    const track = trackManager.tracks.get(target.id);
    if (!track) return;
    const trackSnap = clone(track);
    const trainSnaps = trainManager.getAllTrains()
      .filter((t) => t.currentTrackId === target.id)
      .map((t) => clone(t));
    history.push({
      undo: () => {
        for (const s of trainSnaps) trainManager.restoreTrain(s);
        trackManager.restoreTrack(trackSnap);
      },
      redo: () => {
        for (const s of trainSnaps) trainManager.removeTrain(s.id);
        trackManager.removeTrack(target.id);
      },
    });
    for (const s of trainSnaps) trainManager.removeTrain(s.id);
    trackManager.removeTrack(target.id);
    signalManager?.removeForTrack(target.id);
    return;
  }

  if (target.kind === 'station') {
    const station = stationManager.getStation(target.id);
    if (!station) return;
    const marker = stripStation(station);
    history.push({
      undo: () => rebuildStation(marker, stationManager),
      redo: () => stationManager.removeStation(target.id),
    });
    stationManager.removeStation(target.id);
    return;
  }

  if (target.kind === 'road') {
    const road = roadManager?.userRoads.find((r) => r.id === target.id);
    if (!road) return;
    const snap = clone(road);
    history.push({
      undo: () => roadManager.restoreUserRoad(snap),
      redo: () => roadManager.removeRoad(target.id),
    });
    roadManager.removeRoad(target.id);
  }
}
