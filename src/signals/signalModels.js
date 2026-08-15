/**
 * Signal models — shared lamp materials + per-signal mesh assembly.
 *
 * Signals reuse the `colour-light-signal` GLB for the mast and add
 * emissive lamp spheres per aspect. Lamp materials are created per signal
 * so each signal can light its own lamps independently (shared geometry).
 */
import * as THREE from 'three';
import ModelLibrary from '../models/ModelLibrary.js';

const LAMP_COLORS = {
  red: 0xff4040,
  yellow: 0xffc040,
  green: 0x40ff70,
};

export const SIGNAL_TYPES = ['two', 'three', 'junction', 'platform'];

/** Aspect lamp set per signal type: lamp keys bottom→top. */
export const SIGNAL_ASPECTS = {
  two: ['red', 'green'],
  three: ['red', 'yellow', 'green'],
  junction: ['yellow'],
  platform: ['red', 'green'],
};

const LAMP_GEO = new THREE.SphereGeometry(0.035, 8, 8);
const HALO_GEO = new THREE.SphereGeometry(0.075, 8, 8);

/**
 * Build a signal group (GLB mast + aspect lamps).
 * Lamp meshes carry userData.signalLamp = { key, lit:false, mats:[core, halo] }.
 */
export function buildSignalMesh(type) {
  const group = new THREE.Group();
  const mast = ModelLibrary.getMesh('colour-light-signal');
  group.add(mast);

  const bounds = ModelLibrary.getEntry('colour-light-signal').bounds;
  const lampY = bounds.max.y * 0.85;
  const step = 0.055;

  const aspects = SIGNAL_ASPECTS[type] || SIGNAL_ASPECTS.two;
  const lamps = [];
  aspects.forEach((key, i) => {
    const color = LAMP_COLORS[key];
    const coreMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    coreMat.userData = { nightGlow: true, baseOpacity: 1 };
    const haloMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    haloMat.userData = { nightGlow: true, baseOpacity: 0.38 };

    const core = new THREE.Mesh(LAMP_GEO, coreMat);
    core.position.set(0, lampY - i * step, 0.045);
    core.renderOrder = 2;
    const halo = new THREE.Mesh(HALO_GEO, haloMat);
    halo.position.copy(core.position);
    halo.renderOrder = 2;
    group.add(core, halo);

    lamps.push({ key, lit: false, core, halo });
  });

  group.userData.signalLamps = lamps;
  return group;
}
