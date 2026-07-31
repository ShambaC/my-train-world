import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VOXEL_SIZE } from '../terrain.js';

const WaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uColorDeep: { value: new THREE.Color(0x0b3d5c) },
    uColorShallow: { value: new THREE.Color(0x2e8b9a) },
    uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
    uSunColor: { value: new THREE.Color(0xfff8e0) },
    uSkyColor: { value: new THREE.Color(0x87ceeb) },
    uHeightMap: { value: null },
    uTerrainSize: { value: new THREE.Vector2(50, 50) },
    uWaterY: { value: 0.76 },
    uVoxel: { value: VOXEL_SIZE },
  },
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vElevation;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // 3 directional waves (Gerstner-ish)
      float e = 0.0;
      // Wave 1
      float w1 = sin(pos.x * 3.1 + uTime * 1.6) * 0.018;
      e += w1;
      // Wave 2
      float w2 = cos(pos.z * 2.3 - uTime * 1.1) * 0.014;
      e += w2;
      // Wave 3
      float w3 = sin((pos.x + pos.z) * 1.3 + uTime * 2.2) * 0.008;
      e += w3;

      pos.y += e;
      vElevation = e;

      // Compute normal from wave derivatives
      float dx = cos(pos.x * 3.1 + uTime * 1.6) * 0.018 * 3.1
                - sin(pos.z * 2.3 - uTime * 1.1) * 0.014 * 0.0
                + cos((pos.x + pos.z) * 1.3 + uTime * 2.2) * 0.008 * 1.3;
      float dz = sin(pos.x * 3.1 + uTime * 1.6) * 0.018 * 0.0
                + sin(pos.z * 2.3 - uTime * 1.1) * 0.014 * 2.3
                + cos((pos.x + pos.z) * 1.3 + uTime * 2.2) * 0.008 * 1.3;
      vNormal = normalize(vec3(-dx, 1.0, -dz));

      vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColorDeep;
    uniform vec3 uColorShallow;
    uniform vec3 uSunDir;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform sampler2D uHeightMap;
    uniform vec2 uTerrainSize;
    uniform float uWaterY;
    uniform float uVoxel;
    varying vec2 vUv;
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vElevation;

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
      // --- Heightmap mask: discard above water level ---
      vec2 mapUV = vUv;
      float hSample = texture2D(uHeightMap, mapUV).r;
      float terrainTopY = (hSample + 1.0) * 0.5; // reconstruct world Y from voxel height
      if (terrainTopY > uWaterY - 0.02) discard;

      // Shore factor: 0 = deep, 1 = near shore
      float shore = smoothstep(uWaterY - 0.35, uWaterY, terrainTopY);

      // --- Base color ---
      float depthFactor = shore + abs(vElevation) * 15.0;
      vec3 baseColor = mix(uColorDeep, uColorShallow, clamp(depthFactor, 0.0, 1.0));

      // --- Procedural detail normals ---
      float n1 = noise(vWorldPos.xz * 8.0 + uTime * 0.4);
      float n2 = noise(vWorldPos.xz * 12.0 - uTime * 0.3);
      vec3 detailNormal = normalize(vNormal + vec3((n1 - 0.5) * 0.15, 0.0, (n2 - 0.5) * 0.15));

      // --- View direction ---
      vec3 viewDir = normalize(cameraPosition - vWorldPos);

      // --- Fresnel ---
      float fresnel = pow(1.0 - max(dot(viewDir, detailNormal), 0.0), 3.0);
      baseColor = mix(baseColor, uSkyColor, fresnel * 0.7);

      // --- Sun glint (Blinn specular) ---
      vec3 halfVec = normalize(viewDir + uSunDir);
      float spec = pow(max(dot(detailNormal, halfVec), 0.0), 64.0);
      baseColor += uSunColor * spec * 0.8;

      // --- Foam ---
      // Crest foam
      float crestFoam = smoothstep(0.75, 0.95, abs(vElevation) * 30.0);
      // Shore foam
      float shoreFoam = shore * smoothstep(0.0, 0.3, shore);
      shoreFoam *= 0.5 + 0.5 * noise(vWorldPos.xz * 18.0 + uTime);
      float foam = max(crestFoam, shoreFoam) * 0.6;
      baseColor = mix(baseColor, vec3(1.0), foam);

      // --- Caustic shimmer (shallow areas) ---
      float c1 = 1.0 - min(noise(vWorldPos.xz * 8.0 + uTime * 0.6), noise(vWorldPos.xz * 8.0 - uTime * 0.4));
      float caustic = pow(c1, 6.0) * 0.25 * shore;
      baseColor += vec3(caustic);

      // --- Alpha ---
      float alpha = 0.82 * (1.0 - shore * 0.4);

      gl_FragColor = vec4(baseColor, alpha);
    }
  `,
};

export default function WaterSurface({ terrainSize, heightData, timeOfDay }) {
  const materialRef = useRef();
  const meshRef = useRef();

  const width = (terrainSize.length) * VOXEL_SIZE;
  const height = (terrainSize.breadth) * VOXEL_SIZE;

  // Build height texture from terrain userData
  const heightTexture = useMemo(() => {
    if (!heightData?.heightMap || !heightData?.length || !heightData?.breadth) return null;
    const { heightMap, length, breadth } = heightData;
    const data = new Float32Array(length * breadth);
    for (let x = 0; x < length; x++) {
      for (let z = 0; z < breadth; z++) {
        // Encode height as normalized [0,1] for R channel
        data[z * length + x] = heightMap[x][z] / 10.0;
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
    const sunPositions = {
      dawn: [0.5, 0.4, 0.3],
      day:  [0.5, 0.8, 0.3],
      dusk: [0.5, 0.3, -0.5],
      night:[-0.3, 0.4, -0.3],
    };
    const sunColors = {
      dawn: 0xffb347,
      day:  0xfff8e0,
      dusk: 0xff8c47,
      night:0x6495ed,
    };
    const skyColors = {
      dawn: 0xffd4a8,
      day:  0x87ceeb,
      dusk: 0xff9777,
      night:0x2b3a5f,
    };
    const dir = sunPositions[timeOfDay] || sunPositions.day;
    materialRef.current.uniforms.uSunDir.value.set(...dir).normalize();
    materialRef.current.uniforms.uSunColor.value.set(sunColors[timeOfDay] || sunColors.day);
    materialRef.current.uniforms.uSkyColor.value.set(skyColors[timeOfDay] || skyColors.day);
  }, [timeOfDay]);

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.76, 0]}
      receiveShadow
    >
      <planeGeometry args={[width, height, 64, 64]} />
      <shaderMaterial
        ref={materialRef}
        args={[WaterShader]}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        uniforms-uHeightMap-value={heightTexture}
        uniforms-uTerrainSize-value={new THREE.Vector2(terrainSize.length, terrainSize.breadth)}
        uniforms-uWaterY-value={0.76}
      />
    </mesh>
  );
}
