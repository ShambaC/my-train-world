/**
 * Station Builder — composes a fully decorated station group from start/end
 * marker cells. The group is rotated so local +Z follows the station axis.
 * Every piece carries pop-animation metadata for the wave reveal.
 */
import * as THREE from 'three';
import ModelLibrary from '../models/ModelLibrary';

export const STATION_WIDTH = 3; // voxels perpendicular to the track
export const STATION_WIDTH_WORLD = STATION_WIDTH * 0.5; // 1.5 units
export const PLATFORM_HEIGHT = 0.15; // very low base (was 0.5, then 0.25)
export const MIN_STATION_LENGTH = 8; // voxels
export const MAX_STATION_LENGTH = 40; // voxels

const VOXEL = 0.5;
const DECK_COLOR = 0x9a9a9a;
const EDGE_COLOR = 0x6f6f6f;

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
 * @returns {{station: object, group: THREE.Group}}
 */
export function buildStation({ startCell, endCell, dir, lengthCells, startHeight, terrainLength, terrainBreadth }) {
  const perp = { x: -dir.z, z: dir.x };

  // --- cells + rects ---
  const cells = [];
  for (let i = 0; i < lengthCells; i++) {
    for (let j = 0; j < STATION_WIDTH; j++) {
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
  const worldRect = {
    minX: (voxelRect.minX - 2 - terrainLength / 2 + 0.5) * VOXEL,
    maxX: (voxelRect.maxX + 2 - terrainLength / 2 + 0.5) * VOXEL,
    minZ: (voxelRect.minZ - 2 - terrainBreadth / 2 + 0.5) * VOXEL,
    maxZ: (voxelRect.maxZ + 2 - terrainBreadth / 2 + 0.5) * VOXEL,
  };

  const station = {
    startCell, endCell, dir, lengthCells, startHeight,
    terrainLength, terrainBreadth, voxelRect, worldRect,
    startWorld, groundY,
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
    station.pieces.push({ obj, fromY: y - 0.7, toY: y, delay });
    group.add(obj);
  };

  // --- platform deck (split into 1-voxel sections for the wave) ---
  const deckMat = new THREE.MeshLambertMaterial({ color: DECK_COLOR, flatShading: true });
  const deckGeo = new THREE.BoxGeometry(STATION_WIDTH_WORLD, PLATFORM_HEIGHT, VOXEL);
  for (let i = 0; i < lengthCells; i++) {
    const section = new THREE.Mesh(deckGeo, deckMat);
    section.castShadow = true;
    section.receiveShadow = true;
    addPiece(section, i * VOXEL + 0.25, 0, groundY + PLATFORM_HEIGHT / 2);
  }

  // --- edge trim along the platform sides ---
  const edgeMat = new THREE.MeshLambertMaterial({ color: EDGE_COLOR, flatShading: true });
  const edgeGeo = new THREE.BoxGeometry(0.1, 0.15, VOXEL);
  for (let i = 0; i < lengthCells; i++) {
    for (const ex of [-STATION_WIDTH_WORLD / 2, STATION_WIDTH_WORLD / 2]) {
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      addPiece(edge, i * VOXEL + 0.25, ex, platformTop + 0.03);
    }
  }

  // --- station building near the middle ---
  const building = ModelLibrary.getMesh('station-building');
  const buildingAxial = ((lengthCells - 1) * 0.5) * VOXEL + 0.25;
  addPiece(building, buildingAxial, 0, platformTop, 0.1);
  building.rotation.y = -Math.PI / 2; // face the track side

  // --- clocks flanking the building ---
  for (const side of [-1, 1]) {
    const clock = ModelLibrary.getMesh('station-clock');
    addPiece(clock, buildingAxial + side * 0.9, STATION_WIDTH_WORLD / 2 - 0.3, platformTop, 0.15);
    clock.rotation.y = Math.PI / 2;
  }

  // --- canopies at the far ends, clear of the building and the signals.
  // The model's own base is sunk 0.35 into the platform deck. ---
  const canopyCells = [];
  if (lengthCells >= 22) canopyCells.push(3, lengthCells - 4);
  else if (lengthCells >= 14) canopyCells.push(lengthCells - 4);
  for (const i of canopyCells) {
    const canopy = ModelLibrary.getMesh('platform-canopy');
    addPiece(canopy, i * VOXEL + 0.25, STATION_WIDTH_WORLD / 2 - 0.4, platformTop - 0.35, 0.05);
    canopy.rotation.y = Math.PI / 2;
  }

  // --- prop row (bench / lamp / bin cycle) — one block forward from the
  // building, and never directly under a canopy so support beams stay clear ---
  const propCycle = ['platform-bench', 'platform-gas-lamp', 'platform-litter-bin'];
  for (let i = 2; i < lengthCells - 2; i += 3) {
    if (canopyCells.some((c) => Math.abs(c - i) <= 1)) continue;
    const type = propCycle[Math.floor((i - 2) / 3) % propCycle.length];
    const prop = ModelLibrary.getMesh(type);
    const jitter = (Math.random() - 0.5) * 0.2;
    addPiece(prop, i * VOXEL + 0.25 + jitter, STATION_WIDTH_WORLD / 2 - 0.25, platformTop, 0.05);
    prop.rotation.y = Math.PI / 2 + (Math.random() - 0.5) * 0.3;
  }

  // --- goods shed on long stations ---
  if (lengthCells >= 20) {
    const shed = ModelLibrary.getMesh('goods-shed');
    addPiece(shed, (lengthCells - 1) * VOXEL + 0.25, STATION_WIDTH_WORLD / 2 - 0.35, platformTop, 0.2);
    shed.rotation.y = Math.PI / 2;
  }

  // --- mandatory signals at both ends, ON the platform edges, facing
  // INWARD toward the station ---
  const signalStart = ModelLibrary.getMesh('colour-light-signal');
  addPiece(signalStart, 0.25, STATION_WIDTH_WORLD / 2 - 0.35, platformTop, 0);
  signalStart.rotation.y = 0;

  const signalEnd = ModelLibrary.getMesh('colour-light-signal');
  addPiece(signalEnd, (lengthCells - 1) * VOXEL + 0.25, STATION_WIDTH_WORLD / 2 - 0.35, platformTop, 0.05);
  signalEnd.rotation.y = Math.PI;

  // Wave pops in distance-from-start order
  station.pieces.sort((a, b) => a.delay - b.delay);

  return { station, group };
}

export { easeOutBack };
