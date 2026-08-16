import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Per-kind particle tuning. Smoke: thick puffs from the smokestack.
// Dust: low brown puffs kicked up behind the wheels of a moving train.
const KINDS = {
  smoke: {
    count: 20,
    spawnY: 0.54,
    spawnZ: 0.26,
    size: [0.05, 0.1],
    rise: [0.16, 0.32],
    life: [1.0, 1.5],
    color: 0xc9c9c9, // light steam gray
    emissive: 0x9a9a9a, // stays visible (soft steam) even at night
    opacity: 0.3,
    spin: true,
  },
  dieselSmoke: {
    count: 14,
    spawnY: 0.36,
    spawnZ: 0.28,
    size: [0.035, 0.07],
    rise: [0.12, 0.24],
    life: [0.8, 1.2],
    color: 0x5a5c60, // light diesel exhaust
    emissive: 0x222222,
    opacity: 0.22,
    spin: true,
  },
  dust: {
    count: 18,
    spawnY: 0.06,
    spawnZ: -0.38,
    size: [0.04, 0.09],
    rise: [0.08, 0.2],
    life: [0.6, 1.0],
    color: 0x9a8568,
    emissive: 0x000000,
    opacity: 0.4,
    spin: false,
  },
};

// Shared per-kind resources — one geometry + one material for every train,
// never rebuilt per instance.
const PARTICLE_GEO = new THREE.DodecahedronGeometry(0.06, 0);
const PARTICLE_MATS = Object.fromEntries(
  Object.entries(KINDS).map(([kind, cfg]) => [
    kind,
    new THREE.MeshLambertMaterial({
      color: cfg.color,
      emissive: cfg.emissive,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: cfg.opacity,
      flatShading: true,
    }),
  ])
);

/**
 * Low-poly instanced particle system for trains.
 * - smoke: puffs vary with speed — fast trains trail smaller, quicker
 *   puffs; parked engines chuff big lazy clouds.
 * - dust: brown ground haze behind the wheels while moving.
 *
 * `target` is an Object3D (the train's world group). Its transform is read
 * imperatively every frame — no React re-renders while trains move. Train
 * state (active/speed) is read straight from the TrainManager.
 */
export default function SmokeParticles({ target, trainManager, trainId, engineType = 'steam-engine', kind = 'smoke' }) {
  const meshRef = useRef();
  const groupRef = useRef();

  if (kind === 'smoke' && engineType === 'electric-engine') {
    return null;
  }

  const effectiveKind =
    kind === 'smoke' && (engineType === 'diesel-engine' || engineType === 'checker-engine')
      ? 'dieselSmoke'
      : kind;

  const cfg = KINDS[effectiveKind] || KINDS.smoke;

  const particles = useMemo(() => {
    return Array.from({ length: cfg.count }, (_, i) => ({
      x: 0, y: 0, z: 0,
      size: cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]),
      life: i / cfg.count,
      maxLife: cfg.life[0] + Math.random() * (cfg.life[1] - cfg.life[0]),
      vx: 0,
      vy: cfg.rise[0] + Math.random() * (cfg.rise[1] - cfg.rise[0]),
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
  }, [cfg]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Follow the train imperatively (position/rotation set by TrainRenderer)
    if (target && groupRef.current) {
      groupRef.current.position.copy(target.position);
      groupRef.current.quaternion.copy(target.quaternion);
    }

    // Train state read live — no prop churn while the train moves.
    const train = trainManager?.getTrain?.(trainId);
    const active = !!train?.active;
    const speed = train?.speed ?? 0;

    // Speed factor: fast trains shed quicker, smaller particles
    const spd = Math.max(0, Math.min(1.5, speed));
    const speedRise = 1 + spd * 0.9;
    const speedSize = 1.15 - Math.min(1, spd) * 0.4;
    const speedLife = 1 - Math.min(1, spd) * 0.35;

    particles.forEach((p, i) => {
      if (active) {
        p.life += delta;
        if (p.life > p.maxLife) {
          // Respawn
          p.life = 0;
          p.x = (Math.random() - 0.5) * 0.03;
          p.y = cfg.spawnY;
          p.z = cfg.spawnZ + (Math.random() - 0.5) * 0.03;
          p.vx = p.driftX;
          p.vy = (cfg.rise[0] + Math.random() * (cfg.rise[1] - cfg.rise[0])) * speedRise;
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
        const growthScale = 1 + easeOutCubic(progress) * 2.2;
        // Fade-out scale
        const fadeScale = 1 - smoothstep(0.7, 1.0, progress);
        const currentScale = p.size * growthScale * fadeScale * speedSize;

        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.set(currentScale, currentScale, currentScale);
        if (cfg.spin) {
          dummy.quaternion.setFromAxisAngle(p.spinAxis, p.spinSpeed * p.life);
        } else {
          dummy.quaternion.identity();
        }
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      } else {
        // When inactive: scale to zero (no instant hide)
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={meshRef}
        args={[PARTICLE_GEO, PARTICLE_MATS[kind] || PARTICLE_MATS.smoke, cfg.count]}
      />
    </group>
  );
}
