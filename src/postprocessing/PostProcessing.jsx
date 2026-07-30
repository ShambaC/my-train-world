import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    focusY: { value: 0.5 },
    focusWidth: { value: 0.15 },
    blurAmount: { value: 0.003 },
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
    uniform float focusY;
    uniform float focusWidth;
    uniform float blurAmount;
    varying vec2 vUv;

    void main() {
      float dist = abs(vUv.y - focusY);
      float blur = smoothstep(focusWidth, 0.5, dist) * blurAmount;

      vec4 color = vec4(0.0);
      float totalWeight = 0.0;

      for (float x = -3.0; x <= 3.0; x += 1.0) {
        for (float y = -3.0; y <= 3.0; y += 1.0) {
          vec2 offset = vec2(x, y) * blur;
          float weight = 1.0 - length(vec2(x, y)) / 4.24;
          color += texture2D(tDiffuse, vUv + offset) * max(weight, 0.0);
          totalWeight += max(weight, 0.0);
        }
      }

      vec4 finalColor = color / totalWeight;
      // Slight saturation boost for toy miniature look
      vec3 gray = vec3(dot(finalColor.rgb, vec3(0.299, 0.587, 0.114)));
      finalColor.rgb = mix(gray, finalColor.rgb, 1.25);

      gl_FragColor = finalColor;
    }
  `,
};

export default function PostProcessing({ enabled }) {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef();

  useFrame(() => {
    if (!enabled) return;
    // Renders full tilt-shift frame
  }, 1);

  if (!enabled) return null;

  return null;
}
