import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

const FOCUS_Y = 0.65;
const BLUR_STRENGTH = 3.5;

// ─── Painterly Filmic Color Formation & Tonemap ───────────────────────────
const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    exposure: { value: 1.05 },
    saturation: { value: 1.15 },
    vignette: { value: 0.12 },
    uNightness: { value: 0.0 },
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
    uniform float vignette;
    uniform float uNightness;
    varying vec2 vUv;

    // Pastel-safe filmic curve
    vec3 filmicToneMap(vec3 x) {
      x *= exposure;
      vec3 a = vec3(2.51);
      vec3 b = vec3(0.03);
      vec3 c = vec3(2.43);
      vec3 d = vec3(0.59);
      vec3 e = vec3(0.14);
      return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
    }

    vec3 linearToSRGB(vec3 c) {
      return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, 12.92 * c, step(c, vec3(0.0031308)));
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      color.rgb = filmicToneMap(color.rgb);

      // Controlled saturation
      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma), color.rgb, saturation);

      // Vignette
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

      float luma = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      float bands = 5.0;
      float quantized = floor(luma * bands + 0.5) / bands;
      float scale = quantized / max(luma, 0.001);
      scale = clamp(scale, 0.4, 2.5);
      color.rgb *= scale;

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

      float edge = smoothstep(0.12, 0.25, sobel);
      color.rgb = mix(color.rgb, vec3(0.05), edge * 0.8);

      gl_FragColor = color;
    }
  `,
};

export default function Effects({ tiltShiftEnabled, celShadingEnabled, bloomEnabled = true }) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef();
  const tiltPassRef = useRef();
  const celPassRef = useRef();
  const bloomPassRef = useRef();
  const finalPassRef = useRef();

  useEffect(() => {
    // Half-float render target for HDR luminance bloom
    const renderTarget = new THREE.WebGLRenderTarget(size.width, size.height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });

    const composer = new EffectComposer(gl, renderTarget);
    composerRef.current = composer;

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    // Cel shading (optional)
    const celPass = new ShaderPass(CelShader);
    celPass.enabled = celShadingEnabled;
    celPassRef.current = celPass;
    composer.addPass(celPass);

    // Selective HDR Bloom (threshold 1.2 so only emissive windows/lamps glow)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width * 0.5, size.height * 0.5),
      0.45, // strength
      0.65, // radius
      1.15  // threshold
    );
    bloomPass.enabled = bloomEnabled;
    bloomPassRef.current = bloomPass;
    composer.addPass(bloomPass);

    // Miniature Mode Tilt-Shift passes
    const tiltHPass = new ShaderPass(HorizontalTiltShiftShader);
    const tiltVPass = new ShaderPass(VerticalTiltShiftShader);
    tiltHPass.enabled = tiltShiftEnabled;
    tiltVPass.enabled = tiltShiftEnabled;
    tiltPassRef.current = [tiltHPass, tiltVPass];
    composer.addPass(tiltHPass);
    composer.addPass(tiltVPass);

    // Final color formation pass
    const finalPass = new ShaderPass(FinalShader);
    finalPassRef.current = finalPass;
    composer.addPass(finalPass);

    composer.setSize(size.width, size.height);
    composer.setPixelRatio(gl.getPixelRatio());

    return () => {
      composer.dispose();
      renderTarget.dispose();
      composerRef.current = null;
    };
  }, [gl, scene, camera]);

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

  useEffect(() => {
    const passes = tiltPassRef.current;
    if (passes) {
      passes[0].enabled = tiltShiftEnabled;
      passes[1].enabled = tiltShiftEnabled;
    }
    if (celPassRef.current) celPassRef.current.enabled = celShadingEnabled;
    if (bloomPassRef.current) bloomPassRef.current.enabled = bloomEnabled;
  }, [tiltShiftEnabled, celShadingEnabled, bloomEnabled]);

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
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height);
    }
  }, [size, gl]);

  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render();
    }
    const passes = tiltPassRef.current;
    if (passes && passes[0].enabled && composerRef.current) {
      const pixelRatio = gl.getPixelRatio();
      const renderW = size.width * pixelRatio;
      const renderH = size.height * pixelRatio;
      const dist = THREE.MathUtils.clamp(camera.position.length() / 25, 0.5, 1.6);
      passes[0].uniforms.h.value = (BLUR_STRENGTH * dist) / renderW;
      passes[0].uniforms.r.value = FOCUS_Y;
      passes[1].uniforms.v.value = (BLUR_STRENGTH * dist) / renderH;
      passes[1].uniforms.r.value = FOCUS_Y;
    }
  }, 1);

  return null;
}
