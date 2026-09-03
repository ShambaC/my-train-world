const TIME_PRESETS = ['dawn', 'day', 'dusk', 'night'];

export default function PhotoModePanel({
  fov,
  onFovChange,
  timeOfDay,
  onTimeChange,
  fogEnabled,
  onFogChange,
  tiltShiftEnabled,
  onTiltShiftChange,
  celShadingEnabled,
  onCelShadingChange,
  onReset,
  onCapture,
  onExit,
  capturing = false,
  status = '',
}) {
  return (
    <aside className={`pointer-events-auto fixed bottom-4 left-4 z-[55] w-[min(21rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#101a2b]/95 p-4 text-[#f7f0df] shadow-2xl backdrop-blur-xl ${capturing ? 'opacity-0' : ''}`} aria-labelledby="photo-mode-title">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e5a94f]">Creator mode</p><h2 id="photo-mode-title" className="mt-1 text-xl font-bold">Photo mode</h2></div>
        <button type="button" onClick={onExit} aria-label="Exit photo mode" className="min-h-10 min-w-10 rounded-xl bg-white/10 text-2xl leading-none hover:bg-white/20">×</button>
      </div>
      <label className="mt-4 block text-xs font-semibold" htmlFor="photo-fov">FOV: {fov}°</label>
      <input id="photo-fov" type="range" min="25" max="85" step="1" value={fov} onChange={(event) => onFovChange(Number(event.target.value))} className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-700 accent-[#e5a94f]" />
      <div className="mt-3 grid grid-cols-4 gap-1"><span className="col-span-4 text-xs font-semibold">Time</span>{TIME_PRESETS.map((preset) => <button key={preset} type="button" onClick={() => onTimeChange(preset)} aria-pressed={timeOfDay === preset} className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize ${timeOfDay === preset ? 'bg-[#846b2b] text-white' : 'bg-[#18263b] text-[#aebbd0] hover:text-white'}`}>{preset}</button>)}</div>
      <div className="mt-3 grid grid-cols-3 gap-2"><button type="button" onClick={() => onFogChange(!fogEnabled)} aria-pressed={fogEnabled} className={`rounded-lg px-2 py-2 text-xs font-semibold ${fogEnabled ? 'bg-[#244b67]' : 'bg-[#18263b] text-[#aebbd0]'}`}>Fog</button><button type="button" onClick={() => onTiltShiftChange(!tiltShiftEnabled)} aria-pressed={tiltShiftEnabled} className={`rounded-lg px-2 py-2 text-xs font-semibold ${tiltShiftEnabled ? 'bg-[#244b67]' : 'bg-[#18263b] text-[#aebbd0]'}`}>Tilt-shift</button><button type="button" onClick={() => onCelShadingChange(!celShadingEnabled)} aria-pressed={celShadingEnabled} className={`rounded-lg px-2 py-2 text-xs font-semibold ${celShadingEnabled ? 'bg-[#244b67]' : 'bg-[#18263b] text-[#aebbd0]'}`}>Cel</button></div>
      {status && <p className="mt-3 text-xs text-[#65c587]" role="status">{status}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={onReset} className="min-h-11 rounded-xl border border-white/10 bg-[#18263b] px-3 py-2 text-sm font-semibold hover:bg-[#22344b]">Reset</button><button type="button" onClick={onCapture} disabled={capturing} className="min-h-11 rounded-xl bg-[#e5a94f] px-3 py-2 text-sm font-bold text-[#101a2b] hover:bg-[#f1bd63] disabled:opacity-60">{capturing ? 'Saving…' : 'Capture PNG'}</button></div>
      <button type="button" onClick={onExit} className="mt-2 min-h-10 w-full rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-[#aebbd0] hover:bg-white/10">Exit photo mode · Esc</button>
    </aside>
  );
}
