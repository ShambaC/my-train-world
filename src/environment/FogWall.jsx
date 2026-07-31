import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VOXEL_SIZE } from '../terrain.js';

const FogWallShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(0xd4e8f7) },
    uOpacity: { value: 0.85 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying float vHeight;
    void main() {
      vUv = uv;
      vHeight = position.y / 10.0; // normalized height
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uOpacity;
    varying vec2 vUv;
    varying float vHeight;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    void main() {
      // Animated cloud noise
      float n = noise(vec2(vUv.x * 24.0 + uTime * 0.03, vUv.y * 2.0));
      float n2 = noise(vec2(vUv.x * 12.0 - uTime * 0.02, vUv.y * 3.0 + uTime * 0.01));
      float cloud = n * 0.6 + n2 * 0.4;

      // Height fade: transparent at bottom, opaque at middle, fade at top
      float heightFade = smoothstep(0.0, 0.2, vHeight) * (1.0 - smoothstep(0.7, 1.0, vHeight));

      float alpha = cloud * heightFade * uOpacity;

      gl_FragColor = vec4(uColor, alpha);
    }
  `,
};

/**
 * Fog wall — a truncated cone ring that follows the camera,
 * creating an infinite-looking fog/cloud boundary.
 */
export default function FogWall({ terrainSize, fogColor = 0xd4e8f7 }) {
  const groupRef = useRef();
  const materialRef = useRef();
  const { camera } = useThree();

  const worldHalfL = (terrainSize.length / 2) * VOXEL_SIZE;
  const worldHalfB = (terrainSize.breadth / 2) * VOXEL_SIZE;
  const R0 = Math.max(worldHalfL, worldHalfB) + 8;
  const R1 = R0 + 30;
  const wallHeight = 10;

  // Update color
  const color = useMemo(() => new THREE.Color(fogColor), [fogColor]);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
      materialRef.current.uniforms.uColor.value.copy(color);
    }
    if (groupRef.current) {
      // Re-center on camera XZ
      groupRef.current.position.x = camera.position.x;
      groupRef.current.position.z = camera.position.z;
    }
  });

  return (
    <group ref={groupRef} position={[0, 4, 0]}>
      <mesh rotation={[0, 0, 0]} position={[0, 0, 0]}>
        <cylinderGeometry args={[R1, R0, wallHeight, 64, 1, true]} />
        <shaderMaterial
          ref={materialRef}
          args={[FogWallShader]}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          uniforms-uColor-value={color}
        />
      </mesh>
    </group>
  );
}
