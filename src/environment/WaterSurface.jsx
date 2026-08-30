import { useRef, useMemo, useEffect, useImperativeHandle, forwardRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getGraphicsQuality } from '../render/graphicsQuality.js';
import { VOXEL_SIZE, WATER_LEVEL } from '../terrain.js';

const MAX_FOAM_POINTS = 64;

const WaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uColorDeep: { value: new THREE.Color(0x245f77) },
    uColorShallow: { value: new THREE.Color(0x68a8ae) },
    uColorFoam: { value: new THREE.Color(0xe8f8ff) },
    uColorSand: { value: new THREE.Color(0xd2b981) },
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
    uReflectivity: { value: 0.3 },
    uRoughness: { value: 0.75 },
    uNightness: { value: 0 },
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
      float broadSwell = sin(pos.x * 1.35 + uTime * 0.38) * 0.025;
      float crossingRipple = cos((pos.x - pos.y) * 2.1 - uTime * 0.26) * 0.012;
      pos.z += broadSwell + crossingRipple;


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
    uniform float uReflectivity;
    uniform float uRoughness;
    uniform float uNightness;
    uniform vec3 uFoamPoints[${MAX_FOAM_POINTS}];
    uniform float uFoamCount;
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

    float underWater(float h) {
      return step(h * uVoxel + 0.25, uWaterY - 0.05);
    }

    void main() {
      // --- Heightmap sample: voxel-exact ---
      // Plane local +Y → world -Z, so rows flip; half-texel offset centers samples.
      vec2 mapUV = vec2(
        (vUv.x * (uTerrainSize.x - 1.0) + 0.5) / uTerrainSize.x,
        1.0 - (vUv.y * (uTerrainSize.y - 1.0) + 0.5) / uTerrainSize.y
      );
      float h = texture2D(uHeightMap, mapUV).r;
      float terrainTopY = h * uVoxel + 0.25; // voxel top = h*0.5 + 0.25

      // The plane spans the whole terrain. Fragments buried well below the
      // ground (0.5 units under the surface) are discarded — everything else
      // stays part of one continuous plane, so ponds and river all fill.
      if (terrainTopY > uWaterY + 0.5) discard;

      float depth = uWaterY - terrainTopY;

      // --- Depth-based color: deep = dark saturated, shallow = bright,
      // shallowest = warm sand/mud showing through ---
      float shallowMix = 1.0 - smoothstep(0.25, 1.2, depth);
      float sandMix = (1.0 - smoothstep(0.1, 0.6, depth)) * 0.55;
      vec3 col = mix(uColorDeep, uColorShallow, shallowMix);
      col = mix(col, uColorSand, sandMix);

      // Steep heightmap gradient → churn/foam at waterfalls and rocky banks
      vec2 texel = 1.0 / uTerrainSize;
      float gradN = texture2D(uHeightMap, mapUV + vec2(0.0, texel.y)).r;
      float gradS = texture2D(uHeightMap, mapUV - vec2(0.0, texel.y)).r;
      float gradE = texture2D(uHeightMap, mapUV + vec2(texel.x, 0.0)).r;
      float gradW = texture2D(uHeightMap, mapUV - vec2(texel.x, 0.0)).r;
      float steep = max(max(abs(gradN - h), abs(gradS - h)), max(abs(gradE - h), abs(gradW - h)));
      float churn = smoothstep(1.5, 3.5, steep);

      // --- River vs pond motion ---
      // A river channel continues underwater along the flow axis; a pond is
      // enclosed. Sample the heightmap a few texels along the flow to tell.
      vec2 flowMap = vec2(uFlowDir.x, -uFlowDir.y);
      float hFwd = texture2D(uHeightMap, mapUV + flowMap * texel * 2.0).r;
      float hBack = texture2D(uHeightMap, mapUV - flowMap * texel * 2.0).r;
      float river = min(underWater(hFwd), underWater(hBack));
      float pond = 1.0 - river;

      // Gentle directional shimmer in the river (no hard banding)
      vec2 flowUv = vWorldPos.xz * 0.35;
      flowUv -= uFlowDir * uTime * 0.1;
      float along = abs(uFlowDir.x) > abs(uFlowDir.y) ? flowUv.x : flowUv.y;
      float shimmer = noise(vec2(along * 2.5, vWorldPos.x * 1.2 - uFlowDir.x * uTime * 0.05));
      col += uColorShallow * (shimmer - 0.5) * 0.12 * river;

      // Pond ripples — expanding rings, unlike directional river flow
      vec2 rippleCenter = fract(vWorldPos.xz * 0.4) - 0.5;
      float rippleDist = length(rippleCenter);
      float ripple = sin(rippleDist * 14.0 - uTime * 2.2);
      ripple = smoothstep(0.5, 1.0, ripple * 0.5 + 0.5);
      col = mix(col, uColorFoam, ripple * 0.09 * pond * (0.4 + shallowMix));

      // --- Shore foam: constrained to actual shore cells ---
      float foamBand = 1.0 - smoothstep(0.03, 0.3, depth);
      float shoreFoam = foamBand * (0.5 + 0.5 * noise(vWorldPos.xz * 8.0 + uTime * 0.8));
      col = mix(col, uColorFoam, shoreFoam * 0.5);

      // --- Animated near-shore ripple ---
      float rippleMask = 1.0 - smoothstep(0.0, 0.7, depth);
      float shoreRipple = sin(depth * 60.0 - uTime * 3.0 + noise(vWorldPos.xz * 2.0) * 3.0);
      shoreRipple = smoothstep(0.4, 1.0, shoreRipple * 0.5 + 0.5) * rippleMask;
      col = mix(col, uColorFoam, shoreRipple * 0.18);

      // Interactive foam rings around supports/objects crossing water. Points
      // are supplied from live track/train layout; no foam meshes needed.
      float objectFoam = 0.0;
      for (int i = 0; i < ${MAX_FOAM_POINTS}; i++) {
        if (float(i) >= uFoamCount) break;
        float distanceToObject = distance(vWorldPos.xz, uFoamPoints[i].xz);
        float ring = 1.0 - smoothstep(0.045, 0.2, distanceToObject);
        float pulse = sin(distanceToObject * 48.0 - uTime * 3.2);
        pulse = 0.65 + 0.35 * smoothstep(0.0, 1.0, pulse * 0.5 + 0.5);
        objectFoam = max(objectFoam, ring * pulse);
      }
      col = mix(col, uColorFoam, objectFoam * 0.78);

      // --- Waterfall / steep-bank churn ---
      col = mix(col, uColorFoam, churn * 0.4);

      // --- Soft shallow caustics; disabled by blue-hour/night palette ---
      float caustic = sin(vWorldPos.x * 4.5 - uTime * 0.45) * sin(vWorldPos.z * 3.7 + uTime * 0.38);
      caustic = smoothstep(0.45, 0.9, caustic * 0.5 + 0.5);
      col += uSunColor * caustic * shallowMix * 0.055 * (1.0 - uNightness);

      // --- Broad Fresnel reflection, roughness keeps it calm ---
      vec3 viewDir = normalize(uCameraPos - vWorldPos);
      float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 2.5);
      col = mix(col, uSkyColor, fresnel * uReflectivity * (1.0 - uRoughness * 0.35));

      float alpha = 0.75;

      gl_FragColor = vec4(col, alpha);
    }
  `,
};

const WaterSurface = forwardRef(function WaterSurface({ terrainSize, heightData, timeOfDay, lighting, trackManager, trainManager, graphicsQuality = 'medium' }, ref) {
  const materialRef = useRef();
  const meshRef = useRef();
  const quality = getGraphicsQuality(graphicsQuality);
  const foamPoints = useMemo(
    () => Array.from({ length: MAX_FOAM_POINTS }, () => new THREE.Vector3(9999, 0, 9999)),
    [],
  );

  useImperativeHandle(ref, () => meshRef.current);

  const width = (terrainSize.length) * VOXEL_SIZE;
  const height = (terrainSize.breadth) * VOXEL_SIZE;
  const segments = quality.id === 'low' ? 48 : quality.id === 'high' ? 96 : 72;

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

  // River flows along the map's longer axis (directional streaks)
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
    if (lighting) {
      mat.uniforms.uColorDeep.value.copy(lighting.waterDeep);
      mat.uniforms.uColorShallow.value.copy(lighting.waterShallow);
      mat.uniforms.uColorFoam.value.copy(lighting.waterFoam);
      mat.uniforms.uColorSand.value.copy(lighting.waterSand);
      mat.uniforms.uSunColor.value.copy(lighting.sunTint);
      mat.uniforms.uSkyColor.value.copy(lighting.skyTint);
      mat.uniforms.uReflectivity.value = lighting.waterReflectivity;
      mat.uniforms.uRoughness.value = lighting.waterRoughness;
      mat.uniforms.uNightness.value = lighting.nightness;
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

  // Fallback: static time-of-day tint when no lighting state is provided
  useEffect(() => {
    if (!materialRef.current || lighting) return;
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
  }, [timeOfDay, lighting]);

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 2.0, 0]}
      receiveShadow
    >
      <planeGeometry args={[width, height, segments, segments]} />
      <shaderMaterial
        ref={materialRef}
        args={[WaterShader]}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        uniforms-uHeightMap-value={heightTexture}
        uniforms-uTerrainSize-value={new THREE.Vector2(terrainSize.length, terrainSize.breadth)}
        uniforms-uWaterY-value={2.0}
        uniforms-uFlowDir-value={flowDir}
        uniforms-uFoamPoints-value={foamPoints}
        uniforms-uFoamCount-value={0}
      />
    </mesh>
  );
});

export default WaterSurface;
