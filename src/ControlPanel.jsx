import { useState } from 'react';

export default function ControlPanel({ 
  onTerrainSizeChange, 
  onToggleDebug, 
  showDebug,
  isGenerating 
}) {
  const [length, setLength] = useState(50);
  const [breadth, setBreadth] = useState(50);
  const [isPanelOpen, setIsPanelOpen] = useState(false); // Start closed

  const handleGenerate = () => {
    onTerrainSizeChange({ length: parseInt(length), breadth: parseInt(breadth) });
  };

  const handlePreset = (size) => {
    setLength(size);
    setBreadth(size);
    onTerrainSizeChange({ length: size, breadth: size });
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className="fixed top-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-lg shadow-lg transition-all"
        title={isPanelOpen ? "Close Menu" : "Open Menu"}
      >
        <svg 
          className="w-6 h-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          {isPanelOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Side Panel with sliding animation and transparency */}
      <div 
        className={`fixed top-0 right-0 h-full z-40 bg-gray-900 bg-opacity-90 backdrop-blur-sm text-white shadow-2xl w-80 max-h-screen overflow-y-auto transition-transform duration-300 ease-in-out ${
          isPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 pt-20">
          <h2 className="text-xl font-bold mb-4 text-blue-400">Train World Controls</h2>
          
          {/* Terrain Size Section */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-200">Terrain Size</h3>
            
            {/* Length Input */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Length (X-axis): {length}
              </label>
              <input
                type="range"
                min="20"
                max="200"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                disabled={isGenerating}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>20</span>
                <span>200</span>
              </div>
            </div>

            {/* Breadth Input */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Breadth (Z-axis): {breadth}
              </label>
              <input
                type="range"
                min="20"
                max="200"
                value={breadth}
                onChange={(e) => setBreadth(e.target.value)}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                disabled={isGenerating}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>20</span>
                <span>200</span>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`w-full py-2 px-4 rounded-lg font-medium transition-all ${
                isGenerating
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {isGenerating ? 'Generating...' : 'Generate Terrain'}
            </button>

            {/* Preset Sizes */}
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-2">Quick Presets:</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handlePreset(50)}
                  className="py-1 px-2 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-all"
                  disabled={isGenerating}
                >
                  Small
                </button>
                <button
                  onClick={() => handlePreset(100)}
                  className="py-1 px-2 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-all"
                  disabled={isGenerating}
                >
                  Medium
                </button>
                <button
                  onClick={() => handlePreset(150)}
                  className="py-1 px-2 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-all"
                  disabled={isGenerating}
                >
                  Large
                </button>
              </div>
            </div>
          </div>

          {/* Debug Toggle */}
          <div className="mb-4 pt-4 border-t border-gray-700">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm font-medium text-gray-300">Show Debug Info</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={showDebug}
                  onChange={(e) => onToggleDebug(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </div>
            </label>
          </div>

          {/* Track System Info */}
          <div className="pt-4 border-t border-gray-700">
            <h3 className="text-sm font-semibold mb-2 text-green-400">✅ Active Features</h3>
            <p className="text-xs text-gray-400 mb-2">Use the hotbar at the bottom to:</p>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>Select track types (1-2)</li>
              <li>Press R to rotate tracks</li>
              <li>Place trains on tracks (3)</li>
              <li>Use Q/E for elevated tracks</li>
              <li>Delete with tool (4)</li>
            </ul>
          </div>

          {/* Future Features */}
          <div className="pt-4 border-t border-gray-700">
            <h3 className="text-sm font-semibold mb-2 text-gray-400">Coming Soon</h3>
            <button
              disabled
              className="w-full py-2 px-4 rounded-lg font-medium bg-gray-700 text-gray-500 cursor-not-allowed mb-2"
            >
              🌅 Day/Night Cycle
            </button>
            <button
              disabled
              className="w-full py-2 px-4 rounded-lg font-medium bg-gray-700 text-gray-500 cursor-not-allowed"
            >
              🎨 Custom Skybox
            </button>
          </div>

          {/* Info */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-400 leading-relaxed">
              Use mouse to navigate: Left-click to rotate, right-click to pan, scroll to zoom.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
