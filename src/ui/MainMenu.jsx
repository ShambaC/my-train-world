import { useEffect, useState } from 'react';
import menuArt from '../assets/ui/ui-menu-key-art.png';
import { UI_ICONS } from './iconRegistry';

const SIZE_PRESETS = [
  { key: 'small', label: 'Small', size: { length: 100, breadth: 100 }, hint: 'Quick build' },
  { key: 'medium', label: 'Medium', size: { length: 256, breadth: 256 }, hint: 'Room to grow' },
  { key: 'large', label: 'Large', size: { length: 512, breadth: 512 }, hint: 'Big railway' },
];

const FRAME_LIMIT_OPTIONS = [30, 60, 90, 120, 144, 0];
const TIME_OPTIONS = [
  { value: 'dawn', label: 'Dawn', color: '#ff9966' },
  { value: 'day', label: 'Day', color: '#87ceeb' },
  { value: 'dusk', label: 'Dusk', color: '#ff6b6b' },
  { value: 'night', label: 'Night', color: '#2c3e50' },
];
const SHADOW_OPTIONS = [
  { value: 'none', label: 'Off', icon: 'shadowOff' },
  { value: 'hard', label: 'Hard', icon: 'shadowHard' },
  { value: 'soft', label: 'Soft', icon: 'shadowSoft' },
];

function formatDate(value) {
  if (!value) return 'Not played yet';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function WorldCard({ world, featured, onOpen, onRename, onDuplicate, onExport, onDelete }) {
  const fallbackArt = UI_ICONS.worldCards[(world.id || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % UI_ICONS.worldCards.length];
  return (
    <article
      className={`group relative min-w-0 overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 ${featured
        ? 'border-[#e5a94f]/70 bg-[#22344b] shadow-[0_0_0_1px_rgba(229,169,79,0.14)]'
        : 'border-white/10 bg-[#18263b]/90 hover:border-[#63c9dc]/60'
        }`}
    >
      <div className="relative h-24 overflow-hidden bg-[#101a2b]">
        {world.thumbnail ? (
          <img src={world.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : (
          <img src={fallbackArt || menuArt} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:scale-105" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#101a2b] via-transparent to-transparent" />
        {featured && (
          <span className="absolute left-3 top-3 rounded-full bg-[#e5a94f] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#101a2b]">
            Last played
          </span>
        )}
      </div>
      <div className="p-3">
        <button type="button" onClick={() => onOpen(world.id)} className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63c9dc]">
          <div className="truncate font-semibold text-[#f7f0df]">{world.name}</div>
          <div className="mt-1 text-xs text-[#aebbd0]">Played {formatDate(world.lastPlayedAt)}</div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#aebbd0]">
            <span>{world.terrain?.length} x {world.terrain?.breadth}</span>
            <span>Seed {world.terrain?.seed}</span>
            <span>{world.counts?.tracks ?? 0} tracks</span>
          </div>
        </button>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
          <button type="button" onClick={() => onRename(world)} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#aebbd0] hover:bg-[#22344b] hover:text-white">Rename</button>
          <button type="button" onClick={() => onDuplicate(world.id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#aebbd0] hover:bg-[#22344b] hover:text-white">Duplicate</button>
          <button type="button" onClick={() => onExport(world.id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#aebbd0] hover:bg-[#22344b] hover:text-white">Export</button>
          <button type="button" onClick={() => onDelete(world)} className="rounded-lg px-2 py-1 text-xs font-semibold text-[#ef6b68] hover:bg-[#422b3a]">Delete</button>
        </div>
      </div>
    </article>
  );
}

function NewWorldDialog({ onClose, onCreate }) {
  const [name, setName] = useState('New Railway');
  const [seed, setSeed] = useState(String(Math.floor(Math.random() * 1000000)));
  const [sizeKey, setSizeKey] = useState('small');

  const submit = (event) => {
    event.preventDefault();
    const selected = SIZE_PRESETS.find((preset) => preset.key === sizeKey) || SIZE_PRESETS[0];
    const parsedSeed = Number.parseInt(seed, 10);
    onCreate({
      name: name.trim() || 'New Railway',
      size: selected.size,
      seed: Number.isFinite(parsedSeed) ? parsedSeed : 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#08101c]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-world-title">
      <form onSubmit={submit} className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#101a2b] p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#63c9dc]">New world</div>
            <h2 id="new-world-title" className="mt-1 text-2xl font-bold">Set your route</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-xl text-[#aebbd0] hover:bg-[#22344b] hover:text-white" aria-label="Close new world dialog">x</button>
        </div>

        <label className="mt-6 block text-sm font-semibold text-[#c5d0df]">
          World name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={64} autoFocus className="mt-2 w-full rounded-xl border border-white/10 bg-[#18263b] px-3 py-3 text-white outline-none focus:border-[#63c9dc]" />
        </label>

        <div className="mt-5">
          <div className="text-sm font-semibold text-[#c5d0df]">Terrain size</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {SIZE_PRESETS.map((preset) => (
              <button key={preset.key} type="button" onClick={() => setSizeKey(preset.key)} className={`rounded-xl border p-3 text-left transition ${sizeKey === preset.key ? 'border-[#e5a94f] bg-[#244b67]' : 'border-white/10 bg-[#18263b] hover:border-[#63c9dc]'}`}>
                <span className="block font-semibold">{preset.label}</span>
                <span className="mt-1 block text-xs text-[#aebbd0]">{preset.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="mt-5 block text-sm font-semibold text-[#c5d0df]">
          World seed
          <div className="mt-2 flex gap-2">
            <input type="number" value={seed} onChange={(event) => setSeed(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#18263b] px-3 py-3 text-white outline-none focus:border-[#63c9dc]" />
            <button type="button" onClick={() => setSeed(String(Math.floor(Math.random() * 1000000)))} className="rounded-xl border border-white/10 bg-[#22344b] px-3 text-sm text-[#c5d0df] hover:border-[#63c9dc]">Randomize</button>
          </div>
        </label>

        <div className="mt-7 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-semibold text-[#aebbd0] hover:bg-[#22344b] hover:text-white">Cancel</button>
          <button type="submit" className="rounded-xl bg-[#e5a94f] px-5 py-3 text-sm font-bold text-[#101a2b] hover:bg-[#f1bd63]">Create world</button>
        </div>
      </form>
    </div>
  );
}

function RenameDialog({ world, onClose, onRename }) {
  const [name, setName] = useState(world.name);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08101c]/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="rename-world-title">
      <form onSubmit={(event) => { event.preventDefault(); onRename(name.trim() || world.name); }} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101a2b] p-6 shadow-2xl">
        <h2 id="rename-world-title" className="text-2xl font-bold">Rename world</h2>
        <label className="mt-5 block text-sm font-semibold text-[#c5d0df]">
          World name
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={64} autoFocus className="mt-2 w-full rounded-xl border border-white/10 bg-[#18263b] px-3 py-3 text-white outline-none focus:border-[#63c9dc]" />
        </label>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-semibold text-[#aebbd0] hover:bg-[#22344b] hover:text-white">Cancel</button>
          <button type="submit" className="rounded-xl bg-[#4b8dff] px-5 py-3 text-sm font-bold text-white hover:bg-[#5d9aff]">Rename</button>
        </div>
      </form>
    </div>
  );
}

function DeleteDialog({ world, onClose, onDelete }) {
  const [confirmation, setConfirmation] = useState('');
  const matches = confirmation.trim() === world.name;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#08101c]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-world-title">
      <form onSubmit={(event) => { event.preventDefault(); if (matches) onDelete(); }} className="w-full max-w-md rounded-3xl border border-[#ef6b68]/40 bg-[#101a2b] p-6 shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ef6b68]">Permanent action</div>
        <h2 id="delete-world-title" className="mt-1 text-2xl font-bold">Delete world?</h2>
        <p className="mt-3 text-sm leading-6 text-[#c5d0df]">This removes <strong className="text-white">{world.name}</strong> from local worlds. Type its name to confirm.</p>
        <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoFocus className="mt-5 w-full rounded-xl border border-white/10 bg-[#18263b] px-3 py-3 text-white outline-none focus:border-[#ef6b68]" aria-label="World name confirmation" />
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-semibold text-[#aebbd0] hover:bg-[#22344b] hover:text-white">Keep world</button>
          <button type="submit" disabled={!matches} className="rounded-xl bg-[#b94b58] px-5 py-3 text-sm font-bold text-white enabled:hover:bg-[#d05a67] disabled:cursor-not-allowed disabled:opacity-40">Delete world</button>
        </div>
      </form>
    </div>
  );
}

export default function MainMenu({
  worlds,
  lastWorldId,
  storageStatus,
  onOpenWorld,
  onCreateWorld,
  onImportWorld,
  onRenameWorld,
  onDuplicateWorld,
  onExportWorld,
  onDeleteWorld,
  graphicsQuality,
  onGraphicsQualityChange,
  frameLimit,
  onFrameLimitChange,
  vsync,
  onVsyncChange,
  audioVolumes,
  onAudioVolumeChange,
  globalGraphics,
  onGlobalGraphicsChange,
  showDebug,
  onToggleDebug,
  showAxes,
  onToggleAxes,
  debugDetail,
  onDebugDetailChange,
  debugPosition,
  onDebugPositionChange,
  onCopyDiagnostics,
  showTechnicalInfo,
  onToggleTechnicalInfo,
  accessibility,
  onAccessibilityChange,
}) {
  const [view, setView] = useState('home');
  const [showNewWorld, setShowNewWorld] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [settingsTab, setSettingsTab] = useState('graphics');

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (showNewWorld) setShowNewWorld(false);
      else if (renameTarget) setRenameTarget(null);
      else if (deleteTarget) setDeleteTarget(null);
      else if (view !== 'home') setView('home');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteTarget, renameTarget, showNewWorld, view]);

  const volume = (key, label) => (
    <label className="block text-sm font-semibold text-[#c5d0df]">
      <span className="flex justify-between"><span>{label}</span><span className="font-mono text-xs text-[#aebbd0]">{Math.round((audioVolumes?.[key] ?? 1) * 100)}%</span></span>
      <input type="range" min="0" max="1" step="0.05" value={audioVolumes?.[key] ?? 1} onChange={(event) => onAudioVolumeChange({ [key]: Number(event.target.value) })} className="mt-2 w-full accent-[#4b8dff]" />
    </label>
  );
  const updateGraphics = (patch) => onGlobalGraphicsChange(patch);
  const toggleIcons = { tiltShiftEnabled: 'miniature', celShadingEnabled: 'cel', ambientEnabled: 'activity', soundsEnabled: 'audioTrain', trafficEnabled: 'traffic', signalsEnabled: 'signals' };
  const graphicsToggle = (key, label, description) => (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#18263b] p-3">
      <span>
        <span className="flex items-center gap-2 text-sm font-semibold text-[#c5d0df]"><img src={UI_ICONS.environment[toggleIcons[key]]} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />{label}</span>
        <span className="mt-0.5 block text-xs text-[#aebbd0]">{description}</span>
      </span>
      <input type="checkbox" checked={globalGraphics[key]} onChange={(event) => updateGraphics({ [key]: event.target.checked })} className="h-5 w-5 shrink-0 accent-[#4b8dff]" />
    </label>
  );

  return (
    <main className={`relative h-[100dvh] min-h-0 overflow-hidden bg-[#0b1422] text-[#f7f0df] ${accessibility.highContrast ? 'contrast-125' : ''}`} style={{ fontSize: `${accessibility.uiScale}em` }}>
      <a
        href="https://github.com/ShambaC/my-train-world"
        target="_blank"
        rel="noreferrer"
        aria-label="GitHub repository"
        className="fixed right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full text-[#f7f0df]/85 transition hover:bg-[#101a2b]/45 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63c9dc]"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
          <path fill="currentColor" d="M12 .297a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.74.08-.74 1.2.08 1.84 1.23 1.84 1.23 1.07 1.83 2.8 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.6-2.8 5.62-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .297" />
        </svg>
      </a>

      <img src={menuArt} alt="" aria-hidden="true" className="fixed inset-0 h-full w-full object-cover opacity-65" />
      <div className="fixed inset-0 bg-[linear-gradient(115deg,rgba(11,20,34,0.46),rgba(11,20,34,0.2)_52%,rgba(11,20,34,0.58))]" />

      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:px-12">
        <header className="relative flex shrink-0 justify-center pt-5 sm:pt-8">
          <div className="flex items-center gap-3">
            <img src={UI_ICONS.brandMark} alt="" aria-hidden="true" className="h-20 w-20 object-contain sm:h-20 sm:w-20" draggable={false} />
            <h1 className="font-game text-9xl tracking-tight sm:text-9xl">MyTrainWorld</h1>
          </div>
        </header>

        {view === 'home' && (
          <section className="flex min-h-0 flex-1 items-center justify-center">
            <div className="flex w-full max-w-sm flex-col gap-3">
              <button type="button" onClick={() => setView('worlds')} className="rounded-2xl border border-[#e5a94f]/70 bg-[#101a2b]/90 px-6 py-4 text-lg font-bold shadow-2xl backdrop-blur-md transition hover:border-[#f1bd63] hover:bg-[#22344b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7f0df]">
                Worlds
              </button>
              <button type="button" onClick={() => setView('settings')} className="rounded-2xl border border-white/20 bg-[#101a2b]/80 px-6 py-4 text-lg font-bold shadow-xl backdrop-blur-md transition hover:border-[#63c9dc] hover:bg-[#22344b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#63c9dc]">
                Settings
              </button>
            </div>
          </section>
        )}

        {view === 'worlds' && (
          <section className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col overflow-y-auto py-10">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#63c9dc]">World browser</div>
                <h2 className="mt-1 text-3xl font-bold">Your worlds</h2>
              </div>
              <button type="button" onClick={() => setView('home')} className="rounded-xl border border-white/15 bg-[#101a2b]/80 px-4 py-2 text-sm font-semibold text-[#c5d0df] hover:border-[#63c9dc] hover:text-white">Back</button>
            </div>

            <div className="flex-1 rounded-3xl border border-white/10 bg-[#101a2b]/85 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
              {worlds.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                   {worlds.map((world) => <WorldCard key={world.id} world={world} featured={world.id === lastWorldId} onOpen={onOpenWorld} onRename={setRenameTarget} onDuplicate={onDuplicateWorld} onExport={onExportWorld} onDelete={setDeleteTarget} />)}
                </div>
              ) : (
                <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#18263b]/55 px-5 text-center">
                  <div>
                    <div className="text-lg font-semibold">No saved worlds</div>
                    <p className="mt-2 text-sm text-[#aebbd0]">Create or import a world to see it here.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col justify-end gap-3 sm:flex-row">
              <button type="button" onClick={() => setShowNewWorld(true)} className="rounded-xl bg-[#e5a94f] px-5 py-3 font-bold text-[#101a2b] hover:bg-[#f1bd63]">New world</button>
              <button type="button" onClick={onImportWorld} className="rounded-xl border border-white/20 bg-[#101a2b]/85 px-5 py-3 font-semibold text-[#f7f0df] hover:border-[#63c9dc]">Import world</button>
            </div>
            <div className="mt-3 text-right text-xs text-[#aebbd0]">
              {storageStatus?.available ? 'Saved locally on this device.' : 'Local storage unavailable. Use file import/export.'}
            </div>
          </section>
        )}

        {view === 'settings' && (
          <section className="flex min-h-0 flex-1 flex-col py-6 sm:py-8">
            <div className="mx-auto flex w-full max-w-xl shrink-0 justify-start pb-3">
              <button type="button" onClick={() => setView('home')} className="rounded-xl border border-white/15 bg-[#101a2b]/90 px-4 py-2 text-sm font-semibold text-[#c5d0df] hover:border-[#63c9dc]">Back</button>
            </div>
            <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3">
              <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 bg-[#101a2b]/90 p-5 shadow-2xl backdrop-blur-xl sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#63c9dc]">Global defaults</div>
                  <h2 className="mt-1 text-2xl font-bold">Settings</h2>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2 border-b border-white/10 pb-3 sm:grid-cols-4">
                {[
                  ['graphics', 'Graphics'],
                  ['audio', 'Audio'],
                  ['accessibility', 'Accessibility'],
                  ['developer', 'Developer'],
                ].map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setSettingsTab(key)} className={`rounded-xl px-2 py-2 text-xs font-semibold sm:text-sm ${settingsTab === key ? 'bg-[#244b67] text-white ring-1 ring-[#e5a94f]' : 'bg-[#18263b] text-[#aebbd0] hover:text-white'}`} aria-pressed={settingsTab === key}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-[#aebbd0]">These defaults apply across worlds. Environment and presentation choices saved inside each world remain editable during gameplay.</p>

              <div className={`${settingsTab === 'graphics' ? '' : 'hidden'} mt-6 border-t border-white/10 pt-5 space-y-5`}>
                <div>
                  <div className="text-sm font-semibold text-[#c5d0df]">Graphics Quality</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      { value: 'low', label: 'Low', desc: 'Analytic shadows, fast foliage' },
                      { value: 'medium', label: 'Medium', desc: 'Soft shadows, bloom, reflection' },
                      { value: 'high', label: 'High', desc: '4K shadows, planar reflection, dense grass' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => onGraphicsQualityChange?.(opt.value)}
                        className={`rounded-xl border p-2 text-left transition ${
                          (graphicsQuality || 'medium') === opt.value
                            ? 'border-[#e5a94f] bg-[#244b67] text-white'
                            : 'border-white/10 bg-[#18263b] text-[#aebbd0] hover:border-[#63c9dc]'
                        }`}
                      >
                        <span className="block font-semibold">{opt.label}</span>
                        <span className="mt-0.5 block text-[10px] text-[#aebbd0]">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-sm font-semibold text-[#c5d0df]">Frame limit</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {FRAME_LIMIT_OPTIONS.map((option) => (
                      <button key={option} type="button" onClick={() => onFrameLimitChange(option)} className={`rounded-xl border p-2 text-sm font-semibold ${frameLimit === option ? 'border-[#e5a94f] bg-[#244b67] text-white' : 'border-white/10 bg-[#18263b] text-[#aebbd0] hover:border-[#63c9dc]'}`}>
                        {option === 0 ? 'Uncapped' : option}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#18263b] p-3 text-sm font-semibold text-[#c5d0df]">
                  Vsync
                  <input type="checkbox" checked={vsync} onChange={(event) => onVsyncChange(event.target.checked)} className="h-5 w-5 accent-[#4b8dff]" />
                </label>
              </div>

              <div className={`${settingsTab === 'audio' ? '' : 'hidden'} mt-5 space-y-4 border-t border-white/10 pt-5`}>
                <div className="text-sm font-semibold text-[#c5d0df]">Audio defaults</div>
                {volume('master', 'Master volume')}
                {volume('train', 'Train volume')}
                {volume('ambient', 'Ambient noise volume')}
                {volume('music', 'Background music volume')}
                {graphicsToggle('soundsEnabled', 'Train sounds', 'Train, station, tool, and crossing audio')}
              </div>

              <div className={`${settingsTab === 'graphics' ? '' : 'hidden'} mt-6 space-y-4 border-t border-white/10 pt-5`}>
                <div>
                  <div className="text-sm font-semibold text-[#c5d0df]">Default environment</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {TIME_OPTIONS.map((option) => (
                      <button key={option.value} type="button" onClick={() => updateGraphics({ timeOfDay: option.value })} className={`rounded-xl border p-2 text-sm font-semibold transition ${globalGraphics.timeOfDay === option.value ? 'border-[#e5a94f] bg-[#244b67] text-white' : 'border-white/10 bg-[#18263b] text-[#aebbd0] hover:border-[#63c9dc]'}`} style={{ borderLeftColor: option.color, borderLeftWidth: 4 }}>
                        <span className="inline-flex items-center gap-1"><img src={UI_ICONS.environment[option.value]} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#18263b] p-3 text-sm font-semibold text-[#c5d0df]">
                  Fog
                  <input type="checkbox" checked={globalGraphics.fogEnabled} onChange={(event) => updateGraphics({ fogEnabled: event.target.checked })} className="h-5 w-5 accent-[#4b8dff]" />
                </label>
                {globalGraphics.fogEnabled && (
                  <label className="block text-sm font-semibold text-[#c5d0df]">
                    Fog density <span className="float-right font-mono text-xs text-[#aebbd0]">{((globalGraphics.fogDensity ?? 0.012) * 100).toFixed(0)}%</span>
                    <input type="range" min="0.005" max="0.035" step="0.001" value={globalGraphics.fogDensity ?? 0.012} onChange={(event) => updateGraphics({ fogDensity: Number(event.target.value) })} className="mt-2 w-full accent-[#4b8dff]" />
                  </label>
                )}

                <div>
                  <div className="text-sm font-semibold text-[#c5d0df]">Realtime shadows</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {SHADOW_OPTIONS.map((option) => (
                      <button key={option.value} type="button" onClick={() => updateGraphics({ shadowMode: option.value })} className={`rounded-xl border p-2 text-sm font-semibold transition ${globalGraphics.shadowMode === option.value ? 'border-[#e5a94f] bg-[#244b67] text-white' : 'border-white/10 bg-[#18263b] text-[#aebbd0] hover:border-[#63c9dc]'}`}>
                        <span className="inline-flex items-center gap-1"><img src={UI_ICONS.environment[option.icon]} alt="" aria-hidden="true" className="h-5 w-5 object-contain" />{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {graphicsToggle('tiltShiftEnabled', 'Miniature mode', 'Tilt-shift depth blur')}
                {graphicsToggle('celShadingEnabled', 'Cel shading', 'Toon-style color bands and edges')}
                {graphicsToggle('ambientEnabled', 'Ambient activity', 'Grass, pedestrians, and station life')}
                {graphicsToggle('trafficEnabled', 'Road traffic', 'Cars, carts, bikes, and walkers')}
                {graphicsToggle('signalsEnabled', 'Signals and crossings', 'Rail signals and road crossings')}
              </div>
              <div className={`${settingsTab === 'accessibility' ? '' : 'hidden'} mt-6 space-y-4 border-t border-white/10 pt-5`}>
                <div>
                  <div className="text-sm font-semibold text-[#c5d0df]">Interface scale</div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[0.9, 1, 1.15].map((value) => (
                      <button key={value} type="button" onClick={() => onAccessibilityChange({ uiScale: value })} className={`rounded-xl border p-2 text-sm font-semibold ${accessibility.uiScale === value ? 'border-[#e5a94f] bg-[#244b67] text-white' : 'border-white/10 bg-[#18263b] text-[#aebbd0] hover:border-[#63c9dc]'}`}>
                        {value === 0.9 ? 'Compact' : value === 1 ? 'Default' : 'Large'}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#18263b] p-3 text-sm font-semibold text-[#c5d0df]">
                  High contrast
                  <input type="checkbox" checked={accessibility.highContrast} onChange={(event) => onAccessibilityChange({ highContrast: event.target.checked })} className="h-5 w-5 accent-[#4b8dff]" />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-[#18263b] p-3 text-sm font-semibold text-[#c5d0df]">
                  Reduced motion
                  <input type="checkbox" checked={accessibility.reducedMotion} onChange={(event) => onAccessibilityChange({ reducedMotion: event.target.checked })} className="h-5 w-5 accent-[#4b8dff]" />
                </label>
                <div>
                  <div className="text-sm font-semibold text-[#c5d0df]">Text size</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {['normal', 'large'].map((value) => (
                      <button key={value} type="button" onClick={() => onAccessibilityChange({ textSize: value })} className={`rounded-xl border p-2 text-sm font-semibold capitalize ${accessibility.textSize === value ? 'border-[#e5a94f] bg-[#244b67] text-white' : 'border-white/10 bg-[#18263b] text-[#aebbd0] hover:border-[#63c9dc]'}`}>{value}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className={`${settingsTab === 'developer' ? '' : 'hidden'} mt-6 space-y-4 border-t border-white/10 pt-5`}>
                <div className="text-sm font-semibold text-[#c5d0df]">Developer tools</div>
                <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#18263b] p-3">
                  <span>
                    <span className="block text-sm font-semibold text-[#c5d0df]">Debug info window</span>
                    <span className="mt-0.5 block text-xs text-[#aebbd0]">Show FPS, WebGL, world, and interaction values in gameplay.</span>
                  </span>
                  <input type="checkbox" checked={showDebug} onChange={(event) => onToggleDebug(event.target.checked)} className="h-5 w-5 shrink-0 accent-[#e5a94f]" />
                </label>
                <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#18263b] p-3">
                  <span>
                    <span className="block text-sm font-semibold text-[#c5d0df]">Axis gizmo</span>
                    <span className="mt-0.5 block text-xs text-[#aebbd0]">Show the world orientation helper during gameplay.</span>
                  </span>
                  <input type="checkbox" checked={showAxes} onChange={(event) => onToggleAxes(event.target.checked)} className="h-5 w-5 shrink-0 accent-[#4b8dff]" />
                </label>
                <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#18263b] p-3">
                  <span>
                    <span className="block text-sm font-semibold text-[#c5d0df]">Technical selection details</span>
                    <span className="mt-0.5 block text-xs text-[#aebbd0]">Show IDs, route measurements, and manager-level values when inspecting objects.</span>
                  </span>
                  <input type="checkbox" checked={showTechnicalInfo} onChange={(event) => onToggleTechnicalInfo(event.target.checked)} className="h-5 w-5 shrink-0 accent-[#4b8dff]" />
                </label>
                <div>
                  <div className="text-sm font-semibold text-[#c5d0df]">Overlay detail</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {['compact', 'full'].map((value) => (
                      <button key={value} type="button" onClick={() => onDebugDetailChange(value)} className={`rounded-xl border p-2 text-sm font-semibold capitalize ${debugDetail === value ? 'border-[#e5a94f] bg-[#244b67] text-white' : 'border-white/10 bg-[#18263b] text-[#aebbd0] hover:border-[#63c9dc]'}`}>{value}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#c5d0df]">Overlay position</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {[
                      ['top-left', 'Top left'],
                      ['top-right', 'Top right'],
                      ['bottom-left', 'Bottom left'],
                      ['bottom-right', 'Bottom right'],
                    ].map(([value, label]) => (
                      <button key={value} type="button" onClick={() => onDebugPositionChange(value)} className={`rounded-xl border p-2 text-sm font-semibold ${debugPosition === value ? 'border-[#e5a94f] bg-[#244b67] text-white' : 'border-white/10 bg-[#18263b] text-[#aebbd0] hover:border-[#63c9dc]'}`}>{label}</button>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={onCopyDiagnostics} className="min-h-11 w-full rounded-xl bg-[#22344b] px-4 py-2 text-sm font-semibold text-[#f7f0df] hover:border-[#63c9dc] hover:bg-[#2d4662]">Copy diagnostics</button>
                <p className="text-xs leading-5 text-[#aebbd0]">Press F9 during gameplay to show or hide the overlay, or use the pause menu. Diagnostics stay local and never enter world saves.</p>
              </div>
              </div>
            </div>
          </section>
        )}
      </div>

      {showNewWorld && <NewWorldDialog onClose={() => setShowNewWorld(false)} onCreate={onCreateWorld} />}
      {renameTarget && <RenameDialog world={renameTarget} onClose={() => setRenameTarget(null)} onRename={(name) => { onRenameWorld(renameTarget.id, name); setRenameTarget(null); }} />}
      {deleteTarget && <DeleteDialog world={deleteTarget} onClose={() => setDeleteTarget(null)} onDelete={() => { onDeleteWorld(deleteTarget.id); setDeleteTarget(null); }} />}
    </main>
  );
}
