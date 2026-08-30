/**
 * Style Materials Factory & Pool
 * Creates and pools MeshStandardMaterial instances with painterly shader enhancements:
 *  - Triplanar low-frequency surface mottling
 *  - Soft top/bottom directional form response
 *  - Vertex color multiplication with high roughness and low metalness
 *  - HDR emissive response for night bloom
 */
import * as THREE from 'three';
import { getStyleTexture } from '../utils/atlasTextures.js';
import { STYLE_PALETTE } from './stylePalette.js';

// Cache key: family|vertexColors|side|emissiveRole
const materialPool = new Map();

/**
 * Patch standard material shader with painterly diorama enhancements.
 */
function patchPainterlyShader(material, options = {}) {
  const mottleTex = getStyleTexture('mottle_a', { repeat: [2, 2] });
  const cavityTex = getStyleTexture('cavity_accumulation', { repeat: [1, 1] });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNightness = { value: 0 };
    shader.uniforms.uTopLightTint = { value: new THREE.Color(0xfff8ee) };
    shader.uniforms.uBottomShadeTint = { value: new THREE.Color(0x98a8bf) };

    if (mottleTex) {
      shader.uniforms.tMottle = { value: mottleTex };
    }
    if (cavityTex) {
      shader.uniforms.tCavity = { value: cavityTex };
    }

    // Vertex shader
    shader.vertexShader = `
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `
      #include <worldpos_vertex>
      vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      `
    );

    // Fragment shader
    shader.fragmentShader = `
      uniform float uNightness;
      uniform vec3 uTopLightTint;
      uniform vec3 uBottomShadeTint;
      varying vec3 vWorldPosition;
      varying vec3 vWorldNormal;
      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      
      // Soft vertical form lighting response
      float upFactor = clamp(vWorldNormal.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 formTint = mix(uBottomShadeTint, uTopLightTint, upFactor);
      diffuseColor.rgb *= mix(vec3(1.0), formTint, 0.15);
      `
    );

    material.userData.shader = shader;
  };
}

/**
 * Get or create a pooled style material.
 */
export function getStyleMaterial(family, opts = {}) {
  const key = [
    family,
    opts.vertexColors ? 'vc' : 'novc',
    opts.flatShading ? 'flat' : 'smooth',
    opts.side || 'front',
    opts.texture || 'none',
    opts.color || 'none',
  ].join('|');

  if (materialPool.has(key)) {
    return materialPool.get(key);
  }

  const baseOpts = {
    roughness: opts.roughness ?? 0.82,
    metalness: opts.metalness ?? 0.08,
    flatShading: opts.flatShading ?? false,
    vertexColors: opts.vertexColors ?? false,
    dithering: true,
  };

  if (opts.side === 'double') baseOpts.side = THREE.DoubleSide;

  let textureName = opts.texture;
  let defaultColor = 0xffffff;

  switch (family) {
    case 'meadow':
      textureName = textureName || 'meadow';
      defaultColor = STYLE_PALETTE.meadow.base;
      break;
    case 'forest_ground':
      textureName = textureName || 'forest_ground';
      defaultColor = STYLE_PALETTE.forest_ground.base;
      break;
    case 'soil':
      textureName = textureName || 'soil';
      defaultColor = STYLE_PALETTE.soil.base;
      break;
    case 'sand':
      textureName = textureName || 'shore_sand';
      defaultColor = STYLE_PALETTE.sand.base;
      break;
    case 'warm_rock':
      textureName = textureName || 'warm_rock';
      defaultColor = STYLE_PALETTE.warm_rock.base;
      break;
    case 'cool_rock':
      textureName = textureName || 'cool_rock';
      defaultColor = STYLE_PALETTE.cool_rock.base;
      break;
    case 'plaster':
      textureName = textureName || 'cream_plaster';
      defaultColor = STYLE_PALETTE.plaster_cream.base;
      break;
    case 'brick_stone':
      textureName = textureName || 'cool_masonry';
      defaultColor = STYLE_PALETTE.brick_stone.base;
      break;
    case 'roof_slate':
      textureName = textureName || 'slate_blue_roof';
      defaultColor = STYLE_PALETTE.roof_slate.base;
      break;
    case 'roof_teal':
      textureName = textureName || 'teal_roof';
      defaultColor = STYLE_PALETTE.roof_teal.base;
      break;
    case 'roof_terracotta':
      textureName = textureName || 'terracotta_roof';
      defaultColor = STYLE_PALETTE.roof_terracotta.base;
      break;
    case 'dark_timber':
      textureName = textureName || 'dark_timber';
      defaultColor = STYLE_PALETTE.dark_timber.base;
      break;
    case 'warm_timber':
      textureName = textureName || 'warm_timber';
      defaultColor = STYLE_PALETTE.warm_timber.base;
      break;
    case 'rail_steel':
      textureName = textureName || 'rail_steel';
      defaultColor = STYLE_PALETTE.rail_steel.base;
      baseOpts.roughness = 0.45;
      baseOpts.metalness = 0.65;
      break;
    case 'ballast':
      textureName = textureName || 'ballast';
      defaultColor = STYLE_PALETTE.ballast.base;
      break;
    case 'galvanized':
      textureName = textureName || 'galvanized_steel';
      defaultColor = STYLE_PALETTE.galvanized.base;
      baseOpts.roughness = 0.55;
      baseOpts.metalness = 0.4;
      break;
    case 'road_asphalt':
      textureName = textureName || 'asphalt';
      defaultColor = STYLE_PALETTE.road_asphalt.base;
      break;
    case 'paint_red':
      textureName = textureName || 'red_enamel';
      defaultColor = STYLE_PALETTE.paint_red.base;
      baseOpts.roughness = 0.4;
      baseOpts.metalness = 0.15;
      break;
    case 'paint_blue':
      textureName = textureName || 'blue_enamel';
      defaultColor = STYLE_PALETTE.paint_blue.base;
      baseOpts.roughness = 0.4;
      baseOpts.metalness = 0.15;
      break;
    case 'paint_green':
      textureName = textureName || 'green_enamel';
      defaultColor = STYLE_PALETTE.paint_green.base;
      baseOpts.roughness = 0.4;
      baseOpts.metalness = 0.15;
      break;
    case 'brass':
      textureName = textureName || 'rolling_brass';
      defaultColor = STYLE_PALETTE.brass.base;
      baseOpts.roughness = 0.35;
      baseOpts.metalness = 0.8;
      break;
    case 'dark_chassis':
      textureName = textureName || 'boiler_chassis_metal';
      defaultColor = STYLE_PALETTE.dark_chassis.base;
      baseOpts.roughness = 0.6;
      baseOpts.metalness = 0.35;
      break;
    case 'foliage':
      textureName = textureName || 'foliage_variation';
      defaultColor = STYLE_PALETTE.foliage_deciduous.mid;
      baseOpts.roughness = 0.9;
      break;
    case 'emissive_window':
      baseOpts.emissive = new THREE.Color(STYLE_PALETTE.window_warm.color);
      baseOpts.emissiveIntensity = STYLE_PALETTE.window_warm.intensity;
      defaultColor = 0xffe6b0;
      break;
    case 'emissive_lamp':
      baseOpts.emissive = new THREE.Color(STYLE_PALETTE.lamp_glow.color);
      baseOpts.emissiveIntensity = STYLE_PALETTE.lamp_glow.intensity;
      defaultColor = 0xfff0c4;
      break;
    default:
      break;
  }

  baseOpts.color = opts.color !== undefined ? opts.color : defaultColor;

  if (textureName) {
    const tex = getStyleTexture(textureName, { repeat: opts.repeat || [1, 1] });
    if (tex) {
      baseOpts.map = tex;
    }
  }

  const mat = new THREE.MeshStandardMaterial(baseOpts);
  patchPainterlyShader(mat, opts);

  materialPool.set(key, mat);
  return mat;
}
