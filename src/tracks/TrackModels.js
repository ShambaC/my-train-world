import * as THREE from 'three';
import { VOXEL, HALF, CURVE, pointOnTrack } from './trackGeometry.js';

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
  gravel: 0x808080,
  beam: 0x5a3d28,
  deck: 0x7c5a3c,
  brace: 0x4a3220,
  cap: 0x3a2618,
};

/**
 * Create a straight track piece (real model only — no ghost branch).
 */
export function createStraightTrack() {
  const group = new THREE.Group();

  // Gravel base
  const gravelGeo = new THREE.BoxGeometry(STRAIGHT_TRACK_WIDTH, RAIL_HEIGHT * 0.5, TRACK_LENGTH);
  const gravelMat = new THREE.MeshLambertMaterial({ color: COLORS.gravel, flatShading: true });
  const gravel = new THREE.Mesh(gravelGeo, gravelMat);
  gravel.position.y = RAIL_HEIGHT * 0.25;
  gravel.castShadow = true;
  gravel.receiveShadow = true;
  group.add(gravel);

  // Sleepers
  const sleeperGeo = new THREE.BoxGeometry(STRAIGHT_TRACK_WIDTH * 0.9, RAIL_HEIGHT * 0.6, RAIL_HEIGHT * 1.5);
  const sleeperMat = new THREE.MeshLambertMaterial({ color: COLORS.sleeper, flatShading: true });
  for (let z = -TRACK_LENGTH / 2 + 0.05; z <= TRACK_LENGTH / 2 - 0.05; z += SLEEPER_SPACING) {
    const sleeper = new THREE.Mesh(sleeperGeo, sleeperMat);
    sleeper.position.set(0, RAIL_HEIGHT * 0.5, z);
    sleeper.castShadow = true;
    sleeper.receiveShadow = true;
    group.add(sleeper);
  }

  // Rails
  const railGeo = new THREE.BoxGeometry(RAIL_HEIGHT * 0.8, RAIL_HEIGHT * 0.8, TRACK_LENGTH);
  const railMat = new THREE.MeshLambertMaterial({ color: COLORS.rail, flatShading: true });
  const rail1 = new THREE.Mesh(railGeo, railMat);
  rail1.position.set(-RAIL_OFFSET, RAIL_HEIGHT, 0);
  rail1.castShadow = true;
  rail1.receiveShadow = true;
  group.add(rail1);
  const rail2 = new THREE.Mesh(railGeo, railMat);
  rail2.position.set(RAIL_OFFSET, RAIL_HEIGHT, 0);
  rail2.castShadow = true;
  rail2.receiveShadow = true;
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
  const cx = CURVE.cx;  // 0.25
  const cz = CURVE.cz;  // 0.25
  const r  = CURVE.r;   // 0.25
  const segments = 8;
  const angleStep = (Math.PI / 2) / segments;

  // Gravel and sleepers along arc
  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI + i * angleStep; // 180° → 270°
    const x = cx + Math.cos(angle) * r;
    const z = cz + Math.sin(angle) * r;
    // Local Z (box depth) must align with tangent (sin θ, -cos θ)
    // rotation.y = φ maps local Z to (sin φ, cos φ) → φ = π - θ
    const rotY = Math.PI - angle;

    // Gravel segment
    const gravelGeo = new THREE.BoxGeometry(CURVED_TRACK_WIDTH * 0.9, RAIL_HEIGHT * 0.5, r * angleStep * 1.1);
    const gravelMat = new THREE.MeshLambertMaterial({ color: COLORS.gravel, flatShading: true });
    const gravel = new THREE.Mesh(gravelGeo, gravelMat);
    gravel.position.set(x, RAIL_HEIGHT * 0.25, z);
    gravel.rotation.y = rotY;
    gravel.castShadow = true;
    gravel.receiveShadow = true;
    group.add(gravel);

    // Sleepers - fewer, every 2 segments
    if (i % 2 === 0) {
      const sleeperGeo = new THREE.BoxGeometry(CURVED_TRACK_WIDTH * 0.9, RAIL_HEIGHT * 0.6, RAIL_HEIGHT * 1.5);
      const sleeperMat = new THREE.MeshLambertMaterial({ color: COLORS.sleeper, flatShading: true });
      const sleeper = new THREE.Mesh(sleeperGeo, sleeperMat);
      sleeper.position.set(x, RAIL_HEIGHT * 0.5, z);
      sleeper.rotation.y = rotY;
      sleeper.castShadow = true;
      sleeper.receiveShadow = true;
      group.add(sleeper);
    }
  }

  // Curved Rails — inner and outer arcs (shared gauge)
  const innerRadius = r - RAIL_OFFSET;
  const outerRadius = r + RAIL_OFFSET;

  const buildRailMesh = (radius) => {
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const angle = Math.PI + i * angleStep;
      points.push(new THREE.Vector3(
        cx + Math.cos(angle) * radius,
        RAIL_HEIGHT * 0.8,
        cz + Math.sin(angle) * radius,
      ));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, segments, RAIL_HEIGHT * 0.4, 4, false);
  };

  const railMat = new THREE.MeshLambertMaterial({ color: COLORS.rail, flatShading: true });

  const rail1 = new THREE.Mesh(buildRailMesh(innerRadius), railMat);
  rail1.castShadow = true;
  rail1.receiveShadow = true;
  group.add(rail1);

  const rail2 = new THREE.Mesh(buildRailMesh(outerRadius), railMat);
  rail2.castShadow = true;
  rail2.receiveShadow = true;
  group.add(rail2);

  return group;
}

/**
 * Create trestle bridges & support beams under elevated tracks.
 */
export function createSupportBeams(height, trackType = 'straight') {
  if (height <= 0.05) return null;

  const group = new THREE.Group();
  const pillarRadius = 0.04;
  const pillarHeight = height;

  const pillarMat = new THREE.MeshLambertMaterial({ color: COLORS.beam, flatShading: true });
  const deckMat   = new THREE.MeshLambertMaterial({ color: COLORS.deck, flatShading: true });
  const braceMat  = new THREE.MeshLambertMaterial({ color: COLORS.brace, flatShading: true });
  const capMat    = new THREE.MeshLambertMaterial({ color: COLORS.cap, flatShading: true });
  const pillarGeo = new THREE.CylinderGeometry(pillarRadius * 0.8, pillarRadius, pillarHeight, 6);

  if (trackType === 'straight') {
    // Deck beam
    const deckBeamGeo = new THREE.BoxGeometry(STRAIGHT_TRACK_WIDTH * 1.1, 0.08, TRACK_LENGTH);
    const deckBeam = new THREE.Mesh(deckBeamGeo, deckMat);
    deckBeam.position.set(0, -0.04, 0);
    deckBeam.castShadow = true;
    deckBeam.receiveShadow = true;
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
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(...pos);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      group.add(pillar);

      const capGeo = new THREE.BoxGeometry(pillarRadius * 3, 0.04, pillarRadius * 3);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(pos[0], -0.08, pos[2]);
      group.add(cap);
    });

    if (height > 0.8) {
      const braceLevels = Math.floor(height / 0.8);
      for (let l = 0; l < braceLevels; l++) {
        const yPos = -height + (l + 0.5) * (height / braceLevels);
        const horizBraceGeo = new THREE.BoxGeometry(offsetX * 2, 0.04, 0.04);
        const hBrace = new THREE.Mesh(horizBraceGeo, braceMat);
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

      const capGeo = new THREE.BoxGeometry(0.18, 0.08, 0.18);
      const cap = new THREE.Mesh(capGeo, deckMat);
      cap.position.set(cx, -0.04, cz);
      group.add(cap);

      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(cx, -pillarHeight / 2, cz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
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
