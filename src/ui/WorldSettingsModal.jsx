import { useState } from 'react';
import EnvironmentSettings from './EnvironmentSettings';
import PerformanceSettings from './PerformanceSettings';

export default function WorldSettingsModal({
  isOpen,
  onClose,
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
  frameLimit,
  onFrameLimitChange,
  vsync,
  onVsyncChange,
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
  worldStatus,
}) {
  const [tab, setTab] = useState('environment');
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#08101c]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="world-settings-title">
      <div className="scrollbar-none max-h-[min(44rem,calc(100dvh-2rem))] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#101a2b] p-5 text-[#f7f0df] shadow-2xl sm:p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#63c9dc]">Paused</p>
            <h2 id="world-settings-title" className="mt-1 text-2xl font-bold">World settings</h2>
            <p className="mt-1 text-sm text-[#aebbd0]">Graphics, sound, and performance for this railway.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close world settings" className="min-h-11 min-w-11 rounded-xl bg-white/10 text-2xl leading-none hover:bg-white/20">×</button>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setTab('environment')} className={`min-h-11 rounded-xl px-3 py-2 text-sm font-semibold ${tab === 'environment' ? 'bg-[#244b67] text-white ring-1 ring-[#e5a94f]' : 'bg-[#18263b] text-[#aebbd0] hover:text-white'}`} aria-pressed={tab === 'environment'}>Environment and audio</button>
            <button type="button" onClick={() => setTab('performance')} className={`min-h-11 rounded-xl px-3 py-2 text-sm font-semibold ${tab === 'performance' ? 'bg-[#244b67] text-white ring-1 ring-[#e5a94f]' : 'bg-[#18263b] text-[#aebbd0] hover:text-white'}`} aria-pressed={tab === 'performance'}>Performance</button>
          </div>

          {tab === 'environment' && <section className="rounded-2xl border border-white/10 bg-[#18263b] p-3 sm:p-4">
            <EnvironmentSettings
              timeOfDay={timeOfDay}
              onTimeChange={onTimeChange}
              fogEnabled={fogEnabled}
              onFogEnabledChange={onFogEnabledChange}
              fogDensity={fogDensity}
              onFogDensityChange={onFogDensityChange}
              shadowMode={shadowMode}
              onShadowModeChange={onShadowModeChange}
              tiltShiftEnabled={tiltShiftEnabled}
              onTiltShiftChange={onTiltShiftChange}
              celShadingEnabled={celShadingEnabled}
              onCelShadingChange={onCelShadingChange}
              ambientEnabled={ambientEnabled}
              onAmbientChange={onAmbientChange}
              soundsEnabled={soundsEnabled}
              onSoundsChange={onSoundsChange}
              trafficEnabled={trafficEnabled}
              onTrafficChange={onTrafficChange}
              signalsEnabled={signalsEnabled}
              onSignalsChange={onSignalsChange}
              audioVolumes={audioVolumes}
              onAudioVolumeChange={onAudioVolumeChange}
            />
          </section>}

          {tab === 'performance' && <section className="rounded-2xl border border-white/10 bg-[#18263b] p-3 sm:p-4">
            <PerformanceSettings
              frameLimit={frameLimit}
              vsync={vsync}
              onFrameLimitChange={onFrameLimitChange}
              onVsyncChange={onVsyncChange}
            />
          </section>}
        </div>

        {worldStatus && <p className="mt-4 rounded-xl bg-[#244b67] px-3 py-2 text-sm text-[#f7f0df]" role="status">{worldStatus}</p>}

        <button type="button" onClick={onClose} className="mt-6 min-h-12 w-full rounded-xl bg-[#4b8dff] px-4 py-3 font-semibold text-white hover:bg-[#387be8]">Back to pause menu</button>
      </div>
    </div>
  );
}
