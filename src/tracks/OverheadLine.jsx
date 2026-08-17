/**
 * OverheadLine — procedural electrification gantries for the railway.
 *
 * Gate-shaped poles span across the track every 5 tracks along each
 * connected chain; chains shorter than 5 tracks get one gantry at each
 * end. Consecutive gantries are linked by overhead wires (two sagging
 * contact wires + one messenger) along the chain.
 *
 * Pure presentation: derives from the track graph, rebuilds whenever the
 * track list changes, and never stores user state.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { makeAtlasMaterial } from '../utils/atlasTextures.js';

const POLE_X = 0.55;        // posts stand ±0.55 across the track
const BEAM_Y = 1.55;        // top beam height above track level (tune here)
const CONTACT_Y = 1.42;     // contact wire attach height at the gantry
const CONTACT_SAG = 0.2;    // sag at mid-span
const MESSENGER_Y = 1.66;   // messenger wire height (just above the beam)
const CONTACT_X = 0.18;     // contact wires hang ±0.18 over the rails

const COLORS = {
  post: 0x2f3138,
  beam: 0x3a3d45,
  insulator: 0xd9d9d9,
  contact: 0x2e3138,
  messenger: 0x6a6f78,
};

// ── Shared cached resources (one set of buffers for every gantry) ────────
let gantryTemplate = null;

function getGantryTemplate() {
  if (gantryTemplate) return gantryTemplate;
  gantryTemplate = new THREE.Group();

  const postMat = makeAtlasMaterial('steel_beam', { color: COLORS.post });
  const beamMat = makeAtlasMaterial('steel_beam', { color: COLORS.beam });
  const insulatorMat = makeAtlasMaterial('insulator', { color: COLORS.insulator });

  const postGeo = new THREE.CylinderGeometry(0.035, 0.045, BEAM_Y, 6);
  for (const side of [-1, 1]) {
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(side * POLE_X, BEAM_Y / 2, 0);
    post.castShadow = true;
    gantryTemplate.add(post);
  }

  // Top beam across the tracks
  const beamGeo = new THREE.CylinderGeometry(0.032, 0.032, POLE_X * 2, 6);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.rotation.z = Math.PI / 2;
  beam.position.set(0, BEAM_Y, 0);
  beam.castShadow = true;
  gantryTemplate.add(beam);

  // Insulator stubs where the contact wires hang
  const stubGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.14, 6);
  for (const side of [-1, 1]) {
    const stub = new THREE.Mesh(stubGeo, insulatorMat);
    stub.position.set(side * CONTACT_X, BEAM_Y - 0.06, 0);
    gantryTemplate.add(stub);
  }

  return gantryTemplate;
}

// Wire tube geometries cached per quantized span length (per wire kind),
// built in LOCAL space along +X (0 → len) with the sag baked into Y, so a
// wire mesh is placed/rotated per span while sharing one buffer per length.
const wireGeoCache = new Map(); // key `${kind}:${lenKey}` -> TubeGeometry

function getWireGeo(length, sag, radius, kind) {
  const lenKey = Math.round(length * 4) / 4;
  const key = `${kind}:${lenKey}`;
  let geo = wireGeoCache.get(key);
  if (!geo) {
    const pts = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(lenKey / 2, -sag, 0),
      new THREE.Vector3(lenKey, 0, 0),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    geo = new THREE.TubeGeometry(curve, 10, radius, 5, false);
    wireGeoCache.set(key, geo);
  }
  return geo;
}

const contactMat = new THREE.MeshLambertMaterial({ color: COLORS.contact, flatShading: true });
const messengerMat = new THREE.MeshLambertMaterial({ color: COLORS.messenger, flatShading: true });

/** World-space offset of a local (x, z) point under a Y rotation. */
const rotOffset = (px, pz, rotation) => {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return { x: px * cos + pz * sin, z: -px * sin + pz * cos };
};

/**
 * Walk a chain (path or cycle) from startId over track connections,
 * following unvisited neighbors. Tracks connect at most two ends, so every
 * component decomposes into chains naturally.
 */
function walkChain(byId, visited, startId) {
  const chain = [];
  let prev = null;
  let cur = startId;
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    chain.push(cur);
    const t = byId.get(cur);
    const nexts = [t.connections?.front, t.connections?.back]
      .filter((n) => n && n !== prev && byId.has(n) && !visited.has(n));
    prev = cur;
    cur = nexts.length ? nexts[0] : null;
  }
  return chain;
}

function buildOverheadLine(tracks) {
  const byId = new Map(tracks.map((t) => [t.id, t]));
  if (byId.size === 0) return null;

  // Decompose the network into chains, preferring free ends as starts.
  const visited = new Set();
  const chains = [];
  for (const t of tracks) {
    const conns = [t.connections?.front, t.connections?.back].filter(Boolean);
    if (conns.length < 2 && !visited.has(t.id)) {
      const chain = walkChain(byId, visited, t.id);
      if (chain.length) chains.push(chain);
    }
  }
  for (const t of tracks) {
    if (!visited.has(t.id)) {
      const chain = walkChain(byId, visited, t.id);
      if (chain.length) chains.push(chain);
    }
  }

  // Gantry tracks per chain: at the chain start, then every 5th track;
  // chains shorter than 5 tracks get a gantry at each end instead.
  const group = new THREE.Group();
  const template = getGantryTemplate();

  for (const chain of chains) {
    const gantryIdx = [];
    if (chain.length < 5) {
      const endIdx = new Set([0, chain.length - 1]);
      for (const i of endIdx) gantryIdx.push(i);
    } else {
      for (let i = 0; i < chain.length; i += 5) gantryIdx.push(i);
    }

    const gantryPts = [];
    for (const i of gantryIdx) {
      const track = byId.get(chain[i]);
      const g = template.clone(true);
      g.position.set(track.position.x, track.position.y, track.position.z);
      g.rotation.y = track.rotation || 0;
      group.add(g);
      gantryPts.push({
        x: track.position.x,
        y: track.position.y,
        z: track.position.z,
        rotation: track.rotation || 0,
      });
    }

    // Wires between consecutive gantries along the chain. Wire geometry is
    // built along local +X; rotation.y maps local +X to world (cosθ, -sinθ),
    // so the yaw is atan2(-dz, dx) — otherwise wires point backward.
    for (let i = 0; i < gantryPts.length - 1; i++) {
      const a = gantryPts[i];
      const b = gantryPts[i + 1];
      const wireY = (a.y + b.y) / 2 + CONTACT_Y;
      for (const side of [-1, 1]) {
        const wa = rotOffset(side * CONTACT_X, 0, a.rotation);
        const wb = rotOffset(side * CONTACT_X, 0, b.rotation);
        const sx = a.x + wa.x;
        const sz = a.z + wa.z;
        const ex = b.x + wb.x;
        const ez = b.z + wb.z;
        const len = Math.hypot(ex - sx, ez - sz);
        if (len < 0.01) continue;
        const wire = new THREE.Mesh(getWireGeo(len, CONTACT_SAG, 0.018, 'contact'), contactMat);
        wire.position.set(sx, wireY, sz);
        wire.rotation.y = Math.atan2(-(ez - sz), ex - sx);
        group.add(wire);
      }
      const messengerY = (a.y + b.y) / 2 + MESSENGER_Y;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len >= 0.01) {
        const messenger = new THREE.Mesh(getWireGeo(len, 0.03, 0.012, 'messenger'), messengerMat);
        messenger.position.set(a.x, messengerY, a.z);
        messenger.rotation.y = Math.atan2(-(b.z - a.z), b.x - a.x);
        group.add(messenger);
      }
    }
  }

  return group;
}

/**
 * OverheadLine — renders gantries + wires for the given track list.
 * Rebuilds from scratch on every track list change; all geometries and
 * materials are shared module-level caches.
 */
export default function OverheadLine({ tracks }) {
  const group = useMemo(() => buildOverheadLine(tracks), [tracks]);
  if (!group) return null;
  return <primitive object={group} />;
}

// Exported for tests/dev inspection.
export { buildOverheadLine };
