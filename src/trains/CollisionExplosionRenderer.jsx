import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { trainAudio } from '../audio/trainAudio';

const MAX_BURSTS = 32;
const CLOUDS_PER_BURST = 6;
const CLOUD_COUNT = MAX_BURSTS * CLOUDS_PER_BURST;
const BURST_LIFE = 0.72;
const CLOUD_LIFE = 1.1;
const CHAIN_DELAY = 0.2;

const CLOUD_GEO = new THREE.DodecahedronGeometry(0.42, 0);
const RING_GEO = new THREE.RingGeometry(0.16, 0.24, 12);
const FLASH_GEO = new THREE.SphereGeometry(0.42, 12, 8);
const DUMMY = new THREE.Object3D();
const CLOUD_DARK = new THREE.Color(0x4b4746);
const CLOUD_MID = new THREE.Color(0x77716e);
const CLOUD_LIGHT = new THREE.Color(0xa59c97);

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

  const cloudBurst = new Uint8Array(CLOUD_COUNT);
  const cloudOffsetX = new Float32Array(CLOUD_COUNT);
  const cloudOffsetY = new Float32Array(CLOUD_COUNT);
  const cloudOffsetZ = new Float32Array(CLOUD_COUNT);
  const cloudScale = new Float32Array(CLOUD_COUNT);
  const cloudMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
  });
  const clouds = new THREE.InstancedMesh(CLOUD_GEO, cloudMaterial, CLOUD_COUNT);
  clouds.frustumCulled = false;
  clouds.renderOrder = 4;
  clouds.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  for (let i = 0; i < CLOUD_COUNT; i++) {
    const burst = Math.floor(i / CLOUDS_PER_BURST);
    const lobe = i % CLOUDS_PER_BURST;
    const angle = (lobe / CLOUDS_PER_BURST) * Math.PI * 2 + Math.random() * 0.35;
    const radius = lobe === 0 ? 0 : 0.24 + Math.random() * 0.16;
    cloudBurst[i] = burst;
    cloudOffsetX[i] = Math.cos(angle) * radius;
    cloudOffsetY[i] = lobe === 0 ? 0.04 : 0.12 + Math.random() * 0.2;
    cloudOffsetZ[i] = Math.sin(angle) * radius;
    cloudScale[i] = lobe === 0 ? 1.35 : 0.82 + Math.random() * 0.28;
    const color = lobe === 0 ? CLOUD_LIGHT : (lobe % 2 === 0 ? CLOUD_DARK : CLOUD_MID);
    clouds.setColorAt(i, color);
    DUMMY.position.set(0, -1000, 0);
    DUMMY.scale.setScalar(0);
    DUMMY.updateMatrix();
    clouds.setMatrixAt(i, DUMMY.matrix);
  }
  clouds.instanceColor.needsUpdate = true;

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
  rings.renderOrder = 5;
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
  flash.renderOrder = 6;
  flash.position.set(event.contact.x, event.contact.y + 0.2, event.contact.z);

  const group = new THREE.Group();
  group.name = `collision_explosion_${event.id}`;
  group.add(clouds);
  group.add(rings);
  group.add(flash);
  return {
    id: event.id,
    group,
    clouds,
    rings,
    flash,
    burstCount,
    burstStarts,
    burstPositions,
    cloudBurst,
    cloudOffsetX,
    cloudOffsetY,
    cloudOffsetZ,
    cloudScale,
    age: 0,
    duration: Math.max(1.55, (burstCount - 1) * CHAIN_DELAY + Math.max(BURST_LIFE, CLOUD_LIFE) + 0.25),
  };
}

function updateEffect(effect, delta) {
  effect.age += Math.min(delta, 0.05);
  const effectOpacity = Math.max(0, 1 - Math.max(0, effect.age - effect.duration + 0.7) / 0.7);
  effect.clouds.material.opacity = effectOpacity * 0.88;
  effect.rings.material.opacity = effectOpacity * 0.75;

  for (let i = 0; i < CLOUD_COUNT; i++) {
    const burst = effect.cloudBurst[i];
    const localAge = effect.age - effect.burstStarts[burst];
    if (burst >= effect.burstCount || localAge < 0 || localAge > CLOUD_LIFE) {
      DUMMY.position.set(0, -1000, 0);
      DUMMY.scale.setScalar(0);
      DUMMY.updateMatrix();
      effect.clouds.setMatrixAt(i, DUMMY.matrix);
      continue;
    }
    const puffIn = Math.min(1, localAge / 0.18);
    const puffFade = 1 - localAge / CLOUD_LIFE;
    const burstOffset = burst * 3;
    DUMMY.position.set(
      effect.burstPositions[burstOffset] + effect.cloudOffsetX[i] * puffIn,
      effect.burstPositions[burstOffset + 1] + effect.cloudOffsetY[i] * puffIn + localAge * 0.14,
      effect.burstPositions[burstOffset + 2] + effect.cloudOffsetZ[i] * puffIn,
    );
    DUMMY.rotation.set(localAge * (1.2 + (i % 3) * 0.35), i * 0.41, localAge * 0.8);
    DUMMY.scale.setScalar(effect.cloudScale[i] * (0.3 + puffIn * 0.95) * (0.55 + puffFade * 0.45));
    DUMMY.updateMatrix();
    effect.clouds.setMatrixAt(i, DUMMY.matrix);
  }
  effect.clouds.instanceMatrix.needsUpdate = true;

  for (let i = 0; i < effect.burstCount; i++) {
    const localAge = effect.age - effect.burstStarts[i];
    const offset = i * 3;
    if (localAge < 0 || localAge > BURST_LIFE) {
      DUMMY.position.set(0, -1000, 0);
      DUMMY.scale.setScalar(0);
      DUMMY.updateMatrix();
      effect.rings.setMatrixAt(i, DUMMY.matrix);
      continue;
    }
    const fade = 1 - localAge / BURST_LIFE;
    DUMMY.position.set(effect.burstPositions[offset], effect.burstPositions[offset + 1], effect.burstPositions[offset + 2]);
    DUMMY.scale.setScalar((0.5 + localAge * 1.5) * fade);
    DUMMY.rotation.set(-Math.PI / 2, 0, 0);
    DUMMY.updateMatrix();
    effect.rings.setMatrixAt(i, DUMMY.matrix);
  }
  effect.rings.instanceMatrix.needsUpdate = true;

  if (effect.age < 0.3) {
    const flashFade = 1 - effect.age / 0.3;
    effect.flash.material.opacity = flashFade * 0.92;
    effect.flash.scale.setScalar(0.8 + (effect.age / 0.3) * 1.8);
  } else {
    effect.flash.material.opacity = 0;
  }
}

function disposeEffect(effect) {
  if (effect.group.parent) effect.group.parent.remove(effect.group);
  effect.clouds.material.dispose();
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
