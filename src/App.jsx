import { useState, useRef, useEffect, useCallback } from "react";
import GameScene from "./GameScene";
import PauseMenu from "./ui/PauseMenu";
import LoadingScreen from "./LoadingScreen";
import MainMenu from "./ui/MainMenu";
import DeviceAccessGate from "./ui/DeviceAccessGate";
import Hotbar from "./ui/Hotbar";
import GameHud from "./ui/GameHud";
import HelpPanel from "./ui/HelpPanel";
import ToastRegion from "./ui/ToastRegion";
import SelectionPanel from "./ui/SelectionPanel";
import { TrackManager } from "./tracks/TrackManager";
import { TrainManager } from "./trains/TrainManager";
import { preloadTrainEngines } from "./trains/TrainModel";
import { StationManager } from "./stations/StationManager";
import ModelLibrary from "./models/ModelLibrary";
import { loadSettings, saveSettings } from "./utils/settings";
import { HistoryManager } from "./utils/history";
import { cameraBus } from "./utils/cameraBus";
import { trainAudio } from "./audio/trainAudio";
import { RoadManager } from "./environment/roadNetwork";
import { SignalManager } from "./signals/SignalManager";
import { ATLAS_TEXTURE_COUNT, preloadAtlases } from "./utils/atlasTextures";
import { GRASS_TEXTURE_COUNT, preloadGrassTextures } from "./environment/GrassField";
import { SKYBOX_COUNT, preloadSkyboxes } from "./environment/Skybox";
import { MODEL_DEFS } from "./models/ModelLibrary";
import {
  saveWorldToFile,
  loadWorldFromFile,
  loadRecoverySnapshot,
  autosaveWorld,
  saveSnapshot,
  applyWorld,
  captureWorld,
  createWorldRecord,
  getLastWorldId,
  getStorageStatus,
  getWorld,
  importWorldRecord,
  listWorlds,
  renameWorld,
  duplicateWorld,
  deleteWorld,
  exportWorldRecord,
  saveWorldRecord,
  hasRecoverySnapshot,
} from "./utils/worldSave";

// Define available tools
const TOOLS = [
  { 
    id: 'hand', 
    name: 'Hand / Deselect', 
    label: 'Hand',
    iconKey: 'hand',
    type: 'hand'
  },
  { 
    id: 'straight', 
    name: 'Straight Track', 
    label: 'Straight',
    iconKey: 'straight',
    type: 'track',
    trackType: 'straight'
  },
  { 
    id: 'curved', 
    name: 'Curved Track', 
    label: 'Curved',
    iconKey: 'curved',
    type: 'track',
    trackType: 'curved'
  },
  { 
    id: 'ramp', 
    name: 'Ramp Track (45°)', 
    label: 'Ramp',
    iconKey: 'ramp',
    type: 'track',
    trackType: 'ramp'
  },
  { 
    id: 'road', 
    name: 'Place Road', 
    label: 'Road',
    iconKey: 'road',
    type: 'road'
  },
  { 
    id: 'train', 
    name: 'Place Train', 
    label: 'Train',
    iconKey: 'train',
    type: 'train'
  },
  { 
    id: 'station', 
    name: 'Place Station', 
    label: 'Station',
    iconKey: 'station',
    type: 'station'
  },
  { 
    id: 'coach', 
    name: 'Add Coach', 
    label: 'Coach',
    iconKey: 'coach',
    type: 'coach'
  },
  { 
    id: 'delete', 
    name: 'Delete Tool', 
    label: 'Delete',
    iconKey: 'delete',
    type: 'delete'
  },
];

function loadGlobalGraphicsDefaults() {
  const settings = loadSettings();
  const defaults = settings.globalGraphics || {};
  return {
    timeOfDay: defaults.timeOfDay ?? 'day',
    fogEnabled: defaults.fogEnabled ?? true,
    fogDensity: defaults.fogDensity ?? null,
    shadowMode: defaults.shadowMode ?? 'soft',
    tiltShiftEnabled: defaults.tiltShiftEnabled ?? false,
    celShadingEnabled: defaults.celShadingEnabled ?? false,
    ambientEnabled: defaults.ambientEnabled ?? true,
    soundsEnabled: defaults.soundsEnabled ?? true,
    trafficEnabled: defaults.trafficEnabled ?? true,
    signalsEnabled: defaults.signalsEnabled ?? true,
  };
}

function AppRuntime() {
  const [terrainSize, setTerrainSize] = useState({ length: 100, breadth: 100 });
  const [terrainSeed, setTerrainSeed] = useState(1337);
  const [showDebug, setShowDebug] = useState(() => loadSettings().developerDiagnostics ?? false);
  const [showAxes, setShowAxes] = useState(() => loadSettings().showAxes ?? false);
  const [showTechnicalInfo, setShowTechnicalInfo] = useState(() => loadSettings().showTechnicalInfo ?? false);
  const [debugOverlayVisible, setDebugOverlayVisible] = useState(() => loadSettings().developerDiagnostics ?? false);
  const [debugDetail, setDebugDetail] = useState(() => loadSettings().debugDetail ?? 'compact');
  const [debugPosition, setDebugPosition] = useState(() => loadSettings().debugPosition ?? 'top-left');
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
  const [sceneReady, setSceneReady] = useState(false);
  const [trainCount, setTrainCount] = useState(0);
  const [appView, setAppView] = useState('menu');
  const [worlds, setWorlds] = useState(() => listWorlds());
  const [lastWorldId, setLastWorldIdState] = useState(() => getLastWorldId());
  const [currentWorldId, setCurrentWorldId] = useState(null);
  const [currentWorldName, setCurrentWorldName] = useState('');
  const [storageStatus, setStorageStatus] = useState(() => getStorageStatus());
  const [isPaused, setIsPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [trainControlsOpen, setTrainControlsOpen] = useState(false);

  // QoL state: selection, history, world refresh counter, status, audio.
  const [selection, setSelection] = useState(null);
  const [worldVersion, setWorldVersion] = useState(0);
  const [worldStatus, setWorldStatus] = useState('');
  const canvasRef = useRef(null);
  const [audioVolumes, setAudioVolumes] = useState(() => {
    const v = loadSettings().audioVolumes;
    return {
      master: v?.master ?? 1,
      train: v?.train ?? 1,
      ambient: v?.ambient ?? 1,
      music: v?.music ?? 0.6,
    };
  });
  const [globalGraphics, setGlobalGraphics] = useState(loadGlobalGraphicsDefaults);
  const [accessibility, setAccessibility] = useState(() => {
    const value = loadSettings().accessibility || {};
    return {
      uiScale: value.uiScale ?? 1,
      highContrast: value.highContrast ?? false,
      reducedMotion: value.reducedMotion ?? false,
      textSize: value.textSize ?? 'normal',
    };
  });

  const trackManagerRef = useRef(new TrackManager());
  const stationManagerRef = useRef(new StationManager());
  const trainManagerRef = useRef(new TrainManager(trackManagerRef.current, stationManagerRef.current));
  const roadManagerRef = useRef(new RoadManager());
  const signalManagerRef = useRef(new SignalManager(trackManagerRef.current));
  const historyRef = useRef(new HistoryManager(50));
  const pendingLoadRef = useRef(null);
  const pendingNewWorldRef = useRef(null);
  const currentWorldIdRef = useRef(null);
  const currentWorldNameRef = useRef('');
  const autosaveTimerRef = useRef(null);
  const statusTimerRef = useRef(null);
  const selectedTool = TOOLS[selectedToolIndex];

  currentWorldIdRef.current = currentWorldId;
  currentWorldNameRef.current = currentWorldName;

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
    const counts = {
      models: MODEL_DEFS.length,
      atlases: ATLAS_TEXTURE_COUNT,
      grass: GRASS_TEXTURE_COUNT,
      skyboxes: SKYBOX_COUNT,
    };
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const loaded = { models: 0, atlases: 0, grass: 0, skyboxes: 0 };
    const updateProgress = (name, fraction) => {
      loaded[name] = Math.round(fraction * counts[name]);
      const complete = Object.values(loaded).reduce((sum, count) => sum + count, 0);
      setLoadProgress((complete / total) * 0.8);
    };

    Promise.all([
      preloadAtlases((progress) => updateProgress('atlases', progress)),
      ModelLibrary.preloadAll((progress) => updateProgress('models', progress)),
      preloadGrassTextures((progress) => updateProgress('grass', progress)),
      preloadSkyboxes((progress) => updateProgress('skyboxes', progress)),
    ])
      .then(() => {
        preloadTrainEngines();
        setLoadProgress(0.8);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Asset preload failed:', err);
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
  useEffect(() => {
    saveSettings({ globalGraphics });
  }, [globalGraphics]);
  useEffect(() => {
    saveSettings({ developerDiagnostics: showDebug, debugDetail, debugPosition, showTechnicalInfo });
  }, [debugDetail, debugPosition, showDebug, showTechnicalInfo]);
  useEffect(() => {
    saveSettings({ showAxes });
  }, [showAxes]);
  useEffect(() => {
    saveSettings({ accessibility });
    document.documentElement.dataset.highContrast = accessibility.highContrast ? 'true' : 'false';
    document.documentElement.dataset.reducedMotion = accessibility.reducedMotion ? 'true' : 'false';
    document.documentElement.style.setProperty('--mtw-ui-scale', String(accessibility.uiScale));
    document.documentElement.style.setProperty('--mtw-text-scale', accessibility.textSize === 'large' ? '1.12' : '1');
  }, [accessibility]);

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

  const refreshLibrary = useCallback(() => {
    setWorlds(listWorlds());
    setLastWorldIdState(getLastWorldId());
    setStorageStatus(getStorageStatus());
  }, []);

  const handleRenameWorld = (id, name) => {
    const result = renameWorld(id, name);
    if (result.ok) {
      if (currentWorldIdRef.current === id) setCurrentWorldName(result.world.meta.name);
      refreshLibrary();
    }
  };

  const handleDeleteWorld = (id) => {
    const result = deleteWorld(id);
    if (result.ok) {
      if (currentWorldIdRef.current === id) {
        setCurrentWorldId(null);
        setCurrentWorldName('');
      }
      refreshLibrary();
    }
  };

  const handleDuplicateWorld = (id) => {
    const result = duplicateWorld(id);
    if (result.ok) refreshLibrary();
  };

  const handleExportWorld = (id) => {
    const result = exportWorldRecord(id);
    if (!result.ok) return;
    try {
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      setWorldStatus('Export failed');
    }
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
      const payload = makeWorldPayload();
      autosaveWorld(payload);
      const id = currentWorldIdRef.current;
      if (id) {
        saveWorldRecord(id, payload, { name: currentWorldNameRef.current });
        refreshLibrary();
      }
    }, 2500);
  }, [makeWorldPayload, refreshLibrary]);

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
      trainAudio.undo();
      refreshWorld();
      setStatus('Undone');
    }
  }, [refreshWorld]);

  const doRedo = useCallback(() => {
    if (historyRef.current.redo()) {
      trainAudio.redo();
      refreshWorld();
      setStatus('Redone');
    }
  }, [refreshWorld]);

  const handleSaveWorld = async () => {
    const id = currentWorldIdRef.current;
    if (id) {
      const saved = saveWorldRecord(id, makeWorldPayload(), { name: currentWorldNameRef.current });
      if (!saved.ok) setStatus('Local save unavailable');
      else refreshLibrary();
    }
    const res = await saveWorldToFile(makeWorldPayload());
    if (res?.cancelled) return;
    setStatus(res?.ok ? `World exported (${res.name})` : 'Export failed');
  };

  // Apply a saved snapshot: env immediately, world content once the terrain
  // for its seed/size is generated.
  const applySavedData = (data, { defer = false } = {}) => {
    if (!data) {
      setStatus('Nothing to load');
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

    if (sameTerrain && !defer) {
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
        if (data.camera) cameraBus.emit({ type: 'restore', ...data.camera });
        setStatus('World loaded');
      } else {
        setStatus('Load failed');
      }
    }
    // else: applied in handleTerrainReady once the terrain is generated.
  };

  const openWorld = (id) => {
    const record = getWorld(id);
    if (!record) {
      setStatus('World could not be opened');
      refreshLibrary();
      return;
    }
    setCurrentWorldId(record.meta.id);
    setCurrentWorldName(record.meta.name);
    setAppView('gameplay');
    setSceneReady(false);
    applySavedData(record.snapshot, { defer: true });
    refreshLibrary();
  };

  const createNewWorld = ({ name, size, seed }) => {
    pendingLoadRef.current = null;
    pendingNewWorldRef.current = { name };
    currentWorldIdRef.current = null;
    setCurrentWorldId(null);
    setCurrentWorldName(name);
    clearWorld();
    setSceneReady(false);
    setTerrainSize(size);
    setTerrainSeed(seed);
    setTimeOfDay(globalGraphics.timeOfDay);
    setFogEnabled(globalGraphics.fogEnabled);
    setFogDensity(globalGraphics.fogDensity);
    setShadowMode(globalGraphics.shadowMode);
    setTiltShiftEnabled(globalGraphics.tiltShiftEnabled);
    setCelShadingEnabled(globalGraphics.celShadingEnabled);
    setAmbientEnabled(globalGraphics.ambientEnabled);
    setSoundsEnabled(globalGraphics.soundsEnabled);
    setTrafficEnabled(globalGraphics.trafficEnabled);
    setSignalsEnabled(globalGraphics.signalsEnabled);
    setAppView('gameplay');
  };

  const handleLoadWorld = async () => {
    const res = await loadWorldFromFile();
    if (res?.cancelled) return;
    if (res?.error) {
      setStatus(`Load error: ${res.error}`);
      return;
    }
    const imported = importWorldRecord(res.data, res.name);
    if (!imported.ok) {
      setStatus(`Import error: ${imported.error}`);
      return;
    }
    setCurrentWorldId(imported.world.meta.id);
    setCurrentWorldName(imported.world.meta.name);
    setAppView('gameplay');
    setSceneReady(false);
    applySavedData(imported.world.snapshot, { defer: true });
    refreshLibrary();
    setStatus(`Loaded ${imported.world.meta.name}`);
  };
  const handleRecoverWorld = () => {
    const data = loadRecoverySnapshot();
    if (!data) {
      setStatus('No recovery snapshot found');
      return;
    }
    applySavedData(data);
    setStatus('Recovered autosave');
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
      if (data.camera) cameraBus.emit({ type: 'restore', ...data.camera });
      setStatus('World loaded');
    } else {
      setStatus('Load failed');
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

  const handleToolSelect = (index) => {
    setSelectedToolIndex(index);
    // Stations start fresh in horizontal orientation every time.
    if (TOOLS[index]?.type === 'station') {
      setStationOrientation('horizontal');
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
      if (e.key === 'Escape') {
        if (appView !== 'gameplay' || !sceneReady) return;
        e.preventDefault();
        if (helpOpen) { setHelpOpen(false); setIsPaused(false); }
        else if (trainControlsOpen) setTrainControlsOpen(false);
        else if (settingsOpen) setSettingsOpen(false);
        else setIsPaused((value) => !value);
        return;
      }
      if (e.key === 'F9') {
        if (!showDebug || appView !== 'gameplay' || !sceneReady) return;
        e.preventDefault();
        setDebugOverlayVisible((value) => !value);
        return;
      }
      if (isPaused) return;
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
  }, [appView, doUndo, doRedo, helpOpen, isPaused, sceneReady, settingsOpen, showDebug, trainControlsOpen]);

  const copyDiagnostics = useCallback(async () => {
    const report = [
      'MyTrainWorld diagnostics',
      `World: ${currentWorldNameRef.current || 'none'}`,
      `Terrain: ${terrainSize.length} x ${terrainSize.breadth}, seed ${terrainSeed}`,
      `Tracks: ${trackManagerRef.current.getAllTracks().length}`,
      `Trains: ${trainManagerRef.current.getAllTrains().length}`,
      `Settings: ${debugDetail} diagnostics, ${debugPosition}`,
      `Viewport: ${window.innerWidth} x ${window.innerHeight} @ ${window.devicePixelRatio || 1}x`,
      `User agent: ${navigator.userAgent}`,
    ].join('\n');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(report);
      setStatus('Diagnostics copied');
    } catch {
      setStatus('Clipboard unavailable');
    }
  }, [debugDetail, debugPosition, terrainSeed, terrainSize]);

  const captureWorldThumbnail = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return null;
    try {
      const target = document.createElement('canvas');
      target.width = 320;
      target.height = 180;
      const context = target.getContext('2d', { willReadFrequently: true });
      context.drawImage(canvas, 0, 0, target.width, target.height);
      const pixels = context.getImageData(0, 0, target.width, target.height).data;
      let brightness = 0;
      for (let index = 0; index < pixels.length; index += 16) brightness += pixels[index] + pixels[index + 1] + pixels[index + 2];
      if (brightness / (pixels.length / 16) < 8) return null;
      return target.toDataURL('image/jpeg', 0.65);
    } catch {
      return null;
    }
  }, []);

  const saveCurrentWorldLocally = useCallback(() => {
    const id = currentWorldIdRef.current;
    if (!id) {
      setStatus('World is still loading');
      return false;
    }
    const thumbnail = captureWorldThumbnail();
    const saved = saveWorldRecord(id, makeWorldPayload(), { name: currentWorldNameRef.current, ...(thumbnail ? { thumbnail } : {}) });
    if (!saved.ok) {
      setStatus('Local save unavailable');
      return false;
    }
    refreshLibrary();
    setStatus('Saved locally');
    return true;
  }, [captureWorldThumbnail, makeWorldPayload, refreshLibrary]);

  const handleSceneProgress = useCallback((progress) => {
    setLoadProgress(0.8 + progress * 0.2);
  }, []);

  const handleSceneReady = useCallback(() => {
    setLoadProgress(1);
    setSceneReady(true);
    const pendingNewWorld = pendingNewWorldRef.current;
    if (pendingNewWorld && !currentWorldIdRef.current) {
      const result = createWorldRecord({
        name: pendingNewWorld.name,
        snapshot: captureWorld(makeWorldPayload()),
        thumbnail: captureWorldThumbnail(),
      });
      if (result.ok) {
        setCurrentWorldId(result.world.meta.id);
        setCurrentWorldName(result.world.meta.name);
        refreshLibrary();
      } else {
        setWorldStatus('Local save unavailable');
      }
      pendingNewWorldRef.current = null;
    }
  }, [captureWorldThumbnail, makeWorldPayload, refreshLibrary]);

  if (isLoading) {
    return <LoadingScreen progress={loadProgress} />;
  }

  if (appView === 'menu') {
    return (
      <MainMenu
        worlds={worlds}
        lastWorldId={lastWorldId}
        storageStatus={storageStatus}
        onOpenWorld={openWorld}
        onCreateWorld={createNewWorld}
        onImportWorld={handleLoadWorld}
        onRenameWorld={handleRenameWorld}
        onDuplicateWorld={handleDuplicateWorld}
        onExportWorld={handleExportWorld}
        onDeleteWorld={handleDeleteWorld}
        frameLimit={frameLimit}
        onFrameLimitChange={setFrameLimit}
        vsync={vsync}
        onVsyncChange={setVsync}
        audioVolumes={audioVolumes}
        onAudioVolumeChange={(patch) => setAudioVolumes((value) => ({ ...value, ...patch }))}
        globalGraphics={globalGraphics}
        onGlobalGraphicsChange={(patch) => setGlobalGraphics((value) => ({ ...value, ...patch }))}
        showDebug={showDebug}
        onToggleDebug={(value) => { setShowDebug(value); setDebugOverlayVisible(value); }}
        showAxes={showAxes}
        onToggleAxes={setShowAxes}
        debugDetail={debugDetail}
        onDebugDetailChange={setDebugDetail}
        debugPosition={debugPosition}
        onDebugPositionChange={setDebugPosition}
        onCopyDiagnostics={copyDiagnostics}
        showTechnicalInfo={showTechnicalInfo}
        onToggleTechnicalInfo={setShowTechnicalInfo}
        accessibility={accessibility}
        onAccessibilityChange={(patch) => setAccessibility((value) => ({ ...value, ...patch }))}
      />
    );
  }

  return (
    <div className="w-full h-screen bg-gray-900 overflow-hidden">
      {/* 3D Game Scene */}
      <GameScene 
        terrainSize={terrainSize} 
        terrainSeed={terrainSeed}
        showDebug={showDebug && debugOverlayVisible}
        debugDetail={debugDetail}
        debugPosition={debugPosition}
        showAxes={showAxes}
        paused={isPaused}
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
        onSceneProgress={handleSceneProgress}
        onSceneReady={handleSceneReady}
        worldVersion={worldVersion}
        selectedTrainId={selection?.kind === 'train' ? selection.id : null}
        roadManager={roadManagerRef.current}
        signalManager={signalManagerRef.current}
        onCanvasReady={(canvas) => { canvasRef.current = canvas; }}
      />
      
      <PauseMenu
        isPaused={isPaused}
        helpOpen={helpOpen}
        settingsOpen={settingsOpen}
        onResume={() => { setSettingsOpen(false); setIsPaused(false); }}
        onOpenSettings={() => setSettingsOpen(true)}
        onCloseSettings={() => setSettingsOpen(false)}
        onSave={saveCurrentWorldLocally}
        recoveryAvailable={hasRecoverySnapshot()}
        onRecover={handleRecoverWorld}
        onResetOverview={() => cameraBus.emit({ type: 'reset', terrainSize })}
        onFrameRailway={() => cameraBus.emit({ type: 'frame', terrainSize })}
        diagnosticsEnabled={showDebug}
        diagnosticsVisible={showDebug && debugOverlayVisible}
        onToggleDiagnostics={() => setDebugOverlayVisible((value) => !value)}
        trainControlsOpen={trainControlsOpen}
        onOpenTrainControls={() => setTrainControlsOpen(true)}
        onCloseTrainControls={() => setTrainControlsOpen(false)}
        trainManager={trainManagerRef.current}
        followTrainId={followTrainId}
        onFollowTrain={setFollowTrainId}
        history={historyRef.current}
        onExit={() => { saveCurrentWorldLocally(); setSettingsOpen(false); setIsPaused(false); setAppView('menu'); }}
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
        audioVolumes={audioVolumes}
        onAudioVolumeChange={(patch) => setAudioVolumes((v) => ({ ...v, ...patch }))}
        worldStatus={worldStatus}
      />

      <GameHud
        worldName={currentWorldName}
        worldStatus={worldStatus}
        sceneReady={sceneReady}
        selectedTool={selectedTool}
        rotation={rotation}
        heightOffset={heightOffset}
        onUndo={doUndo}
        onRedo={doRedo}
        onHelp={() => { setHelpOpen(true); setIsPaused(true); }}
        onPause={() => setIsPaused(true)}
        onTrainManagement={() => setTrainControlsOpen(true)}
      />
      {helpOpen && <HelpPanel onClose={() => { setHelpOpen(false); setIsPaused(false); }} />}
      <ToastRegion message={worldStatus} onDismiss={() => setWorldStatus('')} />
      
      {/* Hotbar */}
      <Hotbar
        tools={TOOLS}
        selectedIndex={selectedToolIndex}
        onSelect={handleToolSelect}
        onRotate={handleRotate}
        paused={isPaused}
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
        showTechnicalInfo={showTechnicalInfo}
      />
      
      {/* Height Control Indicator - Moved to bottom-left */}
      {heightOffset !== 0 && (
        <div className="absolute bottom-28 left-4 z-30 rounded-xl border border-[#e5a94f]/40 bg-[#101a2b]/85 px-4 py-2 font-mono text-sm text-white shadow-lg backdrop-blur-md sm:bottom-24">
          <div className="font-bold text-blue-400 mb-1">Bridge Mode</div>
          <div>Height: {heightOffset.toFixed(1)}</div>
          <div className="text-xs text-gray-400 mt-1">
            Q/E: Adjust • X: Reset
          </div>
        </div>
      )}
      
      {!sceneReady && <LoadingScreen progress={loadProgress} />}
    </div>
  );
}

function App() {
  return (
    <DeviceAccessGate>
      <AppRuntime />
    </DeviceAccessGate>
  );
}

export default App;

