import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { trainAudio } from '../audio/trainAudio';

const MAX_BURSTS = 32;
const PARTICLES_PER_BURST = 8;
const PARTICLE_COUNT = MAX_BURSTS * PARTICLES_PER_BURST;
const BURST_LIFE = 0.72;
const CHAIN_DELAY = 0.2;
const PARTICLE_LIFE = 0.72;

const BURST_GEO = new THREE.IcosahedronGeometry(0.28, 0);
const RING_GEO = new THREE.RingGeometry(0.16, 0.24, 12);
const FLASH_GEO = new THREE.SphereGeometry(0.42, 12, 8);
const DUMMY = new THREE.Object3D();
const ORANGE = new THREE.Color(0xff5a18);
const YELLOW = new THREE.Color(0xffd44a);
const SMOKE = new THREE.Color(0x3f3029);

function randomUnit() {
  const x = Math.random() * 2 - 1;
  const y = Math.random() * 2 - 0.5;
  const z = Math.random() * 2 - 1;
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}

function createEffect(event) {
  const chainPoints = (event.chainPoints || [event.contact]).slice(0, MAX_BURSTS);
  const burstCount = Math.max(1, chainPoints.length);
  const burstStarts = new Float32Array(burstCount);
  const burstPositions = new Float32Array(burstCount * 3);
  for (let i = 0; i < burstCount; i++) {
    const point = chainPoints[i];
    burstStarts[i] = i * CHAIN_DELAY;
    burstPositions[i * 3] = point.x;
    burstPositions[i * 3 + 1] = point.y + 0.2;
    burstPositions[i * 3 + 2] = point.z;
  }

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const particleBurst = new Uint8Array(PARTICLE_COUNT);
  const particleAge = new Float32Array(PARTICLE_COUNT);
  const particleLife = new Float32Array(PARTICLE_COUNT);
  const velocityX = new Float32Array(PARTICLE_COUNT);
  const velocityY = new Float32Array(PARTICLE_COUNT);
  const velocityZ = new Float32Array(PARTICLE_COUNT);

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const burst = i % burstCount;
    const offset = i * 3;
    const direction = randomUnit();
    const speed = 0.7 + Math.random() * 1.7;
    particleBurst[i] = burst;
    particleAge[i] = -1;
    particleLife[i] = PARTICLE_LIFE * (0.75 + Math.random() * 0.5);
    velocityX[i] = direction.x * speed;
    velocityY[i] = direction.y * speed + 0.8;
    velocityZ[i] = direction.z * speed;
    positions[offset] = burstPositions[burst * 3];
    positions[offset + 1] = -1000;
    positions[offset + 2] = burstPositions[burst * 3 + 2];
    const color = i % 3 === 0 ? SMOKE : (i % 2 === 0 ? ORANGE : YELLOW);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, PARTICLE_COUNT);

  const particleMaterial = new THREE.PointsMaterial({
    size: 0.14,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const points = new THREE.Points(geometry, particleMaterial);
  points.frustumCulled = false;

  const burstMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const bursts = new THREE.InstancedMesh(BURST_GEO, burstMaterial, MAX_BURSTS);
  bursts.frustumCulled = false;
  bursts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < MAX_BURSTS; i++) {
    bursts.setColorAt(i, i % 2 === 0 ? ORANGE : YELLOW);
    DUMMY.position.set(0, -1000, 0);
    DUMMY.scale.setScalar(0);
    DUMMY.updateMatrix();
    bursts.setMatrixAt(i, DUMMY.matrix);
  }
  bursts.instanceColor.needsUpdate = true;

  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xffa52f,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const rings = new THREE.InstancedMesh(RING_GEO, ringMaterial, MAX_BURSTS);
  rings.frustumCulled = false;
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let i = 0; i < MAX_BURSTS; i++) {
    DUMMY.position.set(0, -1000, 0);
    DUMMY.rotation.set(-Math.PI / 2, 0, 0);
    DUMMY.scale.setScalar(0);
    DUMMY.updateMatrix();
    rings.setMatrixAt(i, DUMMY.matrix);
  }

  const flashMaterial = new THREE.MeshBasicMaterial({
    color: 0xfff0a0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const flash = new THREE.Mesh(FLASH_GEO, flashMaterial);
  flash.position.set(event.contact.x, event.contact.y + 0.2, event.contact.z);

  const group = new THREE.Group();
  group.name = `collision_explosion_${event.id}`;
  group.add(points);
  group.add(bursts);
  group.add(rings);
  group.add(flash);
  return {
    id: event.id,
    group,
    points,
    bursts,
    rings,
    flash,
    burstCount,
    burstStarts,
    burstPositions,
    positions,
    positionAttribute,
    particleBurst,
    particleAge,
    particleLife,
    velocityX,
    velocityY,
    velocityZ,
    age: 0,
    duration: Math.max(1.55, (burstCount - 1) * CHAIN_DELAY + BURST_LIFE + 0.25),
  };
}

function updateEffect(effect, delta) {
  effect.age += Math.min(delta, 0.05);
  const burstOpacity = Math.max(0, 1 - Math.max(0, effect.age - effect.duration + 0.7) / 0.7);
  effect.bursts.material.opacity = burstOpacity;
  effect.rings.material.opacity = burstOpacity * 0.75;
  effect.points.material.opacity = burstOpacity * 0.92;

  for (let i = 0; i < effect.burstCount; i++) {
    const localAge = effect.age - effect.burstStarts[i];
    const offset = i * 3;
    if (localAge < 0 || localAge > BURST_LIFE) {
      DUMMY.position.set(0, -1000, 0);
      DUMMY.scale.setScalar(0);
      DUMMY.updateMatrix();
      effect.bursts.setMatrixAt(i, DUMMY.matrix);
      effect.rings.setMatrixAt(i, DUMMY.matrix);
      continue;
    }

    const growth = Math.min(1, localAge / 0.12);
    const fade = 1 - localAge / BURST_LIFE;
    const pulse = 0.72 + Math.sin(localAge * 28) * 0.12;
    DUMMY.position.set(effect.burstPositions[offset], effect.burstPositions[offset + 1], effect.burstPositions[offset + 2]);
    DUMMY.scale.setScalar((0.18 + growth * 0.34) * (0.65 + fade * 0.35) * pulse);
    DUMMY.rotation.set(localAge * 3, localAge * 5, localAge * 2);
    DUMMY.updateMatrix();
    effect.bursts.setMatrixAt(i, DUMMY.matrix);

    DUMMY.scale.setScalar((0.5 + localAge * 1.5) * fade);
    DUMMY.rotation.set(-Math.PI / 2, 0, 0);
    DUMMY.updateMatrix();
    effect.rings.setMatrixAt(i, DUMMY.matrix);
  }
  effect.bursts.instanceMatrix.needsUpdate = true;
  effect.rings.instanceMatrix.needsUpdate = true;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const burst = effect.particleBurst[i];
    if (effect.particleAge[i] < 0) {
      if (effect.age < effect.burstStarts[burst]) continue;
      effect.particleAge[i] = 0;
      const offset = i * 3;
      const burstOffset = burst * 3;
      effect.positions[offset] = effect.burstPositions[burstOffset];
      effect.positions[offset + 1] = effect.burstPositions[burstOffset + 1];
      effect.positions[offset + 2] = effect.burstPositions[burstOffset + 2];
    }
    effect.particleAge[i] += delta;
    const offset = i * 3;
    if (effect.particleAge[i] >= effect.particleLife[i]) {
      effect.positions[offset + 1] = -1000;
      continue;
    }
    effect.positions[offset] += effect.velocityX[i] * delta;
    effect.positions[offset + 1] += effect.velocityY[i] * delta;
    effect.positions[offset + 2] += effect.velocityZ[i] * delta;
    effect.velocityY[i] -= 2.8 * delta;
  }
  effect.positionAttribute.needsUpdate = true;

  const flashAge = effect.age;
  if (flashAge < 0.3) {
    const flashFade = 1 - flashAge / 0.3;
    effect.flash.material.opacity = flashFade * 0.92;
    const scale = 0.8 + (flashAge / 0.3) * 1.8;
    effect.flash.scale.setScalar(scale);
  } else {
    effect.flash.material.opacity = 0;
  }
}

function disposeEffect(effect) {
  if (effect.group.parent) effect.group.parent.remove(effect.group);
  effect.points.geometry.dispose();
  effect.points.material.dispose();
  effect.bursts.material.dispose();
  effect.rings.material.dispose();
  effect.flash.material.dispose();
}

export default function CollisionExplosionRenderer({ trainManager, onCollisionComplete, simulationPaused = false }) {
  const rootRef = useRef();
  const effectsRef = useRef(new Map());
  const onCollisionCompleteRef = useRef(onCollisionComplete);
  onCollisionCompleteRef.current = onCollisionComplete;
  if (rootRef.current) rootRef.current.name = 'collision-explosions-root';

  useFrame((_, delta) => {
    if (simulationPaused) return;
    for (const event of trainManager.consumeCollisionEvents()) {
      if (effectsRef.current.has(event.id)) continue;
      const effect = createEffect(event);
      effectsRef.current.set(event.id, effect);
      rootRef.current?.add(effect.group);
      trainAudio.startCollision(event.id, event.contact, event.trainIds);
    }

    for (const [id, effect] of effectsRef.current) {
      updateEffect(effect, delta);
      if (effect.age < effect.duration) continue;
      trainManager.finishCollision(id);
      trainAudio.stopCollision(id);
      disposeEffect(effect);
      effectsRef.current.delete(id);
      onCollisionCompleteRef.current?.();
    }
  });

  useEffect(() => () => {
    for (const effect of effectsRef.current.values()) {
      trainManager.finishCollision(effect.id);
      trainAudio.stopCollision(effect.id);
      disposeEffect(effect);
    }
    effectsRef.current.clear();
  }, [trainManager]);

  return <group ref={rootRef} />;
}
