import { useRef, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { generateTerrain, createGrid } from './terrain';
import TrackRenderer from './tracks/TrackRenderer';
import TrainRenderer from './trains/TrainRenderer';
import Skybox, { getLightingForTime } from './environment/Skybox';

// Scene component that contains the terrain
function Scene({ 
  terrainSize, 
  onTerrainGenerated, 
  trackManager,
  trainManager,
  selectedTool, 
  rotation,
  heightOffset,
  onTracksChange,
  tracksVersion,
  timeOfDay,
  fogEnabled
}) {
  const terrainRef = useRef();
    const { camera, scene } = useThree();
  const [terrain, setTerrain] = useState(null);
  
  // Setup lighting based on time of day
  useEffect(() => {
    const lighting = getLightingForTime(timeOfDay);
    
    // Update ambient light
    const existingAmbient = scene.getObjectByName('ambientLight');
    if (existingAmbient) {
      existingAmbient.intensity = lighting.ambient.intensity;
    }
    
    // Update directional light
    const existingDirectional = scene.getObjectByName('directionalLight');
    if (existingDirectional) {
      existingDirectional.color.set(lighting.directional.color);
      existingDirectional.intensity = lighting.directional.intensity;
      existingDirectional.position.set(...lighting.directional.position);
    }
    
    // Update fog
    if (fogEnabled && lighting.fog) {
      scene.fog = new THREE.Fog(
        lighting.fog.color,
        lighting.fog.near,
        lighting.fog.far
      );
    } else {
      scene.fog = null;
    }
  }, [timeOfDay, fogEnabled, scene]);


  useEffect(() => {
    // Generate terrain when size changes
    const newTerrain = generateTerrain(terrainSize.length, terrainSize.breadth);
    setTerrain(newTerrain);
    
    if (onTerrainGenerated) {
      // Count voxels for debug info
      let voxelCount = 0;
      newTerrain.children.forEach(mesh => {
        if (mesh instanceof THREE.InstancedMesh) {
          voxelCount += mesh.count;
        }
      });
      onTerrainGenerated({ voxelCount });
    }
  }, [terrainSize, onTerrainGenerated]);

  return (
    <>
      <Skybox timeOfDay={timeOfDay} />
      
      {/* Lighting */}
      <ambientLight name="ambientLight" intensity={0.5} />
      <directionalLight
        name="directionalLight"
        position={[50, 50, 25]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      
      {/* Terrain */}
      {terrain && (
        <primitive object={terrain} ref={terrainRef} />
      )}
      
      {/* Track System */}
      {terrain && (
        <TrackRenderer
          key={tracksVersion} // Force re-mount when tracks are cleared
          trackManager={trackManager}
          trainManager={trainManager}
          terrainRef={terrainRef}
          selectedTool={selectedTool}
          rotation={rotation}
          heightOffset={heightOffset}
          onTracksChange={onTracksChange}
        />
      )}
      
      {/* Train System */}
      {terrain && (
        <TrainRenderer
          trainManager={trainManager}
        />
      )}
      
      {/* Grid helper */}
      <primitive object={createGrid(Math.max(terrainSize.length, terrainSize.breadth))} />
      
      {/* Camera controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={0.2}
        maxDistance={100}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  );
}

// Main Game Scene Component
export default function GameScene({ 
  terrainSize, 
  showDebug, 
  trackManager,
  trainManager,
  selectedTool,
  rotation,
  heightOffset,
  onTracksChange,
  tracksVersion,
  timeOfDay = 'day',
  fogEnabled = true
}) {
  const [sceneStats, setSceneStats] = useState({
    voxelCount: 0,
  });
  const [fps, setFps] = useState(0);
  const [trackCount, setTrackCount] = useState(0);
  const [trainCount, setTrainCount] = useState(0);

  const handleTracksChange = (tracks) => {
    setTrackCount(tracks.length);
    if (onTracksChange) onTracksChange(tracks);
  };
  
  // Update train count
  useEffect(() => {
    const interval = setInterval(() => {
      setTrainCount(trainManager.getAllTrains().length);
    }, 500);
    return () => clearInterval(interval);
  }, [trainManager]);

  return (
    <div className="relative w-full h-full">
      <Canvas
        camera={{ position: [20, 15, 20], fov: 60 }}
        shadows
        gl={{ antialias: true }}
      >
        <Scene 
          terrainSize={terrainSize} 
          onTerrainGenerated={setSceneStats}
          trackManager={trackManager}
          trainManager={trainManager}
          selectedTool={selectedTool}
          rotation={rotation}
          heightOffset={heightOffset}
          onTracksChange={handleTracksChange}
          tracksVersion={tracksVersion}
          timeOfDay={timeOfDay}
          fogEnabled={fogEnabled}
        />
        <FPSTracker show={showDebug} onFpsUpdate={setFps} />
      </Canvas>
      
      {/* Debug Overlay */}
      {showDebug && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-4 py-3 rounded-lg font-mono text-sm space-y-1">
          <div className="font-bold text-green-400 mb-2">Debug Info</div>
          <div>FPS: {fps}</div>
          <div>Voxels: {sceneStats.voxelCount.toLocaleString()}</div>
          <div>Tracks: {trackCount}</div>
          <div>Trains: {trainCount}</div>
          <div>Terrain: {terrainSize.length} × {terrainSize.breadth}</div>
          {selectedTool && (
            <div className="pt-2 border-t border-gray-600">
              <div>Tool: {selectedTool.name}</div>
              <div>Rotation: {rotation}°</div>
              {heightOffset !== 0 && <div>Height: {heightOffset.toFixed(1)}</div>}
            </div>
          )}
          <div className="pt-2 text-xs text-gray-400">
            <div>Controls:</div>
            <div>• Left Mouse: Rotate</div>
            <div>• Right Mouse: Pan</div>
            <div>• Scroll: Zoom</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Separate component to track FPS
function FPSTracker({ show, onFpsUpdate }) {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame(() => {
    if (!show) return;
    
    frameCount.current++;
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime.current;

    if (deltaTime >= 1000) {
      const currentFps = Math.round((frameCount.current * 1000) / deltaTime);
      onFpsUpdate(currentFps);
      frameCount.current = 0;
      lastTime.current = currentTime;
    }
  });

  return null;
}
