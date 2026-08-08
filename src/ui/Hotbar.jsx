import { useEffect } from 'react';

const TOOL_KEYS = {
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  'Escape': -1, // Deselect
};

/**
 * Hotbar component for track and tool selection
 */
export default function Hotbar({ tools, selectedIndex, onSelect, onRotate }) {
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Number keys for tool selection
      if (TOOL_KEYS[e.key] !== undefined) {
        const index = TOOL_KEYS[e.key];
        if (index === -1) {
          onSelect(0); // Select hand tool
        } else if (index < tools.length) {
          onSelect(index);
        }
      }
      
      // R key for rotation
      if (e.key.toLowerCase() === 'r') {
        onRotate();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [tools.length, onSelect, onRotate]);

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-gray-800 bg-opacity-95 rounded-lg p-2 shadow-2xl border border-gray-700">
        <div className="flex gap-2">
          {tools.map((tool, index) => (
            <button
              key={index}
              onClick={() => onSelect(index)}
              className={`
                relative w-16 h-16 rounded-lg transition-all duration-200
                flex flex-col items-center justify-center
                ${selectedIndex === index 
                  ? 'bg-blue-600 shadow-lg scale-110' 
                  : 'bg-gray-700 hover:bg-gray-600'
                }
              `}
              title={tool.name}
            >
              {/* Icon */}
              <span className="text-2xl mb-1">{tool.icon}</span>
              
              {/* Label */}
              <span className="text-xs text-white font-medium">
                {tool.label}
              </span>
              
              {/* Hotkey indicator */}
              <span className="absolute top-1 right-1 text-xs text-gray-400 bg-gray-900 rounded px-1">
                {index + 1}
              </span>
              
              {/* Selection indicator */}
              {selectedIndex === index && (
                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                </div>
              )}
            </button>
          ))}
        </div>
        
        {/* Instructions */}
        <div className="mt-2 text-xs text-gray-400 text-center">
          Press <kbd className="bg-gray-900 px-1 rounded">1-6</kbd> to select • 
          <kbd className="bg-gray-900 px-1 rounded ml-1">R</kbd> to rotate •
          <kbd className="bg-gray-900 px-1 rounded ml-1">Esc</kbd> deselect
        </div>
      </div>
    </div>
  );
}
