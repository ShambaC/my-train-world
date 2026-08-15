import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { atDistance } from './TrafficManager.js';
import { createPedestrian } from '../ambient/pedestrianModels.js';
import { createVehicle } from './vehicleModels.js';

/**
 * Traffic Renderer — pooled vehicles + pedestrians.
 *
 * Actor counts only change on terrain reset (trafficManager.resetCount);
 * the pool is rebuilt then. Per-frame motion is applied imperatively —
 * no React reconciliation, no re-renders.
 */
export default function TrafficRenderer({ trafficManager, roadManager, crossingManager, lighting, enabled = true }) {
  const rootRef = useRef();
  const poolRef = useRef(new Map()); // actorId -> THREE.Group
  const enabledRef = useRef(enabled);
  const lastResetRef = useRef(-1);
  const [poolTick, setPoolTick] = useState(0);
  enabledRef.current = enabled;

  // Fixed headlight pool — constant light count keeps shaders stable (no
  // recompilation spikes). Assigned to nearest vehicles each frame.
  const HEADLIGHT_COUNT = 4;
  const HEADLIGHT_MAX = 625; // 25^2

  const headlightPool = useMemo(() => {
    const pool = [];
    for (let i = 0; i < HEADLIGHT_COUNT; i++) {
      const light = new THREE.SpotLight(0xfff2c0, 0, 12, 0.5, 0.4, 2);
      const target = new THREE.Object3D();
      target.position.set(2.5, 0.15, 0);
      light.target = target;
      pool.push({ light, target });
    }
    return pool;
  }, []);

  // ── Pool rebuild when the road layout changes ─────────────────────────
  // Version changes arrive outside React renders (user road add/remove), so
  // a poll checks roadManager.version and resets (terrain regen) or syncs
  // (incremental user edits) the actor pools.
  useEffect(() => {
    if (!trafficManager || !roadManager) return;
    let lastVersion = roadManager.version;

    const rebuild = () => {
      if (trafficManager.generation !== roadManager.generation) {
        trafficManager.generation = roadManager.generation;
        trafficManager.reset(roadManager);
      } else {
        trafficManager.sync(roadManager);
      }

      const pool = poolRef.current;
      for (const node of pool.values()) {
        if (node.parent) node.parent.remove(node);
      }
      pool.clear();

      for (const v of trafficManager.getVehicles()) {
        const group = new THREE.Group();
        group.name = v.id;
        group.userData.type = v.type;
        group.userData.variant = v.variant;
        group.add(createVehicle(v.type, v.variant));
        pool.set(v.id, group);
      }
      for (const w of trafficManager.getWalkers()) {
        const group = new THREE.Group();
        group.name = w.id;
        group.userData.variant = w.variant;
        const person = createPedestrian(w.variant);
        person.userData.bobPhase = w.phase;
        group.add(person);
        group.userData.animNodes = person.userData.animNodes;
        pool.set(w.id, group);
      }
      lastResetRef.current = trafficManager.resetCount;
      setPoolTick((t) => t + 1);
    };

    const poll = () => {
      if (roadManager.version !== lastVersion) {
        lastVersion = roadManager.version;
        rebuild();
      }
    };
    rebuild();
    const interval = setInterval(poll, 500);
    return () => clearInterval(interval);
  }, [trafficManager, roadManager]);

  // ── Imperative per-frame animation ────────────────────────────────────
  useFrame((state, delta) => {
    if (!enabledRef.current) return;
    if (lastResetRef.current !== trafficManager.resetCount) return; // pool stale

    trafficManager.update(delta, state.camera.position, crossingManager);
    const t = state.clock.elapsedTime;
    const nightness = lighting ? lighting.nightness : 0.6;
    const headGlow = 0.04 + nightness * 0.8;

    for (const v of trafficManager.getVehicles()) {
      const node = poolRef.current.get(v.id);
      if (!node) continue;
      // Respawned vehicles may have a new type or variant — swap the model.
      if (node.userData.type !== v.type || node.userData.variant !== v.variant) {
        for (const child of [...node.children]) {
          node.remove(child);
        }
        node.add(createVehicle(v.type, v.variant));
        node.userData.type = v.type;
        node.userData.variant = v.variant;
      }
      // Headlamp glow discs fade in at night.
      node.traverse((child) => {
        if (child.userData?.headlamp) child.material.opacity = headGlow;
      });
      const pos = atDistance(v.path, v.s);
      node.position.set(pos.x, pos.y + 0.03, pos.z);
      // Models are long along local X — align with actual travel direction.
      node.rotation.y = pos.yaw - Math.PI / 2 + (v.dir < 0 ? Math.PI : 0);
      node.visible = !v.frozen;
    }

    // Headlight pool: nearest unfrozen vehicles get real spotlights.
    const cam = state.camera.position;
    const nearest = [];
    for (const v of trafficManager.getVehicles()) {
      const node = poolRef.current.get(v.id);
      if (!node || v.frozen) continue;
      const dx = node.position.x - cam.x;
      const dz = node.position.z - cam.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > HEADLIGHT_MAX) continue;
      nearest.push({ v, node, d2 });
      nearest.sort((a, b) => a.d2 - b.d2);
      if (nearest.length > HEADLIGHT_COUNT) nearest.length = HEADLIGHT_COUNT;
    }
    for (let i = 0; i < headlightPool.length; i++) {
      const { light, target } = headlightPool[i];
      const hit = nearest[i];
      if (hit) {
        const pos = atDistance(hit.v.path, hit.v.s);
        const fx = Math.sin(pos.yaw) * (hit.v.dir > 0 ? 1 : -1);
        const fz = Math.cos(pos.yaw) * (hit.v.dir > 0 ? 1 : -1);
        const hx = hit.node.children[0]?.userData?.headlampX || 0.19;
        light.position.set(hit.node.position.x + fx * (hx + 0.1), hit.node.position.y + 0.15, hit.node.position.z + fz * (hx + 0.1));
        target.position.set(hit.node.position.x + fx * 2.5, hit.node.position.y + 0.15, hit.node.position.z + fz * 2.5);
        light.intensity = nightness * 6;
      } else {
        light.intensity = 0;
      }
    }

    for (const w of trafficManager.getWalkers()) {
      const node = poolRef.current.get(w.id);
      if (!node) continue;

      // Respawned walker may have a different variant — swap model
      if (node.userData.variant !== w.variant) {
        for (const child of [...node.children]) {
          node.remove(child);
        }
        const person = createPedestrian(w.variant);
        person.userData.bobPhase = w.phase;
        node.add(person);
        node.userData.variant = w.variant;
        node.userData.animNodes = person.userData.animNodes;
      }

      const pos = atDistance(w.path, w.s);
      // Sideways offset: perpendicular to the walking direction.
      const perpX = -Math.cos(pos.yaw);
      const perpZ = Math.sin(pos.yaw);
      node.position.set(
        pos.x + perpX * w.side * w.offset,
        pos.y,
        pos.z + perpZ * w.side * w.offset
      );
      node.rotation.y = w.dir > 0 ? pos.yaw : pos.yaw + Math.PI;
      node.visible = !w.frozen;

      // Culled walk cycle animation: skip detailed limb swings beyond 28 units distance
      if (!w.frozen) {
        const dx = node.position.x - cam.x;
        const dz = node.position.z - cam.z;
        const distSq = dx * dx + dz * dz;

        const anim = node.userData.animNodes;
        if (anim) {
          if (w.moving && distSq < 784) { // < 28 units
            const walkPhase = t * 13 * (w.speed / 0.12) + w.phase;
            const stride = Math.sin(walkPhase) * 0.42;
            const armStride = Math.sin(walkPhase) * 0.32;
            if (anim.legL) anim.legL.rotation.x = stride;
            if (anim.legR) anim.legR.rotation.x = -stride;
            if (anim.armL) anim.armL.rotation.x = -armStride;
            if (anim.armR) anim.armR.rotation.x = armStride;
            if (anim.body) anim.body.position.y = 0.165 + Math.abs(Math.sin(walkPhase * 2)) * 0.004;
          } else {
            // Standing still or distant: reset limbs to neutral
            if (anim.legL) anim.legL.rotation.x = 0;
            if (anim.legR) anim.legR.rotation.x = 0;
            if (anim.armL) anim.armL.rotation.x = 0;
            if (anim.armR) anim.armR.rotation.x = 0;
            if (anim.body) anim.body.position.y = 0.165;
          }
        }
      }
    }
  });

  // Mount every pooled actor — pool groups must be attached to the scene.
  // poolTick forces a re-render after each pool rebuild.
  return (
    <group ref={rootRef}>
      {trafficManager?.getVehicles().map((v) => {
        const node = poolRef.current.get(v.id);
        return node ? <primitive key={v.id} object={node} /> : null;
      })}
      {trafficManager?.getWalkers().map((w) => {
        const node = poolRef.current.get(w.id);
        return node ? <primitive key={w.id} object={node} /> : null;
      })}
      {headlightPool.map((h, i) => (
        <primitive key={`hl_${i}`} object={h.light} />
      ))}
      {headlightPool.map((h, i) => (
        <primitive key={`hlt_${i}`} object={h.target} />
      ))}
    </group>
  );
}
