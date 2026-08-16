import * as THREE from 'three';
import { VOXEL, HALF, CURVE, pointOnTrack } from './trackGeometry.js';
import { makeAtlasMaterial } from '../utils/atlasTextures.js';

const VOXEL_SIZE = VOXEL;
const STRAIGHT_TRACK_WIDTH = VOXEL;
const CURVED_TRACK_WIDTH = VOXEL;
const TRACK_LENGTH = VOXEL;
const RAIL_HEIGHT = 0.05;
const SLEEPER_SPACING = 0.15;

const RAIL_OFFSET = 0.15; // Shared gauge for straight AND curved tracks

const COLORS = {
  rail: 0x4a4a4a,
  sleeper: 0x8b4513,
  gravel: 0x6d6d6d, // darker ballast — reads as a dark edge against terrain
  beam: 0x5a3d28,
  deck: 0x55402c, // dark underside for bridges
  brace: 0x3a281a,
  cap: 0x3a2618,
};

// Moonlit rail highlight: a faint blue emissive keeps rails distinguishable
// from terrain at night without dynamic lights.
function createRailMaterial() {
  return makeAtlasMaterial('metal', 'rail', {
    color: COLORS.rail,
    emissive: 0x24365c,
    emissiveIntensity: 0.55,
  });
}

// ── Shared resources ──────────────────────────────────────────────────────
// Geometries and materials are cached per track type and reused by every
// track piece, so adding tracks never duplicates GPU buffers or shader
// programs. Bridge supports are cached per quantized height.

const RAIL_MAT = createRailMaterial();

let straightAssets = null;
function getStraightAssets() {
  if (straightAssets) return straightAssets;
  straightAssets = {
    gravelGeo: new THREE.BoxGeometry(STRAIGHT_TRACK_WIDTH, RAIL_HEIGHT * 0.5, TRACK_LENGTH),
    gravelMat: makeAtlasMaterial('roads', 'ballast', { color: COLORS.gravel, repeat: [0.33, 0.33] }),
    sleeperGeo: new THREE.BoxGeometry(STRAIGHT_TRACK_WIDTH * 0.9, RAIL_HEIGHT * 0.6, RAIL_HEIGHT * 1.5),
    sleeperMat: makeAtlasMaterial('wood', 'planks', { color: COLORS.sleeper, repeat: [1, 1] }),
    railGeo: new THREE.BoxGeometry(RAIL_HEIGHT * 0.8, RAIL_HEIGHT * 0.8, TRACK_LENGTH),
  };
  return straightAssets;
}

let curvedAssets = null;
function getCurvedAssets() {
  if (curvedAssets) return curvedAssets;
  const segments = 8;
  const angleStep = (Math.PI / 2) / segments;
  curvedAssets = {
    segments,
    angleStep,
    gravelGeo: new THREE.BoxGeometry(CURVED_TRACK_WIDTH * 0.9, RAIL_HEIGHT * 0.5, CURVE.r * angleStep * 1.1),
    gravelMat: makeAtlasMaterial('roads', 'ballast', { color: COLORS.gravel, repeat: [0.33, 0.33] }),
    sleeperGeo: new THREE.BoxGeometry(CURVED_TRACK_WIDTH * 0.9, RAIL_HEIGHT * 0.6, RAIL_HEIGHT * 1.5),
    sleeperMat: makeAtlasMaterial('wood', 'planks', { color: COLORS.sleeper, repeat: [1, 1] }),
    railGeos: (() => {
      const innerRadius = CURVE.r - RAIL_OFFSET;
      const outerRadius = CURVE.r + RAIL_OFFSET;
      const build = (radius) => {
        const points = [];
        for (let i = 0; i <= segments; i++) {
          const angle = Math.PI + i * angleStep;
          points.push(new THREE.Vector3(
            CURVE.cx + Math.cos(angle) * radius,
            RAIL_HEIGHT * 0.8,
            CURVE.cz + Math.sin(angle) * radius,
          ));
        }
        const curve = new THREE.CatmullRomCurve3(points);
        return new THREE.TubeGeometry(curve, segments, RAIL_HEIGHT * 0.4, 4, false);
      };
      return [build(innerRadius), build(outerRadius)];
    })(),
  };
  return curvedAssets;
}

// Bridge supports — geometry varies with height, so cache per quantized
// height step (0.125) instead of creating a new pillar per placement.
const pillarGeoCache = new Map();
function getPillarGeo(height) {
  const key = Math.max(0.125, Math.round(height * 8) / 8);
  let geo = pillarGeoCache.get(key);
  if (!geo) {
    geo = new THREE.CylinderGeometry(0.032, 0.04, key, 6);
    pillarGeoCache.set(key, geo);
  }
  return geo;
}

let bridgeAssets = null;
function getBridgeAssets() {
  if (bridgeAssets) return bridgeAssets;
  bridgeAssets = {
    pillarMat: makeAtlasMaterial('wood', 'beam', { color: COLORS.beam, repeat: [1, 0.5] }),
    deckMat: makeAtlasMaterial('wood', 'deck', { color: COLORS.deck, repeat: [1, 0.5] }),
    braceMat: makeAtlasMaterial('wood', 'beam', { color: COLORS.brace, repeat: [1, 1] }),
    capMat: makeAtlasMaterial('wood', 'beam', { color: COLORS.cap, repeat: [1, 1] }),
    deckGeo: new THREE.BoxGeometry(STRAIGHT_TRACK_WIDTH * 1.1, 0.08, TRACK_LENGTH),
    capGeo: new THREE.BoxGeometry(0.12, 0.04, 0.12),
    braceGeo: new THREE.BoxGeometry(STRAIGHT_TRACK_WIDTH * 0.7, 0.04, 0.04),
    curvedCapGeo: new THREE.BoxGeometry(0.18, 0.08, 0.18),
  };
  return bridgeAssets;
}

// Track pieces receive and cast realtime shadows (original behavior).
const TRACK_MESH = { castShadow: true, receiveShadow: true };
const BRIDGE_MESH = { castShadow: true, receiveShadow: true };

/**
 * Create a straight track piece (real model only — no ghost branch).
 */
export function createStraightTrack() {
  const group = new THREE.Group();
  const a = getStraightAssets();

  // Gravel base
  const gravel = new THREE.Mesh(a.gravelGeo, a.gravelMat);
  gravel.position.y = RAIL_HEIGHT * 0.25;
  Object.assign(gravel, TRACK_MESH);
  group.add(gravel);

  // Sleepers
  for (let z = -TRACK_LENGTH / 2 + 0.05; z <= TRACK_LENGTH / 2 - 0.05; z += SLEEPER_SPACING) {
    const sleeper = new THREE.Mesh(a.sleeperGeo, a.sleeperMat);
    sleeper.position.set(0, RAIL_HEIGHT * 0.5, z);
    Object.assign(sleeper, TRACK_MESH);
    group.add(sleeper);
  }

  // Rails
  const rail1 = new THREE.Mesh(a.railGeo, RAIL_MAT);
  rail1.position.set(-RAIL_OFFSET, RAIL_HEIGHT, 0);
  Object.assign(rail1, TRACK_MESH);
  group.add(rail1);
  const rail2 = new THREE.Mesh(a.railGeo, RAIL_MAT);
  rail2.position.set(RAIL_OFFSET, RAIL_HEIGHT, 0);
  Object.assign(rail2, TRACK_MESH);
  group.add(rail2);

  return group;
}

/**
 * Create a curved track piece — 90° arc connecting edge midpoints.
 * Arc center at (+0.25, +0.25), radius 0.25, sweep 180°→270°.
 * back (t=0) at (0.25, 0), front (t=1) at (0, 0.25).
 */
export function createCurvedTrack() {
  const group = new THREE.Group();
  const a = getCurvedAssets();
  const segments = a.segments;
  const angleStep = a.angleStep;

  // Gravel and sleepers along arc
  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI + i * angleStep; // 180° → 270°
    const x = CURVE.cx + Math.cos(angle) * CURVE.r;
    const z = CURVE.cz + Math.sin(angle) * CURVE.r;
    // Local Z (box depth) must align with tangent (sin θ, -cos θ)
    // rotation.y = φ maps local Z to (sin φ, cos φ) → φ = π - θ
    const rotY = Math.PI - angle;

    // Gravel segment
    const gravel = new THREE.Mesh(a.gravelGeo, a.gravelMat);
    gravel.position.set(x, RAIL_HEIGHT * 0.25, z);
    gravel.rotation.y = rotY;
    Object.assign(gravel, TRACK_MESH);
    group.add(gravel);

    // Sleepers - fewer, every 2 segments
    if (i % 2 === 0) {
      const sleeper = new THREE.Mesh(a.sleeperGeo, a.sleeperMat);
      sleeper.position.set(x, RAIL_HEIGHT * 0.5, z);
      sleeper.rotation.y = rotY;
      Object.assign(sleeper, TRACK_MESH);
      group.add(sleeper);
    }
  }

  // Curved Rails — inner and outer arcs (shared gauge)
  const rail1 = new THREE.Mesh(a.railGeos[0], RAIL_MAT);
  Object.assign(rail1, TRACK_MESH);
  group.add(rail1);

  const rail2 = new THREE.Mesh(a.railGeos[1], RAIL_MAT);
  Object.assign(rail2, TRACK_MESH);
  group.add(rail2);

  return group;
}

/**
 * Create trestle bridges & support beams under elevated tracks.
 * Support geometries are cached per quantized height.
 */
export function createSupportBeams(height, trackType = 'straight') {
  if (height <= 0.05) return null;

  const group = new THREE.Group();
  const b = getBridgeAssets();
  const pillarHeight = height;
  const pillarGeo = getPillarGeo(pillarHeight);

  if (trackType === 'straight') {
    // Deck beam
    const deckBeam = new THREE.Mesh(b.deckGeo, b.deckMat);
    deckBeam.position.set(0, -0.04, 0);
    Object.assign(deckBeam, BRIDGE_MESH);
    group.add(deckBeam);

    const offsetX = STRAIGHT_TRACK_WIDTH * 0.35;
    const offsetZ = TRACK_LENGTH * 0.35;

    const pillarPositions = [
      [-offsetX, -pillarHeight / 2, -offsetZ],
      [ offsetX, -pillarHeight / 2, -offsetZ],
      [-offsetX, -pillarHeight / 2,  offsetZ],
      [ offsetX, -pillarHeight / 2,  offsetZ],
    ];

    pillarPositions.forEach(pos => {
      const pillar = new THREE.Mesh(pillarGeo, b.pillarMat);
      pillar.position.set(...pos);
      Object.assign(pillar, BRIDGE_MESH);
      group.add(pillar);

      const cap = new THREE.Mesh(b.capGeo, b.capMat);
      cap.position.set(pos[0], -0.08, pos[2]);
      group.add(cap);
    });

    if (height > 0.8) {
      const braceLevels = Math.floor(height / 0.8);
      for (let l = 0; l < braceLevels; l++) {
        const yPos = -height + (l + 0.5) * (height / braceLevels);
        const hBrace = new THREE.Mesh(b.braceGeo, b.braceMat);
        hBrace.position.set(0, yPos, -offsetZ);
        group.add(hBrace);
        const hBrace2 = hBrace.clone();
        hBrace2.position.set(0, yPos, offsetZ);
        group.add(hBrace2);
      }
    }
  } else if (trackType === 'curved') {
    // Use shared arc geometry: cx=0.25, cz=0.25, r=0.25
    const segments = 4;
    const angleStep = (Math.PI / 2) / segments;

    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI + i * angleStep;
      const cx = CURVE.cx + Math.cos(angle) * CURVE.r;
      const cz = CURVE.cz + Math.sin(angle) * CURVE.r;

      const cap = new THREE.Mesh(b.curvedCapGeo, b.deckMat);
      cap.position.set(cx, -0.04, cz);
      group.add(cap);

      const pillar = new THREE.Mesh(pillarGeo, b.pillarMat);
      pillar.position.set(cx, -pillarHeight / 2, cz);
      Object.assign(pillar, BRIDGE_MESH);
      group.add(pillar);
    }
  }

  return group;
}

/**
 * Get track dimensions for collision detection
 */
export function getTrackDimensions(type) {
  if (type === 'straight') {
    return { width: STRAIGHT_TRACK_WIDTH, length: TRACK_LENGTH };
  } else if (type === 'curved') {
    return { width: 0.5, length: 0.5 };
  }
  return { width: 0, length: 0 };
}

export { VOXEL_SIZE, STRAIGHT_TRACK_WIDTH, CURVED_TRACK_WIDTH, RAIL_HEIGHT, TRACK_LENGTH };
