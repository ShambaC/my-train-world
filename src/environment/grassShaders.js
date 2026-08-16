// GLSL for the stylized grass field, ported from cortiz2894/stylized-components
// grassField (blade + flower shaders, dirt/rocks/debug stripped).
//
// Blades are instanced 7-vertex strips (y = 0 base, y = 1 tip) rendered as
// MeshLambertMaterial patched via onBeforeCompile: gradient coloring, patchy
// lush/dry noise, wind with a quadratic height mask, backlit translucency and a
// soft ring-sampled shadow. Flowers are instanced cross-billboards with an
// alpha-mask cut-out, palette lookup and wind — see grassMaterials.js.

// Value noise (hash/noise/fbm) — shared by the blade patch noise.
export const NOISE_GLSL = /* glsl */ `
  float _gmHash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  float _gmNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(_gmHash(i),                  _gmHash(i + vec2(1.0, 0.0)), u.x),
      mix(_gmHash(i + vec2(0.0, 1.0)), _gmHash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float _gmFbm(vec2 p) {
    float v = 0.0, a = 0.5, n = 0.0;
    for (int i = 0; i < 4; i++) {
      v += a * _gmNoise(p);
      n += a;
      p = p * 2.03 + vec2(3.1, 7.7);
      a *= 0.5;
    }
    return v / max(n, 0.001);
  }
`;

export const MAX_SHADOW_TAPS = 4;

// ── Blade ────────────────────────────────────────────────────────────────────

// Vertex stage: injected after `#include <common>`.
export const BLADE_VERTEX_UNIFORMS = /* glsl */ `
  uniform float uTime;
  uniform float uWindStrength;
  uniform float uWindSpeed;
  uniform float uWindFreq;
  uniform float uWindTurb;
  uniform float uWindLean;
  uniform vec2  uWindDir;
  uniform float uWindFixLocal;

  uniform float uPatchScale;

  uniform float uShadowSampleY;  // height up the blade the shadow kernel sits at
  uniform float uShadowRadius;   // world-space radius of the soft-shadow kernel

  varying float vBH;        // blade height [0 = base, 1 = tip]
  varying vec3  vWorldPos;
  varying vec3  vBladeN;    // true facing direction (lighting uses fake +Y)
  varying float vPatch;     // large-scale lush/dry noise at the blade base

  #ifdef USE_SHADOWMAP
    varying vec4 vGrassShCoord[ MAX_SHADOW_TAPS ];
  #endif
`;

// Replaces `#include <begin_vertex>` in the blade material.
export const BLADE_VERTEX = /* glsl */ `
  #include <begin_vertex>

  // Blade base in world space = the instance matrix's translation column.
  vec2 baseXZ = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xz;
  vPatch = _gmFbm(baseXZ * uPatchScale);

  vBH = position.y;
  float hMask = vBH * vBH;

  vec3 wPos = (instanceMatrix * vec4(position, 1.0)).xyz;
  vWorldPos = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;

  float primary = sin(dot(wPos.xz, uWindDir) * uWindFreq + uTime * uWindSpeed);
  float second  = sin(dot(wPos.xz, uWindDir) * uWindFreq * 2.6 + uTime * uWindSpeed * 1.8 + 1.3) * 0.35;
  vec2  perp    = vec2(-uWindDir.y, uWindDir.x);
  float turb    = sin(dot(wPos.xz, perp) * uWindFreq * 1.9 + uTime * uWindSpeed * 0.7 + 2.6) * uWindTurb;
  float swing   = (primary + second + turb) * uWindStrength * hMask;
  float lean    = uWindLean * hMask;

  // Wind is a world-space vector but transformed is in blade-local space, and
  // every blade has a random Y rotation — invert the instance rotation so all
  // blades lean together instead of fanning out.
  mat3 instRot = mat3(
    normalize(vec3(instanceMatrix[0])),
    normalize(vec3(instanceMatrix[1])),
    normalize(vec3(instanceMatrix[2]))
  );
  vec3 windWrong = vec3(uWindDir.x, 0.0, uWindDir.y);
  vec3 windRight = transpose(instRot) * windWrong;
  vec3 windLocal = mix(windWrong, windRight, uWindFixLocal);
  transformed += windLocal * (swing + lean);

  // instRot carries rotation only, so it is safe on a normal without an
  // inverse-transpose.
  vBladeN = normalize(mat3(modelMatrix) * instRot * normal);
`;

// Replaces `#include <worldpos_vertex>` — disables Lambert's single-sample
// shadow and builds a fixed-size ring of shadow coordinates around the blade,
// averaged in the fragment for a soft penumbra (no hard shadow lines across
// the field, no per-fragment flicker).
export const SHADOW_VERTEX = /* glsl */ `
  // Neutralise Lambert's built-in shadow: the coordinate it derives from this
  // lands outside the frustum → getShadow() → 1.0 (unshadowed).
  #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )
    vec4 worldPosition = vec4( 1e6, 1e6, 1e6, 1.0 );
  #endif

  #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    vec3 _shBase = ( modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ) ).xyz;
    vec3 _shTip  = ( modelMatrix * instanceMatrix * vec4( 0.0, 1.0, 0.0, 1.0 ) ).xyz;
    vec3 _shCenter = mix( _shBase, _shTip, uShadowSampleY );

    // Per-blade rotation of the ring, so the kernels don't line up into a
    // visible pattern across the field.
    float _rot = fract( sin( dot( _shBase.xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) * 6.2831853;

    for ( int _k = 0; _k < MAX_SHADOW_TAPS; _k++ ) {
      float _a   = _rot + 6.2831853 * ( float( _k ) + 0.5 ) / float( MAX_SHADOW_TAPS );
      vec2  _off = vec2( cos( _a ), sin( _a ) ) * uShadowRadius;
      vGrassShCoord[ _k ] = directionalShadowMatrix[ 0 ] * vec4( _shCenter + vec3( _off.x, 0.0, _off.y ), 1.0 );
    }
  #endif
`;

// Fragment stage declarations, prepended to the Lambert fragment shader.
export const BLADE_FRAGMENT_UNIFORMS = /* glsl */ `
  varying float vBH;
  varying vec3  vWorldPos;
  varying vec3  vBladeN;
  varying float vPatch;

  uniform vec3  uGrassBottom;
  uniform vec3  uGrassTop;
  uniform float uBrightness;
  uniform float uGradStart;
  uniform float uGradEnd;
  uniform float uGradPower;
  uniform vec3  uPatchLush;
  uniform vec3  uPatchDry;
  uniform float uPatchStrength;
  uniform float uPatchBias;
  uniform int   uShadowSamples;
  uniform float uShadowStrength;
  uniform vec3  uSunDir;
  uniform vec3  uSunColor;
  uniform vec3  uTransColor;
  uniform float uTransStrength;
  uniform float uTransPower;
  uniform float uTransTip;
  uniform float uTransShadow;
  #ifdef USE_SHADOWMAP
    varying vec4 vGrassShCoord[ MAX_SHADOW_TAPS ];
  #endif
`;

// Replaces `vec4 diffuseColor = vec4( diffuse, opacity );` in the blade
// fragment: bottom→top gradient + patchy lush/dry drift.
export const BLADE_DIFFUSE = /* glsl */ `
  float _gT = clamp( ( vBH - uGradStart ) / max( uGradEnd - uGradStart, 0.001 ), 0.0, 1.0 );
  _gT = pow( _gT, uGradPower );
  vec3 _bladeCol = mix( uGrassBottom, uGrassTop, _gT );

  float _pt = pow( clamp( vPatch, 0.0, 1.0 ), uPatchBias );
  _bladeCol = mix( _bladeCol, mix( uPatchLush, uPatchDry, _pt ), uPatchStrength );

  vec4 diffuseColor = vec4( _bladeCol * uBrightness, opacity );
`;

// Replaces `#include <opaque_fragment>`: soft ring-sampled shadow + additive
// backlit translucency, gated by the shadow so the glow never leaks into shade.
export const BLADE_SHADOW_TRANSLUCENCY = /* glsl */ `
  #include <opaque_fragment>
  {
    float _shadow = 1.0;
    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
      DirectionalLightShadow _dls = directionalLightShadows[ 0 ];
      // Unrolled taps: D3D can't dynamically index an input varying array,
      // and MAX_SHADOW_TAPS is a compile-time constant anyway.
      float _sSum = 0.0;
      int   _sN   = 0;
      if ( uShadowSamples >= 1 ) {
        _sSum += getShadow( directionalShadowMap[ 0 ], _dls.shadowMapSize, _dls.shadowIntensity, _dls.shadowBias, _dls.shadowRadius, vGrassShCoord[ 0 ] );
        _sN++;
      }
      if ( uShadowSamples >= 2 ) {
        _sSum += getShadow( directionalShadowMap[ 0 ], _dls.shadowMapSize, _dls.shadowIntensity, _dls.shadowBias, _dls.shadowRadius, vGrassShCoord[ 1 ] );
        _sN++;
      }
      if ( uShadowSamples >= 3 ) {
        _sSum += getShadow( directionalShadowMap[ 0 ], _dls.shadowMapSize, _dls.shadowIntensity, _dls.shadowBias, _dls.shadowRadius, vGrassShCoord[ 2 ] );
        _sN++;
      }
      if ( uShadowSamples >= 4 ) {
        _sSum += getShadow( directionalShadowMap[ 0 ], _dls.shadowMapSize, _dls.shadowIntensity, _dls.shadowBias, _dls.shadowRadius, vGrassShCoord[ 3 ] );
        _sN++;
      }
      _shadow = _sSum / float( max( _sN, 1 ) );
    #endif

    gl_FragColor.rgb *= ( 1.0 - uShadowStrength * ( 1.0 - _shadow ) );

    vec3  _L    = normalize( uSunDir );
    vec3  _V    = normalize( cameraPosition - vWorldPos );
    float _back = pow( max( dot( _V, -_L ), 0.0 ), uTransPower );
    float _thin = mix( 1.0, vBH, uTransTip );
    float _edge = 1.0 - abs( dot( normalize( vBladeN ), _L ) );
    float _sh   = mix( 1.0, _shadow, uTransShadow );

    vec3 _trans = uTransColor * uSunColor * uTransStrength
                * _back * _thin * _edge * _sh;

    gl_FragColor.rgb += _trans;
  }
`;

// ── Flower ──────────────────────────────────────────────────────────────────

// The wind snippet is shared by the visible material and the depth material
// (shadow pass) so a swaying flower's shadow sways with it.

export const FLOWER_WIND_UNIFORMS = /* glsl */ `
  uniform float uTime;
  uniform float uWindStrength;
  uniform float uWindSpeed;
  uniform float uWindFreq;
  uniform float uWindTurb;
  uniform float uWindLean;
  uniform vec2  uWindDir;
  uniform float uBendAmp;
  uniform float uBendFreq;
  varying vec2  vFlUv;
`;

// Replaces `#include <begin_vertex>` in the flower materials.
export const FLOWER_WIND_VERTEX = /* glsl */ `
  #include <begin_vertex>
  vFlUv = uv;

  float _flH = transformed.y * transformed.y;

  #ifdef USE_INSTANCING
    vec3 _flWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
    mat3 _flRot = mat3(
      normalize(vec3(instanceMatrix[0])),
      normalize(vec3(instanceMatrix[1])),
      normalize(vec3(instanceMatrix[2]))
    );
    vec3 _flWindLocal = transpose(_flRot) * vec3(uWindDir.x, 0.0, uWindDir.y);
  #else
    vec3 _flWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vec3 _flWindLocal = vec3(uWindDir.x, 0.0, uWindDir.y);
  #endif

  float _flPrimary = sin(dot(_flWorld.xz, uWindDir) * uWindFreq + uTime * uWindSpeed);
  float _flSecond  = sin(dot(_flWorld.xz, uWindDir) * uWindFreq * 2.6 + uTime * uWindSpeed * 1.8 + 1.3) * 0.35;
  vec2  _flPerp    = vec2(-uWindDir.y, uWindDir.x);
  float _flTurb    = sin(dot(_flWorld.xz, _flPerp) * uWindFreq * 1.9 + uTime * uWindSpeed * 0.7 + 2.6) * uWindTurb;

  transformed += _flWindLocal * ((_flPrimary + _flSecond + _flTurb) * uWindStrength * _flH + uWindLean * _flH);
  transformed.x += sin(transformed.y * uBendFreq + uTime * uWindSpeed * 0.4 + _flWorld.x * 0.7) * uBendAmp * _flH;
`;

// Fragment stage declarations, prepended to the flower Lambert fragment.
export const FLOWER_UNIFORMS = /* glsl */ `
  varying vec2 vFlUv;
  uniform sampler2D uFlowerMask;
  uniform sampler2D uFlowerRGB;
  uniform sampler2D uFlowerGradient;
  uniform vec3  uColorR;
  uniform vec3  uColorG;
  uniform vec3  uColorB;
  uniform vec3  uColorStem;
  uniform vec3  uGrassColor;
  uniform float uBrightness;
`;

// Replaces `vec4 diffuseColor = vec4( diffuse, opacity );`: alpha-mask cut-out,
// dominant-channel palette lookup, base→tip fade into the grass color.
export const FLOWER_DIFFUSE = /* glsl */ `
  if ( texture2D( uFlowerMask, vFlUv ).r < 0.5 ) discard;

  float _gradFade = smoothstep( 0.0, 0.7, texture2D( uFlowerGradient, vFlUv ).r );
  vec3  _rgb = texture2D( uFlowerRGB, vFlUv ).rgb;

  float _isR = max( 0.0, _rgb.r - max( _rgb.g, _rgb.b ) );
  float _isG = max( 0.0, _rgb.g - max( _rgb.r, _rgb.b ) );
  float _isB = max( 0.0, _rgb.b - max( _rgb.r, _rgb.g ) );
  float _isW = min( _rgb.r, min( _rgb.g, _rgb.b ) );
  float _tot = _isR + _isG + _isB + _isW;
  vec3  _fc  = _tot < 0.01 ? uColorStem :
    ( _isR * uColorR + _isG * uColorG + _isB * uColorB + _isW * uColorStem ) / _tot;

  vec3 _flCol = mix( uGrassColor, _fc, _gradFade ) * uBrightness;
  vec4 diffuseColor = vec4( _flCol, opacity );
`;
