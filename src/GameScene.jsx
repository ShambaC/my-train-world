import { useRef, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { generateTerrain, createGrid } from './terrain';
import TrackRenderer from './tracks/TrackRenderer';

// Scene component that contains the terrain
function Scene({ 
  terrainSize, 
  onTerrainGenerated, 
  trackManager, 
  selectedTool, 
  rotation,
  heightOffset,
  onTracksChange,
  tracksVersion // Add tracksVersion prop
}) {
  const terrainRef = useRef();
  const [terrain, setTerrain] = useState(null);

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
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
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
      
      {/* Sky */}
      <Sky sunPosition={[100, 20, 100]} />
      
      {/* Terrain */}
      {terrain && (
        <primitive object={terrain} ref={terrainRef} />
      )}
      
      {/* Track System */}
      {terrain && (
        <TrackRenderer
          key={tracksVersion} // Force re-mount when tracks are cleared
          trackManager={trackManager}
          terrainRef={terrainRef}
          selectedTool={selectedTool}
          rotation={rotation}
          heightOffset={heightOffset}
          onTracksChange={onTracksChange}
        />
      )}
      
      {/* Grid helper */}
      <primitive object={createGrid(Math.max(terrainSize.length, terrainSize.breadth))} />
      
      {/* Camera controls */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={5}
        maxDistance={100}
        maxPolarAngle={Math.PI / 2.1}
      />
    </>
  );
}

// FPS Counter Component
function FPSCounter({ show }) {
  const [fps, setFps] = useState(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useFrame(() => {
    if (!show) return;
    
    frameCount.current++;
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime.current;

    if (deltaTime >= 1000) {
      setFps(Math.round((frameCount.current * 1000) / deltaTime));
      frameCount.current = 0;
      lastTime.current = currentTime;
    }
  });

  if (!show) return null;

  return (
    <mesh position={[0, 0, 0]}>
      {/* Hidden mesh - actual FPS display is handled by parent component */}
    </mesh>
  );
}

// Main Game Scene Component
export default function GameScene({ 
  terrainSize, 
  showDebug, 
  trackManager,
  selectedTool,
  rotation,
  heightOffset,
  onTracksChange,
  tracksVersion // Add tracksVersion prop
}) {
  const [sceneStats, setSceneStats] = useState({
    voxelCount: 0,
  });
  const [fps, setFps] = useState(0);
  const [trackCount, setTrackCount] = useState(0);

  const handleTracksChange = (tracks) => {
    setTrackCount(tracks.length);
    if (onTracksChange) onTracksChange(tracks);
  };

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
          selectedTool={selectedTool}
          rotation={rotation}
          heightOffset={heightOffset}
          onTracksChange={handleTracksChange}
          tracksVersion={tracksVersion} // Pass through to Scene
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
