import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTrainHeadlightConfig } from '../trains/TrainModel';

const TRAIN_LIGHT_COUNT = 4;
const STATION_LIGHT_COUNT = 8;
const LIGHT_MAX_DISTANCE_SQ = 625;

function makePool(count, color, distance, angle, penumbra) {
  const lights = [];
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const light = new THREE.SpotLight(color, 0, distance, angle, penumbra, 2);
    const target = new THREE.Object3D();
    light.target = target;
    group.add(light, target);
    lights.push({ light, target });
  }
  return { group, lights };
}

function transformLocal(local, position, rotation, pitch, bank, target) {
  target.set(local.x, local.y, local.z);
  target.applyEuler(new THREE.Euler(pitch || 0, rotation || 0, bank || 0, 'YXZ'));
  target.x += position.x;
  target.y += position.y + 0.1; // TrainRenderer node lift.
  target.z += position.z;
  return target;
}

/**
 * Persistent dynamic-light budget. SpotLights exist before user placement;
 * placing trains/stations only assigns positions, avoiding shader recompiles.
 */
export default function PracticalLights({ trainManager, stationManager, lighting }) {
  const trainPool = useMemo(
    () => makePool(TRAIN_LIGHT_COUNT, 0xffd9a0, 9, 0.48, 0.45),
    [],
  );
  const stationPool = useMemo(
    () => makePool(STATION_LIGHT_COUNT, 0xffd9a0, 6, Math.PI / 4, 0.5),
    [],
  );
  const rootRef = useRef();
  const source = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const nightness = lighting?.nightness ?? 0.6;
    const camera = state.camera.position;

    const trains = [];
    for (const train of trainManager?.getAllTrains?.() || []) {
      if (!train.position) continue;
      const dx = train.position.x - camera.x;
      const dz = train.position.z - camera.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq > LIGHT_MAX_DISTANCE_SQ) continue;
      trains.push({ train, distanceSq });
    }
    trains.sort((a, b) => a.distanceSq - b.distanceSq);

    for (let i = 0; i < trainPool.lights.length; i++) {
      const slot = trainPool.lights[i];
      const hit = trains[i];
      if (!hit) {
        slot.light.intensity = 0;
        continue;
      }
      const config = getTrainHeadlightConfig(hit.train.engineType);
      transformLocal(
        config.position,
        hit.train.position,
        hit.train.rotation,
        hit.train.pitch,
        hit.train.bank,
        source,
      );
      slot.light.position.copy(source);
      transformLocal(
        config.target,
        hit.train.position,
        hit.train.rotation,
        hit.train.pitch,
        hit.train.bank,
        target,
      );
      slot.target.position.copy(target);
      slot.light.intensity = nightness * 9.2;
    }

    const stationSources = [];
    for (const station of stationManager?.getAllStations?.() || []) {
      station.group?.traverse((child) => {
        if (!child.userData?.stationLightSource) return;
        child.getWorldPosition(source);
        const targetObject = child.userData.stationLightTarget;
        if (!targetObject) return;
        targetObject.getWorldPosition(target);
        const dx = source.x - camera.x;
        const dz = source.z - camera.z;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq <= LIGHT_MAX_DISTANCE_SQ) {
          stationSources.push({ source: source.clone(), target: target.clone(), distanceSq });
        }
      });
    }
    stationSources.sort((a, b) => a.distanceSq - b.distanceSq);

    for (let i = 0; i < stationPool.lights.length; i++) {
      const slot = stationPool.lights[i];
      const hit = stationSources[i];
      if (!hit) {
        slot.light.intensity = 0;
        continue;
      }
      slot.light.position.copy(hit.source);
      slot.target.position.copy(hit.target);
      slot.light.intensity = nightness * 4.5;
    }
  });

  return (
    <group ref={rootRef}>
      <primitive object={trainPool.group} />
      <primitive object={stationPool.group} />
    </group>
  );
}
