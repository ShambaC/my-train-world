import * as THREE from 'three';
import {
  NOISE_GLSL,
  MAX_SHADOW_TAPS,
  BLADE_VERTEX_UNIFORMS,
  BLADE_VERTEX,
  SHADOW_VERTEX,
  BLADE_FRAGMENT_UNIFORMS,
  BLADE_DIFFUSE,
  BLADE_SHADOW_TRANSLUCENCY,
  FLOWER_WIND_UNIFORMS,
  FLOWER_WIND_VERTEX,
  FLOWER_UNIFORMS,
  FLOWER_DIFFUSE,
} from './grassShaders.js';

/** Half-width of the blade at normalized height t. Tapers to a point at the
 *  tip; the exponent gives the slightly concave silhouette. */
function bladeHalfWidth(t) {
  return 0.5 * Math.pow(1 - t, 1.2);
}

/**
 * Blade geometry — unit size (base width = 1, height = 1), flat in XY. The
 * instance matrix scales it to a real blade (≈0.06 × 0.2). A tapered strip
 * with `segments` rows: two vertices per row plus a single tip vertex.
 */
export function makeBladeGeometry(segments = 3) {
  const seg = Math.max(1, Math.round(segments));
  const positions = new Float32Array((seg * 2 + 1) * 3);
  for (let i = 0; i < seg; i++) {
    const t = i / seg;
    const w = bladeHalfWidth(t);
    positions[i * 6 + 0] = -w;
    positions[i * 6 + 1] = t;
    positions[i * 6 + 3] = w;
    positions[i * 6 + 4] = t;
  }
  positions[seg * 6 + 1] = 1; // tip, at x = 0

  const indices = [];
  for (let i = 0; i < seg - 1; i++) {
    const l = i * 2;
    const r = l + 1;
    const nl = l + 2;
    const nr = l + 3;
    indices.push(l, nl, r, r, nl, nr);
  }
  const lastL = (seg - 1) * 2;
  indices.push(lastL, seg * 2, lastL + 1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Blade material — a MeshLambertMaterial patched via onBeforeCompile:
 * bottom→top gradient, patchy lush/dry color drift, wind with a quadratic
 * height mask, fake +Y shading normal (no field shimmer), soft ring-sampled
 * shadow and backlit translucency. Receives scene shadows for free.
 */
export function makeBladeMaterial(u) {
  const mat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);

    // ── Vertex ───────────────────────────────────────────────────────────────
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      #define MAX_SHADOW_TAPS ${MAX_SHADOW_TAPS}
      ${NOISE_GLSL}
      ${BLADE_VERTEX_UNIFORMS}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      BLADE_VERTEX,
    );
    // One ring of shadow taps per blade instead of one sample per fragment.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      SHADOW_VERTEX,
    );
    // Same +Y lighting normal for every blade.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <defaultnormal_vertex>',
      `#include <defaultnormal_vertex>
      transformedNormal = normalize( mat3( viewMatrix ) * vec3( 0.0, 1.0, 0.0 ) );`,
    );

    // ── Fragment ─────────────────────────────────────────────────────────────
    shader.fragmentShader =
      `#define MAX_SHADOW_TAPS ${MAX_SHADOW_TAPS}\n` +
      BLADE_FRAGMENT_UNIFORMS +
      shader.fragmentShader;

    // Force the shading normal to +Y on BOTH faces (Lambert flips it on back
    // faces). Translucency keeps the true facing via vBladeN.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      `#include <normal_fragment_begin>
      normal = normalize( mat3( viewMatrix ) * vec3( 0.0, 1.0, 0.0 ) );`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      'vec4 diffuseColor = vec4( diffuse, opacity );',
      BLADE_DIFFUSE,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      BLADE_SHADOW_TRANSLUCENCY,
    );
  };

  return mat;
}

function bindUniforms(shader, tex, u) {
  Object.assign(shader.uniforms, tex, u);
}

/**
 * Flower visible material — Lambert + alpha-mask cut-out + palette lookup.
 * The petal shape is discarded, not blended, so flowers depth-sort against
 * the blades without a transparent pass.
 */
export function makeFlowerMaterial(tex, u) {
  const mat = new THREE.MeshLambertMaterial({
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
  });

  mat.onBeforeCompile = (shader) => {
    bindUniforms(shader, tex, u);

    shader.vertexShader =
      FLOWER_WIND_UNIFORMS +
      shader.vertexShader.replace('#include <begin_vertex>', FLOWER_WIND_VERTEX);

    shader.fragmentShader =
      FLOWER_UNIFORMS + shader.fragmentShader.replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        FLOWER_DIFFUSE,
      );
  };

  return mat;
}

/**
 * Flower depth material — what the shadow map sees. Three's depth pass knows
 * nothing about the alpha mask or the wind, so this repeats both: the same
 * discard (or every flower casts the shadow of a solid rectangle) and the
 * same wind (or the shadow stands still while the flower sways). Assigned to
 * InstancedMesh.customDepthMaterial.
 */
export function makeFlowerDepthMaterial(tex, u) {
  const mat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    side: THREE.DoubleSide,
  });

  mat.onBeforeCompile = (shader) => {
    bindUniforms(shader, tex, u);

    shader.vertexShader =
      FLOWER_WIND_UNIFORMS +
      shader.vertexShader.replace('#include <begin_vertex>', FLOWER_WIND_VERTEX);

    shader.fragmentShader =
      `varying vec2 vFlUv;\nuniform sampler2D uFlowerMask;\n` +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>
      if ( texture2D( uFlowerMask, vFlUv ).r < 0.5 ) discard;`,
    );
  };

  return mat;
}
