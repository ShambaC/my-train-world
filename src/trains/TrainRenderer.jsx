import { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { createTrainEngine } from './TrainModel';
import SmokeParticles from './SmokeParticles';
import * as THREE from 'three';

/**
 * Train Renderer - Renders all trains in the scene
 */
export default function TrainRenderer({ trainManager }) {
  const [trains, setTrains] = useState([]);
  const trainMeshesRef = useRef(new Map());

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

  // Cleanup old train meshes
  useEffect(() => {
    const currentTrainIds = new Set(trains.map(t => t.id));
    
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
  }, [trains]);

  return (
    <group>
      {trains.map((train, index) => {
        // Create mesh if it doesn't exist
        if (!trainMeshesRef.current.has(train.id)) {
          const trainMesh = createTrainEngine(index);
          trainMeshesRef.current.set(train.id, trainMesh);
        }

        const trainMesh = trainMeshesRef.current.get(train.id);

        return (
          <group key={train.id}>
            <primitive
              object={trainMesh}
              position={[train.position.x, train.position.y + 0.1, train.position.z]}
              rotation={[0, train.rotation, 0]}
            />
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
