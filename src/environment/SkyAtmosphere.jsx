/**
 * Procedural Sky and Cloud Cylinder Renderer
 * Replaces static cube maps with an art-directed painterly gradient dome
 * and drifting cloud layers.
 */
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { getStyleTexture } from '../utils/atlasTextures.js';
import { windTime } from './wind.js';

export const SKYBOX_TIMES = ['dawn', 'day', 'dusk', 'night'];
export const SKYBOX_COUNT = SKYBOX_TIMES.length;

export function preloadSkyboxes(onProgress) {
  onProgress?.(1);
  return Promise.resolve();
}

export function getLightingForTime(timeOfDay) {
  const presets = {
    dawn: {
      ambient: { intensity: 0.65, color: 0xb498c4 },
      hemisphereSky: 0xc8a8d8,
      hemisphereGround: 0x5a4866,
      directional: { intensity: 0.95, color: 0xffa468, position: [40, 16, 30] },
      fog: { color: 0xf2bfa0, density: 0.01 },
      skyZenith: 0x6e78a8,
      skyHorizon: 0xf5b89a,
      skyGround: 0x8a6e60,
      sunTint: 0xffa86c,
      waterDeep: 0x1a466b,
      waterShallow: 0x488cb8,
      waterFoam: 0xfff0dc,
      waterSand: 0xd4a872,
      nightness: 0.15,
      shadowRadius: 5,
    },
    day: {
      ambient: { intensity: 0.75, color: 0x9bc2e6 },
      hemisphereSky: 0xaad4f5,
      hemisphereGround: 0x526b48,
      directional: { intensity: 1.15, color: 0xfffaed, position: [45, 65, 28] },
      fog: { color: 0xd6e8f7, density: 0.007 },
      skyZenith: 0x68a5db,
      skyHorizon: 0xcfe2f5,
      skyGround: 0x688c5e,
      sunTint: 0xfffaec,
      waterDeep: 0x0f5b8a,
      waterShallow: 0x2ea5cb,
      waterFoam: 0xe8f8ff,
      waterSand: 0xdeb878,
      nightness: 0.0,
      shadowRadius: 4,
    },
    dusk: {
      ambient: { intensity: 0.55, color: 0x6b5e9c },
      hemisphereSky: 0x8368ab,
      hemisphereGround: 0x47384a,
      directional: { intensity: 0.85, color: 0xff6e38, position: [30, 12, -38] },
      fog: { color: 0xba6a5d, density: 0.012 },
      skyZenith: 0x443a6b,
      skyHorizon: 0xeb7c52,
      skyGround: 0x543638,
      sunTint: 0xff733c,
      waterDeep: 0x1f3c66,
      waterShallow: 0x4f6494,
      waterFoam: 0xffd2ba,
      waterSand: 0xb57a58,
      nightness: 0.45,
      shadowRadius: 5,
    },
    night: {
      ambient: { intensity: 0.48, color: 0x24335c },
      hemisphereSky: 0x2a3d69,
      hemisphereGround: 0x151b2e,
      directional: { intensity: 0.35, color: 0x9cb8f0, position: [-25, 38, -22] },
      fog: { color: 0x1c253d, density: 0.016 },
      skyZenith: 0x0f1829,
      skyHorizon: 0x223254,
      skyGround: 0x0c1017,
      sunTint: 0x9bb5eb,
      waterDeep: 0x0b1d33,
      waterShallow: 0x1c3452,
      waterFoam: 0x8ea8cf,
      waterSand: 0x3d495c,
      nightness: 1.0,
      shadowRadius: 2,
    },
  };

  return presets[timeOfDay] || presets.day;
}

const SkyDomeShader = {
  uniforms: {
    uZenith: { value: new THREE.Color(0x68a5db) },
    uHorizon: { value: new THREE.Color(0xcfe2f5) },
    uGround: { value: new THREE.Color(0x688c5e) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vWorldPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uZenith;
    uniform vec3 uHorizon;
    uniform vec3 uGround;
    uniform vec3 uSunDir;
    varying vec3 vWorldPosition;

    void main() {
      vec3 dir = normalize(vWorldPosition);
      float y = dir.y;
      vec3 sky = y > 0.0 
        ? mix(uHorizon, uZenith, pow(y, 0.65))
        : mix(uHorizon, uGround, clamp(-y * 2.5, 0.0, 1.0));

      // Sun halo glow
      float sunDot = max(dot(dir, uSunDir), 0.0);
      sky += vec3(1.0, 0.95, 0.85) * pow(sunDot, 64.0) * 0.4;

      gl_FragColor = vec4(sky, 1.0);
    }
  `,
};

export default function SkyAtmosphere({ timeOfDay = 'day', lighting }) {
  const domeRef = useRef();
  const cloudsRef1 = useRef();
  const cloudsRef2 = useRef();

  const cloudTexA = useMemo(() => getStyleTexture('cloud_large_a'), []);
  const cloudTexB = useMemo(() => getStyleTexture('cloud_medium_a'), []);

  const skyMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(SkyDomeShader.uniforms),
      vertexShader: SkyDomeShader.vertexShader,
      fragmentShader: SkyDomeShader.fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, []);

  const cloudMat1 = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: cloudTexA,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [cloudTexA]);

  const cloudMat2 = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: cloudTexB,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [cloudTexB]);

  useFrame(() => {
    if (lighting) {
      skyMat.uniforms.uZenith.value.copy(lighting.skyZenith || lighting.skyTint);
      skyMat.uniforms.uHorizon.value.copy(lighting.fog.color);
      skyMat.uniforms.uGround.value.copy(lighting.skyGround || lighting.fog.color);
      skyMat.uniforms.uSunDir.value.copy(lighting.sun.position).normalize();

      // Cloud tinting with lighting state
      const cloudColor = lighting.sun.color;
      cloudMat1.color.copy(cloudColor);
      cloudMat2.color.copy(cloudColor);
    }

    const t = windTime;
    if (cloudsRef1.current) {
      cloudsRef1.current.rotation.y = t * 0.008;
    }
    if (cloudsRef2.current) {
      cloudsRef2.current.rotation.y = -t * 0.005 + 1.5;
    }
  });

  return (
    <group name="SkyAtmosphere">
      {/* Sky Gradient Dome */}
      <mesh ref={domeRef} material={skyMat}>
        <sphereGeometry args={[180, 24, 16]} />
      </mesh>

      {/* Cloud Cylinder Layer 1 */}
      <mesh ref={cloudsRef1} position={[0, 42, 0]} material={cloudMat1}>
        <cylinderGeometry args={[130, 130, 28, 24, 1, true]} />
      </mesh>

      {/* Cloud Cylinder Layer 2 */}
      <mesh ref={cloudsRef2} position={[0, 52, 0]} material={cloudMat2}>
        <cylinderGeometry args={[150, 150, 24, 24, 1, true]} />
      </mesh>
    </group>
  );
}
