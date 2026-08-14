import { useState } from 'react';
import { STATION_ROLES, DEFAULT_ROLE } from '../stations/stationRoles';

/**
 * Radial station role picker — opens after placing a station.
 * Roles are pure presentation presets: they never block placement or
 * gameplay. Dismissing (click-away) keeps the permissive default.
 */
export default function StationRoleMenu({ x, y, onSelect, onClose }) {
  const [hoverKey, setHoverKey] = useState(null);
  const n = STATION_ROLES.length;
  const hub = 40;
  const radius = 100;
  const labelRadius = radius + 50;

  return (
    <div className="fixed z-50" style={{ left: x, top: y }}>
      {/* Click-away backdrop — defaults to village */}
      <div className="fixed inset-0" onClick={onClose} />
      <div className="absolute" style={{ left: -hub, top: -hub }}>
        {/* Hub */}
        <div className="w-[80px] h-[80px] rounded-full bg-gray-800 border-2 border-green-500 flex flex-col items-center justify-center shadow-2xl">
          <span className="text-lg">🚉</span>
          <span className="text-[9px] text-gray-300">Role</span>
          <span className="text-[8px] text-gray-500">(village = default)</span>
        </div>

        {STATION_ROLES.map((role, i) => {
          const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
          const lx = hub + Math.cos(angle) * radius;
          const ly = hub + Math.sin(angle) * radius;
          const hovered = hoverKey === role.key;
          return (
            <div key={role.key} className="absolute" style={{ left: lx, top: ly }}>
              {hovered && (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap px-2 py-0.5 rounded bg-gray-900 border border-green-500 text-xs text-white shadow-lg pointer-events-none"
                  style={{
                    left: Math.cos(angle) * labelRadius,
                    top: Math.sin(angle) * labelRadius,
                  }}
                >
                  {role.label}
                </div>
              )}
              <button
                onClick={() => onSelect(role.key)}
                onMouseEnter={() => setHoverKey(role.key)}
                onMouseLeave={() => setHoverKey(null)}
                className={`w-[68px] h-[68px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-xl overflow-hidden transition-all hover:scale-110 flex flex-col items-center justify-center ${
                  role.key === DEFAULT_ROLE
                    ? 'bg-gray-800 border-green-500 hover:border-green-300'
                    : 'bg-gray-800 border-gray-600 hover:border-green-500'
                }`}
                title={role.label}
              >
                <span className="text-2xl">{role.icon}</span>
                <span className="text-[9px] text-white mt-0.5">{role.label}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
