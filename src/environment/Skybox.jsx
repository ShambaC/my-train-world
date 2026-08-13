import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Dynamic Skybox with Day/Night Cycle
 */
export default function Skybox({ timeOfDay = 'day', transitionSpeed = 1.0 }) {
  const { scene } = useThree();
  const skyboxRef = useRef(null);
  const currentTextureRef = useRef(null);

  useEffect(() => {
    // Load cubemap textures for the selected time of day
    const loader = new THREE.CubeTextureLoader();
    loader.setPath(`/textures/${timeOfDay}/`);

    const texture = loader.load(
      ['px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png'],
      () => {
        // On successful load, set as scene background
        if (currentTextureRef.current) {
          currentTextureRef.current.dispose();
        }
        scene.background = texture;
        currentTextureRef.current = texture;
      },
      undefined,
      (error) => {
        console.error('Error loading skybox:', error);
      }
    );

    return () => {
      // Cleanup on unmount
      if (currentTextureRef.current) {
        currentTextureRef.current.dispose();
      }
    };
  }, [timeOfDay, scene]);

  return null; // No visible component, just manages scene background
}

/**
 * Get lighting settings based on time of day.
 *
 * All presets share the same shape:
 * - ambient: hemisphere-style fill (dawn/dusk get a cool counter-fill so
 *   shadowed faces read blue against the warm sun).
 * - directional: the sun (moon at night). Low angle at dawn/dusk = long
 *   soft shadows; steep at day = strong readable contact shadows.
 * - fog: coordinated sky-tinted color + density per mood.
 * - skyTint/sunTint: what the water shader mixes toward at grazing angles
 *   and highlights.
 * - waterDeep/Shallow/Foam/Sand: per-preset water palette so lakes and
 *   rivers share the light mood.
 * - nightness 0..1: how dark the scene is — drives emissive/practical
 *   light emphasis and ambient effects (fireflies).
 * - shadowRadius: PCF softness of the directional shadow.
 */
export function getLightingForTime(timeOfDay) {
  const settings = {
    dawn: {
      ambient: { intensity: 0.55, color: 0x9db8d8 },   // cool fill separates shadows
      directional: { intensity: 0.9, color: 0xffa05a, position: [40, 14, 32] }, // warm low sun
      fog: { color: 0xffc9a3, density: 0.012 },         // mild warm mist
      skyTint: 0xffc9a0,
      sunTint: 0xff9a56,
      waterDeep: 0x16537e,
      waterShallow: 0x4699c4,
      waterFoam: 0xfff3e0,
      waterSand: 0xc9a06a,
      nightness: 0.15,
      shadowRadius: 6,
    },
    day: {
      ambient: { intensity: 0.7, color: 0xdfeefc },     // clear blue sky fill
      directional: { intensity: 1.15, color: 0xfff4e0, position: [50, 60, 30] },
      fog: { color: 0xd4e8f7, density: 0.008 },
      skyTint: 0x87ceeb,
      sunTint: 0xfff8e0,
      waterDeep: 0x0a5d8c,
      waterShallow: 0x2ba3c9,
      waterFoam: 0xe8f8ff,
      waterSand: 0xd9b878,
      nightness: 0,
      shadowRadius: 4,
    },
    dusk: {
      ambient: { intensity: 0.42, color: 0x6b6bd6 },    // blue/purple fill vs orange rim
      directional: { intensity: 0.75, color: 0xff6a2a, position: [28, 10, -38] },
      fog: { color: 0xff8c6e, density: 0.014 },         // warm horizon fog
      skyTint: 0xff9777,
      sunTint: 0xff8c47,
      waterDeep: 0x1e4d80,
      waterShallow: 0x4d7fae,
      waterFoam: 0xffd9c2,
      waterSand: 0xb58a60,
      nightness: 0.45,
      shadowRadius: 5,
    },
    night: {
      ambient: { intensity: 0.4, color: 0x22335c },    // low blue fill (brighten here: night.ambient.intensity)
      directional: { intensity: 0.3, color: 0x9fb8ff, position: [-25, 35, -20] }, // no moonlight — darkness carries the mood
      fog: { color: 0x1b2745, density: 0.02 },          // dark sky mist, tracks stay readable
      skyTint: 0x2b3a5f,
      sunTint: 0xa8c0ff,
      waterDeep: 0x0d2440,
      waterShallow: 0x1f3f66,
      waterFoam: 0x9fc0e8,
      waterSand: 0x4a5a76,
      nightness: 1,
      shadowRadius: 2,
    },
  };

  return settings[timeOfDay] || settings.day;
}
