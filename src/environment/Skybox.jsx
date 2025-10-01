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
 * Get lighting settings based on time of day
 */
export function getLightingForTime(timeOfDay) {
  const settings = {
    dawn: {
      ambient: { intensity: 0.4, color: 0xffa07a },
      directional: { intensity: 0.6, color: 0xffb347, position: [30, 20, 30] },
      fog: { color: 0xffa07a, near: 50, far: 200 },
    },
    day: {
      ambient: { intensity: 0.6, color: 0xffffff },
      directional: { intensity: 1.0, color: 0xffffff, position: [50, 50, 25] },
      fog: { color: 0x87ceeb, near: 100, far: 300 },
    },
    dusk: {
      ambient: { intensity: 0.3, color: 0xff6b47 },
      directional: { intensity: 0.5, color: 0xff8c47, position: [30, 15, -30] },
      fog: { color: 0xff6b47, near: 40, far: 180 },
    },
    night: {
      ambient: { intensity: 0.2, color: 0x4169e1 },
      directional: { intensity: 0.3, color: 0x6495ed, position: [-20, 30, -20] },
      fog: { color: 0x191970, near: 30, far: 150 },
    },
  };

  return settings[timeOfDay] || settings.day;
}
