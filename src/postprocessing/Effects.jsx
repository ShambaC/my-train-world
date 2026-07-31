import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ─── Tilt-Shift Shader ────────────────────────────────────────────────────
const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    focusY: { value: 0.5 },
    focusWidth: { value: 0.18 },
    maxBlur: { value: 5.0 },
    saturation: { value: 1.3 },
    vignette: { value: 0.35 },
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
    uniform float focusY;
    uniform float focusWidth;
    uniform float maxBlur;
    uniform float saturation;
    uniform float vignette;
    varying vec2 vUv;

    void main() {
      float dist = abs(vUv.y - focusY);
      float blurFactor = smoothstep(focusWidth, focusWidth + 0.25, dist) * maxBlur;

      vec4 color = vec4(0.0);
      float totalWeight = 0.0;

      for (float x = -3.0; x <= 3.0; x += 1.0) {
        for (float y = -3.0; y <= 3.0; y += 1.0) {
          vec2 offset = vec2(x, y) * blurFactor / resolution;
          float r = length(vec2(x, y));
          float weight = max(1.0 - r / 4.24, 0.0);
          color += texture2D(tDiffuse, vUv + offset) * weight;
          totalWeight += weight;
        }
      }

      vec4 finalColor = color / totalWeight;

      // Saturation boost for miniature look
      float luma = dot(finalColor.rgb, vec3(0.299, 0.587, 0.114));
      finalColor.rgb = mix(vec3(luma), finalColor.rgb, saturation);

      // Slight contrast lift
      finalColor.rgb = pow(finalColor.rgb, vec3(1.06));

      // Vignette
      float vignetteDist = length(vUv - 0.5);
      finalColor.rgb *= 1.0 - vignette * smoothstep(0.55, 0.95, vignetteDist);

      gl_FragColor = finalColor;
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
      scale = clamp(scale, 0.3, 3.0);
      color.rgb *= scale;

      // Sobel edge detection on luminance
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

      float edge = smoothstep(0.05, 0.15, sobel);
      color.rgb = mix(color.rgb, vec3(0.08), edge * 0.85);

      // Saturation boost
      float luma2 = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      color.rgb = mix(vec3(luma2), color.rgb, 1.2);

      gl_FragColor = color;
    }
  `,
};

// ─── Effects Component ────────────────────────────────────────────────────
// Only mount when (tiltShiftEnabled || celShadingEnabled) — see GameScene.jsx
export default function Effects({ tiltShiftEnabled, celShadingEnabled }) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef();
  const tiltPassRef = useRef();
  const celPassRef = useRef();

  // Build composer on mount
  useEffect(() => {
    const composer = new EffectComposer(gl);
    composerRef.current = composer;

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    const celPass = new ShaderPass(CelShader);
    celPass.enabled = celShadingEnabled;
    celPassRef.current = celPass;
    composer.addPass(celPass);

    const tiltPass = new ShaderPass(TiltShiftShader);
    tiltPass.enabled = tiltShiftEnabled;
    tiltPassRef.current = tiltPass;
    composer.addPass(tiltPass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    composer.setSize(size.width, size.height);
    composer.setPixelRatio(gl.getPixelRatio());

    return () => {
      composer.dispose();
      composerRef.current = null;
    };
  }, [gl, scene, camera]);

  // Update pass enabled states
  useEffect(() => {
    if (tiltPassRef.current) tiltPassRef.current.enabled = tiltShiftEnabled;
    if (celPassRef.current) celPassRef.current.enabled = celShadingEnabled;
  }, [tiltShiftEnabled, celShadingEnabled]);

  // Update resolution uniforms on resize
  useEffect(() => {
    const w = size.width;
    const h = size.height;
    if (tiltPassRef.current) {
      tiltPassRef.current.uniforms.resolution.value.set(w, h);
    }
    if (celPassRef.current) {
      celPassRef.current.uniforms.resolution.value.set(w, h);
    }
    if (composerRef.current) {
      composerRef.current.setSize(w, h);
    }
  }, [size]);

  // Render takeover (priority 1 disables R3F default render)
  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render();
    }
  }, 1);

  return null;
}
