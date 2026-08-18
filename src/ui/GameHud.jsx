import { UI_ICONS } from './iconRegistry';

export default function GameHud({
  worldName,
  worldStatus,
  sceneReady,
  selectedTool,
  rotation,
  heightOffset,
  onUndo,
  onRedo,
  onHelp,
  onPause,
  onTrainManagement,
}) {
  const hint = selectedTool?.type === 'train'
    ? `${selectedTool.label} · R changes direction`
    : selectedTool?.type === 'station'
      ? `${selectedTool.label} · R flips orientation`
      : `${selectedTool?.label || 'Hand'} · R rotates`;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="flex w-full max-w-6xl items-center gap-2 rounded-2xl border border-white/10 bg-[#101a2b]/80 px-3 py-2 text-[#f7f0df] shadow-xl backdrop-blur-md sm:gap-4 sm:px-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold sm:text-base">{worldName || 'Railway world'}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-[#aebbd0]">
            <span className={`h-1.5 w-1.5 rounded-full ${sceneReady ? 'bg-[#65c587]' : 'bg-[#e5a94f]'}`} />
            {worldStatus || (sceneReady ? 'Ready' : 'Loading world')}
          </div>
        </div>
        <div className="hidden min-w-0 flex-1 text-center sm:block">
          <div className="truncate text-xs font-semibold text-[#c5d0df]">{hint}</div>
          {heightOffset !== 0 && <div className="mt-0.5 text-[10px] text-[#e5a94f]">Bridge height {heightOffset.toFixed(1)}</div>}
        </div>
        <div className="pointer-events-auto flex shrink-0 items-center gap-1">
          <button type="button" onClick={onUndo} aria-label="Undo" title="Undo last change (Ctrl+Z)" className="hidden min-h-10 min-w-10 rounded-xl bg-[#18263b] px-2 text-sm font-bold text-[#c5d0df] hover:bg-[#22344b] sm:block"><img src={UI_ICONS.actions.undo} alt="" aria-hidden="true" className="mx-auto h-5 w-5 object-contain" /></button>
          <button type="button" onClick={onRedo} aria-label="Redo" title="Redo last change (Ctrl+Y or Ctrl+Shift+Z)" className="hidden min-h-10 min-w-10 rounded-xl bg-[#18263b] px-2 text-sm font-bold text-[#c5d0df] hover:bg-[#22344b] sm:block"><img src={UI_ICONS.actions.redo} alt="" aria-hidden="true" className="mx-auto h-5 w-5 object-contain" /></button>
          <button type="button" onClick={onHelp} aria-label="Open help" title="Open help guide" className="min-h-10 min-w-10 rounded-xl bg-[#18263b] px-2 text-sm font-bold text-[#c5d0df] hover:bg-[#22344b]"><img src={UI_ICONS.actions.help} alt="" aria-hidden="true" className="mx-auto h-5 w-5 object-contain" /></button>
          <button type="button" onClick={onTrainManagement} aria-label="Open train management" title="Open live train management" className="min-h-10 min-w-10 rounded-xl bg-[#18263b] px-2 text-sm font-bold text-[#c5d0df] hover:bg-[#22344b]"><img src={UI_ICONS.trainControls.entityTrain} alt="" aria-hidden="true" className="mx-auto h-5 w-5 object-contain" /></button>
          <button type="button" onClick={onPause} aria-label="Pause game" title="Pause railway" className="min-h-10 rounded-xl bg-[#e5a94f] px-3 text-xs font-bold text-[#101a2b] hover:bg-[#f1bd63]"><img src={UI_ICONS.actions.pause} alt="" aria-hidden="true" className="mx-auto h-5 w-5 object-contain" /></button>
        </div>
      </div>
    </div>
  );
}
