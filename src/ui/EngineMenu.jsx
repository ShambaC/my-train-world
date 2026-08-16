import { useState } from 'react';
import { ENGINE_TYPES } from '../trains/engineTypes';
import steamImg from '../assets/Images/steam_engine.png';
import dieselImg from '../assets/Images/diesel_engine.png';
import electricImg from '../assets/Images/electric_engine.png';
import checkerImg from '../assets/Images/checker_engine.png';

const ENGINE_IMAGES = {
  'steam-engine': steamImg,
  'diesel-engine': dieselImg,
  'electric-engine': electricImg,
  'checker-engine': checkerImg,
};

const MENU_ITEMS = ENGINE_TYPES.map((t) => ({ ...t, img: ENGINE_IMAGES[t.key] }));

/**
 * Radial engine picker — thumbnails arranged in a circle around the cursor.
 * Opened when placing an engine on tracks, or clicking an engine with the Train tool.
 */
export default function EngineMenu({ x, y, currentEngine = 'steam-engine', onSelect, onClose }) {
  const [hoverKey, setHoverKey] = useState(null);
  const n = MENU_ITEMS.length;
  const hub = 36;
  const radius = 95;
  const labelRadius = radius + 46;

  return (
    <div
      className="fixed z-50"
      style={{ left: x, top: y }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Click-away backdrop (covers viewport; radial buttons render above) */}
      <div
        className="fixed inset-0"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div className="absolute" style={{ left: -hub, top: -hub }}>
        {/* Center Hub */}
        <div className="w-[72px] h-[72px] rounded-full bg-gray-800 border-2 border-amber-500 flex flex-col items-center justify-center shadow-2xl pointer-events-none">
          <span className="text-lg">🚂</span>
          <span className="text-[9px] text-gray-300 font-semibold">Engine</span>
        </div>

        {/* Radial Engine Items */}
        {MENU_ITEMS.map((item, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const lx = hub + Math.cos(angle) * radius;
          const ly = hub + Math.sin(angle) * radius;
          const hovered = hoverKey === item.key;
          const isSelected = currentEngine === item.key;

          return (
            <div key={item.key} className="absolute" style={{ left: lx, top: ly }}>
              {/* Hover label outward from the hub */}
              {hovered && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap px-2.5 py-1 rounded bg-gray-900 border border-amber-500 text-xs font-medium text-white shadow-xl pointer-events-none z-10"
                  style={{
                    left: Math.cos(angle) * labelRadius,
                    top: Math.sin(angle) * labelRadius,
                  }}
                >
                  {item.label}
                </div>
              )}
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(item.key);
                }}
                onMouseEnter={() => setHoverKey(item.key)}
                onMouseLeave={() => setHoverKey(null)}
                className={`w-[78px] h-[78px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-800 border-2 transition-all shadow-xl overflow-hidden hover:scale-110 flex items-center justify-center ${
                  isSelected
                    ? 'border-amber-400 ring-2 ring-amber-400/40 scale-105'
                    : 'border-gray-600 hover:border-amber-400'
                }`}
                title={item.label}
              >
                <img
                  src={item.img}
                  alt={item.label}
                  className="w-full h-full object-cover pointer-events-none"
                  draggable={false}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
