import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const PARTICLE_COUNT = 35;

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Low-poly smoke particle system for trains.
 * Thick, dark, visible puffs.
 */
export default function SmokeParticles({ position, rotation, active }) {
  const meshRef = useRef();

  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      x: 0, y: 0, z: 0,
      size: 0.05 + Math.random() * 0.06, // Bigger particles
      life: i / PARTICLE_COUNT,
      maxLife: 1.0 + Math.random() * 0.5,
      vx: 0,
      vy: 0.3 + Math.random() * 0.25,
      vz: 0,
      spinAxis: new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5,
      ).normalize(),
      spinSpeed: 0.5 + Math.random() * 1.5,
      wobblePhase: Math.random() * Math.PI * 2,
      driftX: (Math.random() - 0.5) * 0.06,
      driftZ: (Math.random() - 0.5) * 0.06,
    }));
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorA = useMemo(() => new THREE.Color(0x333333), []); // Dark smoke
  const colorB = useMemo(() => new THREE.Color(0x888888), []); // Lighter as it fades
  const tempColor = useMemo(() => new THREE.Color(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    particles.forEach((p, i) => {
      if (active) {
        p.life += delta;
        if (p.life > p.maxLife) {
          // Respawn
          p.life = 0;
          p.x = (Math.random() - 0.5) * 0.03;
          p.y = 0.52;
          p.z = 0.25 + (Math.random() - 0.5) * 0.03;
          p.vx = p.driftX;
          p.vy = 0.3 + Math.random() * 0.25;
          p.vz = p.driftZ;
        }

        p.x += p.vx * delta;
        p.y += p.vy * delta;
        p.z += p.vz * delta;
        // Lateral wobble
        p.x += Math.sin(p.life * 3 + p.wobblePhase) * 0.06 * delta;
        p.z += Math.cos(p.life * 2.5 + p.wobblePhase) * 0.04 * delta;

        const progress = p.life / p.maxLife;
        // Ease-out growth - thicker
        const growthScale = 1 + easeOutCubic(progress) * 3.0;
        // Fade-out scale
        const fadeScale = 1 - smoothstep(0.7, 1.0, progress);
        const currentScale = p.size * growthScale * fadeScale;

        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.set(currentScale, currentScale, currentScale);
        // Spin rotation
        dummy.quaternion.setFromAxisAngle(p.spinAxis, p.spinSpeed * p.life);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);

        // Color fade: dark gray → lighter gray
        tempColor.copy(colorA).lerp(colorB, progress);
        meshRef.current.setColorAt(i, tempColor);
      } else {
        // When inactive: scale to zero (no instant hide)
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <group position={position} rotation={rotation}>
      <instancedMesh
        ref={meshRef}
        args={[null, null, PARTICLE_COUNT]}
      >
        <dodecahedronGeometry args={[0.06, 0]} />
        <meshLambertMaterial
          color={0xffffff}
          transparent
          opacity={0.65}
          flatShading
        />
      </instancedMesh>
    </group>
  );
}
