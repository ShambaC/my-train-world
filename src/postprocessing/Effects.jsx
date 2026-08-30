import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

// Tilt-shift settings (see tilt-shift-guide.md):
//   r  — normalized screen Y of the sharp focus strip
//   h/v — blur footprint = blurStrength / physical render size.
// A larger blurStrength both narrows the effective sharp band (steeper
// ramp away from the focus line) and blurs the rest more.
const FOCUS_Y = 0.65;
const BLUR_STRENGTH = 3.7;

// ─── Final Color Pass: applies ACES tone mapping + sRGB encoding exactly once,
// plus a light saturation/vignette lift for the miniature look.
// The default OutputPass reads renderer.toneMapping/outputColorSpace, and R3F's
// defaults (ACES + sRGB output) get applied by the RenderPass too — double
// application crushed blacks and blew out brights. This pass is unconditional.
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    exposure: { value: 1.0 },
    saturation: { value: 1.0 },
    contrast: { value: 1.01 },
    vignette: { value: 0.1 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float exposure;
    uniform float saturation;
    uniform float contrast;
    uniform float vignette;
    varying vec2 vUv;

    vec3 filmic(vec3 x) {
      x *= exposure;
      x = max(x, vec3(0.0));
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }
    vec3 linearToSRGB(vec3 c) {
      return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, 12.92 * c, step(c, vec3(0.0031308)));
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      color.rgb = filmic(color.rgb);
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, saturation);
      color.rgb = mix(vec3(0.5), color.rgb, contrast);
      float vignetteDist = length(vUv - 0.5);
      color.rgb *= 1.0 - vignette * smoothstep(0.55, 0.95, vignetteDist);
      color.rgb = linearToSRGB(color.rgb);
      gl_FragColor = color;
    }
  `,
};

// ─── Cel Shader ───────────────────────────────────────────────────────────
const CelShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    varying vec2 vUv;

    void main() {
      vec2 texel = 1.0 / resolution;
      vec4 color = texture2D(tDiffuse, vUv);

      // Luminance-based posterize (preserves hue, reduces tonal bands)
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      float bands = 5.0;
      float quantized = floor(luma * bands + 0.5) / bands;
      float scale = quantized / max(luma, 0.001);
      scale = clamp(scale, 0.4, 2.5);
      color.rgb *= scale;

      // Sobel edge detection on luminance - stronger threshold
      float tl = dot(texture2D(tDiffuse, vUv + texel * vec2(-1, -1)).rgb, vec3(0.299, 0.587, 0.114));
      float t  = dot(texture2D(tDiffuse, vUv + texel * vec2( 0, -1)).rgb, vec3(0.299, 0.587, 0.114));
      float tr = dot(texture2D(tDiffuse, vUv + texel * vec2( 1, -1)).rgb, vec3(0.299, 0.587, 0.114));
      float ml = dot(texture2D(tDiffuse, vUv + texel * vec2(-1,  0)).rgb, vec3(0.299, 0.587, 0.114));
      float mr = dot(texture2D(tDiffuse, vUv + texel * vec2( 1,  0)).rgb, vec3(0.299, 0.587, 0.114));
      float bl = dot(texture2D(tDiffuse, vUv + texel * vec2(-1,  1)).rgb, vec3(0.299, 0.587, 0.114));
      float b  = dot(texture2D(tDiffuse, vUv + texel * vec2( 0,  1)).rgb, vec3(0.299, 0.587, 0.114));
      float br = dot(texture2D(tDiffuse, vUv + texel * vec2( 1,  1)).rgb, vec3(0.299, 0.587, 0.114));

      float gx = -tl - 2.0*ml - bl + tr + 2.0*mr + br;
      float gy = -tl - 2.0*t - tr + bl + 2.0*b + br;
      float sobel = sqrt(gx*gx + gy*gy);

      // Only draw edges where there's a significant luminance jump (object boundaries)
      float edge = smoothstep(0.12, 0.25, sobel);
      color.rgb = mix(color.rgb, vec3(0.05), edge * 0.8);

      // Saturation boost
      float luma2 = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma2), color.rgb, 1.15);

      gl_FragColor = color;
    }
  `,
};

// ─── Effects Component ────────────────────────────────────────────────────
// Only mount when (tiltShiftEnabled || celShadingEnabled) — see GameScene.jsx
export default function Effects({ tiltShiftEnabled, celShadingEnabled, graphicsQuality = 'medium', visualFocusRef }) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef();
  const tiltPassRef = useRef();
  const celPassRef = useRef();
  const bloomPassRef = useRef();
  const finalPassRef = useRef();
  useEffect(() => {
    const composer = new EffectComposer(gl);
    if (import.meta.env.DEV) window.__mtw.composer = composer;
    composerRef.current = composer;

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const celPass = new ShaderPass(CelShader);
    celPass.enabled = celShadingEnabled;
    celPassRef.current = celPass;
    composer.addPass(celPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.25,
      0.65,
      1.35,
    );
    bloomPass.enabled = graphicsQuality !== 'low';
    bloomPassRef.current = bloomPass;
    composer.addPass(bloomPass);

    const tiltHPass = new ShaderPass(HorizontalTiltShiftShader);
    const tiltVPass = new ShaderPass(VerticalTiltShiftShader);
    tiltHPass.enabled = tiltShiftEnabled;
    tiltVPass.enabled = tiltShiftEnabled;
    tiltPassRef.current = [tiltHPass, tiltVPass];
    composer.addPass(tiltHPass);
    composer.addPass(tiltVPass);
    const finalPass = new ShaderPass(FinalShader);
    finalPassRef.current = finalPass;
    composer.addPass(finalPass);
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(gl.getPixelRatio());

    return () => {
      composer.dispose();
      composerRef.current = null;
    };
  }, [gl, scene, camera]);

  // The composer's final pass does tone mapping + sRGB conversion itself.
  // R3F defaults (ACES + sRGB output) would apply them a second time in the
  // RenderPass, washing colors out, crushing blacks and turning bright
  // transparent surfaces white/black. Switch them off while mounted.
  useEffect(() => {
    const prevToneMapping = gl.toneMapping;
    const prevOutputColorSpace = gl.outputColorSpace;
    gl.toneMapping = THREE.NoToneMapping;
    gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    return () => {
      gl.toneMapping = prevToneMapping;
      gl.outputColorSpace = prevOutputColorSpace;
    };
  }, [gl]);

  // Update pass enabled states
  useEffect(() => {
    const passes = tiltPassRef.current;
    if (passes) {
      passes[0].enabled = tiltShiftEnabled;
      passes[1].enabled = tiltShiftEnabled;
    }
    if (celPassRef.current) celPassRef.current.enabled = celShadingEnabled;
    if (bloomPassRef.current) bloomPassRef.current.enabled = graphicsQuality !== 'low';
  }, [tiltShiftEnabled, celShadingEnabled, graphicsQuality]);

  // Update tilt-shift focus + blur footprint (physical render pixels) on resize
  useEffect(() => {
    const pixelRatio = gl.getPixelRatio();
    const renderW = size.width * pixelRatio;
    const renderH = size.height * pixelRatio;
    if (celPassRef.current) {
      celPassRef.current.uniforms.resolution.value.set(size.width, size.height);
    }
    const passes = tiltPassRef.current;
    if (passes) {
      passes[0].uniforms.h.value = BLUR_STRENGTH / renderW;
      passes[0].uniforms.r.value = FOCUS_Y;
      passes[1].uniforms.v.value = BLUR_STRENGTH / renderH;
      passes[1].uniforms.r.value = FOCUS_Y;
    }
    if (bloomPassRef.current) {
      bloomPassRef.current.resolution.set(
        size.width * (graphicsQuality === 'high' ? 0.5 : 0.25),
        size.height * (graphicsQuality === 'high' ? 0.5 : 0.25),
      );
      bloomPassRef.current.threshold = graphicsQuality === 'high' ? 1.15 : 1.35;
    }
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height);
    }
  }, [size, gl]);

  // Render takeover (priority 1 disables R3F default render)
  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render();
    }
    // Tilt-shift blur scales with camera-to-focus distance.
    const passes = tiltPassRef.current;
    if (passes && passes[0].enabled && composerRef.current) {
      const pixelRatio = gl.getPixelRatio();
      const renderW = size.width * pixelRatio;
      const renderH = size.height * pixelRatio;
      const focusDistance = visualFocusRef?.current?.distance ?? camera.position.length();
      const dist = THREE.MathUtils.clamp(focusDistance / 30, 0.4, 1.5);
      passes[0].uniforms.h.value = (BLUR_STRENGTH * dist) / renderW;
      passes[0].uniforms.r.value = FOCUS_Y;
      passes[1].uniforms.v.value = (BLUR_STRENGTH * dist) / renderH;
      passes[1].uniforms.r.value = FOCUS_Y;
    }
  }, 1);

  return null;
}
