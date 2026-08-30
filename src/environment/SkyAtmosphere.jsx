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
      waterDeep: 0x144963,
      waterShallow: 0x3d9bb5,
      waterFoam: 0xfff3e6,
      waterSand: 0xdeb878,
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
      waterDeep: 0x0a485c,
      waterShallow: 0x28a69e,
      waterFoam: 0xf4fbfb,
      waterSand: 0xdfc48c,
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
      waterDeep: 0x183b57,
      waterShallow: 0x486b87,
      waterFoam: 0xffdac2,
      waterSand: 0xb8805c,
      nightness: 0.4,
      shadowRadius: 4,
    },
    night: {
      ambient: { intensity: 0.55, color: 0x2e3f6e },
      hemisphereSky: 0x364c7d,
      hemisphereGround: 0x1c2336,
      directional: { intensity: 0.42, color: 0xa8c2f8, position: [-25, 42, -22] },
      fog: { color: 0x202b45, density: 0.012 },
      skyZenith: 0x111c2e,
      skyHorizon: 0x283a61,
      skyGround: 0x0e141f,
      sunTint: 0xa8c2f8,
      waterDeep: 0x0c1e33,
      waterShallow: 0x1d3754,
      waterFoam: 0x9bb5d9,
      waterSand: 0x434f63,
      nightness: 1.0,
      shadowRadius: 2,
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
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [cloudTexA]);

  const cloudMat2 = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      map: cloudTexB,
      transparent: true,
      opacity: 0.8,
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

      const cloudColor = lighting.sun.color;
      cloudMat1.color.copy(cloudColor);
      cloudMat2.color.copy(cloudColor);
    }

    const t = windTime;
    if (cloudsRef1.current) {
      cloudsRef1.current.rotation.y = t * 0.006;
    }
    if (cloudsRef2.current) {
      cloudsRef2.current.rotation.y = -t * 0.004 + 1.2;
    }
  });

  return (
    <group name="SkyAtmosphere">
      {/* Luminous Sky Gradient Dome */}
      <mesh ref={domeRef} material={skyMat}>
        <sphereGeometry args={[180, 24, 16]} />
      </mesh>

      {/* Fluffy Cloud Layer 1 */}
      <mesh ref={cloudsRef1} position={[0, 44, 0]} material={cloudMat1}>
        <cylinderGeometry args={[130, 130, 30, 24, 1, true]} />
      </mesh>

      {/* Fluffy Cloud Layer 2 */}
      <mesh ref={cloudsRef2} position={[0, 56, 0]} material={cloudMat2}>
        <cylinderGeometry args={[150, 150, 26, 24, 1, true]} />
      </mesh>
    </group>
  );
}
