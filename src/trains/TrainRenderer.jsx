import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
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

/**
 * Train Renderer - Renders all trains + their trailing coaches.
 * Each engine carries one warm point light (small budget — engines are few)
 * plus smoke and wheel dust. Coach windows are emissive; a fake contact
 * patch grounds every vehicle.
 */
export default function TrainRenderer({ trainManager, lighting }) {
  const [trains, setTrains] = useState([]);
  const trainMeshesRef = useRef(new Map());
  const coachMeshesRef = useRef(new Map());
  const headlightsRef = useRef(new Map());
  const coachPatchesRef = useRef(new Map());

  // Update trains list
  useEffect(() => {
    const updateTrains = () => {
      setTrains(trainManager.getAllTrains());
    };

    // Update initially
    updateTrains();

    // Set up interval to check for new trains
    const interval = setInterval(updateTrains, 500);
    return () => clearInterval(interval);
  }, [trainManager]);

  // Animate trains
  useFrame((state, delta) => {
    trainManager.update(delta);
    setTrains([...trainManager.getAllTrains()]); // Force re-render with updated positions

    // Night-scaled headlight pool: dim during the day, warm after dark.
    // The beam cone and glow halo fade out almost entirely in daylight.
    const nightness = lighting ? lighting.nightness : 0.6;
    const intensity = 0.7 + nightness * 8.5;
    for (const light of headlightsRef.current.values()) {
      light.intensity = intensity;
    }
    for (const mesh of trainMeshesRef.current.values()) {
      mesh.traverse((child) => {
        const kind = child.userData?.lightGlow;
        if (!kind) return;
        const mat = child.material;
        if (!mat) return;
        if (kind === 'glow') mat.opacity = 0.04 + nightness * 0.31;
        else mat.opacity = 0.02 + nightness * 0.18;
      });
    }
  });

  // Cleanup old train meshes + coach meshes + lights + patches
  useEffect(() => {
    const currentTrainIds = new Set(trains.map(t => t.id));
    const currentCoachIds = new Set();
    for (const t of trains) {
      for (const c of t.coaches || []) currentCoachIds.add(c.id);
    }

    for (const [id, mesh] of trainMeshesRef.current.entries()) {
      if (!currentTrainIds.has(id)) {
        if (mesh.parent) mesh.parent.remove(mesh);
        mesh.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        trainMeshesRef.current.delete(id);
        headlightsRef.current.delete(id);
      }
    }
    for (const [id, mesh] of coachMeshesRef.current.entries()) {
      if (!currentCoachIds.has(id)) {
        if (mesh.parent) mesh.parent.remove(mesh);
        mesh.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        coachMeshesRef.current.delete(id);
        const patch = coachPatchesRef.current.get(id);
        if (patch?.parent) patch.parent.remove(patch);
        coachPatchesRef.current.delete(id);
      }
    }
  }, [trains]);

  return (
    <group>
      {trains.map((train) => {
        // Engine mesh
        if (!trainMeshesRef.current.has(train.id)) {
          const trainMesh = createTrainEngine(trainMeshesRef.current.size);
          trainMeshesRef.current.set(train.id, trainMesh);
        }
        const trainMesh = trainMeshesRef.current.get(train.id);

        // Coach meshes
        const coachNodes = (train.coaches || []).map((coach) => {
          if (!coach.position) return null;
          if (!coachMeshesRef.current.has(coach.id)) {
            const mesh = coach.type === 'passenger-coach'
              ? createPassengerCoach()
              : coach.type === 'coal-cart'
              ? createCoalCart()
              : coach.type === 'gas-coach'
              ? createGasCoach()
              : (coach.type === 'goods-coach' || coach.type === 'freight-van')
              ? createGoodsCoach()
              : (coach.type === 'container-coach' || coach.type === 'container-flat-wagon')
              ? createContainerCoach()
              : (coach.type === 'viewdeck-coach' || coach.type === 'mail-coach')
              ? createViewdeckCoach()
              : ModelLibrary.getMesh(coach.type);
            coachMeshesRef.current.set(coach.id, mesh);
            coachPatchesRef.current.set(coach.id, createContactPatch(0.34, 0.26, 0.012));
          }
          const mesh = coachMeshesRef.current.get(coach.id);
          const patch = coachPatchesRef.current.get(coach.id);
          return (
            <group
              key={coach.id}
              position={[coach.position.x, coach.position.y + 0.1, coach.position.z]}
              rotation={[0, coach.rotation, 0]}
            >
              <primitive object={patch} />
              <primitive object={mesh} />
            </group>
          );
        });

        return (
          <group key={train.id}>
            <group
              position={[train.position.x, train.position.y + 0.1, train.position.z]}
              rotation={[0, train.rotation, 0]}
            >
              <pointLight
                ref={(l) => {
                  if (l) headlightsRef.current.set(train.id, l);
                }}
                position={[0, 0.3, 0.42]}
                color={0xffd9a0}
                distance={9}
                decay={2}
                intensity={0.7}
              />
              <primitive object={trainMesh} />
            </group>
            {coachNodes}
            <SmokeParticles
              position={[train.position.x, train.position.y + 0.1, train.position.z]}
              rotation={[0, train.rotation, 0]}
              active={train.active}
              speed={train.active ? train.speed : 0}
            />
            <SmokeParticles
              kind="dust"
              position={[train.position.x, train.position.y + 0.1, train.position.z]}
              rotation={[0, train.rotation, 0]}
              active={train.active && train.speed > 0.1}
              speed={train.speed}
            />
          </group>
        );
      })}
    </group>
  );
}
