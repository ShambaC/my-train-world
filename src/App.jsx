import { useState, useRef, useEffect } from "react";
import GameScene from "./GameScene";
import ControlPanel from "./ControlPanel";
import LoadingScreen from "./LoadingScreen";
import Hotbar from "./ui/Hotbar";
import { TrackManager } from "./tracks/TrackManager";
import { TrainManager } from "./trains/TrainManager";
import { StationManager } from "./stations/StationManager";
import ModelLibrary from "./models/ModelLibrary";
import { loadSettings, saveSettings } from "./utils/settings";

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
  
  const trackManagerRef = useRef(new TrackManager());
  const stationManagerRef = useRef(new StationManager());
  const trainManagerRef = useRef(new TrainManager(trackManagerRef.current, stationManagerRef.current));
  const selectedTool = TOOLS[selectedToolIndex];

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

  const clearWorld = () => {
    // Clear tracks, trains AND stations when terrain changes
    trackManagerRef.current.clear();
    trainManagerRef.current.clear();
    stationManagerRef.current.clear();
    setFollowTrainId(null);
    setTracksVersion(v => v + 1); // Trigger re-render
  };

  const handleTerrainSizeChange = (newSize) => {
    setIsGenerating(true);
    setTerrainSize(newSize);
    clearWorld();
    // Simulate generation delay for UI feedback
    setTimeout(() => setIsGenerating(false), 500);
  };

  const handleSeedChange = (newSeed) => {
    if (newSeed === terrainSeed) return;
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
  }, []);

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
        followTrainId={followTrainId}
        stationOrientation={stationOrientation}
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
        followTrainId={followTrainId}
        onFollowTrain={setFollowTrainId}
      />
      
      {/* Hotbar */}
      <Hotbar
        tools={TOOLS}
        selectedIndex={selectedToolIndex}
        onSelect={handleToolSelect}
        onRotate={handleRotate}
        disabledToolIds={trainCount === 0 ? ['coach'] : []}
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
