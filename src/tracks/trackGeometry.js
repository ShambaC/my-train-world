/**
 * Track Geometry — single source of truth for endpoints, arcs, and movement.
 * Used by TrackManager, TrainManager, and TrackModels.
 */

export const VOXEL = 0.5;
export const HALF = VOXEL / 2; // 0.25

// Straight: endpoints on local Z axis (Three.js Z-forward convention)
export const STRAIGHT = {
  back:  { x: 0, z: -HALF }, // progress t = 0
  front: { x: 0, z:  HALF }, // progress t = 1
};

// Curved: 90° arc connecting edge midpoints.
// Arc center at (+HALF, +HALF), radius HALF.
// back (t=0) at angle 270° → (HALF, 0) = right edge midpoint
// front(t=1) at angle 180° → (0, HALF) = top edge midpoint
export const CURVE = { cx: HALF, cz: HALF, r: HALF };

/**
 * Get the local-space point on a track at progress t (0 = back, 1 = front).
 * @param {'straight'|'curved'} type
 * @param {number} t — progress [0, 1]
 * @returns {{x: number, z: number}}
 */
export function pointOnTrack(type, t) {
  if (type === 'straight') {
    return { x: 0, z: (t - 0.5) * VOXEL };
  }
  // Curved: sweep from 270° (back) down to 180° (front)
  const theta = (3 * Math.PI / 2) - t * (Math.PI / 2);
  return {
    x: CURVE.cx + CURVE.r * Math.cos(theta),
    z: CURVE.cz + CURVE.r * Math.sin(theta),
  };
}

/**
 * Tangent direction at progress t (in local space, normalized).
 * Increasing t moves back→front.
 * @param {'straight'|'curved'} type
 * @param {number} t
 * @returns {{x: number, z: number}}
 */
export function tangentOnTrack(type, t) {
  if (type === 'straight') {
    // Tangent always points +Z (back→front)
    return { x: 0, z: 1 };
  }
  // Curved: derivative of (cx + r*cos θ, cz + r*sin θ) w.r.t t is
  //   d/dt = (-r*sin θ, r*cos θ) * dθ/dt  where dθ/dt = -π/2
  // So tangent = (r*sin(θ)*π/2, -r*cos(θ)*π/2), normalized = (sin θ, -cos θ)
  const theta = (3 * Math.PI / 2) - t * (Math.PI / 2);
  return { x: Math.sin(theta), z: -Math.cos(theta) };
}

/**
 * Transform a local {x, z} to world space given track position and rotation.
 * Uses the Three.js rotation.y convention:
 *   x' = x·cosθ + z·sinθ
 *   z' = -x·sinθ + z·cosθ
 */
export function localToWorld(local, position, rotationY) {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return {
    x: position.x + local.x * cos + local.z * sin,
    z: position.z + -local.x * sin + local.z * cos,
  };
}

/**
 * Get the world-space endpoint of a track.
 * @param {'straight'|'curved'} type
 * @param {'front'|'back'} end
 * @param {{x: number, z: number}} position — track position
 * @param {number} rotationY — track rotation in radians
 * @returns {{x: number, z: number}}
 */
export function getEndpoint(type, end, position, rotationY) {
  const local = type === 'straight' ? STRAIGHT[end] : (end === 'front' ? CURVE : CURVE);
  // For curved, both endpoints come from CURVE arc:
  //   back = pointOnTrack('curved', 0), front = pointOnTrack('curved', 1)
  const localPt = type === 'curved'
    ? pointOnTrack('curved', end === 'front' ? 1 : 0)
    : STRAIGHT[end];
  return localToWorld(localPt, position, rotationY);
}

/**
 * Get both endpoints of a track.
 */
export function getEndpoints(type, position, rotationY) {
  return {
    front: getEndpoint(type, 'front', position, rotationY),
    back: getEndpoint(type, 'back', position, rotationY),
  };
}
