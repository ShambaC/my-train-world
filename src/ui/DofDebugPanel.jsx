import React, { useState, useEffect } from 'react';
import { dofState, updateDof, subscribeDof } from '../postprocessing/dofState.js';

/**
 * Live interactive tuning panel for Miniature Tilt-Shift Bokeh
 */
export default function DofDebugPanel({ tiltShiftEnabled }) {
  const [state, setState] = useState({ ...dofState });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    return subscribeDof((newState) => setState({ ...newState }));
  }, []);

  if (!tiltShiftEnabled || !state.showTuner) return null;

  return (
    <aside aria-label="DoF Tuning Panel" className="pointer-events-auto fixed bottom-24 right-4 z-40 w-80 rounded-2xl border border-white/20 bg-[#0f172a]/95 p-4 text-white shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-[#e5a94f]">📸 Miniature Bokeh Tuner</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/80 hover:bg-white/20"
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-3 space-y-3.5 text-xs">
          {/* Vertical Focus Center */}
          <div>
            <div className="flex justify-between font-semibold">
              <span>Vertical Focus Center</span>
              <span className="font-mono text-[#e5a94f]">{state.tiltFocusY.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.90"
              step="0.01"
              value={state.tiltFocusY}
              onChange={(e) => updateDof({ tiltFocusY: parseFloat(e.target.value) })}
              className="mt-1 w-full accent-[#e5a94f]"
            />
            <p className="mt-0.5 text-[10px] text-white/50">
              Moves the sharp focal band up or down on screen (0.48 = midground tracks).
            </p>
          </div>

          {/* Focal Range / In-focus Window */}
          <div>
            <div className="flex justify-between font-semibold">
              <span>In-Focus Window Size</span>
              <span className="font-mono text-[#e5a94f]">{state.focalRange.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="4"
              max="35"
              step="0.5"
              value={state.focalRange}
              onChange={(e) => updateDof({ focalRange: parseFloat(e.target.value) })}
              className="mt-1 w-full accent-[#e5a94f]"
            />
            <p className="mt-0.5 text-[10px] text-white/50">
              Height of the sharp diorama band before top & bottom blur begins.
            </p>
          </div>

          {/* Max Bokeh Blur */}
          <div>
            <div className="flex justify-between font-semibold">
              <span>Max Bokeh Blur</span>
              <span className="font-mono text-[#e5a94f]">{state.maxBlur.toFixed(1)} px</span>
            </div>
            <input
              type="range"
              min="0"
              max="8"
              step="0.2"
              value={state.maxBlur}
              onChange={(e) => updateDof({ maxBlur: parseFloat(e.target.value) })}
              className="mt-1 w-full accent-[#e5a94f]"
            />
            <p className="mt-0.5 text-[10px] text-white/50">
              Strength of smooth Poisson bokeh blur on distant sky & foreground edge.
            </p>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-3 gap-1 pt-1">
            <button
              type="button"
              onClick={() => updateDof({ tiltFocusY: 0.48, focalRange: 14.0, maxBlur: 3.5 })}
              className="rounded-lg bg-white/10 py-1 font-semibold text-white/70 hover:bg-white/20 hover:text-white"
            >
              Default
            </button>
            <button
              type="button"
              onClick={() => updateDof({ tiltFocusY: 0.45, focalRange: 8.0, maxBlur: 5.5 })}
              className="rounded-lg bg-white/10 py-1 font-semibold text-white/70 hover:bg-white/20 hover:text-white"
            >
              Macro
            </button>
            <button
              type="button"
              onClick={() => updateDof({ tiltFocusY: 0.50, focalRange: 24.0, maxBlur: 2.0 })}
              className="rounded-lg bg-white/10 py-1 font-semibold text-white/70 hover:bg-white/20 hover:text-white"
            >
              Subtle
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
