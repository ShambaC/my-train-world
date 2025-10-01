import { useState } from "react";
import GameScene from "./GameScene";
import ControlPanel from "./ControlPanel";
import LoadingScreen from "./LoadingScreen";

function App() {
  const [terrainSize, setTerrainSize] = useState({ length: 50, breadth: 50 });
  const [showDebug, setShowDebug] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleTerrainSizeChange = (newSize) => {
    setIsGenerating(true);
    setTerrainSize(newSize);
    // Simulate generation delay for UI feedback
    setTimeout(() => setIsGenerating(false), 500);
  };

  if (isLoading) {
    return <LoadingScreen onLoadingComplete={() => setIsLoading(false)} />;
  }

  return (
    <div className="w-full h-screen bg-gray-900 overflow-hidden">
      {/* 3D Game Scene */}
      <GameScene 
        terrainSize={terrainSize} 
        showDebug={showDebug}
      />
      
      {/* Control Panel */}
      <ControlPanel
        onTerrainSizeChange={handleTerrainSizeChange}
        onToggleDebug={setShowDebug}
        showDebug={showDebug}
        isGenerating={isGenerating}
      />
      
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
