/**
 * Ghost utility — clone any object and override all materials for preview silhouettes.
 */
import * as THREE from 'three';

/**
 * Clone a 3D object and replace all mesh materials with a translucent overlay.
 * @param {THREE.Object3D} object — the source object to clone
 * @param {number} hex — ghost color (0x00ff00 green, 0xff0000 red)
 * @param {number} opacity — transparency level (0–1)
 * @returns {THREE.Group}
 */
export function makeGhost(object, hex = 0x00ff00, opacity = 0.55) {
  const clone = object.clone(true);
  const color = new THREE.Color(hex);
  // Make the ghost color lighter/less saturated for visibility
  const hsl = {};
  color.getHSL(hsl);
  color.setHSL(hsl.h, Math.min(hsl.s * 0.8, 1), Math.min(hsl.l + 0.2, 0.9));

  clone.traverse(c => {
    if (c.isMesh) {
      c.material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false, // keep ghosts bright under the effects pipeline
      });
      c.castShadow = false;
      c.receiveShadow = false;
    }
  });
  return clone;
}

export const GHOST_GREEN = 0x00ff00;
export const GHOST_RED   = 0xff0000;
