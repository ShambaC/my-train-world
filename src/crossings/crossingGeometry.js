import { pointOnTrack, tangentOnTrack } from '../tracks/trackGeometry.js';

export const CROSSING_CONTACT = Object.freeze({
  NONE: 'no contact',
  PERPENDICULAR: 'valid perpendicular contact',
  PARALLEL: 'invalid parallel contact',
  CURVED: 'invalid curved contact',
});

const DEFAULT_ROAD_HALF_WIDTH = 0.375;
const CONTACT_TOLERANCE = 0.08;
const GRADE_TOLERANCE = 0.35;
const TRACK_SAMPLES = 17;

const worldPointOnTrack = (track, progress) => {
  const local = pointOnTrack(track.type, progress);
  const cos = Math.cos(track.rotation || 0);
  const sin = Math.sin(track.rotation || 0);
  return {
    x: track.position.x + local.x * cos + local.z * sin,
    y: track.position.y + (local.y || 0),
    z: track.position.z - local.x * sin + local.z * cos,
  };
};

const worldTangentOnTrack = (track, progress) => {
  const local = tangentOnTrack(track.type, progress);
  const cos = Math.cos(track.rotation || 0);
  const sin = Math.sin(track.rotation || 0);
  return {
    x: local.x * cos + local.z * sin,
    z: -local.x * sin + local.z * cos,
  };
};

const roadHalfWidth = (segment) => {
  if (segment.halfWidth != null) return segment.halfWidth;
  if (segment.width != null) return segment.width / 2;
  if (segment.type === 'main') return 0.5;
  if (segment.type === 'branch') return DEFAULT_ROAD_HALF_WIDTH;
  return 0.275;
};

const nearestRoadPoint = (point, segment) => {
  const abx = segment.b.x - segment.a.x;
  const abz = segment.b.z - segment.a.z;
  const len2 = abx * abx + abz * abz;
  const u = len2 > 1e-8
    ? ((point.x - segment.a.x) * abx + (point.z - segment.a.z) * abz) / len2
    : 0;
  const t = Math.max(0, Math.min(1, u));
  const x = segment.a.x + abx * t;
  const z = segment.a.z + abz * t;
  return {
    distance: Math.hypot(point.x - x, point.z - z),
    progress: t,
    y: segment.a.y + (segment.b.y - segment.a.y) * t,
  };
};

const roadAxis = (segment) => {
  const x = segment.b.x - segment.a.x;
  const z = segment.b.z - segment.a.z;
  const length = Math.hypot(x, z) || 1;
  return { x: x / length, z: z / length };
};

/**
 * Classify one track against world-space road segments.
 * Track/road contact is evaluated at grade and uses actual road waypoints.
 */
export function classifyTrackRoadContact(track, roadSegments = []) {
  if (!track || !Array.isArray(roadSegments) || roadSegments.length === 0) {
    return { kind: CROSSING_CONTACT.NONE, contacts: [] };
  }

  const contacts = [];
  for (const segment of roadSegments) {
    if (!segment?.a || !segment?.b) continue;
    let best = null;
    for (let i = 0; i < TRACK_SAMPLES; i += 1) {
      const progress = i / (TRACK_SAMPLES - 1);
      const point = worldPointOnTrack(track, progress);
      const nearest = nearestRoadPoint(point, segment);
      if (nearest.distance > roadHalfWidth(segment) + CONTACT_TOLERANCE) continue;
      if (Math.abs(point.y - nearest.y) > GRADE_TOLERANCE) continue;
      if (!best || nearest.distance < best.distance) {
        best = { progress, point, ...nearest };
      }
    }
    if (!best) continue;

    if (track.type === 'curved') {
      contacts.push({ kind: CROSSING_CONTACT.CURVED, track, segment, ...best });
      continue;
    }

    const trackVector = worldTangentOnTrack(track, best.progress);
    const roadVector = roadAxis(segment);
    const alignment = Math.abs(trackVector.x * roadVector.x + trackVector.z * roadVector.z);
    const kind = alignment <= 0.35 ? CROSSING_CONTACT.PERPENDICULAR : CROSSING_CONTACT.PARALLEL;
    contacts.push({ kind, track, segment, alignment, ...best });
  }
  // Adjacent waypoint segments represent one road. Keep one nearest contact
  // per road so a single perpendicular crossing yields one gate pair.
  const unique = new Map();
  for (const contact of contacts) {
    const key = contact.segment.roadId ?? contact.segment;
    const previous = unique.get(key);
    if (!previous || contact.distance < previous.distance) unique.set(key, contact);
  }
  const groupedContacts = Array.from(unique.values());
  if (groupedContacts.some((contact) => contact.kind === CROSSING_CONTACT.CURVED)) {
    return { kind: CROSSING_CONTACT.CURVED, contacts: groupedContacts };
  }
  if (groupedContacts.some((contact) => contact.kind === CROSSING_CONTACT.PARALLEL)) {
    return { kind: CROSSING_CONTACT.PARALLEL, contacts: groupedContacts };
  }
  if (groupedContacts.length > 0) {
    return { kind: CROSSING_CONTACT.PERPENDICULAR, contacts: groupedContacts };
  }
  return { kind: CROSSING_CONTACT.NONE, contacts: [] };
}

export function isTrackRoadContactAllowed(track, roadSegments = []) {
  const result = classifyTrackRoadContact(track, roadSegments);
  return result.kind === CROSSING_CONTACT.NONE || result.kind === CROSSING_CONTACT.PERPENDICULAR;
}

export function getTrackRoadContact(track, roadSegments = []) {
  return classifyTrackRoadContact(track, roadSegments);
}
