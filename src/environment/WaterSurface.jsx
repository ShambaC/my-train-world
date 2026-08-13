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
    uColorSand: { value: new THREE.Color(0xd9b878) },
    uSunColor: { value: new THREE.Color(0xfff8e0) },
    uSkyColor: { value: new THREE.Color(0x87ceeb) },
    uCameraPos: { value: new THREE.Vector3() },
    uHeightMap: { value: null },
    uTerrainSize: { value: new THREE.Vector2(50, 50) },
    uWaterY: { value: 1.0 },
    uVoxel: { value: VOXEL_SIZE },
    uFlowDir: { value: new THREE.Vector2(0, 1) },
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
      e += sin(pos.x * 4.0 + uTime * 2.0) * 0.03;
      e += cos(pos.y * 3.5 - uTime * 1.5) * 0.026;
      e += sin((pos.x + pos.y) * 2.5 + uTime * 2.8) * 0.016;
      e += cos((pos.x - pos.y) * 5.0 + uTime * 3.5) * 0.009;

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
    uniform vec3 uColorSand;
    uniform vec3 uSunColor;
    uniform vec3 uSkyColor;
    uniform vec3 uCameraPos;
    uniform sampler2D uHeightMap;
    uniform vec2 uTerrainSize;
    uniform float uWaterY;
    uniform float uVoxel;
    uniform vec2 uFlowDir;
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

      // --- Waterfall / steep-bank churn ---
      col = mix(col, uColorFoam, churn * 0.4);

      // --- Subtle caustics, only in shallow water ---
      float caustic = sin(vWorldPos.x * 9.0 - uTime * 1.6) * sin(vWorldPos.z * 7.0 + uTime * 1.4);
      caustic = smoothstep(0.6, 1.0, caustic * 0.5 + 0.5);
      col += uSunColor * caustic * shallowMix * 0.1;

      // --- Fresnel: sky tint at grazing camera angles ---
      vec3 viewDir = normalize(uCameraPos - vWorldPos);
      float fresnel = pow(1.0 - max(dot(viewDir, vec3(0.0, 1.0, 0.0)), 0.0), 2.5);
      col = mix(col, uSkyColor, fresnel * 0.38);

      // Subtle sun sheen
      col += uSunColor * 0.04;

      float alpha = 0.75;

      gl_FragColor = vec4(col, alpha);
    }
  `,
};

export default function WaterSurface({ terrainSize, heightData, timeOfDay, lighting }) {
  const materialRef = useRef();
  const meshRef = useRef();
  const { camera } = useThree();

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
    mat.uniforms.uCameraPos.value.copy(camera.position);
    // Interpolated lighting state overrides the static preset mapping below
    if (lighting) {
      mat.uniforms.uColorDeep.value.copy(lighting.waterDeep);
      mat.uniforms.uColorShallow.value.copy(lighting.waterShallow);
      mat.uniforms.uColorFoam.value.copy(lighting.waterFoam);
      mat.uniforms.uColorSand.value.copy(lighting.waterSand);
      mat.uniforms.uSunColor.value.copy(lighting.sunTint);
      mat.uniforms.uSkyColor.value.copy(lighting.skyTint);
    }
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
        uniforms-uFlowDir-value={flowDir}
      />
    </mesh>
  );
}
