import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BIOME, mulberry32 } from '../terrain.js';

const FLY_COUNT = 120;
const CENTER_COUNT = 12;
const FLIES_PER_CENTER = FLY_COUNT / CENTER_COUNT;

/**
 * Low-density fireflies at night, placed in loose clusters. Half the
 * clusters hover over water, the rest gather on land near trees (forest
 * biome) and random meadow spots. Instanced additive spheres with per-point
 * drift; opacity follows LightingState.nightness so they fade out entirely
 * during day. Deterministic placement from the world seed.
 */
export default function Fireflies({ terrainData, lighting }) {
  const meshRef = useRef();

  const { positions, phases, base } = useMemo(() => {
    const length = terrainData?.length || 0;
    const breadth = terrainData?.breadth || 0;
    const heightMap = terrainData?.heightMap || null;
    const biomeMask = terrainData?.biomeMask || null;
    const waterLevel = terrainData?.waterLevel ?? 3;
    const seed = terrainData?.seed ?? 1337;

    const rng = mulberry32((seed * 999983) >>> 0);
    const waterCells = [];
    const forestCells = [];
    const meadowCells = [];

    if (heightMap) {
      for (let x = 3; x < length - 3; x += 2) {
        for (let z = 3; z < breadth - 3; z += 2) {
          const h = heightMap[x][z];
          if (h <= waterLevel) {
            waterCells.push({ x, z });
            continue;
          }
          const biome = biomeMask ? biomeMask[x * breadth + z] : BIOME.meadow;
          if (biome === BIOME.forest) {
            forestCells.push({ x, z });
          } else if (biome === BIOME.meadow) {
            // Keep meadow spots on gentle ground so flies hover sensibly
            const slope = Math.max(
              Math.abs(h - heightMap[x - 1][z]),
              Math.abs(h - heightMap[x + 1][z]),
              Math.abs(h - heightMap[x][z - 1]),
              Math.abs(h - heightMap[x][z + 1])
            );
            if (slope <= 1) meadowCells.push({ x, z });
          }
        }
      }
    }

    // Cluster centers: half water, the rest near trees / open land.
    const pools = [waterCells, forestCells, meadowCells];
    const weights = [0.5, 0.35, 0.15];
    const centers = [];
    for (let c = 0; c < CENTER_COUNT; c++) {
      let pool = null;
      let roll = rng();
      for (let p = 0; p < pools.length; p++) {
        if (pools[p].length > 0) {
          roll -= weights[p];
          if (roll <= 0) { pool = pools[p]; break; }
        }
      }
      if (!pool) {
        // fall back to any non-empty pool
        pool = pools.find((pl) => pl.length > 0) || [{ x: 0, z: 0 }];
      }
      centers.push(pool[Math.floor(rng() * pool.length)]);
    }

    const VOXEL = 0.5;
    const positions = new Float32Array(FLY_COUNT * 3);
    const phases = [];
    const base = [];

    for (let i = 0; i < FLY_COUNT; i++) {
      const center = centers[Math.floor((i / FLIES_PER_CENTER) % CENTER_COUNT)];
      const h = heightMap ? heightMap[center.x][center.z] : 0;
      const clusterR = 0.6 + rng() * 1.6;
      const angle = rng() * Math.PI * 2;
      const dist = clusterR * Math.sqrt(rng());
      const x = (center.x - length / 2 + 0.5 + Math.cos(angle) * dist) * VOXEL;
      const z = (center.z - breadth / 2 + 0.5 + Math.sin(angle) * dist) * VOXEL;
      const y = h * VOXEL + 0.25 + 0.3 + rng() * 1.3;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
      base.push({ x, y, z });
      phases.push({
        t: rng() * Math.PI * 2,
        speed: 0.3 + rng() * 0.7,
        amp: 0.12 + rng() * 0.25,
        yAmp: 0.05 + rng() * 0.12,
      });
    }

    return { positions, phases, base };
  }, [terrainData]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < FLY_COUNT; i++) {
      const b = base[i];
      const ph = phases[i];
      dummy.position.set(
        b.x + Math.sin(t * ph.speed + ph.t) * ph.amp,
        b.y + Math.sin(t * ph.speed * 1.3 + ph.t * 2) * ph.yAmp,
        b.z + Math.cos(t * ph.speed * 0.8 + ph.t) * ph.amp * 0.8
      );
      // Pulse the size slightly for a twinkle
      const s = 0.07 + 0.02 * Math.sin(t * 3 + ph.t * 2);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (lighting) {
      meshRef.current.material.opacity = lighting.nightness * 0.9;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, FLY_COUNT]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial
        color={0xffe9a8}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
