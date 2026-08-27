/**
 * Station Builder — composes a fully decorated station group from start/end
 * marker cells. The group is rotated so local +Z follows the station axis.
 * Every piece carries pop-animation metadata for the wave reveal.
 */
import * as THREE from 'three';
import ModelLibrary from '../models/ModelLibrary';
import { PuffSystem } from '../environment/PuffSystem';
import { mulberry32 } from '../terrain.js';
import { makeAtlasMaterial } from '../utils/atlasTextures.js';

export const STATION_WIDTH = 3; // voxels perpendicular to the track
export const STATION_WIDTH_WORLD = STATION_WIDTH * 0.5; // 1.5 units
export const PLATFORM_HEIGHT = 0.15; // very low base (was 0.5, then 0.25)
export const MIN_STATION_LENGTH = 8; // voxels
export const MAX_STATION_LENGTH = 40; // voxels

const VOXEL = 0.5;
const DECK_COLOR = 0x9a9a9a;
const EDGE_COLOR = 0x929292; // brighter platform edges for readability
const PLATFORM_EDGE_WIDTH = 0.1;
const PLATFORM_DECK_WIDTH = STATION_WIDTH_WORLD - PLATFORM_EDGE_WIDTH;

const STATION_DECK_MAT = makeAtlasMaterial('deck', { repeat: [1, 0.33] });
const STATION_EDGE_MAT = makeAtlasMaterial('edge', { repeat: [0.5, 0.5] });
const STATION_DECK_GEO = new THREE.BoxGeometry(PLATFORM_DECK_WIDTH, PLATFORM_HEIGHT, VOXEL);
const STATION_EDGE_GEO = new THREE.BoxGeometry(PLATFORM_EDGE_WIDTH, 0.15, VOXEL);

// Shared practical-light materials (additive, toneMapped off — cheap glow
// that reads as a lit lamp/window without dynamic lights). Tagged nightGlow
// so StationRenderer fades them to near-zero in daylight.
const LAMP_GLOW_MAT = new THREE.MeshBasicMaterial({
  color: 0xffd9a0,
  transparent: true,
  opacity: 0.95,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});
LAMP_GLOW_MAT.userData = { nightGlow: true, baseOpacity: 0.95 };

const LAMP_HALO_MAT = new THREE.MeshBasicMaterial({
  color: 0xffb86a,
  transparent: true,
  opacity: 0.4,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});
LAMP_HALO_MAT.userData = { nightGlow: true, baseOpacity: 0.4 };

const WINDOW_GLOW_MAT = new THREE.MeshBasicMaterial({
  color: 0xffd9a0,
  transparent: true,
  opacity: 0.65,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
  toneMapped: false,
});
WINDOW_GLOW_MAT.userData = { nightGlow: true, baseOpacity: 0.65 };

const makeLampGlow = (radius = 0.05) => {
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(radius, 8, 8), LAMP_GLOW_MAT);
  core.renderOrder = 2;
  const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 2.1, 8, 8), LAMP_HALO_MAT);
  halo.renderOrder = 2;
  group.add(core, halo);
  return group;
};

const makeSignalLamp = (color) => {
  const group = new THREE.Group();
  const coreMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  coreMat.userData = { nightGlow: true, baseOpacity: 1.0 };
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 8, 8),
    coreMat
  );
  core.renderOrder = 2;
  const haloMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  haloMat.userData = { nightGlow: true, baseOpacity: 0.32 };
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 8, 8),
    haloMat
  );
  halo.renderOrder = 2;
  group.add(core, halo);
  return group;
};

function alignBuildingRotation(rotation) {
  const delta = Math.atan2(
    Math.sin(rotation + Math.PI / 2),
    Math.cos(rotation + Math.PI / 2),
  );
  return Math.abs(delta) <= Math.PI / 2 ? -Math.PI / 2 : Math.PI / 2;
}
function getRotatedPlanarBounds(bounds, rotation) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const result = {
    minX: Infinity,
    minZ: Infinity,
    maxX: -Infinity,
    maxZ: -Infinity,
  };
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const z of [bounds.min.z, bounds.max.z]) {
      const rx = x * cos + z * sin;
      const rz = -x * sin + z * cos;
      result.minX = Math.min(result.minX, rx);
      result.minZ = Math.min(result.minZ, rz);
      result.maxX = Math.max(result.maxX, rx);
      result.maxZ = Math.max(result.maxZ, rz);
    }
  }
  return result;
}
function fitModelToFootprint(object, modelKey, x, axial, rotation, lengthCells) {
  const bounds = getRotatedPlanarBounds(ModelLibrary.getEntry(modelKey).bounds, rotation);
  const inset = 0.12;
  const minX = -STATION_WIDTH_WORLD / 2 + inset;
  const maxX = STATION_WIDTH_WORLD / 2 - inset;
  const minZ = inset;
  const maxZ = lengthCells * VOXEL - inset;
  const spanX = Math.max(bounds.maxX - bounds.minX, 0.001);
  const spanZ = Math.max(bounds.maxZ - bounds.minZ, 0.001);
  const scale = Math.min(1, (maxX - minX) / spanX, (maxZ - minZ) / spanZ);
  object.scale.setScalar(scale);

  const scaledMinX = bounds.minX * scale;
  const scaledMaxX = bounds.maxX * scale;
  const scaledMinZ = bounds.minZ * scale;
  const scaledMaxZ = bounds.maxZ * scale;
  object.position.x = THREE.MathUtils.clamp(x, minX - scaledMinX, maxX - scaledMaxX);
  object.position.z = THREE.MathUtils.clamp(axial, minZ - scaledMinZ, maxZ - scaledMaxZ);
  return scale;
}

// Glow quads stuck to the four vertical sides of a building — reads as
// lit windows at night, stays subtle during the day.
const addWindowGlows = (building, modelKey = 'station-building') => {
  const bounds = ModelLibrary.getEntry(modelKey).bounds;
  const hx = (bounds.max.x - bounds.min.x) / 2;
  const hz = (bounds.max.z - bounds.min.z) / 2;
  const y = bounds.min.y + (bounds.max.y - bounds.min.y) * 0.62;
  const geo = new THREE.PlaneGeometry(0.13, 0.15);
  const sides = [
    [1, 0, Math.PI / 2],
    [-1, 0, Math.PI / 2],
    [0, 1, 0],
    [0, -1, 0],
  ];
  for (const [dx, dz, rotY] of sides) {
    const quad = new THREE.Mesh(geo, WINDOW_GLOW_MAT);
    quad.position.set(dx * hx * 0.62, y, dz * hz * 0.62);
    quad.rotation.y = rotY;
    quad.renderOrder = 2;
    building.add(quad);
  }
};

// Lamp post beside a bench: pole + lamp head + deferred-light source marker.
// One per bench, on platform edge opposite bench.
const addLampPost = (addPiece, axial, side, groundY) => {
  const post = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2b2b2b, flatShading: true });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.55, 6), poleMat);
  pole.position.y = 0.275;
  post.add(pole);
  const headMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a, flatShading: true });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), headMat);
  head.position.y = 0.58;
  post.add(head);
  const glow = makeLampGlow();
  glow.position.y = 0.58;
  post.add(glow);
  const source = new THREE.Object3D();
  source.position.y = 0.58;
  source.userData.stationLightSource = true;
  const target = new THREE.Object3D();
  target.position.set(0, -1, 0);
  source.userData.stationLightTarget = target;
  post.add(source, target);
  addPiece(post, axial, side, groundY, 0.05);
  return post;
};

const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * @param {object} p
 * @param {{x:number,z:number}} p.startCell
 * @param {{x:number,z:number}} p.endCell
 * @param {{x:number,z:number}} p.dir unit axis vector
 * @param {number} p.lengthCells
 * @param {number} p.startHeight voxel height of the flat ground
 * @param {number} p.terrainLength
 * @param {number} p.terrainBreadth
 * @param {number} [p.trackSide=1] side of station strip containing adjacent track
 * @param {number} [p.buildingRotation] local building yaw, relative to station group
 * @returns {{station: object, group: THREE.Group}}
 */
export function buildStation({ startCell, endCell, dir, lengthCells, startHeight, terrainLength, terrainBreadth, trackSide = 1, buildingRotation }) {
  const perp = { x: -dir.z, z: dir.x };

  // --- cells + rects ---
  const cells = [];
  for (let i = 0; i < lengthCells; i++) {
    for (let j = -1; j <= 1; j++) {
      cells.push({ x: startCell.x + dir.x * i + perp.x * j, z: startCell.z + dir.z * i + perp.z * j });
    }
  }
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const c of cells) {
    minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
    minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z);
  }
  const voxelRect = { minX, minZ, maxX, maxZ };

  const cellToWorld = (x, z) => ({
    x: (x - terrainLength / 2 + 0.5) * VOXEL,
    z: (z - terrainBreadth / 2 + 0.5) * VOXEL,
  });
  const startWorld = cellToWorld(startCell.x, startCell.z);
  const endWorld = cellToWorld(endCell.x, endCell.z);
  const groundY = startHeight * VOXEL + 0.25;
  const stationLengthWorld = lengthCells * VOXEL;
  const stationYaw = Math.atan2(dir.x, dir.z);
  const stationCos = Math.cos(stationYaw);
  const stationSin = Math.sin(stationYaw);
  const footprintCorners = [
    [-STATION_WIDTH_WORLD / 2, 0],
    [STATION_WIDTH_WORLD / 2, 0],
    [-STATION_WIDTH_WORLD / 2, stationLengthWorld],
    [STATION_WIDTH_WORLD / 2, stationLengthWorld],
  ].map(([x, z]) => ({
    x: startWorld.x + x * stationCos + z * stationSin,
    z: startWorld.z - x * stationSin + z * stationCos,
  }));
  const worldRect = {
    minX: Math.min(...footprintCorners.map((corner) => corner.x)),
    maxX: Math.max(...footprintCorners.map((corner) => corner.x)),
    minZ: Math.min(...footprintCorners.map((corner) => corner.z)),
    maxZ: Math.max(...footprintCorners.map((corner) => corner.z)),
  };

  const station = {
    startCell, endCell, dir, lengthCells, startHeight,
    terrainLength, terrainBreadth, voxelRect, worldRect,
    startWorld, groundY, trackSide, buildingRotation,
    centerWorld: {
      x: (startWorld.x + endWorld.x) / 2,
      y: groundY + PLATFORM_HEIGHT,
      z: (startWorld.z + endWorld.z) / 2,
    },
    animStart: null,
    pieces: [],
  };

  // --- build group (local +Z = station axis, local +X = perpendicular) ---
  const group = new THREE.Group();
  group.position.set(startWorld.x, 0, startWorld.z);
  group.rotation.y = Math.atan2(dir.x, dir.z);

  const platformTop = groundY + PLATFORM_HEIGHT;
  const waveSpeed = 0.1; // seconds per world unit along the axis

  const addPiece = (obj, axial, x, y, extraDelay = 0) => {
    obj.position.set(x, y, axial);
    const delay = (Math.max(0, axial) + 0.25) * waveSpeed + extraDelay;
    obj.userData.pop = { fromY: y - 0.7, toY: y, delay };
    const piece = { obj, fromY: y - 0.7, toY: y, delay, baseScale: obj.scale.x || 1 };
    station.pieces.push(piece);
    group.add(obj);
    return piece;
  };

  const addModelPiece = (modelKey, obj, axial, x, y, rotation, extraDelay = 0) => {
    const piece = addPiece(obj, axial, x, y, extraDelay);
    obj.rotation.y = rotation;
    piece.baseScale = fitModelToFootprint(obj, modelKey, x, axial, rotation, lengthCells);
  };

  // --- platform deck (split into 1-voxel sections for the wave) ---
  for (let i = 0; i < lengthCells; i++) {
    const section = new THREE.Mesh(STATION_DECK_GEO, STATION_DECK_MAT);
    section.castShadow = true;
    section.receiveShadow = true;
    addPiece(section, i * VOXEL + 0.25, 0, groundY + PLATFORM_HEIGHT / 2);
  }

  for (let i = 0; i < lengthCells; i++) {
    for (const ex of [
      -STATION_WIDTH_WORLD / 2 + PLATFORM_EDGE_WIDTH / 2,
      STATION_WIDTH_WORLD / 2 - PLATFORM_EDGE_WIDTH / 2,
    ]) {
      const edge = new THREE.Mesh(STATION_EDGE_GEO, STATION_EDGE_MAT);
      addPiece(edge, i * VOXEL + 0.25, ex, platformTop + 0.03);
    }
  }

  // --- station building near the middle ---
  const building = ModelLibrary.getMesh('station-building');
  const buildingAxial = ((lengthCells - 1) * 0.5) * VOXEL + 0.25;
  const alignedBuildingRotation = alignBuildingRotation(
    buildingRotation ?? (trackSide < 0 ? Math.PI / 2 : -Math.PI / 2),
  );
  addModelPiece('station-building', building, buildingAxial, 0, platformTop, alignedBuildingRotation, 0.1);
  station.buildingRotation = alignedBuildingRotation;
  addWindowGlows(building);

  // Chimney smoke puffs above the station building. Local coords: x = width
  // (centered), y = up, z = platform axis — the chimney sits on the building
  // roof, not at the platform end.
  const buildingBounds = ModelLibrary.getEntry('station-building').bounds;
  const chimney = new PuffSystem({
    position: [0, platformTop + buildingBounds.max.y * 0.9, buildingAxial + 0.69],
    count: 12,
    size: 0.07,
    rise: 0.3,
    life: 2.6,
  });
  group.add(chimney.mesh);
  station.smoke = chimney;

  // --- clocks flanking the building ---
  for (const side of [-1, 1]) {
    const clock = ModelLibrary.getMesh('station-clock');
    addModelPiece(
      'station-clock',
      clock,
      buildingAxial + side * 0.9,
      STATION_WIDTH_WORLD / 2 - 0.3,
      platformTop,
      Math.PI / 2,
      0.15,
    );
  }
  // --- canopies at the far ends, clear of the building and the signals.
  // The model's own base is sunk 0.35 into the platform deck. ---
  const canopyCells = [];
  if (lengthCells >= 22) canopyCells.push(3, lengthCells - 4);
  else if (lengthCells >= 14) canopyCells.push(lengthCells - 4);
  for (const i of canopyCells) {
    const canopy = ModelLibrary.getMesh('platform-canopy');
    addModelPiece(
      'platform-canopy',
      canopy,
      i * VOXEL + 0.25,
      STATION_WIDTH_WORLD / 2 - 0.4,
      platformTop - 0.35,
      Math.PI / 2,
      0.05,
    );
  }
  // --- prop row (bench / lamp / bin cycle) — one block forward from the
  // building, and never directly under a canopy so support beams stay clear.
  // Every bench gets a lamp post with a warm point light on the far edge.
  // Jitter is deterministic per marker cell so undo/redo and save/load
  // rebuild the identical station (no unseeded Math.random in world content).
  const propCycle = ['platform-bench', 'platform-gas-lamp', 'platform-litter-bin'];
  for (let i = 2; i < lengthCells - 2; i += 3) {
    if (canopyCells.some((c) => Math.abs(c - i) <= 1)) continue;
    const type = propCycle[Math.floor((i - 2) / 3) % propCycle.length];
    const prop = ModelLibrary.getMesh(type);
    const rng = mulberry32(((startCell.x * 73856093) ^ (startCell.z * 19349663) ^ (i * 83492791)) >>> 0);
    const jitter = (rng() - 0.5) * 0.2;
    const propRotation = Math.PI / 2 + (rng() - 0.5) * 0.3;
    addModelPiece(type, prop, i * VOXEL + 0.25 + jitter, STATION_WIDTH_WORLD / 2 - 0.25, platformTop, propRotation, 0.05);
    // Warm glow at the head of each gas lamp
    if (type === 'platform-gas-lamp') {
      const lampBounds = ModelLibrary.getEntry('platform-gas-lamp').bounds;
      const glow = makeLampGlow();
      glow.position.set(0, lampBounds.max.y * 0.82, 0);
      prop.add(glow);
    }

    // Lamp post with spotlight opposite every bench
    if (type === 'platform-bench') {
      addLampPost(addPiece, i * VOXEL + 0.25 + jitter, -STATION_WIDTH_WORLD / 2 + 0.2, groundY);
    }
  }

  // --- goods shed on long stations ---
  if (lengthCells >= 20) {
    const shed = ModelLibrary.getMesh('goods-shed');
    addModelPiece(
      'goods-shed',
      shed,
      (lengthCells - 1) * VOXEL + 0.25,
      STATION_WIDTH_WORLD / 2 - 0.35,
      platformTop,
      Math.PI / 2,
      0.2,
    );
    addWindowGlows(shed, 'goods-shed');
  }

  // --- mandatory signals at both ends, ON the platform edges, facing
  // INWARD toward the station ---
  const addSignalLamps = (signal) => {
    const sb = ModelLibrary.getEntry('colour-light-signal').bounds;
    const lampY = sb.max.y * 0.85;
    const red = makeSignalLamp(0xff4040);
    red.position.set(0, lampY, 0.03);
    const green = makeSignalLamp(0x40ff70);
    green.position.set(0, lampY - 0.05, 0.03);
    signal.add(red, green);
  };

  const signalStart = ModelLibrary.getMesh('colour-light-signal');
  addModelPiece(
    'colour-light-signal',
    signalStart,
    0.25,
    0,
    platformTop,
    0,
  );
  addSignalLamps(signalStart);

  const signalEnd = ModelLibrary.getMesh('colour-light-signal');
  addModelPiece(
    'colour-light-signal',
    signalEnd,
    (lengthCells - 1) * VOXEL + 0.25,
    0,
    platformTop,
    Math.PI,
    0.05,
  );
  addSignalLamps(signalEnd);

  // Fake contact shadow slab under the whole platform
  const patchGeo = new THREE.BoxGeometry(STATION_WIDTH_WORLD, 0.02, lengthCells * VOXEL);
  const patchMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
    toneMapped: false,
  });
  const patch = new THREE.Mesh(patchGeo, patchMat);
  patch.position.set(0, groundY + 0.006, (lengthCells - 1) * VOXEL * 0.5 + 0.25);
  patch.renderOrder = 1;
  group.add(patch);

  // Wave pops in distance-from-start order
  station.pieces.sort((a, b) => a.delay - b.delay);

  return { station, group };
}

export { easeOutBack };
