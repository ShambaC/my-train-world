import { useState, useEffect } from 'react';

const TIME_OPTIONS = [
  { value: 'dawn', label: '🌅 Dawn', color: '#ff9966' },
  { value: 'day', label: '☀️ Day', color: '#87ceeb' },
  { value: 'dusk', label: '🌆 Dusk', color: '#ff6b6b' },
  { value: 'night', label: '🌙 Night', color: '#2c3e50' }
];

function EnvironmentSettings({ 
  timeOfDay, 
  onTimeChange, 
  fogEnabled, 
  onFogEnabledChange 
}) {
  const [isOpen, setIsOpen] = useState(true);

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

          {/* Current Settings Display */}
          <div className="pt-2 border-t border-gray-700 text-xs text-gray-400">
            <div>Current: {TIME_OPTIONS.find(t => t.value === timeOfDay)?.label}</div>
            <div>Fog: {fogEnabled ? 'Enabled' : 'Disabled'}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EnvironmentSettings;
