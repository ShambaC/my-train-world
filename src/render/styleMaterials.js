import * as THREE from 'three';
import { assignStyleTexture } from '../utils/atlasTextures.js';

const STYLE_PATCH = `
  float styleHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float styleNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = styleHash(i);
    float b = styleHash(i + vec2(1.0, 0.0));
    float c = styleHash(i + vec2(0.0, 1.0));
    float d = styleHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
`;

function patchPainterlyShader(material) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = STYLE_PATCH + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `#include <normal_fragment_begin>
      float styleVariation = styleNoise(vViewPosition.xz * 0.45) - 0.5;
      float styleTop = smoothstep(-0.15, 0.8, normal.y);
      vec3 styleTint = mix(vec3(0.86, 0.9, 1.0), vec3(1.08, 1.03, 0.9), styleTop);
      diffuseColor.rgb *= styleTint * (1.0 + styleVariation * 0.12);`,
    );
  };
}

export function makeStyleMaterial(name, opts = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 0.86,
    metalness: opts.metalness ?? 0.05,
    flatShading: opts.flatShading ?? false,
    ...(opts.side === undefined ? {} : { side: opts.side }),
    ...(opts.emissive === undefined ? {} : { emissive: opts.emissive }),
    ...(opts.emissiveIntensity === undefined ? {} : { emissiveIntensity: opts.emissiveIntensity }),
    vertexColors: opts.vertexColors ?? false,
  });
  assignStyleTexture(material, name, opts);
  patchPainterlyShader(material);
  return material;
}
