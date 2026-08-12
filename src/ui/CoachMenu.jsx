import { useState } from 'react';
import { COACH_TYPES } from '../trains/coachTypes';
import passengerImg from '../assets/Images/passenger-coach.png';
import freightImg from '../assets/Images/freight-van.png';
import mailImg from '../assets/Images/mail-coach.png';
import coalImg from '../assets/Images/open-coal-wagon.png';
import containerImg from '../assets/Images/container-flat-wagon.png';
import coalCartImg from '../assets/ModelImages/coal_coach_sheet.png';
import gasImg from '../assets/ModelImages/gas_coach_sheet.png';
import goodsImg from '../assets/ModelImages/goods_coach_sheet.png';

const COACH_IMAGES = {
  'passenger-coach': passengerImg,
  'freight-van': goodsImg,
  'mail-coach': mailImg,
  'open-coal-wagon': coalImg,
  'container-flat-wagon': containerImg,
  'coal-cart': coalCartImg,
  'gas-coach': gasImg,
  'goods-coach': goodsImg,
};

const MENU_ITEMS = COACH_TYPES.map((t) => ({ ...t, img: COACH_IMAGES[t.key] }));

/**
 * Radial coach picker — thumbnails arranged in a circle around the cursor.
 * Click an item to attach that coach behind the engine; hover shows the
 * coach name radially outward from the hub.
 */
export default function CoachMenu({ x, y, onSelect, onClose }) {
  const [hoverKey, setHoverKey] = useState(null);
  const n = MENU_ITEMS.length;
  const hub = 34; // hub center offset from the anchor point
  const radius = 92;
  const labelRadius = radius + 44;

  return (
    <div className="fixed z-50" style={{ left: x, top: y }}>
      {/* Click-away backdrop (covers the whole viewport; items render above) */}
      <div className="fixed inset-0" onClick={onClose} />
      <div className="absolute" style={{ left: -hub, top: -hub }}>
        {/* Hub */}
        <div className="w-[68px] h-[68px] rounded-full bg-gray-800 border-2 border-blue-500 flex flex-col items-center justify-center shadow-2xl">
          <span className="text-lg">🚃</span>
          <span className="text-[9px] text-gray-300">Coach</span>
        </div>

        {/* Radial items + hover labels */}
        {MENU_ITEMS.map((item, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const lx = hub + Math.cos(angle) * radius;
          const ly = hub + Math.sin(angle) * radius;
          const hovered = hoverKey === item.key;
          return (
            <div key={item.key} className="absolute" style={{ left: lx, top: ly }}>
              {/* Hover label — radially outward from the hub */}
              {hovered && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap px-2 py-0.5 rounded bg-gray-900 border border-blue-500 text-xs text-white shadow-lg pointer-events-none"
                  style={{
                    left: Math.cos(angle) * labelRadius,
                    top: Math.sin(angle) * labelRadius,
                  }}
                >
                  {item.label}
                </div>
              )}
              <button
                onClick={() => onSelect(item.key)}
                onMouseEnter={() => setHoverKey(item.key)}
                onMouseLeave={() => setHoverKey(null)}
                className="w-[76px] h-[76px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-800 border-2 border-gray-600 hover:border-blue-500 hover:scale-110 transition-all shadow-xl overflow-hidden"
                title={item.label}
              >
                <img
                  src={item.img}
                  alt={item.label}
                  className="w-full h-full object-cover"
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
