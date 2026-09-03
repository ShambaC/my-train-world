/**
 * Crossing models — shared geometry + per-crossing gate/warning-light mesh.
 *
 * Each crossing gets a small group: two barrier arms (one per road side)
 * that swing from vertical (open) to horizontal (closed), plus two lamp
 * posts with alternating red lamps. All geometry is shared; only the lamp
 * materials are per-instance so each lamp can blink independently.
 */
import * as THREE from 'three';
import { makeAtlasMaterial } from '../utils/atlasTextures.js';

const POST_GEO = new THREE.CylinderGeometry(0.025, 0.035, 0.72, 6);
const LAMP_POST_GEO = new THREE.CylinderGeometry(0.02, 0.028, 1.05, 6);
const ARM_GEO = new THREE.BoxGeometry(0.055, 0.03, 0.65);
ARM_GEO.translate(0, 0, 0.325); // pivot at one end (road side)
const STRIPE_GEO = new THREE.BoxGeometry(0.06, 0.036, 0.16);
const LAMP_GEO = new THREE.SphereGeometry(0.035, 8, 8);
const HALO_GEO = new THREE.SphereGeometry(0.075, 8, 8);

const POST_MAT = makeAtlasMaterial('structural_beam', { color: 0x3a3a3a });
const LAMP_POST_MAT = makeAtlasMaterial('lamp_metal', { color: 0x2b2b2b });
const ARM_MAT = makeAtlasMaterial('crossing_red_metal', { color: 0xaa2e2e });
const STRIPE_MAT = new THREE.MeshLambertMaterial({ color: 0xe8e4da, flatShading: true });

const makeLamp = (color) => {
  const coreMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  coreMat.userData = { nightGlow: true, baseOpacity: 0.9 };
  const haloMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  haloMat.userData = { nightGlow: true, baseOpacity: 0.3 };
  const core = new THREE.Mesh(LAMP_GEO, coreMat);
  core.renderOrder = 2;
  const halo = new THREE.Mesh(HALO_GEO, haloMat);
  halo.renderOrder = 2;
  return { core, halo };
};

/**
 * Build a crossing group centered at the track/road intersection.
 * @param {number} roadWidth — road width at the crossing
 */
export function buildCrossingMesh(roadWidth = 0.75) {
  const group = new THREE.Group();
  const half = roadWidth / 2;
  const gateOffset = half + 0.12;

  const arms = [];
  const lamps = [];

  for (const side of [-1, 1]) {
    // One set per corner: offset along the road AND along the track, so the
    // two barricade sets sit diagonally — one on each side of road & track.
    const rx = side * 0.5;
    // Barrier post + arm
    const post = new THREE.Mesh(POST_GEO, POST_MAT);
    post.position.set(rx, 0.36, side * gateOffset);
    group.add(post);

    // Parent arm + stripe to pivot. Rotating stripe independently leaves it
    // behind while gate moves, producing broken-looking close animation.
    const gate = new THREE.Group();
    gate.position.set(rx, 0.6, side * gateOffset);
    gate.rotation.y = side > 0 ? Math.PI : 0;

    const arm = new THREE.Mesh(ARM_GEO, ARM_MAT);
    gate.add(arm);

    const stripe = new THREE.Mesh(STRIPE_GEO, STRIPE_MAT);
    stripe.position.z = 0.325;
    gate.add(stripe);
    group.add(gate);
    arms.push({ gate, arm, stripe, closed: 0 });

    // Warning lamp post with two red lamps, slightly outward.
    const lz = side * (half + 0.62);
    const lampPost = new THREE.Mesh(LAMP_POST_GEO, LAMP_POST_MAT);
    lampPost.position.set(rx, 0.525, lz);
    group.add(lampPost);
    const lampA = makeLamp(0xff3030);
    lampA.core.position.set(rx, 0.85, lz);
    lampA.halo.position.set(rx, 0.85, lz);
    group.add(lampA.core, lampA.halo);
    const lampB = makeLamp(0xff3030);
    lampB.core.position.set(rx, 0.72, lz);
    lampB.halo.position.set(rx, 0.72, lz);
    group.add(lampB.core, lampB.halo);
    lamps.push([lampA, lampB]);
  }

  group.userData = { arms, lamps };
  return group;
}
