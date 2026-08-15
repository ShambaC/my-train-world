import { useState, useEffect } from 'react';

const TIME_OPTIONS = [
  { value: 'dawn', label: '🌅 Dawn', color: '#ff9966' },
  { value: 'day', label: '☀️ Day', color: '#87ceeb' },
  { value: 'dusk', label: '🌆 Dusk', color: '#ff6b6b' },
  { value: 'night', label: '🌙 Night', color: '#2c3e50' }
];

const SHADOW_OPTIONS = [
  { value: 'none', label: '🚫 Off' },
  { value: 'hard', label: '🔦 Hard' },
  { value: 'soft', label: '☁️ Soft' },
];

function EnvironmentSettings({ 
  timeOfDay, 
  onTimeChange, 
  fogEnabled, 
  onFogEnabledChange,
  fogDensity,
  onFogDensityChange,
  shadowMode,
  onShadowModeChange,
  tiltShiftEnabled,
  onTiltShiftChange,
  celShadingEnabled,
  onCelShadingChange,
  ambientEnabled,
  onAmbientChange,
  soundsEnabled,
  onSoundsChange,
  trafficEnabled,
  onTrafficChange,
  signalsEnabled,
  onSignalsChange,
  audioVolumes,
  onAudioVolumeChange,
}) {
  const [isOpen, setIsOpen] = useState(true);

  const volumeSlider = (label, key, display) => (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label}: {display ? display(audioVolumes[key]) : Math.round(audioVolumes[key] * 100)}%
      </label>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={audioVolumes[key]}
        onChange={(e) => onAudioVolumeChange({ [key]: parseFloat(e.target.value) })}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );

  return (
    <div className="mb-4">
      <button 
        className="w-full flex justify-between items-center p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="font-bold">🌍 Environment</span>
        <span className="text-sm">{isOpen ? '▼' : '▶'}</span>
      </button>
      
      {isOpen && (
        <div className="mt-2 p-3 bg-gray-800 rounded space-y-4">
          {/* Time of Day Selector */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Time of Day
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIME_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => onTimeChange(option.value)}
                  className={`p-2 rounded text-sm font-medium transition-all ${
                    timeOfDay === option.value
                      ? 'bg-blue-600 hover:bg-blue-500 ring-2 ring-blue-400'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                  style={{
                    borderLeft: `4px solid ${option.color}`
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fog Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              🌫️ Fog
            </label>
            <button
              onClick={() => onFogEnabledChange(!fogEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                fogEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  fogEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Fog Density Slider — override; null uses the time-of-day preset */}
          {fogEnabled && onFogDensityChange && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Fog Density: {((fogDensity ?? 0.012) * 100).toFixed(0)}%
              </label>
              <input
                type="range"
                min="0.005"
                max="0.035"
                step="0.001"
                value={fogDensity ?? 0.012}
                onChange={(e) => onFogDensityChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Clear</span>
                <span>Thick</span>
              </div>
            </div>
          )}

          {/* Shadow Mode Selector */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Shadows (Realtime)
            </label>
            <div className="grid grid-cols-3 gap-2">
              {SHADOW_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => onShadowModeChange(option.value)}
                  className={`p-2 rounded text-sm font-medium transition-all ${
                    shadowMode === option.value
                      ? 'bg-blue-600 hover:bg-blue-500 ring-2 ring-blue-400'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Miniature Tilt-Shift Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              🔍 Miniature Mode (Tilt-Shift)
            </label>
            <button
              onClick={() => onTiltShiftChange && onTiltShiftChange(!tiltShiftEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                tiltShiftEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  tiltShiftEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Cel Shading Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              🎨 Cel Shading (Toon)
            </label>
            <button
              onClick={() => onCelShadingChange && onCelShadingChange(!celShadingEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                celShadingEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  celShadingEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Ambient Activity Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              🌾 Ambient Activity
            </label>
            <button
              onClick={() => onAmbientChange && onAmbientChange(!ambientEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                ambientEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  ambientEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Train Sounds Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              🔔 Train Sounds
            </label>
            <button
              onClick={() => onSoundsChange && onSoundsChange(!soundsEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                soundsEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  soundsEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Audio volumes */}
          {audioVolumes && onAudioVolumeChange && (
            <div className="space-y-2 pt-1 border-t border-gray-700">
              {volumeSlider('🔊 Master Volume', 'master')}
              {volumeSlider('🚂 Train Volume (whistle/bell)', 'train')}
              {volumeSlider('🚧 Crossing Volume (bell/motor)', 'crossing')}
            </div>
          )}

          {/* Roads & Traffic Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              🛣️ Roads & Traffic
            </label>
            <button
              onClick={() => onTrafficChange && onTrafficChange(!trafficEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                trafficEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  trafficEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Signals & Crossings Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">
              🚦 Signals & Crossings
            </label>
            <button
              onClick={() => onSignalsChange && onSignalsChange(!signalsEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                signalsEnabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  signalsEnabled ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Current Settings Display */}
          <div className="pt-2 border-t border-gray-700 text-xs text-gray-400">
            <div>Current: {TIME_OPTIONS.find(t => t.value === timeOfDay)?.label}</div>
            <div>Fog: {fogEnabled ? 'Enabled' : 'Disabled'}</div>
            <div>Shadows: {SHADOW_OPTIONS.find(s => s.value === shadowMode)?.label}</div>
            <div>Miniature: {tiltShiftEnabled ? 'Active' : 'Off'}</div>
            <div>Cel: {celShadingEnabled ? 'On' : 'Off'}</div>
            <div>Ambient: {ambientEnabled ? 'On' : 'Off'}</div>
            <div>Sounds: {soundsEnabled ? 'On' : 'Off'}</div>
            <div>Traffic: {trafficEnabled ? 'On' : 'Off'}</div>
            <div>Signals: {signalsEnabled ? 'On' : 'Off'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnvironmentSettings;
