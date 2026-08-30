import { useRef, useMemo, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { VOXEL_SIZE, WATER_LEVEL } from '../terrain.js';
import { getStyleTexture } from '../utils/atlasTextures.js';

const MAX_FOAM_POINTS = 64;

const WaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uColorDeep: { value: new THREE.Color(0x0f5b8a) },
    uColorShallow: { value: new THREE.Color(0x2ea5cb) },
    uColorFoam: { value: new THREE.Color(0xe8f8ff) },
    uColorSand: { value: new THREE.Color(0xdeb878) },
    uSunColor: { value: new THREE.Color(0xfff8e0) },
    uSkyColor: { value: new THREE.Color(0x87ceeb) },
    uCameraPos: { value: new THREE.Vector3() },
    uHeightMap: { value: null },
    uTerrainSize: { value: new THREE.Vector2(50, 50) },
    uWaterY: { value: WATER_LEVEL },
    uVoxel: { value: VOXEL_SIZE },
    uFlowDir: { value: new THREE.Vector2(0, 1) },
    uFoamPoints: { value: Array.from({ length: MAX_FOAM_POINTS }, () => new THREE.Vector3(9999, 0, 9999)) },
    uFoamCount: { value: 0 },
    tRipple: { value: null },
    tCaustic: { value: null },
  },
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    void main() {
      vUv = uv;
      vec3 pos = position;

      // Gentle calm surface displacement
      float e = 0.0;
      e += sin(pos.x * 2.5 + uTime * 1.2) * 0.015;
      e += cos(pos.y * 2.2 - uTime * 0.9) * 0.012;
      pos.z += e;

      vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
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
    uniform vec3 uCameraPos;
    uniform sampler2D uHeightMap;
    uniform vec2 uTerrainSize;
    uniform float uWaterY;
    uniform float uVoxel;
    uniform vec2 uFlowDir;
    uniform vec3 uFoamPoints[${MAX_FOAM_POINTS}];
    uniform float uFoamCount;
    uniform sampler2D tRipple;
    uniform sampler2D tCaustic;
    varying vec2 vUv;
    varying vec3 vWorldPos;

    void main() {
      vec2 mapUV = vec2(
        (vUv.x * (uTerrainSize.x - 1.0) + 0.5) / uTerrainSize.x,
        1.0 - (vUv.y * (uTerrainSize.y - 1.0) + 0.5) / uTerrainSize.y
      );
      float h = texture2D(uHeightMap, mapUV).r;
      float terrainTopY = h * uVoxel + 0.25;

      if (terrainTopY > uWaterY + 0.45) discard;

      float depth = max(0.0, uWaterY - terrainTopY);

      // Smooth depth color absorption
      float shallowMix = 1.0 - smoothstep(0.1, 1.1, depth);
      float sandMix = (1.0 - smoothstep(0.02, 0.45, depth)) * 0.6;
      vec3 col = mix(uColorDeep, uColorShallow, shallowMix);
      col = mix(col, uColorSand, sandMix);

      // Dual calm ripple texture sampling
      vec2 rippleUv1 = vWorldPos.xz * 0.12 + vec2(uTime * 0.02, uTime * 0.015);
      vec2 rippleUv2 = vWorldPos.xz * 0.18 - vec2(uTime * 0.015, uTime * 0.02);
      float r1 = texture2D(tRipple, rippleUv1).r;
      float r2 = texture2D(tRipple, rippleUv2).r;
      float ripple = (r1 + r2) * 0.5;
      col += (uColorShallow - uColorDeep) * (ripple - 0.5) * 0.15;

      // Soft shore foam fringe
      float shoreFoam = (1.0 - smoothstep(0.02, 0.22, depth)) * 0.35;
      col = mix(col, uColorFoam, shoreFoam);

      // Interactive object foam around supports
      float objectFoam = 0.0;
      for (int i = 0; i < ${MAX_FOAM_POINTS}; i++) {
        if (float(i) >= uFoamCount) break;
        float distanceToObject = distance(vWorldPos.xz, uFoamPoints[i].xz);
        float ring = 1.0 - smoothstep(0.04, 0.25, distanceToObject);
        float pulse = sin(distanceToObject * 36.0 - uTime * 2.5);
        pulse = 0.7 + 0.3 * smoothstep(0.0, 1.0, pulse * 0.5 + 0.5);
        objectFoam = max(objectFoam, ring * pulse);
      }
      col = mix(col, uColorFoam, objectFoam * 0.65);

      // Shallow caustics
      float caustic = texture2D(tCaustic, vWorldPos.xz * 0.15 + uTime * 0.01).r;
      col += uSunColor * caustic * shallowMix * 0.12;

      // Fresnel sky reflection
      vec3 viewDir = normalize(uCameraPos - vWorldPos);
      float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
      col = mix(col, uSkyColor, fresnel * 0.42);

      gl_FragColor = vec4(col, 0.82);
    }
  `,
};

const WaterSurface = forwardRef(function WaterSurface({ terrainSize, heightData, timeOfDay, lighting, trackManager, trainManager }, ref) {
  const materialRef = useRef();
  const meshRef = useRef();
  const { camera } = useThree();
  const foamPoints = useMemo(
    () => Array.from({ length: MAX_FOAM_POINTS }, () => new THREE.Vector3(9999, 0, 9999)),
    [],
  );

  const rippleTex = useMemo(() => getStyleTexture('water_ripple_broad'), []);
  const causticTex = useMemo(() => getStyleTexture('caustic_soft'), []);

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

  const flowDir = useMemo(() => {
    if (heightData?.riverPlan) {
      return new THREE.Vector2(heightData.riverPlan.horizontal ? 0 : 1, heightData.riverPlan.horizontal ? 1 : 0);
    }
    return new THREE.Vector2(0, 1);
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
        uniforms-uFlowDir-value={flowDir}
        uniforms-uFoamPoints-value={foamPoints}
        uniforms-uFoamCount-value={0}
        uniforms-tRipple-value={rippleTex}
        uniforms-tCaustic-value={causticTex}
      />
    </mesh>
  );
});

export default WaterSurface;
