import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 15;

/**
 * Low-poly smoke particle system for trains
 */
export default function SmokeParticles({ position, rotation, active }) {
  const meshRef = useRef();
  
  // Create particle state pool
  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: 0,
      y: 0,
      z: 0,
      size: 0.03 + Math.random() * 0.04,
      life: i / PARTICLE_COUNT, // Stagger initial life
      maxLife: 1.2 + Math.random() * 0.6,
      vx: (Math.random() - 0.5) * 0.05,
      vy: 0.2 + Math.random() * 0.2,
      vz: (Math.random() - 0.5) * 0.05,
    }));
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    particles.forEach((p, index) => {
      if (active) {
        p.life += delta;
        if (p.life > p.maxLife) {
          p.life = 0;
          p.x = 0;
          p.y = 0.45; // Top of smokestack
          p.z = 0.25;
        }

        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.z += p.vz * delta;

        const progress = p.life / p.maxLife;
        const currentScale = p.size * (1 + progress * 2.5);

        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.set(currentScale, currentScale, currentScale);
        dummy.updateMatrix();

        meshRef.current.setMatrixAt(index, dummy.matrix);
      } else {
        // Hide particles when train is stopped
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(index, dummy.matrix);
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group position={position} rotation={rotation}>
      <instancedMesh
        ref={meshRef}
        args={[null, null, PARTICLE_COUNT]}
      >
        <dodecahedronGeometry args={[0.05, 0]} />
        <meshLambertMaterial
          color={0xcccccc}
          transparent
          opacity={0.6}
          flatShading
        />
      </instancedMesh>
    </group>
  );
}
