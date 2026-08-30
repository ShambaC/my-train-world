import { useState } from 'react';
import { UI_ICONS } from './iconRegistry';
import { QUALITY_TIERS } from '../render/graphicsQuality.js';

const FRAME_LIMIT_OPTIONS = [
  { value: 30, label: '30' },
  { value: 60, label: '60' },
  { value: 90, label: '90' },
  { value: 120, label: '120' },
  { value: 144, label: '144' },
  { value: 0, label: 'Uncapped' },
];

const QUALITY_OPTIONS = [
  { value: 'low', label: 'Low', desc: 'Analytic shadows, sky reflection, optimized foliage' },
  { value: 'medium', label: 'Medium', desc: 'PCF soft shadows, GTAO, scene refraction, bloom' },
  { value: 'high', label: 'High', desc: 'Tight 4K shadows, planar reflection, max grass density' },
];

function PerformanceSettings({
  frameLimit,
  vsync,
  graphicsQuality = 'medium',
  onFrameLimitChange,
  onVsyncChange,
  onGraphicsQualityChange,
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="mb-4">
      <button
        className="w-full flex justify-between items-center p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="flex items-center gap-2 font-bold">
          <img src={UI_ICONS.environment.performance} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />
          Performance & Graphics
        </span>
        <span className="text-sm">{isOpen ? '▼' : '▶'}</span>
      </button>

      {isOpen && (
        <div className="mt-2 p-3 bg-gray-800 rounded space-y-4">
          {/* Graphics Quality Tier */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Graphics Quality
            </label>
            <div className="grid grid-cols-3 gap-2">
              {QUALITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onGraphicsQualityChange?.(opt.value)}
                  className={`p-2 rounded text-sm font-medium transition-all ${
                    graphicsQuality === opt.value
                      ? 'bg-blue-600 hover:bg-blue-500 ring-2 ring-blue-400 text-white'
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {QUALITY_OPTIONS.find((o) => o.value === graphicsQuality)?.desc}
            </p>
          </div>

          {/* Frame Limit */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Frame Limit (FPS)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FRAME_LIMIT_OPTIONS.map((option) => (
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
              Controls render pacing. Simulation speed stays identical at every limit.
            </p>
          </div>

          {/* Vsync Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              <span className="flex items-center gap-2">
                <img src={UI_ICONS.environment.performance} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />
                Vsync
              </span>
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

          {/* Current Settings Display */}
          <div className="pt-2 border-t border-gray-700 text-xs text-gray-400">
            <div>Quality: {QUALITY_OPTIONS.find((o) => o.value === graphicsQuality)?.label}</div>
            <div>Frame Limit: {FRAME_LIMIT_OPTIONS.find((o) => o.value === frameLimit)?.label}</div>
            <div>Vsync: {vsync ? 'On' : 'Off'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PerformanceSettings;
