import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { atDistance } from './TrafficManager.js';
import { createPerson } from '../ambient/propModels.js';

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

  // ── Vehicle models (shared geometries/materials) ──────────────────────
  const wheelGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.02, 8);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1c, flatShading: true });
  const BODY_COLORS = [0xb82828, 0x2270b6, 0x2e7d32, 0xd35400, 0x8e44ad, 0x5d6d7e, 0xd6a63a, 0x7f8c8d, 0xe8e8e8, 0x4a4a5a];

  const buildVehicle = (type) => {
    const g = new THREE.Group();
    const mat = () => new THREE.MeshLambertMaterial({
      color: BODY_COLORS[Math.floor(Math.random() * BODY_COLORS.length)],
      flatShading: true,
    });
    const darkMat = () => new THREE.MeshLambertMaterial({ color: 0x2b2b2b, flatShading: true });

    const addWheels = (x1, x2, z1, z2) => {
      for (const x of [x1, x2]) {
        for (const z of [z1, z2]) {
          const wheel = new THREE.Mesh(wheelGeo, wheelMat);
          wheel.rotation.x = Math.PI / 2; // axle along Z
          wheel.position.set(x, 0.05, z);
          g.add(wheel);
        }
      }
    };

    if (type === 'car') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.1, 0.17), mat());
      body.position.y = 0.14;
      g.add(body);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.11, 0.15), darkMat());
      cabin.position.set(0, 0.245, -0.01);
      g.add(cabin);
      addWheels(-0.13, 0.13, -0.07, 0.07);
    } else if (type === 'truck') {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.17), mat());
      cab.position.set(0, 0.17, 0.1);
      g.add(cab);
      const cargo = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.17), mat());
      cargo.position.set(0, 0.2, -0.08);
      g.add(cargo);
      addWheels(-0.15, 0.15, -0.13, 0.13);
    } else if (type === 'bus') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.18, 0.18), mat());
      body.position.y = 0.2;
      g.add(body);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.03, 0.19), darkMat());
      stripe.position.y = 0.16;
      g.add(stripe);
      addWheels(-0.19, 0.19, -0.07, 0.07);
    } else if (type === 'cart') {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.16), mat());
      bed.position.y = 0.16;
      g.add(bed);
      addWheels(-0.11, 0.11, -0.06, 0.06);
    } else {
      // bicycle — two wheels + frame, long axis along X
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.02), darkMat());
      frame.position.y = 0.13;
      g.add(frame);
      for (const x of [-0.09, 0.09]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 8), wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.055, 0);
        g.add(wheel);
      }
    }
    return g;
  };

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
        group.add(buildVehicle(v.type));
        pool.set(v.id, group);
      }
      for (const w of trafficManager.getWalkers()) {
        const group = new THREE.Group();
        group.name = w.id;
        const person = createPerson();
        person.userData.bobPhase = w.phase;
        group.add(person);
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

    for (const v of trafficManager.getVehicles()) {
      const node = poolRef.current.get(v.id);
      if (!node) continue;
      // Respawned vehicles may have a new type — swap the model.
      if (node.userData.type !== v.type) {
        for (const child of [...node.children]) {
          child.traverse((m) => {
            if (m.isMesh && m.material) m.material.dispose();
          });
          node.remove(child);
        }
        node.add(buildVehicle(v.type));
        node.userData.type = v.type;
      }
      const pos = atDistance(v.path, v.s);
      node.position.set(pos.x, pos.y + 0.03, pos.z);
      // Models are long along local X — align that with the road direction.
      node.rotation.y = pos.yaw - Math.PI / 2;
      node.visible = !v.frozen;
    }

    for (const w of trafficManager.getWalkers()) {
      const node = poolRef.current.get(w.id);
      if (!node) continue;
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
      node.position.y += Math.sin(t * 2.6 + w.phase) * 0.01;
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
    </group>
  );
}
