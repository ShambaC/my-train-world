import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { createTrainEngine } from './TrainModel';
import { createPassengerCoach } from './PassengerCoachModel';
import { createCoalCart } from './CoalCartModel';
import { createGasCoach } from './GasCoachModel';
import { createGoodsCoach } from './GoodsCoachModel';
import ModelLibrary from '../models/ModelLibrary';
import SmokeParticles from './SmokeParticles';

/**
 * Train Renderer - Renders all trains + their trailing coaches
 */
export default function TrainRenderer({ trainManager }) {
  const [trains, setTrains] = useState([]);
  const trainMeshesRef = useRef(new Map());
  const coachMeshesRef = useRef(new Map());

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
  });

  // Cleanup old train meshes + coach meshes
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
              : ModelLibrary.getMesh(coach.type);
            coachMeshesRef.current.set(coach.id, mesh);
          }
          const mesh = coachMeshesRef.current.get(coach.id);
          return (
            <primitive
              key={coach.id}
              object={mesh}
              position={[coach.position.x, coach.position.y + 0.1, coach.position.z]}
              rotation={[0, coach.rotation, 0]}
            />
          );
        });

        return (
          <group key={train.id}>
            <primitive
              object={trainMesh}
              position={[train.position.x, train.position.y + 0.1, train.position.z]}
              rotation={[0, train.rotation, 0]}
            />
            {coachNodes}
            <SmokeParticles
              position={[train.position.x, train.position.y + 0.1, train.position.z]}
              rotation={[0, train.rotation, 0]}
              active={train.active}
            />
          </group>
        );
      })}
    </group>
  );
}
