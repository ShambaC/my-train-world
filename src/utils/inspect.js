/**
 * Route inspection — read-only descriptions of world state. These tools
 * never validate, reject, or block anything; they just report facts.
 */

const trackLength = (track) => (track.type === 'curved' ? (Math.PI / 2) * 0.25 : 0.5);

/**
 * Walk the connected component containing startTrackId via BFS.
 * Returns { ids, trackCount, distance, deadEnds } where deadEnds counts
 * free (unconnected) track endpoints in the component.
 */
export function connectedComponent(trackManager, startTrackId) {
  const track = trackManager.tracks.get(startTrackId);
  if (!track) return { ids: new Set(), trackCount: 0, distance: 0, deadEnds: 0 };

  const visited = new Set();
  const queue = [startTrackId];
  let distance = 0;
  let deadEnds = 0;

  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id)) continue;
    visited.add(id);
    const t = trackManager.tracks.get(id);
    if (!t) continue;
    distance += trackLength(t);
    for (const end of ['front', 'back']) {
      const next = t.connections?.[end];
      if (!next) deadEnds++;
      else if (!visited.has(next)) queue.push(next);
    }
  }

  return { ids: visited, trackCount: visited.size, distance, deadEnds };
}

/**
 * Count disconnected segments across the whole network (BFS over all tracks).
 */
export function disconnectedSegments(trackManager) {
  const seen = new Set();
  let segments = 0;
  for (const t of trackManager.getAllTracks()) {
    if (seen.has(t.id)) continue;
    segments++;
    const queue = [t.id];
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      const tr = trackManager.tracks.get(id);
      if (!tr) continue;
      for (const end of ['front', 'back']) {
        const next = tr.connections?.[end];
        if (next && !seen.has(next)) queue.push(next);
      }
    }
  }
  return segments;
}

/**
 * Total length of the whole track network (all components).
 */
export function totalTrackDistance(trackManager) {
  let d = 0;
  for (const t of trackManager.getAllTracks()) d += trackLength(t);
  return d;
}

/**
 * Approximate length of a train's consist (engine half + coach spacings).
 */
export function consistDistance(train) {
  let d = 0.5;
  for (const c of train?.coaches || []) d += c.spacing ?? 0.5;
  return d;
}

/**
 * Station the given track is bound to (a stop happens there), or null.
 */
export function stationForTrack(stationManager, trackId) {
  return stationManager?.getStationForTrack(trackId) ?? null;
}

/**
 * Stations reachable from a track's component (read-only peek, no route rules).
 */
export function stationsAlongComponent(stationManager, trackManager, startTrackId) {
  const { ids } = connectedComponent(trackManager, startTrackId);
  const stops = [];
  for (const trackId of ids) {
    const s = stationManager?.getStationForTrack(trackId);
    if (s && !stops.some((x) => x.id === s.id)) stops.push(s);
  }
  return stops;
}
