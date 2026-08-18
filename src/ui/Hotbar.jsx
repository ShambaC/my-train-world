import { useEffect } from 'react';
import { TOOL_ICONS } from './iconRegistry';

const TOOL_KEYS = {
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4,
  '6': 5,
  '7': 6,
  '8': 7,
  '9': 8,
  'Escape': -1, // Deselect
};

/**
 * Hotbar component for track and tool selection
 */
export default function Hotbar({ tools, selectedIndex, onSelect, onRotate, disabledToolIds = [] }) {
  useEffect(() => {
    const handleKeyPress = (e) => {
      // Number keys for tool selection
      if (TOOL_KEYS[e.key] !== undefined) {
        const index = TOOL_KEYS[e.key];
        if (index === -1) {
          onSelect(0); // Select hand tool
        } else if (index < tools.length && !disabledToolIds.includes(tools[index].id)) {
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
  }, [tools.length, onSelect, onRotate, disabledToolIds]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-2 pb-2 sm:bottom-3 sm:px-4">
      <div className="w-full max-w-[780px] rounded-2xl border border-white/10 bg-[#101a2b]/90 p-2 shadow-2xl backdrop-blur-xl sm:p-2.5">
        <div className="flex items-center justify-between px-1 pb-1.5 sm:px-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#aebbd0]">
            Build tools
          </span>
          <span className="hidden text-[10px] text-[#aebbd0] sm:inline">
            R rotate · Esc select
          </span>
        </div>

        <div className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto pb-0.5 scrollbar-none sm:justify-center sm:overflow-visible">
          {tools.map((tool, index) => {
            const disabled = disabledToolIds.includes(tool.id);
            const icon = TOOL_ICONS[tool.iconKey || tool.id];
            return (
              <button
                key={tool.id}
                onClick={() => !disabled && onSelect(index)}
                disabled={disabled}
                aria-label={disabled ? `${tool.name}, unavailable until an engine exists` : tool.name}
                aria-pressed={selectedIndex === index}
                className={`
                  relative h-[4.35rem] w-[4.35rem] flex-none snap-start rounded-xl border transition-colors duration-150
                   flex flex-col items-center justify-center
                  touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63c9dc]
                  ${disabled
                    ? 'border-transparent bg-[#18263b] opacity-40 cursor-not-allowed'
                    : selectedIndex === index
                      ? 'border-[#e5a94f] bg-[#244b67] shadow-[0_0_0_2px_rgba(229,169,79,0.18)]'
                      : 'border-white/5 bg-[#18263b] hover:border-[#63c9dc]/60 hover:bg-[#22344b]'
                  }
                `}
                title={disabled ? `${tool.name} (needs an engine in the world)` : tool.name}
              >
                {/* Icon */}
                <img
                  src={icon}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="mb-1 h-7 w-7 object-contain pointer-events-none"
                />

                {/* Label */}
                <span className="text-[11px] font-semibold leading-none text-[#f7f0df]">
                  {tool.label}
                </span>

                {/* Hotkey indicator */}
                <span className="absolute right-1 top-1 rounded bg-[#101a2b] px-1 text-[10px] font-mono text-[#aebbd0]">
                  {index + 1}
                </span>

                {/* Selection indicator */}
                {selectedIndex === index && !disabled && (
                  <div className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[#e5a94f]">
                    <span className="sr-only">Selected</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Instructions */}
        <div className="mt-1.5 hidden text-center text-[10px] text-[#aebbd0] sm:block">
          Press <kbd className="bg-gray-900 px-1 rounded">1-9</kbd> to select •
          <kbd className="bg-gray-900 px-1 rounded ml-1">R</kbd> to rotate •
          <kbd className="bg-gray-900 px-1 rounded ml-1">Esc</kbd> deselect
        </div>
      </div>
    </div>
  );
}
