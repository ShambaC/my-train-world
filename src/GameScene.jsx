import { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky } from '@react-three/drei';
import * as THREE from 'three';
import { generateTerrain, createGrid, VOXEL_SIZE } from './terrain';
import TrackRenderer from './tracks/TrackRenderer';
import TrainRenderer from './trains/TrainRenderer';
import Skybox from './environment/Skybox';
import LightingState from './environment/LightingState';
import Fireflies from './environment/Fireflies';
import { advanceWind } from './environment/wind';
import CameraController from './environment/CameraController';
import { createForestBorder } from './environment/ForestBorder';
import WaterSurface from './environment/WaterSurface';
import FogWall from './environment/FogWall';
import Effects from './postprocessing/Effects';
import ScatterProps from './environment/ScatterProps';
import StationRenderer from './stations/StationRenderer';
import CoachMenu from './ui/CoachMenu';

// Scene component that contains the terrain
function Scene({ 
  terrainSize, 
  terrainSeed,
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
  shadowMode = 'soft',
  tiltShiftEnabled,
  celShadingEnabled,
  trainDirection,
  trackCount,
  stationsVersion,
  onStationsChange,
  onCoachPick,
}) {
  const terrainRef = useRef();
  const orbitRef = useRef(null);
  const { camera, scene, gl } = useThree();
  const [terrain, setTerrain] = useState(null);
  const [forestBorder, setForestBorder] = useState(null);

  // Realtime shadow mode: none / hard (BasicShadowMap) / soft (PCFSoft).
  // The shadow type is baked into every receiving shader, so toggling
  // requires recompiling materials; 'none' also drops castShadow from the
  // light (a stale shadow map would otherwise keep shading the scene).
  useEffect(() => {
    const dir = scene.getObjectByName('directionalLight');
    if (dir) dir.castShadow = shadowMode !== 'none';
    gl.shadowMap.enabled = shadowMode !== 'none';
    gl.shadowMap.type =
      shadowMode === 'hard' ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
    scene.traverse((obj) => {
      if (obj.isMesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) m.needsUpdate = true;
      }
    });
  }, [shadowMode, gl, scene]);

  // Interpolated lighting state — one stable object shared by the lights,
  // fog, water shader, fog wall, train lights and fireflies.
  const lighting = useMemo(() => new LightingState(timeOfDay), []);
  useEffect(() => {
    lighting.setTarget(timeOfDay);
  }, [timeOfDay, lighting]);

  // Shadow camera covers the active playable region, not the whole map.
  const shadowHalf = Math.max(40, Math.min(Math.max(terrainSize.length, terrainSize.breadth) * 0.5 * VOXEL_SIZE * 0.85, 110));

  useEffect(() => {
    const dir = scene.getObjectByName('directionalLight');
    if (!dir) return;
    dir.shadow.camera.left = -shadowHalf;
    dir.shadow.camera.right = shadowHalf;
    dir.shadow.camera.top = shadowHalf;
    dir.shadow.camera.bottom = -shadowHalf;
    dir.shadow.camera.updateProjectionMatrix();
  }, [scene, shadowHalf]);

  // Shadow softness follows the light mood (long soft dawn shadows, crisp day)
  useEffect(() => {
    const dir = scene.getObjectByName('directionalLight');
    if (dir) dir.shadow.radius = lighting.target?.shadowRadius ?? 4;
  }, [timeOfDay, lighting, scene]);

  // Dev-only test hook
  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__mtw = {
        ...window.__mtw, camera, gl: gl.domElement, renderer: gl, THREE,
        terrainRef: terrainRef.current, terrainData: terrain?.userData, terrainGroup: terrain,
      };
    }
  }, [camera, gl, terrain, terrainRef]);

  // Per-frame lighting: ease the current values toward the target preset
  // (no abrupt color/intensity jumps), then apply to lights and fog.
  useFrame((_, delta) => {
    lighting.update(delta);
    advanceWind(delta);

    const amb = scene.getObjectByName('ambientLight');
    if (amb) {
      amb.color.copy(lighting.ambient.color);
      amb.intensity = lighting.ambient.intensity;
    }

    const dir = scene.getObjectByName('directionalLight');
    if (dir) {
      dir.color.copy(lighting.sun.color);
      dir.intensity = lighting.sun.intensity;
      dir.position.copy(lighting.sun.position);
    }

    if (fogEnabled) {
      if (!scene.fog) {
        scene.fog = new THREE.FogExp2(lighting.fog.color.getHex(), lighting.fog.density);
      }
      scene.fog.color.copy(lighting.fog.color);
      // null (from App default) = use the time-of-day preset density
      scene.fog.density = fogDensity != null ? fogDensity : lighting.fog.density;
    } else if (scene.fog) {
      scene.fog = null;
    }
  });


  useEffect(() => {
    // Generate terrain when size or seed changes
    const newTerrain = generateTerrain(terrainSize.length, terrainSize.breadth, terrainSeed);
    setTerrain(newTerrain);
    
    // Generate forest border around terrain (world-unit based)
    const border = createForestBorder(terrainSize, terrainSeed);
    setForestBorder(border);
    
    if (onTerrainGenerated) {
      // Count voxels for debug info
      let voxelCount = 0;
      newTerrain.children.forEach(mesh => {
        if (mesh instanceof THREE.InstancedMesh) {
          voxelCount += mesh.count;
        }
      });
      onTerrainGenerated({ voxelCount, diagnostics: newTerrain.userData.diagnostics });
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
  }, [terrainSize, terrainSeed, onTerrainGenerated]);

  return (
    <>
      <Skybox timeOfDay={timeOfDay} />
      <CameraController terrainSize={terrainSize} orbitRef={orbitRef} />
      
      {/* Lighting */}
      <ambientLight name="ambientLight" intensity={0.5} />
      <directionalLight
        name="directionalLight"
        position={[50, 60, 30]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-shadowHalf}
        shadow-camera-right={shadowHalf}
        shadow-camera-top={shadowHalf}
        shadow-camera-bottom={-shadowHalf}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      
      {/* Terrain */}
      {terrain && (
        <primitive object={terrain} ref={terrainRef} />
      )}

      {/* Water Surface */}
      <WaterSurface terrainSize={terrainSize} heightData={terrain?.userData} timeOfDay={timeOfDay} lighting={lighting} />

      {/* Forest Border */}
      {forestBorder && (
        <primitive object={forestBorder} />
      )}

      {/* Fog Wall */}
      <FogWall terrainSize={terrainSize} fogColor={lighting.fog.color} />

      {/* Night fireflies above water */}
      {terrain && (
        <Fireflies terrainData={terrain?.userData} lighting={lighting} />
      )}
      
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
          onCoachPick={onCoachPick}
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
          lighting={lighting}
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
  terrainSeed = 1337,
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
  shadowMode = 'soft',
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
  const [memStats, setMemStats] = useState({ jsHeapMB: -1, geometries: 0, textures: 0, programs: 0 });

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

  // Coach picker (radial menu) — opened when clicking an engine with the
  // coach tool; selection attaches the coach behind that engine.
  const [coachMenu, setCoachMenu] = useState(null);

  const handleCoachPick = (trainId, x, y) => {
    setCoachMenu({ trainId, x, y });
  };

  const handleCoachSelect = (coachType) => {
    if (coachMenu) {
      trainManager?.addCoach(coachMenu.trainId, coachType);
    }
    setCoachMenu(null);
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
          terrainSeed={terrainSeed}
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
          shadowMode={shadowMode}
          tiltShiftEnabled={tiltShiftEnabled}
          celShadingEnabled={celShadingEnabled}
          trainDirection={trainDirection}
          trackCount={trackCount}
          stationsVersion={stationsVersion}
          onStationsChange={handleStationsChange}
          onCoachPick={handleCoachPick}
        />
        {/* Effects only mount when active to avoid breaking default render */}
        {(tiltShiftEnabled || celShadingEnabled) && (
          <Effects tiltShiftEnabled={tiltShiftEnabled} celShadingEnabled={celShadingEnabled} />
        )}
        <FPSTracker show={showDebug} onFpsUpdate={setFps} onMemoryUpdate={setMemStats} />
      </Canvas>

      {/* Radial coach picker */}
      {coachMenu && (
        <CoachMenu
          x={coachMenu.x}
          y={coachMenu.y}
          onSelect={handleCoachSelect}
          onClose={() => setCoachMenu(null)}
        />
      )}
      
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
          {sceneStats.diagnostics && (
            <div className="text-xs text-gray-400">
              <div>Flat regions: {sceneStats.diagnostics.regionCount} • Build spots: {sceneStats.diagnostics.candidates}</div>
              <div>Largest flat: {sceneStats.diagnostics.largestArea} cells • Corridor: {sceneStats.diagnostics.longestCorridor} cells</div>
            </div>
          )}
          {memStats.jsHeapMB >= 0 && <div>Memory: {memStats.jsHeapMB} MB</div>}
          <div>WebGL: {memStats.geometries} geo • {memStats.textures} tex • {memStats.programs} prog</div>
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

// Separate component to track FPS + memory stats.
// JS heap is Chromium-only (performance.memory); three.js WebGL resource
// counts work in every browser, including Firefox.
function FPSTracker({ show, onFpsUpdate, onMemoryUpdate }) {
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  const gl = useThree((state) => state.gl);

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

      // JS heap usage (Chrome/Edge only; Firefox exposes no heap API)
      const mem = performance.memory;
      const info = gl?.info;
      onMemoryUpdate({
        jsHeapMB: mem && typeof mem.usedJSHeapSize === 'number'
          ? Math.round(mem.usedJSHeapSize / (1024 * 1024))
          : -1,
        geometries: info?.memory?.geometries ?? 0,
        textures: info?.memory?.textures ?? 0,
        programs: info?.programs?.length ?? 0,
      });
    }
  });

  return null;
}
