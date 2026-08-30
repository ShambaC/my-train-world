import * as THREE from 'three';
import { assignStyleTexture } from '../utils/atlasTextures.js';
const STYLE_BASE_COLORS = {
  asphalt: 0x5a6064,
  shoulder: 0x827969,
  road_dirt: 0x7d654c,
  rail: 0x596775,
  ballast: 0x81766c,
  deck: 0xb39b6c,
  edge: 0x9c9486,
  planks: 0x815d43,
  beam: 0x684b37,
  wood_deck: 0x8a6847,
  bark: 0x684c3c,
  rock: 0x967c68,
  warm_rock: 0xa58a70,
  cool_rock: 0x727a91,
  foliage: 0x78985f,
  leaf_dark: 0x4e735c,
  leaf_light: 0x89a968,
  bush: 0x6d8c5c,
  galvanized: 0x858e91,
  steel_beam: 0x858e91,
  lamp_post: 0x4f5a61,
  red_paint: 0xa94b43,
  green_sign: 0x668b6a,
  insulator: 0xbed5cf,
  'cream-plaster': 0xd9c7a7,
  cream_plaster: 0xd9c7a7,
};

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

function patchPainterlyShader(material, triplanar) {
  const previousOnBeforeCompile = material.onBeforeCompile;
  material.onBeforeCompile = (shader) => {
    previousOnBeforeCompile?.(shader);
    shader.fragmentShader = STYLE_PATCH + shader.fragmentShader;
    if (triplanar) {
      const texture = material.userData.styleTexture;
      shader.uniforms.styleTexture = { value: texture };
      material.userData.styleShader = shader;
      shader.uniforms.styleRepeat = { value: texture.repeat.clone() };
      shader.uniforms.styleOffset = { value: texture.offset.clone() };
      shader.vertexShader = `
        varying vec3 styleWorldPosition;
        varying vec3 styleWorldNormal;
      ` + shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        styleWorldPosition = worldPosition.xyz;
        styleWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`,
      );
      shader.fragmentShader = `
        uniform sampler2D styleTexture;
        uniform vec2 styleRepeat;
        uniform vec2 styleOffset;
        varying vec3 styleWorldPosition;
        varying vec3 styleWorldNormal;
      ` + shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 styleBlend = pow(abs(normalize(styleWorldNormal)), vec3(4.0));
        styleBlend /= max(styleBlend.x + styleBlend.y + styleBlend.z, 0.0001);
        vec2 styleUvX = styleOffset + fract(styleWorldPosition.yz * 0.42) * styleRepeat;
        vec2 styleUvY = styleOffset + fract(styleWorldPosition.xz * 0.42) * styleRepeat;
        vec2 styleUvZ = styleOffset + fract(styleWorldPosition.xy * 0.42) * styleRepeat;
        vec3 styleTriColor =
          texture2D(styleTexture, styleUvX).rgb * styleBlend.x +
          texture2D(styleTexture, styleUvY).rgb * styleBlend.y +
          texture2D(styleTexture, styleUvZ).rgb * styleBlend.z;
        diffuseColor.rgb *= mix(vec3(1.0), styleTriColor, 0.72);`,
      );
    }
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `#include <normal_fragment_begin>
      float styleVariation = styleNoise(vViewPosition.xz * 0.45) - 0.5;
      float styleTop = smoothstep(-0.15, 0.8, normal.y);
      vec3 styleTint = mix(vec3(0.91, 0.94, 1.0), vec3(1.08, 1.04, 0.92), styleTop);
      diffuseColor.rgb *= styleTint * (1.0 + styleVariation * 0.12);`,
    );
  };
}

export function makeStyleMaterial(name, opts = {}) {
  const material = new THREE.MeshStandardMaterial({
    color: opts.color ?? STYLE_BASE_COLORS[name] ?? 0xffffff,
    roughness: opts.roughness ?? 0.86,
    metalness: opts.metalness ?? 0.05,
    flatShading: opts.flatShading ?? false,
    ...(opts.side === undefined ? {} : { side: opts.side }),
    ...(opts.emissive === undefined ? {} : { emissive: opts.emissive }),
    ...(opts.emissiveIntensity === undefined ? {} : { emissiveIntensity: opts.emissiveIntensity }),
    vertexColors: opts.vertexColors ?? false,
  });
  assignStyleTexture(material, name, opts);
  if (opts.triplanar) {
    material.userData.styleTriplanar = true;
    material.userData.styleTexture = material.map;
    material.map = null;
  }
  patchPainterlyShader(material, Boolean(opts.triplanar));
  return material;
}

