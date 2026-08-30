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

// ─── Depth-Aware Miniature Tilt-Shift (Macro DoF) ─────────────────────────
const DepthTiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    cameraNear: { value: 0.1 },
    cameraFar: { value: 1000.0 },
    focusDistance: { value: 20.0 },
    focalRange: { value: 10.0 },
    maxBlur: { value: 4.0 },
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
    #include <packing>
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform float focusDistance;
    uniform float focalRange;
    uniform float maxBlur;
    uniform vec2 resolution;
    varying vec2 vUv;

    float getLinearDepth(vec2 coord) {
      float fragCoordZ = texture2D(tDepth, coord).x;
      float viewZ = perspectiveDepthToViewZ(fragCoordZ, cameraNear, cameraFar);
      return -viewZ;
    }

    void main() {
      vec2 texel = 1.0 / resolution;
      float centerDepth = getLinearDepth(vUv);
      
      // Compute Circle of Confusion based on real 3D distance from focal plane
      float depthDelta = abs(centerDepth - focusDistance);
      float coc = clamp((depthDelta - focalRange * 0.2) / max(focalRange, 0.001), 0.0, 1.0);
      coc = smoothstep(0.04, 1.0, coc);
      float blurRadius = coc * maxBlur;

      if (blurRadius < 0.2) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec4 col = vec4(0.0);
      float totalWeight = 0.0;

      const int SAMPLES = 12;
      vec2 disk[12];
      disk[0] = vec2( 0.000,  1.000);
      disk[1] = vec2( 0.500,  0.866);
      disk[2] = vec2( 0.866,  0.500);
      disk[3] = vec2( 1.000,  0.000);
      disk[4] = vec2( 0.866, -0.500);
      disk[5] = vec2( 0.500, -0.866);
      disk[6] = vec2( 0.000, -1.000);
      disk[7] = vec2(-0.500, -0.866);
      disk[8] = vec2(-0.866, -0.500);
      disk[9] = vec2(-1.000,  0.000);
      disk[10] = vec2(-0.866, 0.500);
      disk[11] = vec2(-0.500, 0.866);

      col += texture2D(tDiffuse, vUv) * 2.0;
      totalWeight += 2.0;

      for (int i = 0; i < SAMPLES; i++) {
        vec2 offset1 = disk[i] * texel * blurRadius * 0.5;
        vec2 offset2 = disk[i] * texel * blurRadius * 1.0;

        col += texture2D(tDiffuse, vUv + offset1);
        col += texture2D(tDiffuse, vUv + offset2) * 0.75;
        totalWeight += 1.75;
      }

      gl_FragColor = col / totalWeight;
    }
  `,
};

export default function Effects({
  tiltShiftEnabled,
  celShadingEnabled,
  bloomEnabled = true,
  graphicsQuality = 'medium',
  focusTarget = null,
}) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef();
  const depthTextureRef = useRef();
  const tiltPassRef = useRef();
  const celPassRef = useRef();
  const bloomPassRef = useRef();
  const finalPassRef = useRef();

  useEffect(() => {
    // Half-float render target with attached depth texture
    const depthTexture = new THREE.DepthTexture();
    depthTexture.type = THREE.UnsignedShortType;
    depthTextureRef.current = depthTexture;

    const renderTarget = new THREE.WebGLRenderTarget(size.width, size.height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthTexture,
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

    // Selective HDR Bloom (threshold 1.15 so only emissive windows/lamps glow)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width * 0.5, size.height * 0.5),
      0.45, // strength
      0.65, // radius
      1.15  // threshold
    );
    bloomPass.enabled = bloomEnabled;
    bloomPassRef.current = bloomPass;
    composer.addPass(bloomPass);

    // Depth-Aware Miniature Mode DoF Pass
    const depthDofPass = new ShaderPass(DepthTiltShiftShader);
    depthDofPass.uniforms.tDepth.value = depthTexture;
    depthDofPass.enabled = tiltShiftEnabled;
    tiltPassRef.current = depthDofPass;
    composer.addPass(depthDofPass);

    // Final color formation pass
    const finalPass = new ShaderPass(FinalShader);
    finalPassRef.current = finalPass;
    composer.addPass(finalPass);

    composer.setSize(size.width, size.height);
    composer.setPixelRatio(gl.getPixelRatio());

    return () => {
      composer.dispose();
      renderTarget.dispose();
      depthTexture.dispose();
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
    if (tiltPassRef.current) tiltPassRef.current.enabled = tiltShiftEnabled;
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
    if (tiltPassRef.current) {
      tiltPassRef.current.uniforms.resolution.value.set(renderW, renderH);
    }
    if (composerRef.current) {
      composerRef.current.setSize(size.width, size.height);
    }
  }, [size, gl]);

  useFrame(() => {
    if (composerRef.current) {
      composerRef.current.render();
    }
    const tiltPass = tiltPassRef.current;
    if (tiltPass && tiltPass.enabled && camera) {
      const pixelRatio = gl.getPixelRatio();
      const renderW = size.width * pixelRatio;
      const renderH = size.height * pixelRatio;

      tiltPass.uniforms.cameraNear.value = camera.near || 0.1;
      tiltPass.uniforms.cameraFar.value = camera.far || 1000.0;
      tiltPass.uniforms.resolution.value.set(renderW, renderH);

      const targetPos = focusTarget ? (focusTarget.position || focusTarget) : new THREE.Vector3(0, 1.5, 0);
      const dist = camera.position.distanceTo(targetPos);
      tiltPass.uniforms.focusDistance.value = dist;
      tiltPass.uniforms.focalRange.value = THREE.MathUtils.clamp(dist * 0.45, 4.0, 18.0);
    }
  }, 1);

  return null;
}
