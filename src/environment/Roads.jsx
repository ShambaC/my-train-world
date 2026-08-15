import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createRoadMeshes } from './roadNetwork.js';

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
    return createRoadMeshes(roadManager.layout);
  }, [layoutVersion, roadManager]);

  // Fade lamp glow with the time of day (shared nightGlow materials).
  useFrame(() => {
    if (!groupRef.current) return;
    const nightness = lighting ? lighting.nightness : 0.6;
    const g = groupRef.current.userData;
    if (g.glowCore) g.glowCore.material.opacity = 0.04 + nightness * 0.81;
    if (g.glowHalo) g.glowHalo.material.opacity = 0.02 + nightness * 0.33;
  });

  if (!group) return null;

  return <primitive ref={groupRef} object={group} visible={enabled} />;
}
