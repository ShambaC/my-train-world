import { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { generateTerrain, createGrid, VOXEL_SIZE } from './terrain';
import TrackRenderer from './tracks/TrackRenderer';
import TrainRenderer from './trains/TrainRenderer';
import SkyAtmosphere from './environment/SkyAtmosphere';
import LightingState from './environment/LightingState';
import Fireflies from './environment/Fireflies';
import { advanceWind } from './environment/wind';
import CameraController from './environment/CameraController';
import { createForestBorder } from './environment/ForestBorder';
import ShoreDressing from './environment/ShoreDressing';
import WaterSurface from './environment/WaterSurface';
import FogWall from './environment/FogWall';
import Effects from './postprocessing/Effects';
import { getGraphicsQuality } from './render/graphicsQuality';
import { installVisualReview } from './render/VisualReviewHarness';
import { initializeStyleKTX2 } from './utils/atlasTextures';
import ScatterProps from './environment/ScatterProps';
import GrassField from './environment/GrassField';
import StationRenderer from './stations/StationRenderer';
import CoachMenu from './ui/CoachMenu';
import StationRoleMenu from './ui/StationRoleMenu';
import EngineMenu from './ui/EngineMenu';
import RenderScheduler from './render/RenderScheduler';
import { ActivityManager } from './ambient/ActivityManager';
import ActivityRenderer from './ambient/ActivityRenderer';
import { trainAudio } from './audio/trainAudio';
import Roads from './environment/Roads';
import { TrafficManager } from './environment/TrafficManager';
import TrafficRenderer from './environment/TrafficRenderer';
import CameraCommands from './environment/CameraCommands';
import AxisGizmo from './environment/AxisGizmo';
import SignalsRenderer from './signals/SignalsRenderer';
import { CrossingManager } from './crossings/CrossingManager';
import CrossingRenderer from './crossings/CrossingRenderer';
import { cameraBus } from './utils/cameraBus';
import { clone } from './utils/editActions';
import CameraCollision, { constrainCamera } from './environment/cameraCollision';
import PracticalLights from './environment/PracticalLights';

// Scene component that contains the terrain
function Scene({ 
  terrainSize, 
  terrainSeed,
  onTerrainGenerated, 
  onTerrainReady,
  onSceneProgress,
  onSceneReady,
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
  onEnginePick,
  currentEngineType,
  frameLimit,
  vsync,
  ambientEnabled,
  onStationPlaced,
  activityManager,
  followTrainId,
  stationOrientation,
  roadManager,
  trafficManager,
  signalManager,
  crossingManager,
  trafficEnabled,
  signalsEnabled,
  trackLayoutVersion,
  history,
  onSelect,
  selectedTrainId,
  trainsVersion,
  stationsScatterVersion,
  showAxes,
  graphicsQuality = 'medium',
  visualFocusRef,
}) {
  const terrainRef = useRef();
  const waterRef = useRef();
  const orbitRef = useRef(null);
  const visualFocus = visualFocusRef || { current: { point: new THREE.Vector3(), distance: 0, mode: 'orbit' } };
  const focusTargetRef = useRef(new THREE.Vector3());
  const desiredCameraRef = useRef(new THREE.Vector3());
  const { camera, scene, gl } = useThree();
  const [terrain, setTerrain] = useState(null);
  const [forestBorder, setForestBorder] = useState(null);
  const sceneBootFramesRef = useRef(0);
  const sceneReadyRef = useRef(false);

  // Realtime shadow mode: none / hard (BasicShadowMap) / soft (PCFSoft).
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

  // Interpolated lighting state
  const lighting = useMemo(() => new LightingState(timeOfDay), []);
  useEffect(() => {
    lighting.setTarget(timeOfDay);
  }, [timeOfDay, lighting]);

  // Shadow camera covers the active playable region
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

  useEffect(() => {
    const dir = scene.getObjectByName('directionalLight');
    if (dir) dir.shadow.radius = lighting.target?.shadowRadius ?? 4;
  }, [timeOfDay, lighting, scene]);

  // Dev-only review and diagnostics hook
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__mtw = {
      ...window.__mtw, camera, scene, gl: gl.domElement, renderer: gl, THREE,
      terrainRef: terrainRef.current, terrainData: terrain?.userData, terrainGroup: terrain,
    };
    installVisualReview({
      camera,
      controlsRef: orbitRef,
      renderer: gl,
      getTimeOfDay: () => timeOfDay,
      getGraphicsQuality: () => graphicsQuality,
    });
  }, [camera, gl, terrain, timeOfDay, graphicsQuality]);
  useEffect(() => {
    initializeStyleKTX2(gl).catch((error) => {
      console.error('Style KTX2 initialization failed:', error);
    });
  }, [gl]);

  // Auto-scatter signals beside long track runs
  useEffect(() => {
    if (!terrain) return;
    signalManager?.rebuildAuto(trackManager, terrainSeed, terrain?.userData);
  }, [trackLayoutVersion, tracksVersion, terrainSeed, terrain, signalManager, trackManager]);

  useFrame((_, delta) => {
    if (!sceneReadyRef.current && terrain && roadManager?.ready &&
      (!trafficEnabled || trafficManager?.resetCount > 0)) {
      sceneBootFramesRef.current += 1;
      if (sceneBootFramesRef.current === 1) onSceneProgress?.(0.7);
      if (sceneBootFramesRef.current >= 3) {
        sceneReadyRef.current = true;
        onSceneProgress?.(1);
        onSceneReady?.();
      }
    }

    lighting.update(delta);
    advanceWind(delta);
    const controls = orbitRef.current;
    const followTrain = followTrainId ? trainManager.getTrain(followTrainId) : null;
    const focusTarget = focusTargetRef.current;
    const desiredCamera = desiredCameraRef.current;
    if (followTrain) {
      const hx = Math.sin(followTrain.rotation);
      const hz = Math.cos(followTrain.rotation);
      const sideX = hz;
      const sideZ = -hx;
      focusTarget.set(
        followTrain.position.x,
        followTrain.position.y + 0.25,
        followTrain.position.z,
      );
      desiredCamera.set(
        focusTarget.x - hx * 3.6 + sideX * 1.4,
        focusTarget.y + 2.25,
        focusTarget.z - hz * 3.6 + sideZ * 1.4,
      );
      constrainCamera(desiredCamera, focusTarget, terrain?.userData, trackManager, trainManager);
      const k = 1 - Math.exp(-3.5 * Math.min(delta, 0.1));
      camera.position.lerp(desiredCamera, k);
      controls.target.lerp(focusTarget, k);
      controls.update();
      visualFocus.current.mode = 'follow';
      visualFocus.current.point.copy(focusTarget);
      visualFocus.current.distance = camera.position.distanceTo(focusTarget);
      return;
    }

    if (controls) {
      const distance = camera.position.distanceTo(controls.target);
      const closeRangeBoost = THREE.MathUtils.clamp(8 / Math.max(distance, 0.2), 1, 8);
      controls.zoomSpeed = 1.5 * closeRangeBoost;
      controls.panSpeed = 1.5 * closeRangeBoost;
      visualFocus.current.mode = distance > 80 ? 'overview' : 'orbit';
      visualFocus.current.point.copy(controls.target);
      visualFocus.current.distance = distance;
      if (import.meta.env.DEV && window.__mtw) window.__mtw.orbitControls = controls;
    }
    const hemi = scene.getObjectByName('hemisphereLight');
    if (hemi) {
      hemi.color.copy(lighting.hemisphereSky);
      hemi.groundColor.copy(lighting.hemisphereGround);
      hemi.intensity = lighting.hemisphereIntensity;
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
      scene.fog.density = fogDensity != null ? fogDensity : lighting.fog.density;
    } else if (scene.fog) {
      scene.fog = null;
    }
  });

  useEffect(() => {
    const t0 = performance.now();
    const newTerrain = generateTerrain(terrainSize.length, terrainSize.breadth, terrainSeed);
    setTerrain(newTerrain);
    sceneBootFramesRef.current = 0;
    sceneReadyRef.current = false;
    onSceneProgress?.(0.2);

    const border = createForestBorder(terrainSize, terrainSeed);
    setForestBorder(border);

    if (onTerrainGenerated) {
      let voxelCount = 0;
      newTerrain.children.forEach(mesh => {
        if (mesh instanceof THREE.InstancedMesh) {
          voxelCount += mesh.count;
        }
      });
      onTerrainGenerated({
        voxelCount,
        genTimeMs: Math.round(performance.now() - t0),
        diagnostics: newTerrain.userData.diagnostics,
      });
    }
    if (onTerrainReady) onTerrainReady(newTerrain.userData);
    return () => {
      if (border) {
        border.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((material) => {
              material.map?.dispose();
              material.dispose();
            });
          }
        });
      }
      newTerrain.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach((material) => {
            material.map?.dispose();
            material.dispose();
          });
        }
      });
    };

  }, [terrainSize, terrainSeed, onTerrainGenerated, onTerrainReady, onSceneProgress]);

  return (
    <>
      <SkyAtmosphere timeOfDay={timeOfDay} cloudLayers={getGraphicsQuality(graphicsQuality).cloudLayers} lighting={lighting} />
      <CameraController terrainSize={terrainSize} orbitRef={orbitRef} followActive={!!followTrainId} />
      
      {/* Lighting */}
      <hemisphereLight name="hemisphereLight" intensity={0.7} />
      <directionalLight
        name="directionalLight"
        position={[50, 60, 30]}
        intensity={1.15}
        castShadow
        shadow-mapSize-width={getGraphicsQuality(graphicsQuality).shadowMapSize}
        shadow-mapSize-height={getGraphicsQuality(graphicsQuality).shadowMapSize}
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
       <WaterSurface
         ref={waterRef}
         terrainSize={terrainSize}
         heightData={terrain?.userData}
         timeOfDay={timeOfDay}
         lighting={lighting}
         trackManager={trackManager}
         trainManager={trainManager}
         graphicsQuality={graphicsQuality}
       />
      <ShoreDressing
        terrainData={terrain?.userData}
        trackManager={trackManager}
        stationManager={stationManager}
        roadManager={roadManager}
        revision={trackLayoutVersion + stationsScatterVersion}
      />

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
          waterRef={waterRef}
          selectedTool={selectedTool}
          rotation={rotation}
          heightOffset={heightOffset}
          onTracksChange={onTracksChange}
          trainDirection={trainDirection}
          onStationsChange={onStationsChange}
          onCoachPick={onCoachPick}
          onEnginePick={onEnginePick}
          currentEngineType={currentEngineType}
          signalManager={signalManager}
          roadManager={roadManager}
          history={history}
          onSelect={onSelect}
          terrainData={terrain?.userData}
        />
      )}

      {/* Station System */}
      {terrain && (
        <StationRenderer
          stationManager={stationManager}
          terrainRef={terrainRef}
          selectedTool={selectedTool}
          orientation={stationOrientation}
          terrainData={terrain?.userData}
          stationsVersion={stationsVersion}
          onStationsChange={onStationsChange}
          onStationPlaced={onStationPlaced}
          lighting={lighting}
          history={history}
          trackManager={trackManager}
          roadManager={roadManager}
        />
      )}

      {/* Ambient passenger/cargo activity */}
      {terrain && ambientEnabled && (
        <ActivityRenderer
          activityManager={activityManager}
          stationManager={stationManager}
          trainManager={trainManager}
          enabled={ambientEnabled}
        />
      )}

      {/* Roads */}
      {terrain && (
        <Roads
          terrainData={terrain?.userData}
          roadManager={roadManager}
          lighting={lighting}
          enabled={trafficEnabled}
        />
      )}

      {/* Scattered Props */}
      {terrain && (
        <ScatterProps
          terrainData={terrain?.userData}
          trackManager={trackManager}
          stationManager={stationManager}
          trackCount={trackCount}
          stationsVersion={stationsScatterVersion}
          roadManager={roadManager}
        />
      )}

      {/* Stylized grass field */}
      {terrain && (
        <GrassField
          terrainData={terrain?.userData}
          trackManager={trackManager}
          stationManager={stationManager}
          trackCount={trackCount}
          stationsVersion={stationsScatterVersion}
          roadManager={roadManager}
          lighting={lighting}
          graphicsQuality={graphicsQuality}
        />
      )}

      {/* Traffic (vehicles, pedestrians) */}
      {terrain && trafficEnabled && (
        <TrafficRenderer
          trafficManager={trafficManager}
          roadManager={roadManager}
          crossingManager={crossingManager}
          lighting={lighting}
          enabled={trafficEnabled && ambientEnabled}
        />
      )}

      {/* Signals */}
      {terrain && (
        <SignalsRenderer
          signalManager={signalManager}
          trainManager={trainManager}
          lighting={lighting}
          enabled={signalsEnabled}
        />
      )}

      {/* Road-rail crossings */}
      {terrain && (
        <CrossingRenderer
          crossingManager={crossingManager}
          trackManager={trackManager}
          roadManager={roadManager}
          trainManager={trainManager}
          lighting={lighting}
          enabled={signalsEnabled}
        />
      )}
      
      {/* Train System */}
      {terrain && (
        <TrainRenderer
          trainManager={trainManager}
          lighting={lighting}
          selectedTrainId={selectedTrainId}
          trainsVersion={trainsVersion}
        />
      )}

      <PracticalLights
        trainManager={trainManager}
        stationManager={stationManager}
        lighting={lighting}
      />
      
      {/* Grid helper */}
      <primitive object={createGrid(Math.max(terrainSize.length, terrainSize.breadth))} />
      
      {/* Camera controls */}
      <OrbitControls
        ref={orbitRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={0.75}
        maxDistance={Math.max(120, Math.max(terrainSize.length, terrainSize.breadth) * 0.75)}
        maxPolarAngle={Math.PI - 0.08}
      />

      {/* QoL camera commands */}
      <CameraCommands
        terrainSize={terrainSize}
        trackManager={trackManager}
        stationManager={stationManager}
        trainManager={trainManager}
        followTrainId={followTrainId}
        orbitRef={orbitRef}
      />

      <CameraCollision
        terrainData={terrain?.userData}
        trackManager={trackManager}
        trainManager={trainManager}
        orbitRef={orbitRef}
      />

      {/* Axis indicator gizmo */}
      <AxisGizmo visible={showAxes} />
    </>
  );
}

// Main Game Scene Component
export default function GameScene({ 
  terrainSize, 
  terrainSeed = 1337,
  showDebug,
  showAxes,
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
  frameLimit = 120,
  vsync = true,
  graphicsQuality = 'medium',
  trainDirection = 1,
  ambientEnabled = true,
  soundsEnabled = true,
  trafficEnabled = true,
  signalsEnabled = true,
  followTrainId = null,
  stationOrientation = 'horizontal',
  history,
  onSelect,
  onTerrainReady,
  onSceneProgress,
  onSceneReady,
  worldVersion = 0,
  selectedTrainId = null,
  roadManager,
  signalManager,
  onCanvasReady,
  paused = false,
  debugDetail = 'compact',
  debugPosition = 'top-left',
}) {
  const [sceneStats, setSceneStats] = useState({
    voxelCount: 0,
    genTimeMs: 0,
  });
  const [fps, setFps] = useState(0);
  const [trackCount, setTrackCount] = useState(0);
  const [trainCount, setTrainCount] = useState(0);
  const [stationCount, setStationCount] = useState(0);
  const [stationsVersion, setStationsVersion] = useState(0);
  const [trackLayoutVersion, setTrackLayoutVersion] = useState(0);
  const [trainsVersion, setTrainsVersion] = useState(0);
  const [stationsScatterVersion, setStationsScatterVersion] = useState(0);
  const [memStats, setMemStats] = useState({ jsHeapMB: -1, geometries: 0, textures: 0, programs: 0, drawCalls: 0, triangles: 0 });

  const [currentEngineType, setCurrentEngineType] = useState('steam-engine');
  const visualFocusRef = useRef({
    point: new THREE.Vector3(),
    distance: 0,
    mode: 'orbit',
  });

  const activityManagerRef = useRef(null);
  if (!activityManagerRef.current) {
    activityManagerRef.current = new ActivityManager(stationManager, trainManager);
  }

  const trafficManagerRef = useRef(null);
  if (!trafficManagerRef.current) trafficManagerRef.current = new TrafficManager();
  const crossingManagerRef = useRef(null);
  if (!crossingManagerRef.current) {
    crossingManagerRef.current = new CrossingManager(trackManager, roadManager);
  }

  // Deferred scatter rebuild — prevents GrassField/ScatterProps rebuild from
  // blocking the station wave pop animation.
  const scatterTimeoutRef = useRef(null);
  const bumpScatter = (delayMs = 0) => {
    if (scatterTimeoutRef.current) clearTimeout(scatterTimeoutRef.current);
    scatterTimeoutRef.current = delayMs > 0
      ? setTimeout(() => { scatterTimeoutRef.current = null; setStationsScatterVersion(v => v + 1); }, delayMs)
      : (setStationsScatterVersion(v => v + 1), null);
  };

  // Train/tool/station/crossing sound switch.
  useEffect(() => {
    trainAudio.setTrainEnabled(soundsEnabled);
  }, [soundsEnabled]);

  useEffect(() => {
    trainAudio.setAmbientEnabled(ambientEnabled);
  }, [ambientEnabled]);

  useEffect(() => {
    trainAudio.startMusic();
    return () => {
      trainAudio.stopAmbient();
      trainAudio.stopMusic();
    };
  }, []);

  // Cleanup scatter timeout on unmount
  useEffect(() => {
    return () => { if (scatterTimeoutRef.current) clearTimeout(scatterTimeoutRef.current); };
  }, []);

  // Re-sync ambient targets when stations change
  useEffect(() => {
    activityManagerRef.current.sync();
  }, [stationsVersion]);

  const handleTracksChange = (tracks) => {
    setTrackCount(tracks.length);
    setTrackLayoutVersion((v) => v + 1);
    stationManager?.rebuildBindings(trackManager);
    if (onTracksChange) onTracksChange(tracks);
  };

  const handleStationsChange = () => {
    setStationsVersion((v) => v + 1);
    setStationCount(stationManager?.getAllStations().length || 0);
    stationManager?.rebuildBindings(trackManager);
  };

  // Station role picker (radial menu)
  const [roleMenu, setRoleMenu] = useState(null);

  const handleStationPlaced = (station, x, y) => {
    setRoleMenu({ stationId: station.id, x, y });
    // Defer scatter rebuild so wave pop animation isn't blocked
    const waveDuration = station.lengthCells * 0.5 * 0.1 + 0.45 + 0.3;
    bumpScatter(waveDuration * 1000);
  };

  const handleRoleSelect = (role) => {
    if (roleMenu) {
      stationManager?.setRole(roleMenu.stationId, role);
      handleStationsChange();
    }
    setRoleMenu(null);
  };

  // Coach picker (radial menu)
  const [coachMenu, setCoachMenu] = useState(null);

  const handleCoachPick = (trainId, x, y) => {
    setCoachMenu({ trainId, x, y });
  };

  const handleCoachSelect = (coachType) => {
    if (coachMenu) {
      const coach = trainManager?.addCoach(coachMenu.trainId, coachType);
      if (coach && history) {
        const trainId = coachMenu.trainId;
        const idx = trainManager.getTrain(trainId).coaches.findIndex((c) => c.id === coach.id);
        history.push({
          undo: () => trainManager.removeCoach(trainId, coach.id),
          redo: () => trainManager.restoreCoach(trainId, coach, idx),
        });
      }
      if (coach) trainAudio.coachAttached();
      setTrainsVersion(v => v + 1);
    }
    setCoachMenu(null);
  };

  // Engine picker (radial menu) — opened when clicking track with Train tool or clicking an existing engine
  const [engineMenu, setEngineMenu] = useState(null);

  const handleEnginePick = (target, x, y) => {
    // target can be { trackId, direction } (new placement) or { trainId } (switch engine)
    let currentEngine = currentEngineType;
    if (target?.trainId) {
      const train = trainManager?.getTrain(target.trainId);
      if (train?.engineType) currentEngine = train.engineType;
    }
    setEngineMenu({
      ...target,
      x,
      y,
      currentEngine,
    });
  };

  const handleEngineSelect = (engineType) => {
    if (engineMenu) {
      setCurrentEngineType(engineType);
      if (engineMenu.trackId) {
        // Place new train with chosen engine
        const train = trainManager?.addTrain(engineMenu.trackId, engineMenu.direction, engineType);
        if (train && history) {
          const snap = clone(train);
          history.push({
            undo: () => trainManager.removeTrain(train.id),
            redo: () => trainManager.restoreTrain(clone(snap)),
          });
        }
        if (train) trainAudio.trainPlaced();
        setTrainsVersion(v => v + 1);
      } else if (engineMenu.trainId) {
        // Switch engine of existing train
        const train = trainManager?.getTrain(engineMenu.trainId);
        if (train && history) {
          const prevEngineType = train.engineType;
          const trainId = train.id;
          history.push({
            undo: () => trainManager.setEngineType(trainId, prevEngineType),
            redo: () => trainManager.setEngineType(trainId, engineType),
          });
        }
        trainManager?.setEngineType(engineMenu.trainId, engineType);
        setTrainsVersion(v => v + 1);
      }
    }
    setEngineMenu(null);
  };

  // Stations are cleared by App on terrain change
  useEffect(() => {
    setStationsVersion((v) => v + 1);
    setStationCount(stationManager?.getAllStations().length || 0);
    bumpScatter(0);
  }, [terrainSize, stationManager]);

  useEffect(() => {
    if (!worldVersion) return;
    setTrackLayoutVersion((v) => v + 1);
    setStationsVersion((v) => v + 1);
    setTrackCount(trackManager?.getAllTracks().length || 0);
    setStationCount(stationManager?.getAllStations().length || 0);
    stationManager?.rebuildBindings(trackManager);
    bumpScatter(0);
  }, [worldVersion, trackManager, stationManager]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      Object.assign(window.__mtw || (window.__mtw = {}), {
        trackManager, stationManager, trainManager,
        activityManager: activityManagerRef.current,
        roadManager: roadManager,
        signalManager: signalManager,
        crossingManager: crossingManagerRef.current,
        trafficManager: trafficManagerRef.current,
        handleStationsChange,
        history,
        cameraBus,
      });
    }
  }, [trackManager, stationManager, trainManager, history]);
  
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
        dpr={[1, getGraphicsQuality(graphicsQuality).dprCap]}
        shadows
        frameloop="never"
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => onCanvasReady?.(gl.domElement)}
      >
        <RenderScheduler frameLimit={frameLimit} vsync={vsync} paused={paused} />
        <Scene 
          terrainSize={terrainSize} 
          terrainSeed={terrainSeed}
           onTerrainGenerated={setSceneStats}
           onTerrainReady={onTerrainReady}
           onSceneProgress={onSceneProgress}
           onSceneReady={onSceneReady}
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
          onEnginePick={handleEnginePick}
          currentEngineType={currentEngineType}
          frameLimit={frameLimit}
          vsync={vsync}
          graphicsQuality={graphicsQuality}
          visualFocusRef={visualFocusRef}
          ambientEnabled={ambientEnabled}
          onStationPlaced={handleStationPlaced}
          activityManager={activityManagerRef.current}
          followTrainId={followTrainId}
          stationOrientation={stationOrientation}
          roadManager={roadManager}
          trafficManager={trafficManagerRef.current}
          signalManager={signalManager}
          crossingManager={crossingManagerRef.current}
          trafficEnabled={trafficEnabled}
          signalsEnabled={signalsEnabled}
          trackLayoutVersion={trackLayoutVersion}
          history={history}
          onSelect={onSelect}
          selectedTrainId={selectedTrainId}
          trainsVersion={trainsVersion}
          stationsScatterVersion={stationsScatterVersion}
           showAxes={showAxes}
         />
        {/* Final color pass always mounted: vanilla now shares the miniature
            mode's vibrant grading (exposure/saturation/vignette); the tilt
            blur and cel passes stay opt-in toggles. */}
        <Effects tiltShiftEnabled={tiltShiftEnabled} celShadingEnabled={celShadingEnabled} graphicsQuality={graphicsQuality} visualFocusRef={visualFocusRef} />
        <FPSTracker show={showDebug} onFpsUpdate={setFps} onMemoryUpdate={setMemStats} />
      </Canvas>

      {/* Radial engine picker */}
      {engineMenu && (
        <EngineMenu
          x={engineMenu.x}
          y={engineMenu.y}
          currentEngine={engineMenu.currentEngine}
          onSelect={handleEngineSelect}
          onClose={() => setEngineMenu(null)}
        />
      )}

      {/* Radial coach picker */}
      {coachMenu && (
        <CoachMenu
          x={coachMenu.x}
          y={coachMenu.y}
          onSelect={handleCoachSelect}
          onClose={() => setCoachMenu(null)}
        />
      )}

      {/* Station role picker (after placement) */}
      {roleMenu && (
        <StationRoleMenu
          x={roleMenu.x}
          y={roleMenu.y}
          onSelect={handleRoleSelect}
          onClose={() => setRoleMenu(null)}
        />
      )}
      
      {/* Debug Overlay */}
      {showDebug && (
        <div className={`absolute z-30 max-w-[min(32rem,calc(100vw-2rem))] rounded-lg bg-black/70 px-4 py-3 font-mono text-sm text-white ${
          debugPosition === 'top-right' ? 'right-4 top-4' :
          debugPosition === 'bottom-left' ? 'bottom-4 left-4' :
          debugPosition === 'bottom-right' ? 'bottom-4 right-4' : 'left-4 top-4'
        }`}>
          <div className="font-bold text-green-400 mb-2">Debug Info</div>
          <div>FPS: {fps}</div>
          <div>Tracks: {trackCount}</div>
          <div>Trains: {trainCount}</div>
          <div>Terrain: {terrainSize.length} × {terrainSize.breadth}</div>
          {debugDetail === 'full' && <>
            <div>Stations: {stationCount}</div>
            <div>Voxels: {sceneStats.voxelCount.toLocaleString()}</div>
            {sceneStats.genTimeMs > 0 && <div>Terrain gen: {sceneStats.genTimeMs} ms</div>}
            {sceneStats.diagnostics && <div className="text-xs text-gray-400"><div>Flat regions: {sceneStats.diagnostics.regionCount} • Build spots: {sceneStats.diagnostics.candidates}</div><div>Largest flat: {sceneStats.diagnostics.largestArea} cells • Corridor: {sceneStats.diagnostics.longestCorridor} cells</div></div>}
            {memStats.jsHeapMB >= 0 && <div>Memory: {memStats.jsHeapMB} MB</div>}
            <div>WebGL: {memStats.geometries} geo • {memStats.textures} tex • {memStats.programs} prog</div>
            <div>Draw calls: {memStats.drawCalls} • Tris: {memStats.triangles.toLocaleString()}</div>
            <div>Frame limit: {frameLimit === 0 ? 'Uncapped' : frameLimit} • Vsync: {vsync ? 'On' : 'Off'}</div>
            <div>Graphics: {graphicsQuality} • DPR cap: {getGraphicsQuality(graphicsQuality).dprCap}</div>
            <div>Shadow map: {getGraphicsQuality(graphicsQuality).shadowMapSize}px • Bloom: {getGraphicsQuality(graphicsQuality).bloom ? 'On' : 'Off'}</div>
            {selectedTool && <div className="border-t border-gray-600 pt-2"><div>Tool: {selectedTool.name}</div>{selectedTool.type === 'station' ? <div>Orientation: {stationOrientation === 'vertical' ? 'Vertical (R to flip)' : 'Horizontal (R to flip)'}</div> : <div>Rotation: {rotation}°</div>}{heightOffset !== 0 && <div>Height: {heightOffset.toFixed(1)}</div>}</div>}
          </>}
        </div>
      )}
    </div>
  );
}

// Separate component to track FPS + memory stats.
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

      const mem = performance.memory;
      const info = gl?.info;
      onMemoryUpdate({
        jsHeapMB: mem && typeof mem.usedJSHeapSize === 'number'
          ? Math.round(mem.usedJSHeapSize / (1024 * 1024))
          : -1,
        geometries: info?.memory?.geometries ?? 0,
        textures: info?.memory?.textures ?? 0,
        programs: info?.programs?.length ?? 0,
        drawCalls: info?.render?.calls ?? 0,
        triangles: info?.render?.triangles ?? 0,
      });
    }
  });

  return null;
}
