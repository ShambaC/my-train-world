import { useState, useRef, useEffect } from "react";
import GameScene from "./GameScene";
import ControlPanel from "./ControlPanel";
import LoadingScreen from "./LoadingScreen";
import Hotbar from "./ui/Hotbar";
import { TrackManager } from "./tracks/TrackManager";
import { TrainManager } from "./trains/TrainManager";

// Define available tools
const TOOLS = [
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
    id: 'delete', 
    name: 'Delete Tool', 
    label: 'Delete',
    icon: '🗑️', 
    type: 'delete'
  },
];

function App() {
  const [terrainSize, setTerrainSize] = useState({ length: 50, breadth: 50 });
  const [showDebug, setShowDebug] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedToolIndex, setSelectedToolIndex] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [heightOffset, setHeightOffset] = useState(0);
  const [timeOfDay, setTimeOfDay] = useState('day');
  const [fogEnabled, setFogEnabled] = useState(true);
  const [fogDensity, setFogDensity] = useState(0.012); // Default medium density
  const [tracksVersion, setTracksVersion] = useState(0); // Force re-render of tracks
  
  const trackManagerRef = useRef(new TrackManager());
  const trainManagerRef = useRef(new TrainManager(trackManagerRef.current));
  const selectedTool = TOOLS[selectedToolIndex];

  const handleTerrainSizeChange = (newSize) => {
    setIsGenerating(true);
    setTerrainSize(newSize);
    // Clear tracks AND trains when terrain changes
    trackManagerRef.current.clear();
    trainManagerRef.current.clear();
    setTracksVersion(v => v + 1); // Trigger re-render
    // Simulate generation delay for UI feedback
    setTimeout(() => setIsGenerating(false), 500);
  };

  const handleToolSelect = (index) => {
    setSelectedToolIndex(index);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
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
    return <LoadingScreen onLoadingComplete={() => setIsLoading(false)} />;
  }

  return (
    <div className="w-full h-screen bg-gray-900 overflow-hidden">
      {/* 3D Game Scene */}
      <GameScene 
        terrainSize={terrainSize} 
        showDebug={showDebug}
        trackManager={trackManagerRef.current}
        trainManager={trainManagerRef.current}
        selectedTool={selectedTool}
        rotation={rotation * (Math.PI / 180)} // Convert to radians
        heightOffset={heightOffset}
        tracksVersion={tracksVersion}
        timeOfDay={timeOfDay}
        fogEnabled={fogEnabled}
        fogDensity={fogDensity}
      />
      
      {/* Control Panel */}
      <ControlPanel
        onTerrainSizeChange={handleTerrainSizeChange}
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
      />
      
      {/* Hotbar */}
      <Hotbar
        tools={TOOLS}
        selectedIndex={selectedToolIndex}
        onSelect={handleToolSelect}
        onRotate={handleRotate}
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
