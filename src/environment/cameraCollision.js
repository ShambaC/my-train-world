import { WATER_LEVEL, VOXEL_SIZE } from '../terrain.js';
import { pointOnTrack } from '../tracks/trackGeometry.js';
import { useFrame, useThree } from '@react-three/fiber';

const TERRAIN_CLEARANCE = 0.55;
const TRACK_CLEARANCE = 0.45;
const TRAIN_CLEARANCE = 0.25;
const TRACK_RADIUS = 0.42;
const TRAIN_RADIUS = 0.72;

function terrainFloorAt(x, z, terrainData) {
  const heightMap = terrainData?.heightMap;
  if (!heightMap) return -Infinity;

  const length = terrainData.length;
  const breadth = terrainData.breadth;
  const cx = Math.round(x / VOXEL_SIZE + length / 2 - 0.5);
  const cz = Math.round(z / VOXEL_SIZE + breadth / 2 - 0.5);
  if (cx < 0 || cx >= length || cz < 0 || cz >= breadth) return -Infinity;

  // Top of voxel column, or water surface where column is submerged.
  return Math.max((heightMap[cx][cz] + 0.5) * VOXEL_SIZE, WATER_LEVEL) + TERRAIN_CLEARANCE;
}

function trackFloorAt(x, z, tracks) {
  let floor = -Infinity;
  for (const track of tracks || []) {
    const dx = x - track.position.x;
    const dz = z - track.position.z;
    if (dx * dx + dz * dz > 0.9 * 0.9) continue;
    const cos = Math.cos(track.rotation);
    const sin = Math.sin(track.rotation);
    for (let i = 0; i <= 4; i++) {
      const local = pointOnTrack(track.type, i / 4);
      const wx = track.position.x + local.x * cos + local.z * sin;
      const wz = track.position.z - local.x * sin + local.z * cos;
      if (Math.hypot(x - wx, z - wz) > TRACK_RADIUS) continue;
      floor = Math.max(floor, track.position.y + (local.y || 0) + TRACK_CLEARANCE);
    }
  }
  return floor;
}

function consistFloorAt(x, z, trains) {
  let floor = -Infinity;
  for (const train of trains || []) {
    const parts = [train, ...(train.coaches || [])];
    for (const part of parts) {
      if (!part.position) continue;
      const dx = x - part.position.x;
      const dz = z - part.position.z;
      if (dx * dx + dz * dz > TRAIN_RADIUS * TRAIN_RADIUS) continue;
      // Train nodes sit 0.1 above their manager position; fixed envelope covers
      // engines, coaches, chimney and roof without requiring mesh raycasts.
      floor = Math.max(floor, part.position.y + 1.05 + TRAIN_CLEARANCE);
    }
  }
  return floor;
}

function floorAt(x, z, terrainData, tracks, trains) {
  return Math.max(
    terrainFloorAt(x, z, terrainData),
    trackFloorAt(x, z, tracks),
    consistFloorAt(x, z, trains),
  );
}

/**
 * Keep camera and its sight line above terrain, track, and consist geometry.
 * Sampling sight line catches hillside clipping between orbit target and camera.
 */
export function constrainCamera(camera, target, terrainData, trackManager, trainManager) {
  if (!camera) return false;

  // Follow mode constrains a desired Vector3; live collision constrains camera.
  const position = camera.position || camera;

  const tracks = trackManager?.getAllTracks?.() || [];
  const trains = trainManager?.getAllTrains?.() || [];
  const lookTarget = target || position;
  let requiredY = floorAt(position.x, position.z, terrainData, tracks, trains);

  const dx = lookTarget.x - position.x;
  const dy = lookTarget.y - position.y;
  const dz = lookTarget.z - position.z;
  const distance = Math.hypot(dx, dy, dz);
  const samples = Math.min(12, Math.max(2, Math.ceil(distance / 1.5)));
  for (let i = 1; i < samples; i++) {
    const t = i / samples;
    requiredY = Math.max(
      requiredY,
      floorAt(
        position.x + dx * t,
        position.z + dz * t,
        terrainData,
        tracks,
        trains,
      ),
    );
  }

  if (position.y >= requiredY) return false;
  position.y = requiredY;
  return true;
}

export default function CameraCollision({ terrainData, trackManager, trainManager, orbitRef }) {
  const { camera } = useThree();

  useFrame(() => {
    const controls = orbitRef?.current;
    constrainCamera(
      camera,
      controls?.target,
      terrainData,
      trackManager,
      trainManager,
    );
  });

  return null;
}
