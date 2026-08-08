import { useRef, useEffect, useState } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { generateTerrain, createGrid } from './terrain';
import TrackRenderer from './tracks/TrackRenderer';
import TrainRenderer from './trains/TrainRenderer';
import Skybox, { getLightingForTime } from './environment/Skybox';
import CameraController from './environment/CameraController';
import { createForestBorder } from './environment/ForestBorder';
import WaterSurface from './environment/WaterSurface';
import FogWall from './environment/FogWall';
import Effects from './postprocessing/Effects';
import ScatterProps from './environment/ScatterProps';
import StationRenderer from './stations/StationRenderer';

// Scene component that contains the terrain
function Scene({ 
  terrainSize, 
  onTerrainGenerated, 
  trackManager,
  stationManager,
  trainManager,
  selectedTool, 
  rotation,
  heightOffset,
  onTracksChange,
  tracksVersion,
  timeOfDay,
  fogEnabled,
  fogDensity,
  tiltShiftEnabled,
  celShadingEnabled,
  trainDirection,
  trackCount,
  stationsVersion,
  onStationsChange,
}) {
  const terrainRef = useRef();
  const orbitRef = useRef(null);
  const { camera, scene, gl } = useThree();
  const [terrain, setTerrain] = useState(null);
  const [forestBorder, setForestBorder] = useState(null);

  // Dev-only test hook
  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__mtw = {
        ...window.__mtw, camera, gl: gl.domElement, THREE,
        terrainRef: terrainRef.current, terrainData: terrain?.userData, terrainGroup: terrain,
      };
    }
  }, [camera, gl, terrain, terrainRef]);
  
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
    
    // Update fog - using FogExp2 for more natural distance-based fog
    if (fogEnabled && lighting.fog) {
      // Use custom density if provided, otherwise use preset
      const density = fogDensity !== undefined ? fogDensity : lighting.fog.density;
      scene.fog = new THREE.FogExp2(
        lighting.fog.color,
        density
      );
    } else {
      scene.fog = null;
    }
  }, [timeOfDay, fogEnabled, fogDensity, scene]);


  useEffect(() => {
    // Generate terrain when size changes
    const newTerrain = generateTerrain(terrainSize.length, terrainSize.breadth);
    setTerrain(newTerrain);
    
    // Generate forest border around terrain (world-unit based)
    const border = createForestBorder(terrainSize);
    setForestBorder(border);
    
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

    // Cleanup old border on unmount
    return () => {
      if (border) {
        border.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }
    };
  }, [terrainSize, onTerrainGenerated]);

  return (
    <>
      <Skybox timeOfDay={timeOfDay} />
      <CameraController terrainSize={terrainSize} orbitRef={orbitRef} />
      
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

      {/* Water Surface */}
      <WaterSurface terrainSize={terrainSize} heightData={terrain?.userData} timeOfDay={timeOfDay} />

      {/* Forest Border */}
      {forestBorder && (
        <primitive object={forestBorder} />
      )}

      {/* Fog Wall */}
      <FogWall terrainSize={terrainSize} fogColor={getLightingForTime(timeOfDay).fog?.color || 0xd4e8f7} />
      
      {/* Track System */}
      {terrain && (
        <TrackRenderer
          key={tracksVersion}
          trackManager={trackManager}
          stationManager={stationManager}
          trainManager={trainManager}
          terrainRef={terrainRef}
          selectedTool={selectedTool}
          rotation={rotation}
          heightOffset={heightOffset}
          onTracksChange={onTracksChange}
          trainDirection={trainDirection}
          onStationsChange={onStationsChange}
        />
      )}

      {/* Station System */}
      {terrain && (
        <StationRenderer
          stationManager={stationManager}
          terrainRef={terrainRef}
          selectedTool={selectedTool}
          rotation={rotation}
          terrainData={terrain?.userData}
          stationsVersion={stationsVersion}
          onStationsChange={onStationsChange}
        />
      )}

      {/* Scattered Props */}
      {terrain && (
        <ScatterProps
          terrainData={terrain?.userData}
          trackManager={trackManager}
          stationManager={stationManager}
          trackCount={trackCount}
          stationsVersion={stationsVersion}
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
        ref={orbitRef}
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
  stationManager,
  trainManager,
  selectedTool,
  rotation,
  heightOffset,
  onTracksChange,
  tracksVersion,
  timeOfDay = 'day',
  fogEnabled = true,
  fogDensity,
  tiltShiftEnabled = false,
  celShadingEnabled = false,
  trainDirection = 1,
}) {
  const [sceneStats, setSceneStats] = useState({
    voxelCount: 0,
  });
  const [fps, setFps] = useState(0);
  const [trackCount, setTrackCount] = useState(0);
  const [trainCount, setTrainCount] = useState(0);
  const [stationCount, setStationCount] = useState(0);
  const [stationsVersion, setStationsVersion] = useState(0);
  const [memoryMB, setMemoryMB] = useState(0);

  const handleTracksChange = (tracks) => {
    setTrackCount(tracks.length);
    stationManager?.rebuildBindings(trackManager);
    if (onTracksChange) onTracksChange(tracks);
  };

  const handleStationsChange = () => {
    setStationsVersion((v) => v + 1);
    setStationCount(stationManager?.getAllStations().length || 0);
    stationManager?.rebuildBindings(trackManager);
  };

  // Stations are cleared by App on terrain change — re-sync versions
  useEffect(() => {
    setStationsVersion((v) => v + 1);
    setStationCount(stationManager?.getAllStations().length || 0);
  }, [terrainSize, stationManager]);

  // Dev-only test hook
  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__mtw = { trackManager, stationManager, trainManager };
    }
  }, [trackManager, stationManager, trainManager]);
  
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
          stationManager={stationManager}
          trainManager={trainManager}
          selectedTool={selectedTool}
          rotation={rotation}
          heightOffset={heightOffset}
          onTracksChange={handleTracksChange}
          tracksVersion={tracksVersion}
          timeOfDay={timeOfDay}
          fogEnabled={fogEnabled}
          fogDensity={fogDensity}
          tiltShiftEnabled={tiltShiftEnabled}
          celShadingEnabled={celShadingEnabled}
          trainDirection={trainDirection}
          trackCount={trackCount}
          stationsVersion={stationsVersion}
          onStationsChange={handleStationsChange}
        />
        {/* Effects only mount when active to avoid breaking default render */}
        {(tiltShiftEnabled || celShadingEnabled) && (
          <Effects tiltShiftEnabled={tiltShiftEnabled} celShadingEnabled={celShadingEnabled} />
        )}
        <FPSTracker show={showDebug} onFpsUpdate={setFps} onMemoryUpdate={setMemoryMB} />
      </Canvas>
      
      {/* Debug Overlay */}
      {showDebug && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white px-4 py-3 rounded-lg font-mono text-sm space-y-1">
          <div className="font-bold text-green-400 mb-2">Debug Info</div>
          <div>FPS: {fps}</div>
          <div>Voxels: {sceneStats.voxelCount.toLocaleString()}</div>
          <div>Tracks: {trackCount}</div>
          <div>Trains: {trainCount}</div>
          <div>Stations: {stationCount}</div>
          <div>Terrain: {terrainSize.length} × {terrainSize.breadth}</div>
          {memoryMB > 0 && <div>Memory: {memoryMB} MB</div>}
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

// Separate component to track FPS + JS heap memory (Chromium-only)
function FPSTracker({ show, onFpsUpdate, onMemoryUpdate }) {
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

      // JS heap usage (Chrome/Edge only; other browsers return undefined)
      const mem = performance.memory;
      if (mem && typeof mem.usedJSHeapSize === 'number') {
        onMemoryUpdate(Math.round(mem.usedJSHeapSize / (1024 * 1024)));
      }
    }
  });

  return null;
}
