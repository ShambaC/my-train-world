import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const WaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uColorDeep: { value: new THREE.Color(0x1a5276) },
    uColorSurface: { value: new THREE.Color(0x48c9b0) },
  },
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      vUv = uv;
      vec3 pos = position;
      
      float wave1 = sin(pos.x * 3.0 + uTime * 2.0) * 0.02;
      float wave2 = cos(pos.z * 3.0 + uTime * 1.5) * 0.02;
      pos.y += wave1 + wave2;
      vElevation = wave1 + wave2;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColorDeep;
    uniform vec3 uColorSurface;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      float mixFactor = (vElevation + 0.04) * 12.0;
      vec3 color = mix(uColorDeep, uColorSurface, clamp(mixFactor, 0.0, 1.0));
      
      // Specular highlight / foam edges
      if (mixFactor > 0.7) {
        color += vec3(0.15);
      }

      gl_FragColor = vec4(color, 0.85);
    }
  `,
};

export default function WaterSurface({ terrainSize }) {
  const materialRef = useRef();

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  const width = terrainSize.length * 0.5;
  const height = terrainSize.breadth * 0.5;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.48, 0]} // Water level height
      receiveShadow
    >
      <planeGeometry args={[width, height, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        args={[WaterShader]}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
