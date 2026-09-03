import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRoadMeshes } from './roadNetwork.js';

// Fixed spotlight pool for street lamps. Constant light count = one shader
// compile, no recompilation spikes while exploring; lights are assigned to
// the nearest lamps every frame.
const LAMP_LIGHT_COUNT = 8;
const LAMP_RANGE = 30;
const LAMP_MAX = 625; // 25^2 — light budget cutoff

/**
 * Roads — renders the deterministic scenery road network.
 *
 * Builds the road layout once per terrain (roadManager holds the data so
 * crossings and traffic can share it) and renders it as a few instanced
 * meshes. Lamp glow fades with nightness, following the shared lighting.
 */
export default function Roads({ terrainData, roadManager, lighting, enabled = true }) {
  const groupRef = useRef();
  const [layoutVersion, setLayoutVersion] = useState(0);

  // Build/replace the layout when the terrain changes, then force a
  // re-render so the instanced meshes rebuild (and consumers like
  // ScatterProps see the new road version in the same commit).
  useEffect(() => {
    if (!roadManager) return;
    if (terrainData) roadManager.build(terrainData);
    else roadManager.clear();
    setLayoutVersion((v) => v + 1);

    // User road placement changes roadManager.version outside React
    // renders — poll and re-render so new roads appear.
    let lastVersion = roadManager.version;
    const interval = setInterval(() => {
      if (roadManager.version !== lastVersion) {
        lastVersion = roadManager.version;
        setLayoutVersion((v) => v + 1);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [terrainData, roadManager]);

  // Road meshes are static — build once per layout version.
  const group = useMemo(() => {
    if (!roadManager?.ready) return null;
    const g = createRoadMeshes(roadManager.layout);

    // Spotlight pool: constant count, assigned to nearest lamps per frame.
    const lampLights = [];
    for (let i = 0; i < LAMP_LIGHT_COUNT; i++) {
      const light = new THREE.SpotLight(0xffd9a0, 0, 7, Math.PI / 4, 0.5, 2);
      const target = new THREE.Object3D();
      target.position.set(0, -1, 0);
      light.target = target;
      g.add(target);
      g.add(light);
      lampLights.push(light);
    }
    g.userData.lampLights = lampLights;
    return g;
  }, [layoutVersion, roadManager]);

  // Fade lamp glow with the time of day (shared nightGlow materials).
  // Spotlights stay off in daylight; the pool follows the camera.
  useFrame((state) => {
    if (!groupRef.current) return;
    const nightness = lighting ? lighting.nightness : 0.6;
    const g = groupRef.current.userData;
    if (g.glowCore) g.glowCore.material.opacity = nightness * 0.81;
    if (g.glowHalo) g.glowHalo.material.opacity = nightness * 0.33;


    const cam = state.camera.position;
    const lamps = roadManager?.layout?.lamps || [];
    // Pick the nearest lamps within range (top-8 selection).
    const nearest = [];
    for (const l of lamps) {
      const dx = l.x - cam.x;
      const dz = l.z - cam.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > LAMP_RANGE * LAMP_RANGE) continue;
      if (nearest.length < LAMP_LIGHT_COUNT) {
        nearest.push({ l, d2 });
        nearest.sort((a, b) => a.d2 - b.d2);
      } else if (d2 < nearest[nearest.length - 1].d2) {
        nearest[nearest.length - 1] = { l, d2 };
        nearest.sort((a, b) => a.d2 - b.d2);
      }
    }

    const lights = g.lampLights || [];
    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];
      const hit = nearest[i];
      if (hit) {
        light.position.set(hit.l.x, hit.l.y + 0.55, hit.l.z);
        light.target.position.set(hit.l.x, hit.l.y - 1, hit.l.z);
        light.intensity = nightness * 6; // ~0.65x the train headlight
      } else {
        light.intensity = 0;
      }
    }
  });

  if (!group) return null;

  return <primitive ref={groupRef} object={group} visible={enabled} />;
}
