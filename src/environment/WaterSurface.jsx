import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VOXEL_SIZE } from '../terrain.js';

const WaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uColorDeep: { value: new THREE.Color(0x0a5d8c) },
    uColorShallow: { value: new THREE.Color(0x2ba3c9) },
    uColorFoam: { value: new THREE.Color(0xe8f8ff) },
    uSunColor: { value: new THREE.Color(0xfff8e0) },
    uSkyColor: { value: new THREE.Color(0x87ceeb) },
    uHeightMap: { value: null },
    uTerrainSize: { value: new THREE.Vector2(50, 50) },
    uWaterY: { value: 1.0 },
    uVoxel: { value: VOXEL_SIZE },
  },
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Waves use local plane axes (pos.x, pos.y). Plane lies in XY;
      // mesh rotation.x = -PI/2 maps local +Z to world UP.
      float e = 0.0;
      e += sin(pos.x * 4.0 + uTime * 2.0) * 0.035;
      e += cos(pos.y * 3.5 - uTime * 1.5) * 0.03;
      e += sin((pos.x + pos.y) * 2.5 + uTime * 2.8) * 0.018;
      e += cos((pos.x - pos.y) * 5.0 + uTime * 3.5) * 0.01;

      pos.z += e; // displace along local normal = world UP

      vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColorDeep;
    uniform vec3 uColorShallow;
    uniform vec3 uColorFoam;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform sampler2D uHeightMap;
    uniform vec2 uTerrainSize;
    uniform float uWaterY;
    uniform float uVoxel;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    // Simple hash-based noise
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      // --- Heightmap mask: voxel-exact sampling ---
      // Plane local +Y → world -Z, so rows flip; half-texel offset centers samples.
      vec2 mapUV = vec2(
        (vUv.x * (uTerrainSize.x - 1.0) + 0.5) / uTerrainSize.x,
        1.0 - (vUv.y * (uTerrainSize.y - 1.0) + 0.5) / uTerrainSize.y
      );
      float h = texture2D(uHeightMap, mapUV).r;
      float terrainTopY = h * uVoxel + 0.25; // voxel top = h*0.5 + 0.25
      if (terrainTopY > uWaterY - 0.04) discard;

      // Shore factor: 0 = deep, 1 = near shore
      float shore = smoothstep(uWaterY - 0.4, uWaterY, terrainTopY);

      // --- Low-poly flow streaks (low-poly-waterfall style) ---
      vec2 flowUv = vWorldPos.xz * 0.35;
      flowUv.y -= uTime * 0.12;

      float n = noise(vec2(flowUv.x * 0.0, flowUv.y * 3.5));
      float water = smoothstep(0.0, 0.2, n);
      water = floor(water * 10.0 + 0.5) / 10.0; // quantized banding

      vec3 col = mix(uColorDeep, uColorShallow, clamp(shore + water * 0.6, 0.0, 1.0));
      col = mix(col, uColorFoam, water * 0.4);

      // --- Animated near-shore ripple ---
      float rippleMask = 1.0 - smoothstep(0.0, 0.6, shore);
      float ripple = sin(shore * 60.0 - uTime * 3.0 + noise(vWorldPos.xz * 2.0) * 3.0);
      ripple = smoothstep(0.4, 1.0, ripple * 0.5 + 0.5) * rippleMask;
      col = mix(col, uColorFoam, ripple * 0.2);

      // --- Shore foam ---
      float shoreFoam = shore * (0.5 + 0.5 * noise(vWorldPos.xz * 8.0 + uTime * 0.8));
      col = mix(col, uColorFoam, shoreFoam * 0.25);

      // --- Subtle sky/sun tint ---
      col += uSkyColor * 0.04;
      col += uSunColor * 0.05;

      // More transparent water
      float alpha = 0.7;

      gl_FragColor = vec4(col, alpha);
    }
  `,
};

export default function WaterSurface({ terrainSize, heightData, timeOfDay }) {
  const materialRef = useRef();
  const meshRef = useRef();

  const width = (terrainSize.length) * VOXEL_SIZE;
  const height = (terrainSize.breadth) * VOXEL_SIZE;

  // Build height texture from terrain userData (raw voxel heights)
  const heightTexture = useMemo(() => {
    if (!heightData?.heightMap || !heightData?.length || !heightData?.breadth) return null;
    const { heightMap, length, breadth } = heightData;
    const data = new Float32Array(length * breadth);
    for (let x = 0; x < length; x++) {
      for (let z = 0; z < breadth; z++) {
        data[z * length + x] = heightMap[x][z];
      }
    }
    const tex = new THREE.DataTexture(data, length, breadth, THREE.RedFormat, THREE.FloatType);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    return tex;
  }, [heightData]);

  useFrame((state, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    }
  });

  // Update sky/sun uniforms when timeOfDay changes
  useEffect(() => {
    if (!materialRef.current) return;
    const sunColors = {
      dawn: 0xffb347,
      day: 0xfff8e0,
      dusk: 0xff8c47,
      night: 0x6495ed,
    };
    const skyColors = {
      dawn: 0xffd4a8,
      day: 0x87ceeb,
      dusk: 0xff9777,
      night: 0x2b3a5f,
    };
    materialRef.current.uniforms.uSunColor.value.set(sunColors[timeOfDay] || sunColors.day);
    materialRef.current.uniforms.uSkyColor.value.set(skyColors[timeOfDay] || skyColors.day);
  }, [timeOfDay]);

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 2.0, 0]}
      receiveShadow
    >
      <planeGeometry args={[width, height, 96, 96]} />
      <shaderMaterial
        ref={materialRef}
        args={[WaterShader]}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        uniforms-uHeightMap-value={heightTexture}
        uniforms-uTerrainSize-value={new THREE.Vector2(terrainSize.length, terrainSize.breadth)}
        uniforms-uWaterY-value={2.0}
      />
    </mesh>
  );
}
