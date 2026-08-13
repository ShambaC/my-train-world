import { useState } from 'react';

const FRAME_LIMIT_OPTIONS = [
  { value: 30, label: '30' },
  { value: 60, label: '60' },
  { value: 90, label: '90' },
  { value: 120, label: '120' },
  { value: 144, label: '144' },
  { value: 0, label: 'Uncapped' },
];

/**
 * Performance settings — frame limit + vsync preference. These control
 * render scheduling only (see render/RenderScheduler.jsx); changing them
 * never touches world, tracks or camera state.
 *
 * Defaults: 120 FPS limit (the optimization plan's desired target; on
 * monitors below 120 Hz the browser's vsync still caps the presentation)
 * and vsync on (browser-synchronized frames).
 */
function PerformanceSettings({ frameLimit, vsync, onFrameLimitChange, onVsyncChange }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-4">
      <button
        className="w-full flex justify-between items-center p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-bold">⚡ Performance</span>
        <span className="text-sm">{isOpen ? '▼' : '▶'}</span>
      </button>

      {isOpen && (
        <div className="mt-2 p-3 bg-gray-800 rounded space-y-4">
          {/* Frame Limit */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Frame Limit (FPS)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FRAME_LIMIT_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => onFrameLimitChange(option.value)}
                  className={`p-2 rounded text-sm font-medium transition-all ${
                    frameLimit === option.value
                      ? 'bg-blue-600 hover:bg-blue-500 ring-2 ring-blue-400'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Controls render pacing, not just the FPS counter. Simulation
              speed stays identical at every limit.
            </p>
          </div>

          {/* Vsync Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              💠 Vsync
            </label>
            <button
              onClick={() => onVsyncChange(!vsync)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                vsync ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  vsync ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {vsync
              ? 'On: frames synchronized to the display (browser/R3F RAF loop).'
              : 'Off: app-controlled render pacing. Browsers and webviews may still synchronize presentation to the monitor.'}
          </p>

          {/* Current Settings Display */}
          <div className="pt-2 border-t border-gray-700 text-xs text-gray-400">
            <div>Frame Limit: {FRAME_LIMIT_OPTIONS.find(o => o.value === frameLimit)?.label}</div>
            <div>Vsync: {vsync ? 'On' : 'Off'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PerformanceSettings;
