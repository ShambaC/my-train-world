import { useEffect } from 'react';
import WorldSettingsModal from './WorldSettingsModal';

export default function PauseMenu({
  isPaused,
  settingsOpen,
  onResume,
  onOpenSettings,
  onCloseSettings,
  onSave,
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
      {isPaused && !settingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#08101c]/70 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="pause-menu-title">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101a2b]/95 p-5 text-[#f7f0df] shadow-2xl sm:p-7">
            <div className="mb-7 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#e5a94f]">Railway paused</p>
              <h2 id="pause-menu-title" className="mt-2 text-3xl font-bold">Pause menu</h2>
              <p className="mt-2 text-sm text-[#aebbd0]">The world is paused. Choose what to do next.</p>
            </div>

            <div className="grid gap-3">
              <button type="button" data-pause-menu-primary onClick={onResume} className="min-h-12 rounded-xl bg-[#4b8dff] px-4 py-3 font-semibold text-white hover:bg-[#387be8]">Resume railway</button>
              <button type="button" onClick={onOpenSettings} className="min-h-12 rounded-xl border border-white/10 bg-[#18263b] px-4 py-3 font-semibold hover:border-[#63c9dc] hover:bg-[#22344b]">World settings</button>
              <button type="button" onClick={onSave} className="min-h-12 rounded-xl border border-white/10 bg-[#18263b] px-4 py-3 font-semibold hover:border-[#65c587] hover:bg-[#22344b]">Save locally</button>
              <button type="button" onClick={onExit} className="min-h-12 rounded-xl border border-[#ef6b68]/40 bg-[#3a2029] px-4 py-3 font-semibold text-[#ffd9d5] hover:bg-[#512632]">Save and return to worlds</button>
            </div>

            <p className="mt-6 text-center text-xs text-[#aebbd0]">Press Esc to resume</p>
          </div>
        </div>
      )}
      <WorldSettingsModal isOpen={settingsOpen} onClose={onCloseSettings} {...settingsProps} />
    </>
  );
}
