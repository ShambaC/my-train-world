import { useState } from 'react';
import { UI_ICONS } from './iconRegistry';
import {
  QUALITY_TIERS,
  getCustomQualityOverrides,
  setCustomQualityOverrides,
} from '../render/graphicsQuality.js';

const FRAME_LIMIT_OPTIONS = [
  { value: 30, label: '30' },
  { value: 60, label: '60' },
  { value: 90, label: '90' },
  { value: 120, label: '120' },
  { value: 144, label: '144' },
  { value: 0, label: 'Uncapped' },
];

export const QUALITY_OPTIONS = [
  { value: 'low', label: 'Low', desc: 'Analytic shadows, sky reflection, optimized foliage' },
  { value: 'medium', label: 'Medium', desc: 'PCF soft shadows, GTAO, scene refraction, bloom' },
  { value: 'high', label: 'High', desc: 'Tight 4K shadows, planar reflection, max grass density' },
  { value: 'custom', label: 'Custom', desc: 'User configured settings overrides' },
];

export function CustomGraphicsControls() {
  const [overrides, setOverrides] = useState(getCustomQualityOverrides());

  const update = (patch) => {
    const next = { ...overrides, ...patch };
    setOverrides(next);
    setCustomQualityOverrides(patch);
  };

  const dpr = overrides.dprCap ?? 1.5;
  const shadowSize = overrides.shadowMapSize ?? 2048;
  const grassDensity = overrides.grassDensityMultiplier ?? 0.8;
  const flowerDensity = overrides.flowerDensityMultiplier ?? 0.8;
  const waterRefl = overrides.waterReflection ?? 'planar';
  const bloom = overrides.bloom ?? true;
  const dofSamples = overrides.miniatureDof?.sampleCount ?? 8;
  const cloudLayers = overrides.cloudLayers ?? 2;

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-[#132032] p-3 text-xs text-[#c5d0df]">
      <div className="font-bold text-[#e5a94f]">Custom Quality Settings</div>

      {/* DPR / Resolution Cap */}
      <div>
        <div className="font-semibold mb-1">Resolution / DPR Scale</div>
        <div className="grid grid-cols-3 gap-1.5">
          {[1.0, 1.5, 2.0].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ dprCap: v })}
              className={`rounded-lg border p-1.5 font-medium transition ${
                dpr === v ? 'border-[#e5a94f] bg-[#244b67] text-white' : 'border-white/10 bg-[#18263b] hover:border-[#63c9dc]'
              }`}
            >
              {v}x {v === 1 ? '(Fast)' : v === 1.5 ? '(Balanced)' : '(Crisp)'}
            </button>
          ))}
        </div>
      </div>

      {/* Shadow Resolution */}
      <div>
        <div className="font-semibold mb-1">Shadow Map Resolution</div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { v: 1024, l: '1K Basic' },
            { v: 2048, l: '2K Soft' },
            { v: 4096, l: '4K Tight' },
          ].map((item) => (
            <button
              key={item.v}
              type="button"
              onClick={() => update({ shadowMapSize: item.v, shadowFiltering: item.v === 4096 ? 'pcfsoft_tight' : item.v === 2048 ? 'pcfsoft' : 'basic' })}
              className={`rounded-lg border p-1.5 font-medium transition ${
                shadowSize === item.v ? 'border-[#e5a94f] bg-[#244b67] text-white' : 'border-white/10 bg-[#18263b] hover:border-[#63c9dc]'
              }`}
            >
              {item.l}
            </button>
          ))}
        </div>
      </div>

      {/* Grass Density Slider */}
      <div>
        <div className="flex justify-between font-semibold">
          <span>Grass Blade Density</span>
          <span className="font-mono text-[#aebbd0]">{(grassDensity * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0.2"
          max="1.5"
          step="0.1"
          value={grassDensity}
          onChange={(e) => update({ grassDensityMultiplier: parseFloat(e.target.value) })}
          className="mt-1 w-full accent-[#4b8dff]"
        />
      </div>

      {/* Flower Density Slider */}
      <div>
        <div className="flex justify-between font-semibold">
          <span>Flower Field Density</span>
          <span className="font-mono text-[#aebbd0]">{(flowerDensity * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min="0.2"
          max="1.5"
          step="0.1"
          value={flowerDensity}
          onChange={(e) => update({ flowerDensityMultiplier: parseFloat(e.target.value) })}
          className="mt-1 w-full accent-[#4b8dff]"
        />
      </div>

      {/* Water Reflection Mode */}
      <div>
        <div className="font-semibold mb-1">Water Reflection Mode</div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { v: 'sky', l: 'Sky Only' },
            { v: 'sky_refract', l: 'Refract' },
            { v: 'planar', l: 'Planar Mirror' },
          ].map((item) => (
            <button
              key={item.v}
              type="button"
              onClick={() => update({ waterReflection: item.v })}
              className={`rounded-lg border p-1.5 font-medium transition ${
                waterRefl === item.v ? 'border-[#e5a94f] bg-[#244b67] text-white' : 'border-white/10 bg-[#18263b] hover:border-[#63c9dc]'
              }`}
            >
              {item.l}
            </button>
          ))}
        </div>
      </div>

      {/* Miniature DoF Blur Samples */}
      <div>
        <div className="font-semibold mb-1">Miniature Tilt-Shift Quality</div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { v: 4, l: '4 Samples' },
            { v: 8, l: '8 Samples' },
            { v: 16, l: '16 Samples' },
          ].map((item) => (
            <button
              key={item.v}
              type="button"
              onClick={() => update({ miniatureDof: { resolution: 0.5, sampleCount: item.v } })}
              className={`rounded-lg border p-1.5 font-medium transition ${
                dofSamples === item.v ? 'border-[#e5a94f] bg-[#244b67] text-white' : 'border-white/10 bg-[#18263b] hover:border-[#63c9dc]'
              }`}
            >
              {item.l}
            </button>
          ))}
        </div>
      </div>

      {/* Cloud Layers */}
      <div>
        <div className="font-semibold mb-1">Volumetric Cloud Layers</div>
        <div className="grid grid-cols-3 gap-1.5">
          {[1, 2, 3].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => update({ cloudLayers: v })}
              className={`rounded-lg border p-1.5 font-medium transition ${
                cloudLayers === v ? 'border-[#e5a94f] bg-[#244b67] text-white' : 'border-white/10 bg-[#18263b] hover:border-[#63c9dc]'
              }`}
            >
              {v} {v === 1 ? 'Layer' : 'Layers'}
            </button>
          ))}
        </div>
      </div>

      {/* Bloom Toggle */}
      <label className="flex items-center justify-between font-semibold pt-1">
        <span>Emissive Lamp & Window Bloom</span>
        <input
          type="checkbox"
          checked={bloom}
          onChange={(e) => update({ bloom: e.target.checked })}
          className="h-4 w-4 accent-[#4b8dff]"
        />
      </label>
    </div>
  );
}

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
            <div className="grid grid-cols-4 gap-2">
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

            {/* If Custom, render fine-tuning options */}
            {graphicsQuality === 'custom' && <CustomGraphicsControls />}
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
