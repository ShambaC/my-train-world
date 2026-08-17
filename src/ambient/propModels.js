/**
 * Procedural low-poly models for ambient activity — passengers and cargo
 * piles. Shared geometries/materials are cached once; each item gets a
 * lightweight THREE.Group composed of shared parts (like coach models).
 * No assets, no per-item material allocation beyond the small palette.
 */
import * as THREE from 'three';
import { makeAtlasMaterial } from '../utils/atlasTextures.js';

import { createPedestrian, getRandomPedestrianType } from './pedestrianModels.js';

// ── Shared geometries ──────────────────────────────────────────────────
const PERSON_LEG_GEO = new THREE.BoxGeometry(0.03, 0.1, 0.03);
const PERSON_TORSO_GEO = new THREE.BoxGeometry(0.1, 0.13, 0.06);
const PERSON_HEAD_GEO = new THREE.SphereGeometry(0.044, 8, 6);

const CRATE_GEO = new THREE.BoxGeometry(0.16, 0.14, 0.16);
const SACK_GEO = new THREE.SphereGeometry(0.075, 8, 6);
const COAL_GEO = new THREE.DodecahedronGeometry(0.055, 0);
const CONTAINER_GEO = new THREE.BoxGeometry(0.3, 0.2, 0.46);
const TANKER_GEO = new THREE.CylinderGeometry(0.06, 0.06, 0.26, 10);

// ── Shared materials ────────────────────────────────────────────────────
const SHIRT_COLORS = [0xb82828, 0x2270b6, 0x2e7d32, 0xd35400, 0x8e44ad, 0x5d6d7e];
const PANTS_COLORS = [0x2b2b2b, 0x34495e, 0x6b4629, 0x4a5568];
const SKIN_COLORS = [0xe0b18c, 0xc6885c, 0x8d5a3b, 0xf0d0b0];

const SHIRT_MATS = SHIRT_COLORS.map((c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
const PANTS_MATS = PANTS_COLORS.map((c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
const SKIN_MATS = SKIN_COLORS.map((c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
const HEAD_MAT = new THREE.MeshLambertMaterial({ color: 0x2b2b2b, flatShading: true }); // hat/cap
const CRATE_MAT = makeAtlasMaterial('crate', { color: 0x8a6a3f });
const SACK_MAT = makeAtlasMaterial('sack', { color: 0xc9a86a });
const COAL_MAT = makeAtlasMaterial('coal', { color: 0x2a2a2a });
const CONTAINER_MAT = makeAtlasMaterial('container', { color: 0xd65b20 });
const TANKER_MAT = makeAtlasMaterial('tanker', { color: 0xb9c2c9 });

const randOf = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Low-poly passenger figure matching reference sheet archetypes.
 * Height ~0.32 units.
 */
export function createPerson(variant) {
  return createPedestrian(variant || getRandomPedestrianType());
}

/**
 * Cargo pile by type: 'crate' | 'sack' | 'coal' | 'container' | 'tanker'.
 */
export function createCargo(type) {
  const g = new THREE.Group();
  if (type === 'crate') {
    const c = new THREE.Mesh(CRATE_GEO, CRATE_MAT);
    c.position.y = 0.07;
    g.add(c);
    const lid = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.024, 0.19),
      makeAtlasMaterial('crate_lid', { color: 0x6b4e2c })
    );
    lid.position.y = 0.152;
    g.add(lid);
  } else if (type === 'sack') {
    const s = new THREE.Mesh(SACK_GEO, SACK_MAT);
    s.scale.set(1, 0.85, 1);
    s.position.y = 0.065;
    g.add(s);
  } else if (type === 'coal') {
    for (let i = 0; i < 5; i++) {
      const piece = new THREE.Mesh(COAL_GEO, COAL_MAT);
      piece.position.set((Math.random() - 0.5) * 0.15, 0.035 + Math.random() * 0.09, (Math.random() - 0.5) * 0.15);
      piece.rotation.set(Math.random() * 3, Math.random() * 3, 0);
      piece.scale.setScalar(0.7 + Math.random() * 0.9);
      g.add(piece);
    }
  } else if (type === 'container') {
    const c = new THREE.Mesh(CONTAINER_GEO, CONTAINER_MAT);
    c.position.y = 0.1;
    g.add(c);
  } else if (type === 'tanker') {
    const t = new THREE.Mesh(TANKER_GEO, TANKER_MAT);
    t.rotation.x = Math.PI / 2;
    t.position.y = 0.13;
    g.add(t);
  }
  return g;
}

// Per-cargo-type ride offset (local to a coach): how high the cargo sits
// while riding. Passengers stand on the coach origin.
export const RIDE_OFFSET = {
  passenger: { y: 0.26, z: 0.05 },
  crate: { y: 0.38, z: 0.05 },
  sack: { y: 0.36, z: 0.05 },
  coal: { y: 0.16, z: 0.05 },
  container: { y: 0.23, z: 0.05 },
  tanker: { y: 0.36, z: 0.05 },
};

// Which cargo types are visible while riding: only open-top coaches
// (coal cart, container flatcar) show their load on deck. Passengers,
// crates and tankers ride inside enclosed coaches — boarding/leaving is
// visible on the platform, the ride itself is hidden.
export const RIDE_VISIBLE = {
  passenger: false,
  crate: false,
  sack: false,
  coal: true,
  container: true,
  tanker: false,
};
