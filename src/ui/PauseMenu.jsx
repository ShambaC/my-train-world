import { useEffect } from 'react';
import WorldSettingsModal from './WorldSettingsModal';
import TrainControl from './TrainControl';
import { UI_ICONS } from './iconRegistry';

export default function PauseMenu({
  isPaused,
  helpOpen = false,
  settingsOpen,
  onResume,
  onOpenSettings,
  onCloseSettings,
  onSave,
  recoveryAvailable = false,
  onRecover,
  onResetOverview,
  onFrameRailway,
  diagnosticsEnabled = false,
  diagnosticsVisible = false,
  onToggleDiagnostics,
  trainControlsOpen = false,
  onOpenTrainControls,
  onCloseTrainControls,
  trainManager,
  followTrainId,
  onFollowTrain,
  history,
  onExit,
  ...settingsProps
}) {
  useEffect(() => {
    if (!isPaused || settingsOpen) return undefined;
    const previouslyFocused = document.activeElement;
    const firstButton = document.querySelector('[data-pause-menu-primary]');
    firstButton?.focus();
    return () => previouslyFocused?.focus?.();
  }, [isPaused, settingsOpen]);

  if (!isPaused && !settingsOpen) return null;

  return (
    <>
      {isPaused && !settingsOpen && !helpOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#08101c]/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="pause-menu-title">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101a2b]/95 p-5 text-[#f7f0df] shadow-2xl sm:p-7">
            <div className="mb-7 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#e5a94f]">Railway paused</p>
              <h2 id="pause-menu-title" className="mt-2 text-3xl font-bold">Pause menu</h2>
              <p className="mt-2 text-sm text-[#aebbd0]">The world is paused. Choose what to do next.</p>
            </div>

            <div className="grid gap-3">
              <button type="button" data-pause-menu-primary onClick={onResume} className="min-h-12 rounded-xl bg-[#4b8dff] px-4 py-3 font-semibold text-white hover:bg-[#387be8]">Resume railway</button>
              <button type="button" onClick={onOpenSettings} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#18263b] px-4 py-3 font-semibold hover:border-[#63c9dc] hover:bg-[#22344b]"><img src={UI_ICONS.actions.settings} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />World settings</button>
              <button type="button" onClick={onOpenTrainControls} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#18263b] px-4 py-3 font-semibold hover:border-[#63c9dc] hover:bg-[#22344b]"><img src={UI_ICONS.trainControls.entityTrain} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />Train management</button>
              {diagnosticsEnabled && <button type="button" onClick={onToggleDiagnostics} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#18263b] px-4 py-3 font-semibold hover:border-[#63c9dc] hover:bg-[#22344b]"><img src={UI_ICONS.status.developer} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />{diagnosticsVisible ? 'Hide diagnostics' : 'Show diagnostics'}</button>}
              <button type="button" onClick={onSave} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#18263b] px-4 py-3 font-semibold hover:border-[#65c587] hover:bg-[#22344b]"><img src={UI_ICONS.actions.save} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />Save locally</button>
              {recoveryAvailable && <button type="button" onClick={onRecover} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#63c9dc]/40 bg-[#18384a] px-4 py-3 font-semibold text-[#d9f7ff] hover:bg-[#20536a]"><img src={UI_ICONS.actions.recover} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />Recover autosave</button>}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={onResetOverview} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#18263b] px-3 py-3 text-sm font-semibold hover:bg-[#22344b]"><img src={UI_ICONS.actions.resetOverview} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />Reset overview</button>
                <button type="button" onClick={onFrameRailway} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#18263b] px-3 py-3 text-sm font-semibold hover:bg-[#22344b]"><img src={UI_ICONS.actions.frameRailway} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />Frame railway</button>
              </div>
              <button type="button" onClick={onExit} className="min-h-12 rounded-xl border border-[#ef6b68]/40 bg-[#3a2029] px-4 py-3 font-semibold text-[#ffd9d5] hover:bg-[#512632]">Save and return to worlds</button>
            </div>

            <p className="mt-6 text-center text-xs text-[#aebbd0]">Press Esc to resume</p>
          </div>
        </div>
      )}
      <WorldSettingsModal isOpen={settingsOpen} onClose={onCloseSettings} {...settingsProps} />
      {trainControlsOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-[#08101c]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="train-management-title">
          <div className="scrollbar-none max-h-[min(44rem,calc(100dvh-2rem))] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#101a2b] p-5 text-white shadow-2xl sm:p-7">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#63c9dc]">Paused</p>
                <h2 id="train-management-title" className="mt-1 text-2xl font-bold">Train management</h2>
              </div>
              <button type="button" onClick={onCloseTrainControls} aria-label="Close train management" className="min-h-11 min-w-11 rounded-xl bg-white/10 text-2xl leading-none hover:bg-white/20">×</button>
            </div>
            <TrainControl trainManager={trainManager} followTrainId={followTrainId} onFollowTrain={onFollowTrain} history={history} />
            <button type="button" onClick={onCloseTrainControls} className="mt-6 min-h-12 w-full rounded-xl bg-[#4b8dff] px-4 py-3 font-semibold">Back to pause menu</button>
          </div>
        </div>
      )}
    </>
  );
}
