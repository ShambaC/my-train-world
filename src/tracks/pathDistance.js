/**
 * Path distance — along-track (graph) distance between two points on the
 * track network. Used by signals and crossings so approach detection
 * follows the rails instead of straight-line distance: a train on a
 * parallel line near a crossing must not trigger it.
 *
 * The track graph is small (user-built), so a simple Dijkstra over track
 * endpoints is plenty fast.
 */
import { pointOnTrack } from './trackGeometry.js';

function trackLength(track) {
  return track.type === 'curved' ? (Math.PI / 2) * 0.25 : 0.5;
}

/**
 * Shortest distance along the track network from (fromTrackId, fromProgress)
 * to (toTrackId, toProgress), measured in world units along track
 * centerlines. Returns Infinity when unreachable within `maxDist`.
 */
export function distanceAlongTrack(trackManager, fromTrackId, fromProgress, toTrackId, toProgress, maxDist = 60) {
  if (fromTrackId === toTrackId) {
    return Math.abs(fromProgress - toProgress) * trackLength(trackManager.tracks.get(fromTrackId));
  }

  const dist = new Map(); // `${trackId}:0|1` -> best distance
  const queue = [];
  const push = (trackId, side, d) => {
    const key = `${trackId}:${side}`;
    if (d > maxDist) return;
    const prev = dist.get(key);
    if (prev === undefined || d < prev) {
      dist.set(key, d);
      queue.push({ trackId, side, d });
    }
  };

  // Seeds: both endpoints of the start track, via the start progress.
  const startLen = trackLength(trackManager.tracks.get(fromTrackId));
  push(fromTrackId, 0, fromProgress * startLen);
  push(fromTrackId, 1, (1 - fromProgress) * startLen);

  let best = Infinity;
  while (queue.length) {
    // Dijkstra — linear min-extraction is fine for tiny graphs.
    let bi = 0;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].d < queue[bi].d) bi = i;
    }
    const cur = queue.splice(bi, 1)[0];

    const track = trackManager.tracks.get(cur.trackId);
    if (!track) continue;

    if (cur.trackId === toTrackId) {
      const toSide = cur.side;
      const d = cur.d + Math.abs(toProgress - toSide) * trackLength(track);
      if (d < best) best = d;
      continue;
    }

    // Walk through this track to its other endpoint.
    const len = trackLength(track);
    const otherSide = cur.side === 0 ? 1 : 0;
    const otherD = cur.d + len;
    if (otherD <= maxDist) {
      // Cross to the neighbor connected at `otherSide`.
      const connId = otherSide === 0 ? track.connections.back : track.connections.front;
      if (connId) {
        const neighbor = trackManager.tracks.get(connId);
        if (neighbor) {
          const entrySide =
            neighbor.connections.front === track.id ? 1 : neighbor.connections.back === track.id ? 0 : -1;
          if (entrySide >= 0) push(connId, entrySide, otherD);
        }
      }
    }
  }

  return best;
}

/**
 * World position of a point (track, progress).
 */
export function trackPointWorld(trackManager, trackId, progress) {
  const track = trackManager.tracks.get(trackId);
  if (!track) return null;
  const local = pointOnTrack(track.type, progress);
  const cos = Math.cos(track.rotation);
  const sin = Math.sin(track.rotation);
  return {
    x: track.position.x + local.x * cos + local.z * sin,
    y: track.position.y,
    z: track.position.z + -local.x * sin + local.z * cos,
  };
}
