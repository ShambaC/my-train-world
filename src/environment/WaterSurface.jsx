import { useRef, useMemo, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VOXEL_SIZE, WATER_LEVEL } from '../terrain.js';
import { getStyleTexture } from '../utils/atlasTextures.js';

const MAX_FOAM_POINTS = 64;

const WaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uColorDeep: { value: new THREE.Color(0x0a485c) },
    uColorShallow: { value: new THREE.Color(0x28a69e) },
    uColorFoam: { value: new THREE.Color(0xf4fbfb) },
    uColorSand: { value: new THREE.Color(0xdfc48c) },
    uSunColor: { value: new THREE.Color(0xfff7e6) },
    uSkyColor: { value: new THREE.Color(0x8ec7f5) },
    uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
    uCameraPos: { value: new THREE.Vector3() },
    uHeightMap: { value: null },
    uTerrainSize: { value: new THREE.Vector2(50, 50) },
    uWaterY: { value: WATER_LEVEL },
    uVoxel: { value: VOXEL_SIZE },
    uFoamPoints: { value: Array.from({ length: MAX_FOAM_POINTS }, () => new THREE.Vector3(9999, 0, 9999)) },
    uFoamCount: { value: 0 },
    tRipple: { value: null },
    tRippleCross: { value: null },
    tCaustic: { value: null },
    tCausticBroken: { value: null },
    tShoreDamp: { value: null },
    tShoreFoam: { value: null },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPos;

    void main() {
      vUv = uv;
      // Flat calm mirror plane
      vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColorDeep;
    uniform vec3 uColorShallow;
    uniform vec3 uColorFoam;
    uniform vec3 uColorSand;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform vec3 uSunDir;
    uniform vec3 uCameraPos;
    uniform sampler2D uHeightMap;
    uniform vec2 uTerrainSize;
    uniform float uWaterY;
    uniform float uVoxel;
    uniform vec3 uFoamPoints[${MAX_FOAM_POINTS}];
    uniform float uFoamCount;
    uniform sampler2D tRipple;
    uniform sampler2D tRippleCross;
    uniform sampler2D tCaustic;
    uniform sampler2D tCausticBroken;
    uniform sampler2D tShoreDamp;
    uniform sampler2D tShoreFoam;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    void main() {
      vec2 mapUV = vec2(
        (vUv.x * (uTerrainSize.x - 1.0) + 0.5) / uTerrainSize.x,
        1.0 - (vUv.y * (uTerrainSize.y - 1.0) + 0.5) / uTerrainSize.y
      );
      float h = texture2D(uHeightMap, mapUV).r;
      float terrainTopY = h * uVoxel + 0.25;

      if (terrainTopY > uWaterY + 0.4) discard;

      float depth = max(0.0, uWaterY - terrainTopY);

      // Multi-layer calm ripple normal perturbation (broad swell + crossing ripples)
      vec2 uv1 = vWorldPos.xz * 0.15 + vec2(uTime * 0.022, uTime * 0.015);
      vec2 uv2 = vWorldPos.xz * 0.26 - vec2(uTime * 0.016, uTime * 0.020);
      vec2 uv3 = vWorldPos.zx * 0.32 + vec2(uTime * 0.012, -uTime * 0.014);
      float r1 = texture2D(tRipple, uv1).r;
      float r2 = texture2D(tRippleCross, uv2).r;
      float r3 = texture2D(tRipple, uv3).r;
      vec3 normal = normalize(vec3(
        (r1 - 0.5) * 0.16 + (r2 - 0.5) * 0.10 + (r3 - 0.5) * 0.06,
        1.0,
        (r1 - 0.5) * 0.12 - (r2 - 0.5) * 0.10 + (r3 - 0.5) * 0.05
      ));

      // Luminous depth absorption gradient (Tiny Glade teal/turquoise)
      float shallowMix = 1.0 - smoothstep(0.06, 1.3, depth);
      float sandMix = (1.0 - smoothstep(0.02, 0.45, depth)) * 0.75;
      vec3 waterBody = mix(uColorDeep, uColorShallow, shallowMix);
      vec3 col = mix(waterBody, uColorSand, sandMix);

      // Dual-layer shallow caustics with organic breakup
      float c1 = texture2D(tCaustic, vWorldPos.xz * 0.18 + uTime * 0.012).r;
      float c2 = texture2D(tCausticBroken, vWorldPos.xz * 0.28 - uTime * 0.016).r;
      float caustic = c1 * 0.7 + c2 * 0.3;
      col += uSunColor * caustic * shallowMix * 0.20;

      // Soft shore contact foam fringe using mask
      float shoreContact = 1.0 - smoothstep(0.02, 0.24, depth);
      float shoreMask = texture2D(tShoreFoam, vWorldPos.xz * 0.35 + uTime * 0.01).r;
      shoreContact *= (0.65 + 0.35 * shoreMask);
      col = mix(col, uColorFoam, shoreContact * 0.48);

      // Interactive object foam rings
      float objectFoam = 0.0;
      for (int i = 0; i < ${MAX_FOAM_POINTS}; i++) {
        if (float(i) >= uFoamCount) break;
        float dist = distance(vWorldPos.xz, uFoamPoints[i].xz);
        float ring = 1.0 - smoothstep(0.04, 0.28, dist);
        float pulse = 0.7 + 0.3 * sin(dist * 40.0 - uTime * 3.0);
        objectFoam = max(objectFoam, ring * pulse);
      }
      col = mix(col, uColorFoam, objectFoam * 0.75);

      // View & Fresnel sky reflection
      vec3 viewDir = normalize(uCameraPos - vWorldPos);
      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.2);
      col = mix(col, uSkyColor, fresnel * 0.58);

      // Crisp sun specular glints on ripples
      vec3 halfDir = normalize(uSunDir + viewDir);
      float spec = pow(max(dot(normal, halfDir), 0.0), 96.0);
      col += uSunColor * spec * 0.70;

      float alpha = clamp(0.72 + depth * 0.25, 0.72, 0.94);
      gl_FragColor = vec4(col, alpha);
    }
  `,
};

const WaterSurface = forwardRef(function WaterSurface({ terrainSize, heightData, timeOfDay, lighting, trackManager, trainManager, quality }, ref) {
  const materialRef = useRef();
  const meshRef = useRef();
  const { camera } = useThree();
  const foamPoints = useMemo(
    () => Array.from({ length: MAX_FOAM_POINTS }, () => new THREE.Vector3(9999, 0, 9999)),
    [],
  );

  const rippleTex = useMemo(() => getStyleTexture('water_ripple_broad', { repeat: [2, 2] }), []);
  const rippleCrossTex = useMemo(() => getStyleTexture('water_ripple_crossing', { repeat: [2, 2] }) || rippleTex, [rippleTex]);
  const causticTex = useMemo(() => getStyleTexture('caustic_soft', { repeat: [2, 2] }), []);
  const causticBrokenTex = useMemo(() => getStyleTexture('caustic_broken', { repeat: [2, 2] }) || causticTex, [causticTex]);
  const shoreDampTex = useMemo(() => getStyleTexture('shore_damp_mask'), []);
  const shoreFoamTex = useMemo(() => getStyleTexture('shore_foam_mask') || rippleTex, [rippleTex]);

  useImperativeHandle(ref, () => meshRef.current);

  const width = terrainSize.length * VOXEL_SIZE;
  const height = terrainSize.breadth * VOXEL_SIZE;

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
    const mat = materialRef.current;
    if (!mat) return;
    mat.uniforms.uTime.value += delta;
    mat.uniforms.uCameraPos.value.copy(camera.position);

    if (lighting) {
      mat.uniforms.uColorDeep.value.copy(lighting.waterDeep);
      mat.uniforms.uColorShallow.value.copy(lighting.waterShallow);
      mat.uniforms.uColorFoam.value.copy(lighting.waterFoam);
      mat.uniforms.uColorSand.value.copy(lighting.waterSand);
      mat.uniforms.uSunColor.value.copy(lighting.sunTint);
      mat.uniforms.uSkyColor.value.copy(lighting.skyTint);
      mat.uniforms.uSunDir.value.copy(lighting.sun.position).normalize();
    }

    let foamCount = 0;
    const { heightMap, length, breadth } = heightData || {};
    const groundAt = (x, z) => {
      if (!heightMap) return null;
      const cx = Math.round(x / VOXEL_SIZE + length / 2 - 0.5);
      const cz = Math.round(z / VOXEL_SIZE + breadth / 2 - 0.5);
      if (cx < 0 || cx >= length || cz < 0 || cz >= breadth) return null;
      return heightMap[cx][cz] * VOXEL_SIZE;
    };
    const addFoamPoint = (x, z, deckY) => {
      if (foamCount >= MAX_FOAM_POINTS) return;
      const groundY = groundAt(x, z);
      if (groundY === null || groundY >= WATER_LEVEL || deckY <= WATER_LEVEL) return;
      foamPoints[foamCount++].set(x, 0, z);
    };
    const addTrackSupportPoints = (track) => {
      const cos = Math.cos(track.rotation);
      const sin = Math.sin(track.rotation);
      const addLocal = (x, z, deckY = 0) => addFoamPoint(
        track.position.x + x * cos + z * sin,
        track.position.z - x * sin + z * cos,
        track.position.y + deckY,
      );
      if (track.type === 'straight') {
        for (const x of [-0.175, 0.175]) for (const z of [-0.175, 0.175]) addLocal(x, z);
      } else if (track.type === 'curved') {
        for (let i = 0; i <= 4; i++) {
          const angle = Math.PI + i * (Math.PI / 2) / 4;
          addLocal(0.25 + Math.cos(angle) * 0.25, 0.25 + Math.sin(angle) * 0.25);
        }
      } else if (track.type === 'ramp') {
        for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
          for (const x of [-0.175, 0.175]) addLocal(x, (t - 0.5) * 0.5, t * 0.5);
        }
      }
    };
    for (const track of trackManager?.getAllTracks?.() ?? []) addTrackSupportPoints(track);
    for (const train of trainManager?.getAllTrains?.() ?? []) {
      if (foamCount >= MAX_FOAM_POINTS) break;
      addFoamPoint(train.position.x, train.position.z, train.position.y);
    }
    for (let i = foamCount; i < MAX_FOAM_POINTS; i++) foamPoints[i].set(9999, 0, 9999);
    mat.uniforms.uFoamPoints.value = foamPoints;
    mat.uniforms.uFoamCount.value = foamCount;
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, WATER_LEVEL, 0]}
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
        uniforms-uWaterY-value={WATER_LEVEL}
        uniforms-uFoamPoints-value={foamPoints}
        uniforms-uFoamCount-value={0}
        uniforms-tRipple-value={rippleTex}
        uniforms-tRippleCross-value={rippleCrossTex}
        uniforms-tCaustic-value={causticTex}
        uniforms-tCausticBroken-value={causticBrokenTex}
        uniforms-tShoreDamp-value={shoreDampTex}
        uniforms-tShoreFoam-value={shoreFoamTex}
      />
    </mesh>
  );
});

export default WaterSurface;
