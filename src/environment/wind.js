import * as THREE from 'three';

/**
 * Shared wind sway. One global clock drives every wind-aware material so
 * trees bend in sync. Uses onBeforeCompile vertex displacement, so it adds
 * a single sin/cos per vertex — cheap enough for instanced low-poly trees.
 */

export const windTime = { value: 0 };

export function advanceWind(delta) {
  windTime.value += delta;
}

/**
 * Add wind sway to a material. Idempotent (guarded via userData).
 * @param {THREE.Material} material
 * @param {{strength?: number, leaves?: boolean}} opts strength 0..2,
 *   leaves sways by height (trees), non-leaves sways gently (trunks).
 */
export function applyWindSway(material, { strength = 1, leaves = true } = {}) {
  if (!material || material.userData?.windApplied) return material;
  material.userData.windApplied = true;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windTime;
    shader.uniforms.uWindStrength = { value: strength };
    shader.vertexShader =
      'uniform float uWindTime;\nuniform float uWindStrength;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
          float windAmp = uWindStrength * ${leaves ? 0.045 : 0.014};
          float windH = ${leaves ? 'position.y' : '1.0'};
          float windPhase = position.x * 2.4 + position.z * 1.7 + uWindTime * 1.5;
          transformed.x += sin(windPhase) * windAmp * windH;
          transformed.z += cos(windPhase * 0.75 + 1.2) * windAmp * windH * 0.55;
        `
      );
  };
  material.needsUpdate = true;
  return material;
}
