import { useState, useRef, useEffect, useCallback } from "react";
import GameScene from "./GameScene";
import ControlPanel from "./ControlPanel";
import LoadingScreen from "./LoadingScreen";
import Hotbar from "./ui/Hotbar";
import SelectionPanel from "./ui/SelectionPanel";
import { TrackManager } from "./tracks/TrackManager";
import { TrainManager } from "./trains/TrainManager";
import { StationManager } from "./stations/StationManager";
import ModelLibrary from "./models/ModelLibrary";
import { loadSettings, saveSettings } from "./utils/settings";
import { HistoryManager } from "./utils/history";
import { cameraBus } from "./utils/cameraBus";
import { trainAudio } from "./audio/trainAudio";
import { RoadManager } from "./environment/roadNetwork";
import { SignalManager } from "./signals/SignalManager";
import {
  saveWorldToFile,
  loadWorldFromFile,
  loadRecoverySnapshot,
  autosaveWorld,
  saveSnapshot,
  applyWorld,
} from "./utils/worldSave";

// Define available tools
const TOOLS = [
  { 
    id: 'hand', 
    name: 'Hand / Deselect', 
    label: 'Hand',
    icon: '✋', 
    type: 'hand'
  },
  { 
    id: 'straight', 
    name: 'Straight Track', 
    label: 'Straight',
    icon: '━', 
    type: 'track',
    trackType: 'straight'
  },
  { 
    id: 'curved', 
    name: 'Curved Track', 
    label: 'Curved',
    icon: '╰', 
    type: 'track',
    trackType: 'curved'
  },
  { 
    id: 'road', 
    name: 'Place Road', 
    label: 'Road',
    icon: '🛣️', 
    type: 'road'
  },
  { 
    id: 'train', 
    name: 'Place Train', 
    label: 'Train',
    icon: '🚂', 
    type: 'train'
  },
  { 
    id: 'station', 
    name: 'Place Station', 
    label: 'Station',
    icon: '🚉', 
    type: 'station'
  },
  { 
    id: 'coach', 
    name: 'Add Coach', 
    label: 'Coach',
    icon: '🚃', 
    type: 'coach'
  },
  { 
    id: 'delete', 
    name: 'Delete Tool', 
    label: 'Delete',
    icon: '🗑️', 
    type: 'delete'
  },
];

function App() {
  const [terrainSize, setTerrainSize] = useState({ length: 100, breadth: 100 });
  const [terrainSeed, setTerrainSeed] = useState(1337);
  const [showDebug, setShowDebug] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedToolIndex, setSelectedToolIndex] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [heightOffset, setHeightOffset] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState('day');
  const [fogEnabled, setFogEnabled] = useState(true);
  const [fogDensity, setFogDensity] = useState(null); // null = use time-of-day preset density
  const [shadowMode, setShadowMode] = useState('soft'); // none | hard | soft
  const [tiltShiftEnabled, setTiltShiftEnabled] = useState(false);
  const [celShadingEnabled, setCelShadingEnabled] = useState(false);
  const [ambientEnabled, setAmbientEnabled] = useState(true);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [trafficEnabled, setTrafficEnabled] = useState(true);
  const [signalsEnabled, setSignalsEnabled] = useState(true);
  const [followTrainId, setFollowTrainId] = useState(null);
  // Stations have exactly two orientations (horizontal / vertical); R toggles.
  const [stationOrientation, setStationOrientation] = useState('horizontal');
  // Render pacing prefs — persisted, never touch world state.
  // Defaults: 120 FPS limit, vsync on (see PerformanceSettings.jsx).
  const [frameLimit, setFrameLimit] = useState(() => {
    const v = loadSettings().frameLimit;
    return v === undefined || v === null ? 120 : v;
  });
  const [vsync, setVsync] = useState(() => {
    const v = loadSettings().vsync;
    return v === undefined || v === null ? true : v;
  });
  const [tracksVersion, setTracksVersion] = useState(0);
  const [trainDirection, setTrainDirection] = useState(1); // 1=forward, -1=backward
  const [loadProgress, setLoadProgress] = useState(0);
  const [trainCount, setTrainCount] = useState(0);

  // QoL state: selection, history, world refresh counter, status, audio.
  const [selection, setSelection] = useState(null);
  const [worldVersion, setWorldVersion] = useState(0);
  const [worldStatus, setWorldStatus] = useState('');
  const [audioVolumes, setAudioVolumes] = useState(() => {
    const v = loadSettings().audioVolumes;
    return { master: 1, train: 1, crossing: 1, ...(v || {}) };
  });

  const trackManagerRef = useRef(new TrackManager());
  const stationManagerRef = useRef(new StationManager());
  const trainManagerRef = useRef(new TrainManager(trackManagerRef.current, stationManagerRef.current));
  const roadManagerRef = useRef(new RoadManager());
  const signalManagerRef = useRef(new SignalManager(trackManagerRef.current));
  const historyRef = useRef(new HistoryManager(50));
  const pendingLoadRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const statusTimerRef = useRef(null);
  const selectedTool = TOOLS[selectedToolIndex];

  // Latest environment state for world capture (plain object, no deps churn).
  const envRef = useRef({});
  envRef.current = {
    timeOfDay, fogEnabled, fogDensity, shadowMode,
    tiltShiftEnabled, celShadingEnabled, ambientEnabled,
    soundsEnabled, trafficEnabled, signalsEnabled,
    frameLimit, vsync, stationOrientation, trainDirection,
  };

  // Preload all GLB models with real progress
  useEffect(() => {
    ModelLibrary.preloadAll(setLoadProgress)
      .then(() => setIsLoading(false))
      .catch((err) => {
        console.error('Model preload failed:', err);
        setIsLoading(false);
      });
  }, []);

  // Persist render pacing prefs
  useEffect(() => {
    saveSettings({ frameLimit, vsync });
  }, [frameLimit, vsync]);

  // Audio volumes → synth buses + persistence
  useEffect(() => {
    trainAudio.setVolumes(audioVolumes);
  }, [audioVolumes]);
  useEffect(() => {
    saveSettings({ audioVolumes });
  }, [audioVolumes]);

  // Track engine count so the coach tool can be gated on it
  useEffect(() => {
    const interval = setInterval(() => {
      const count = trainManagerRef.current.getAllTrains().length;
      setTrainCount(count);
      // Coach tool needs at least one engine in the world
      setSelectedToolIndex((idx) => {
        if (TOOLS[idx]?.type === 'coach' && count === 0) return 0;
        return idx;
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const setStatus = (msg) => {
    setWorldStatus(msg);
    clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setWorldStatus(''), 3000);
  };

  // ── World capture / save / load / recover ──────────────────────────────

  const makeWorldPayload = useCallback(() => ({
    terrainSize,
    terrainSeed,
    trackManager: trackManagerRef.current,
    stationManager: stationManagerRef.current,
    trainManager: trainManagerRef.current,
    roadManager: roadManagerRef.current,
    env: envRef.current,
    camera: cameraBus.getState(),
  }), [terrainSize, terrainSeed]);

  // Debounced quiet autosave after meaningful edits (never per-frame).
  const scheduleAutosave = useCallback(() => {
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveWorld(makeWorldPayload());
    }, 2500);
  }, [makeWorldPayload]);

  useEffect(() => {
    historyRef.current.onChange = scheduleAutosave;
    return () => {
      historyRef.current.onChange = null;
      clearTimeout(autosaveTimerRef.current);
    };
  }, [scheduleAutosave]);

  // Bump renderer version counters after undo/redo/load restores managers.
  const refreshWorld = useCallback(() => {
    setTracksVersion((v) => v + 1);
    setWorldVersion((v) => v + 1);
  }, []);

  const doUndo = useCallback(() => {
    if (historyRef.current.undo()) {
      refreshWorld();
      setStatus('↩ Undone');
    }
  }, [refreshWorld]);

  const doRedo = useCallback(() => {
    if (historyRef.current.redo()) {
      refreshWorld();
      setStatus('↪ Redone');
    }
  }, [refreshWorld]);

  const handleSaveWorld = async () => {
    const res = await saveWorldToFile(makeWorldPayload());
    if (res?.cancelled) return;
    setStatus(res?.ok ? `💾 World saved (${res.name})` : '⚠ Save failed');
  };

  // Apply a saved snapshot: env immediately, world content once the terrain
  // for its seed/size is generated.
  const applySavedData = (data) => {
    if (!data) {
      setStatus('⚠ Nothing to load');
      return;
    }
    const t = data.terrain || {};
    const env = data.env || {};
    const sameTerrain =
      (t.length ?? terrainSize.length) === terrainSize.length &&
      (t.breadth ?? terrainSize.breadth) === terrainSize.breadth &&
      (t.seed ?? terrainSeed) === terrainSeed;

    pendingLoadRef.current = data;
    if (t.length) setTerrainSize({ length: t.length, breadth: t.breadth });
    if (t.seed !== undefined) setTerrainSeed(t.seed);
    if (env.timeOfDay) setTimeOfDay(env.timeOfDay);
    if (env.fogEnabled !== undefined) setFogEnabled(env.fogEnabled);
    if (env.fogDensity !== undefined) setFogDensity(env.fogDensity);
    if (env.shadowMode) setShadowMode(env.shadowMode);
    if (env.tiltShiftEnabled !== undefined) setTiltShiftEnabled(env.tiltShiftEnabled);
    if (env.celShadingEnabled !== undefined) setCelShadingEnabled(env.celShadingEnabled);
    if (env.ambientEnabled !== undefined) setAmbientEnabled(env.ambientEnabled);
    if (env.soundsEnabled !== undefined) setSoundsEnabled(env.soundsEnabled);
    if (env.trafficEnabled !== undefined) setTrafficEnabled(env.trafficEnabled);
    if (env.signalsEnabled !== undefined) setSignalsEnabled(env.signalsEnabled);
    if (env.frameLimit !== undefined) setFrameLimit(env.frameLimit);
    if (env.vsync !== undefined) setVsync(env.vsync);
    if (env.stationOrientation) setStationOrientation(env.stationOrientation);
    if (env.trainDirection) setTrainDirection(env.trainDirection);

    setFollowTrainId(null);
    setSelection(null);

    if (sameTerrain) {
      // Terrain won't regenerate — apply world content right away.
      pendingLoadRef.current = null;
      const ok = applyWorld(data, {
        trackManager: trackManagerRef.current,
        stationManager: stationManagerRef.current,
        trainManager: trainManagerRef.current,
        roadManager: roadManagerRef.current,
      });
      if (ok) {
        refreshWorld();
        if (data.camera) {
          cameraBus.emit({ type: 'focus', target: data.camera.position, distance: 6 });
        }
        setStatus('📂 World loaded');
      } else {
        setStatus('⚠ Load failed');
      }
    }
    // else: applied in handleTerrainReady once the terrain is generated.
  };

  const handleLoadWorld = async () => {
    const res = await loadWorldFromFile();
    if (res?.cancelled) return;
    if (res?.error) {
      setStatus(`⚠ ${res.error}`);
      return;
    }
    applySavedData(res.data);
    setStatus(`📂 Loaded ${res.name}`);
  };
  const handleRecoverWorld = () => {
    const data = loadRecoverySnapshot();
    if (!data) {
      setStatus('⚠ No recovery snapshot found');
      return;
    }
    applySavedData(data);
    setStatus('🛟 Recovered autosave');
  };

  // Called by the scene once terrain generation finishes — applies any
  // pending world load with the fresh terrainData (roads rebuild over it).
  const handleTerrainReady = useCallback((terrainData) => {
    const data = pendingLoadRef.current;
    if (!data) return;
    pendingLoadRef.current = null;
    const ok = applyWorld(data, {
      trackManager: trackManagerRef.current,
      stationManager: stationManagerRef.current,
      trainManager: trainManagerRef.current,
      roadManager: roadManagerRef.current,
    });
    if (ok) {
      refreshWorld();
      if (data.camera) {
        cameraBus.emit({ type: 'focus', target: data.camera.position, distance: 6 });
      }
      setStatus('📂 World loaded');
    } else {
      setStatus('⚠ Load failed');
    }
  }, [refreshWorld]);

  // ── Terrain regeneration safety ────────────────────────────────────────

  // Snapshot the current world BEFORE any destructive regeneration/clear,
  // so the previous world is always recoverable.
  const snapshotBeforeDestructive = () => {
    try {
      saveSnapshot(makeWorldPayload());
    } catch {
      // Storage unavailable — regeneration proceeds without a snapshot.
    }
  };

  const clearWorld = () => {
    // Clear tracks, trains AND stations when terrain changes
    trackManagerRef.current.clear();
    trainManagerRef.current.clear();
    stationManagerRef.current.clear();
    historyRef.current.clear();
    setFollowTrainId(null);
    setSelection(null);
    setTracksVersion(v => v + 1); // Trigger re-render
  };

  const handleTerrainSizeChange = (newSize) => {
    snapshotBeforeDestructive();
    setIsGenerating(true);
    setTerrainSize(newSize);
    clearWorld();
    // Simulate generation delay for UI feedback
    setTimeout(() => setIsGenerating(false), 500);
  };

  const handleSeedChange = (newSeed) => {
    if (newSeed === terrainSeed) return;
    snapshotBeforeDestructive();
    setIsGenerating(true);
    clearWorld();
    setTerrainSeed(newSeed);
    // Simulate generation delay for UI feedback
    setTimeout(() => setIsGenerating(false), 500);
  };

  const handleToolSelect = (index) => {
    setSelectedToolIndex(index);
    // Stations start fresh in horizontal orientation every time.
    if (TOOLS[index]?.type === 'station') {
      setStationOrientation('horizontal');
    }
    // Non-forced framing assist: pull the camera closer to a comfortable
    // construction distance when it is far away (never disorienting).
    if (TOOLS[index]?.type && TOOLS[index].type !== 'hand') {
      cameraBus.emit({ type: 'ease', maxDistance: 22 });
    }
  };

  const handleRotate = () => {
    if (selectedTool?.type === 'train') {
      // Toggle train direction
      setTrainDirection(d => d === 1 ? -1 : 1);
    } else if (selectedTool?.type === 'station') {
      // Stations: flip between horizontal and vertical only
      setStationOrientation(o => (o === 'horizontal' ? 'vertical' : 'horizontal'));
    } else {
      setRotation((prev) => (prev + 90) % 360);
    }
  };

  const handleHeightChange = (delta) => {
    setHeightOffset((prev) => Math.max(-2, Math.min(5, prev + delta)));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        if (e.key.toLowerCase() === 'z' && e.shiftKey) doRedo();
        else if (e.key.toLowerCase() === 'z') doUndo();
        else doRedo();
        return;
      }
      // Q/E for height adjustment
      if (e.key.toLowerCase() === 'q') {
        handleHeightChange(-0.5);
      } else if (e.key.toLowerCase() === 'e') {
        handleHeightChange(0.5);
      }
      // X to reset height
      else if (e.key.toLowerCase() === 'x') {
        setHeightOffset(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doUndo, doRedo]);

  if (isLoading) {
    return <LoadingScreen progress={loadProgress} />;
  }

  return (
    <div className="w-full h-screen bg-gray-900 overflow-hidden">
      {/* 3D Game Scene */}
      <GameScene 
        terrainSize={terrainSize} 
        terrainSeed={terrainSeed}
        showDebug={showDebug}
        trackManager={trackManagerRef.current}
        stationManager={stationManagerRef.current}
        trainManager={trainManagerRef.current}
        selectedTool={selectedTool}
        rotation={rotation * (Math.PI / 180)}
        heightOffset={heightOffset}
        tracksVersion={tracksVersion}
        timeOfDay={timeOfDay}
        fogEnabled={fogEnabled}
        fogDensity={fogDensity}
        shadowMode={shadowMode}
        tiltShiftEnabled={tiltShiftEnabled}
        celShadingEnabled={celShadingEnabled}
        trainDirection={trainDirection}
        frameLimit={frameLimit}
        vsync={vsync}
        ambientEnabled={ambientEnabled}
        soundsEnabled={soundsEnabled}
        trafficEnabled={trafficEnabled}
        signalsEnabled={signalsEnabled}
        followTrainId={followTrainId}
        stationOrientation={stationOrientation}
        history={historyRef.current}
        onSelect={setSelection}
        onTerrainReady={handleTerrainReady}
        worldVersion={worldVersion}
        selectedTrainId={selection?.kind === 'train' ? selection.id : null}
        roadManager={roadManagerRef.current}
        signalManager={signalManagerRef.current}
      />
      
      {/* Control Panel */}
      <ControlPanel
        onTerrainSizeChange={handleTerrainSizeChange}
        terrainSeed={terrainSeed}
        onSeedChange={handleSeedChange}
        onToggleDebug={setShowDebug}
        showDebug={showDebug}
        isGenerating={isGenerating}
        trainManager={trainManagerRef.current}
        timeOfDay={timeOfDay}
        onTimeChange={setTimeOfDay}
        fogEnabled={fogEnabled}
        onFogEnabledChange={setFogEnabled}
        fogDensity={fogDensity}
        onFogDensityChange={setFogDensity}
        shadowMode={shadowMode}
        onShadowModeChange={setShadowMode}
        tiltShiftEnabled={tiltShiftEnabled}
        onTiltShiftChange={setTiltShiftEnabled}
        celShadingEnabled={celShadingEnabled}
        onCelShadingChange={setCelShadingEnabled}
        frameLimit={frameLimit}
        onFrameLimitChange={setFrameLimit}
        vsync={vsync}
        onVsyncChange={setVsync}
        ambientEnabled={ambientEnabled}
        onAmbientChange={setAmbientEnabled}
        soundsEnabled={soundsEnabled}
        onSoundsChange={setSoundsEnabled}
        trafficEnabled={trafficEnabled}
        onTrafficChange={setTrafficEnabled}
        signalsEnabled={signalsEnabled}
        onSignalsChange={setSignalsEnabled}
        followTrainId={followTrainId}
        onFollowTrain={setFollowTrainId}
        audioVolumes={audioVolumes}
        onAudioVolumeChange={(patch) => setAudioVolumes((v) => ({ ...v, ...patch }))}
        history={historyRef.current}
        terrainSize={terrainSize}
        onSaveWorld={handleSaveWorld}
        onLoadWorld={handleLoadWorld}
        onRecoverWorld={handleRecoverWorld}
        onUndo={doUndo}
        onRedo={doRedo}
        worldStatus={worldStatus}
      />
      
      {/* Hotbar */}
      <Hotbar
        tools={TOOLS}
        selectedIndex={selectedToolIndex}
        onSelect={handleToolSelect}
        onRotate={handleRotate}
        disabledToolIds={trainCount === 0 ? ['coach'] : []}
      />
      
      {/* Selection panel (hand tool) */}
      <SelectionPanel
        selection={selection}
        trackManager={trackManagerRef.current}
        stationManager={stationManagerRef.current}
        trainManager={trainManagerRef.current}
        roadManager={roadManagerRef.current}
        signalManager={signalManagerRef.current}
        history={historyRef.current}
        followTrainId={followTrainId}
        onFollowTrain={setFollowTrainId}
        onSelect={setSelection}
        onRefreshWorld={refreshWorld}
      />
      
      {/* Height Control Indicator - Moved to bottom-left */}
      {heightOffset !== 0 && (
        <div className="absolute bottom-24 left-4 bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg font-mono text-sm z-30">
          <div className="font-bold text-blue-400 mb-1">Bridge Mode</div>
          <div>Height: {heightOffset.toFixed(1)}</div>
          <div className="text-xs text-gray-400 mt-1">
            Q/E: Adjust • X: Reset
          </div>
        </div>
      )}
      
      {/* Title Overlay */}
      <div className="absolute bottom-4 left-4 z-30">
        <h1 className="text-white text-3xl font-bold drop-shadow-lg">
          🚂 MyTrainWorld
        </h1>
        <p className="text-gray-300 text-sm mt-1 drop-shadow">
          Build your railway empire
        </p>
      </div>
    </div>
  );
}

export default App;

