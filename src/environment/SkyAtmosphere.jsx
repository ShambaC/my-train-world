/**
 * Procedural Sky, Lighting and Cloud Atmosphere (Tiny Glade Style)
 * Art-directed painterly gradient dome with luminous pastel horizons,
 * hemisphere ground bounce, and drifting cloud cylinders.
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
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
      ambient: { intensity: 0.85, color: 0xc4aed4 },
      hemisphereSky: 0xd8bce2,
      hemisphereGround: 0x6e5c4a,
      directional: { intensity: 1.1, color: 0xffaf75, position: [40, 20, 30] },
      fog: { color: 0xf5cfb8, density: 0.007 },
      skyZenith: 0x7685ba,
      skyHorizon: 0xfcc4aa,
      skyGround: 0x9c7a65,
      sunTint: 0xffb57d,
      waterDeep: 0x051622,
      waterShallow: 0x144252,
      waterFoam: 0xfff3e6,
      waterSand: 0xa88a4c,
      nightness: 0.1,
      shadowRadius: 4,
    },
    day: {
      ambient: { intensity: 0.95, color: 0xb5d8f7 },
      hemisphereSky: 0x9ecbf5,
      hemisphereGround: 0x557d44,
      directional: { intensity: 1.25, color: 0xfff7e8, position: [45, 65, 30] },
      fog: { color: 0xd8eaf8, density: 0.005 },
      skyZenith: 0x62a6e8,
      skyHorizon: 0xd6eafc,
      skyGround: 0x6b945c,
      sunTint: 0xfffaee,
      waterDeep: 0x01131c,
      waterShallow: 0x074550,
      waterFoam: 0xf5fbfb,
      waterSand: 0xa88a4c,
      nightness: 0.0,
      shadowRadius: 4,
    },
    dusk: {
      ambient: { intensity: 0.75, color: 0x7e70a8 },
      hemisphereSky: 0x997bbd,
      hemisphereGround: 0x58443e,
      directional: { intensity: 0.95, color: 0xff7b48, position: [30, 14, -38] },
      fog: { color: 0xc97b6a, density: 0.009 },
      skyZenith: 0x4d3e75,
      skyHorizon: 0xf28b62,
      skyGround: 0x63403a,
      sunTint: 0xff8550,
      waterDeep: 0x081320,
      waterShallow: 0x183446,
      waterFoam: 0xffdac2,
      waterSand: 0x9e6a45,
      nightness: 0.4,
      shadowRadius: 4,
    },
    night: {
      ambient: { intensity: 0.45, color: 0x223048 },
      hemisphereSky: 0x283854,
      hemisphereGround: 0x18202c,
      directional: { intensity: 0.35, color: 0x7da4d4, position: [20, 50, 15] },
      fog: { color: 0x141e2e, density: 0.012 },
      skyZenith: 0x0c1422,
      skyHorizon: 0x182436,
      skyGround: 0x101824,
      sunTint: 0x8ab2e2,
      waterDeep: 0x01050a,
      waterShallow: 0x020f17,
      waterFoam: 0x9ebad8,
      waterSand: 0x3d3525,
      nightness: 0.9,
      shadowRadius: 6,
    },
  };

  return presets[timeOfDay] || presets.day;
}

const SkyDomeShader = {
  uniforms: {
    uZenith: { value: new THREE.Color(0x62a6e8) },
    uHorizon: { value: new THREE.Color(0xd6eafc) },
    uGround: { value: new THREE.Color(0x6b945c) },
    uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
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
        ? mix(uHorizon, uZenith, pow(y, 0.6))
        : mix(uHorizon, uGround, clamp(-y * 2.5, 0.0, 1.0));

      // Luminous sun halo glow
      float sunDot = max(dot(dir, uSunDir), 0.0);
      sky += vec3(1.0, 0.96, 0.88) * pow(sunDot, 48.0) * 0.45;

      gl_FragColor = vec4(sky, 1.0);
    }
  `,
};

export default function SkyAtmosphere({ timeOfDay = 'day', lighting }) {
  const domeRef = useRef();
  const cloudsRef1 = useRef();
  const cloudsRef2 = useRef();
  const cloudsRef3 = useRef();

  const cloudTexA = useMemo(() => getStyleTexture('cloud_large_a', { repeat: [8, 1] }), []);
  const cloudTexB = useMemo(() => getStyleTexture('cloud_medium_a', { repeat: [6, 1] }), []);
  const cloudTexHaze = useMemo(() => getStyleTexture('cloud_haze_a', { repeat: [10, 1] }), []);

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
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [cloudTexA]);

  const cloudMat2 = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: cloudTexB,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [cloudTexB]);

  const cloudMat3 = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: cloudTexHaze,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [cloudTexHaze]);

  useFrame(() => {
    if (lighting) {
      skyMat.uniforms.uZenith.value.copy(lighting.skyZenith || lighting.skyTint);
      skyMat.uniforms.uHorizon.value.copy(lighting.fog.color);
      skyMat.uniforms.uGround.value.copy(lighting.skyGround || lighting.fog.color);
      skyMat.uniforms.uSunDir.value.copy(lighting.sun.position).normalize();

      const cloudLit = new THREE.Color().copy(lighting.sun.color).lerp(new THREE.Color(0xffffff), 0.45);
      cloudMat1.color.copy(cloudLit);
      cloudMat2.color.copy(cloudLit);
      cloudMat3.color.copy(lighting.fog.color);
    }

    const t = windTime;
    if (cloudsRef1.current) {
      cloudsRef1.current.rotation.y = t * 0.008;
    }
    if (cloudsRef2.current) {
      cloudsRef2.current.rotation.y = -t * 0.005 + 1.2;
    }
    if (cloudsRef3.current) {
      cloudsRef3.current.rotation.y = t * 0.003 + 2.5;
    }
  });

  return (
    <group name="SkyAtmosphere">
      {/* Luminous Sky Gradient Dome */}
      <mesh ref={domeRef} material={skyMat} renderOrder={-10}>
        <sphereGeometry args={[180, 32, 20]} />
      </mesh>

      {/* Distant Atmospheric Haze Band */}
      <mesh ref={cloudsRef3} position={[0, 18, 0]} material={cloudMat3} renderOrder={-9}>
        <cylinderGeometry args={[120, 120, 22, 32, 1, true]} />
      </mesh>

      {/* Fluffy Cloud Layer 1 */}
      <mesh ref={cloudsRef1} position={[0, 26, 0]} material={cloudMat1} renderOrder={-8}>
        <cylinderGeometry args={[85, 85, 24, 32, 1, true]} />
      </mesh>

      {/* Fluffy Cloud Layer 2 */}
      <mesh ref={cloudsRef2} position={[0, 36, 0]} material={cloudMat2} renderOrder={-7}>
        <cylinderGeometry args={[100, 100, 26, 32, 1, true]} />
      </mesh>
    </group>
  );
}
