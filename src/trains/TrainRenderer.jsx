import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createTrainEngine } from './TrainModel';
import { createPassengerCoach } from './PassengerCoachModel';
import { createCoalCart } from './CoalCartModel';
import { createGasCoach } from './GasCoachModel';
import { createGoodsCoach } from './GoodsCoachModel';
import { createContainerCoach } from './ContainerCoachModel';
import { createViewdeckCoach } from './ViewdeckCoachModel';
import ModelLibrary from '../models/ModelLibrary';
import SmokeParticles from './SmokeParticles';
import { createContactPatch } from '../utils/contactPatch';

// Coach model factories, keyed by coach type.
function createCoachMesh(type) {
  if (type === 'passenger-coach') return createPassengerCoach();
  if (type === 'coal-cart') return createCoalCart();
  if (type === 'gas-coach') return createGasCoach();
  if (type === 'goods-coach' || type === 'freight-van') return createGoodsCoach();
  if (type === 'container-coach' || type === 'container-flat-wagon') return createContainerCoach();
  if (type === 'viewdeck-coach' || type === 'mail-coach') return createViewdeckCoach();
  return ModelLibrary.getMesh(type);
}

// Selection highlight: flat rings under the engine + every coach.
const SELECT_RING_MAT = new THREE.MeshBasicMaterial({
  color: 0x00ff88,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  toneMapped: false,
});
const ENGINE_RING_GEO = new THREE.TorusGeometry(0.5, 0.035, 8, 32);
const COACH_RING_GEO = new THREE.TorusGeometry(0.42, 0.03, 8, 32);

function makeSelectRing(geo) {
  const mesh = new THREE.Mesh(geo, SELECT_RING_MAT);
  mesh.rotation.x = Math.PI / 2;
  mesh.renderOrder = 5;
  return mesh;
}

/**
 * Train Renderer — renders all trains + their trailing coaches.
 *
 * Performance: React only reconciles when entity TOPOLOGY changes (trains
 * added/removed, coaches attached). Per-frame movement is applied
 * imperatively to cached Object3D groups in useFrame, so moving trains and
 * coaches never trigger React re-renders.
 */
export default function TrainRenderer({ trainManager, lighting, selectedTrainId }) {
  const rootRef = useRef();
  const trainNodesRef = useRef(new Map()); // trainId -> THREE.Group (world)
  const coachNodesRef = useRef(new Map()); // coachId -> THREE.Group (world)
  const headlightsRef = useRef(new Map()); // trainId -> pointLight
  const lastSigRef = useRef('');
  const [snapshot, setSnapshot] = useState(null);
  const highlightGroupRef = useRef(null);
  const highlightMeshesRef = useRef([]); // engine ring + coach rings
  const selectedTrainIdRef = useRef(selectedTrainId);
  selectedTrainIdRef.current = selectedTrainId;

  // Topology poll — state updates only when the train/coach set changes.
  useEffect(() => {
    const sync = () => {
      const trains = trainManager.getAllTrains();
      const sig = trains
        .map((t) =>
          `${t.id}:${t.engineType || 'steam-engine'}:${(t.coaches || []).map((c) => c.id + (c.position ? 'p' : 'x')).join(',')}`
        )
        .join('|');
      if (sig !== lastSigRef.current) {
        lastSigRef.current = sig;
        setSnapshot({
          trains: trains.map((t) => ({
            id: t.id,
            engineType: t.engineType || 'steam-engine',
            coaches: (t.coaches || []).map((c) => ({
              id: c.id,
              type: c.type,
              placed: !!c.position,
            })),
          })),
        });
      }
    };

    sync();
    const interval = setInterval(sync, 500);
    return () => clearInterval(interval);
  }, [trainManager]);

  // Animate trains imperatively — no React state involved.
  useFrame((state, delta) => {
    trainManager.update(delta);
    const t = state.clock.elapsedTime;

    for (const train of trainManager.getAllTrains()) {
      const node = trainNodesRef.current.get(train.id);
      if (node) {
        // Small idle motion while parked (stopped at a station or inactive)
        const parked = !train.active || !!train.dwell;
        const bobY = parked ? Math.sin(t * 2.2 + train.id.length) * 0.012 : 0;
        node.position.set(train.position.x, train.position.y + 0.1 + bobY, train.position.z);
        node.rotation.y = train.rotation;
        node.rotation.z = train.bank || 0;
      }
      for (const coach of train.coaches || []) {
        const cnode = coachNodesRef.current.get(coach.id);
        if (cnode && coach.position) {
          const parked = !train.active || !!train.dwell;
          const bobY = parked ? Math.sin(t * 2.2 + coach.id.length) * 0.01 : 0;
          cnode.position.set(coach.position.x, coach.position.y + 0.1 + bobY, coach.position.z);
          cnode.rotation.y = coach.rotation;
        }
      }
    }

    // Night-scaled headlight pool: fully off in daylight (saves dynamic
    // light cost), warm and bright after dark. Beam cone and glow halo fade
    // out almost entirely in daylight too.
    const nightness = lighting ? lighting.nightness : 0.6;
    const intensity = nightness * 9.2;
    for (const light of headlightsRef.current.values()) {
      light.intensity = intensity;
    }
    for (const node of trainNodesRef.current.values()) {
      node.traverse((child) => {
        const kind = child.userData?.lightGlow;
        if (!kind) return;
        const mat = child.material;
        if (!mat) return;
        if (kind === 'glow') mat.opacity = 0.04 + nightness * 0.31;
        else mat.opacity = 0.02 + nightness * 0.18;
      });
    }
    // Coach window warmth at night (materials flagged windowGlow)
    const winGlow = 0.12 + nightness * 0.8;
    for (const node of coachNodesRef.current.values()) {
      node.traverse((child) => {
        const mat = child.material;
        if (mat?.userData?.windowGlow) mat.emissiveIntensity = winGlow;
      });
    }

    // Selection highlight: rings under the engine + every coach of the
    // selected consist (updated imperatively, no React churn).
    const group = highlightGroupRef.current;
    if (group) {
      const selected = selectedTrainIdRef.current
        ? trainManager.getTrain(selectedTrainIdRef.current)
        : null;
      if (!selected) {
        group.visible = false;
      } else {
        const count = 1 + (selected.coaches || []).length;
        while (highlightMeshesRef.current.length < count) {
          const ring = makeSelectRing(
            highlightMeshesRef.current.length === 0 ? ENGINE_RING_GEO : COACH_RING_GEO
          );
          highlightMeshesRef.current.push(ring);
          group.add(ring);
        }
        while (highlightMeshesRef.current.length > count) {
          const ring = highlightMeshesRef.current.pop();
          group.remove(ring);
          ring.geometry.dispose();
          ring.material.dispose();
        }
        highlightMeshesRef.current[0].position.set(selected.position.x, selected.position.y + 0.06, selected.position.z);
        for (let i = 0; i < (selected.coaches || []).length; i++) {
          const c = selected.coaches[i];
          highlightMeshesRef.current[i + 1].position.set(
            c.position ? c.position.x : selected.position.x,
            (c.position ? c.position.y : selected.position.y) + 0.05,
            c.position ? c.position.z : selected.position.z
          );
        }
        group.visible = true;
      }
    }
  });

  // Remove + dispose meshes that left the topology.
  useEffect(() => {
    if (!snapshot) return;
    const trainIds = new Set(snapshot.trains.map((t) => t.id));
    const coachIds = new Set();
    for (const t of snapshot.trains) {
      for (const c of t.coaches) coachIds.add(c.id);
    }

    for (const [id, node] of trainNodesRef.current.entries()) {
      if (!trainIds.has(id)) {
        if (node.parent) node.parent.remove(node);
        node.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        trainNodesRef.current.delete(id);
        headlightsRef.current.delete(id);
      }
    }
    for (const [id, node] of coachNodesRef.current.entries()) {
      if (!coachIds.has(id)) {
        if (node.parent) node.parent.remove(node);
        node.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        coachNodesRef.current.delete(id);
      }
    }
  }, [snapshot]);

  return (
    <group ref={rootRef}>
      {snapshot?.trains.map((train) => {
        const engineType = train.engineType || 'steam-engine';
        const existingNode = trainNodesRef.current.get(train.id);

        // Recreate engine node if engineType changed
        if (existingNode && existingNode.userData?.engineType !== engineType) {
          if (existingNode.parent) existingNode.parent.remove(existingNode);
          existingNode.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
          trainNodesRef.current.delete(train.id);
          headlightsRef.current.delete(train.id);
        }

        // Engine node (created once, updated imperatively)
        if (!trainNodesRef.current.has(train.id)) {
          const node = new THREE.Group();
          node.name = `train_${train.id}`;
          node.userData.engineType = engineType;

          const engineMesh = createTrainEngine(engineType);
          node.add(engineMesh);

          // One warm point light per engine (engines are few).
          const headlight = new THREE.PointLight(0xffd9a0, 0, 9, 2);
          headlight.position.set(0, 0.3, 0.46);
          node.add(headlight);
          headlightsRef.current.set(train.id, headlight);

          trainNodesRef.current.set(train.id, node);
        }
        const trainNode = trainNodesRef.current.get(train.id);

        // Coach nodes
        const coachNodes = train.coaches
          .filter((c) => c.placed)
          .map((coach) => {
            if (!coachNodesRef.current.has(coach.id)) {
              const node = new THREE.Group();
              node.name = `coach_${coach.id}`;
              node.add(createCoachMesh(coach.type));
              node.add(createContactPatch(0.34, 0.26, 0.012));
              coachNodesRef.current.set(coach.id, node);
            }
            return (
              <primitive key={coach.id} object={coachNodesRef.current.get(coach.id)} />
            );
          });

        return (
          <group key={train.id}>
            <primitive object={trainNode} />
            {coachNodes}
            <SmokeParticles
              key={`${train.id}_smoke_${engineType}`}
              target={trainNode}
              trainManager={trainManager}
              trainId={train.id}
              engineType={engineType}
              kind="smoke"
            />
            <SmokeParticles
              key={`${train.id}_dust`}
              kind="dust"
              target={trainNode}
              trainManager={trainManager}
              trainId={train.id}
              engineType={engineType}
            />
          </group>
        );
      })}
      {/* Selection highlight rings — updated imperatively in useFrame */}
      <group ref={highlightGroupRef} visible={false} />
    </group>
  );
}
