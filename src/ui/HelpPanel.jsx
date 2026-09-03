import { useEffect, useRef, useState } from 'react';

const PAGES = [
  {
    label: 'Build',
    title: 'Build your railway',
    sections: [
      ['Build tools', [
        <><strong>1</strong> Hand</>,
        <><strong>2</strong> Tracks → Straight, Curved, or Ramp</>,
        <><strong>3</strong> Road places axis-aligned road segments</>,
        <><strong>4</strong> Trains → Engine or Coach</>,
        <><strong>5</strong> Station places a two-marker platform</>,
        <><strong>6</strong> Delete removes the selected entity</>,
      ]],
      ['Placement', [
        <><strong>R</strong> rotate tracks, roads, or station direction</>,
        <><strong>Q / E</strong> change bridge height</>,
        <><strong>X</strong> reset bridge height</>,
        <>Green preview means the placement is valid</>,
        <>Click to place; move the pointer to preview another cell</>,
      ]],
    ],
    note: 'Tracks connect automatically when nearby endpoints match. Stations bind to tracks running beside their platform.',
  },
  {
    label: 'Trains',
    title: 'Run and manage trains',
    sections: [
      ['Train workflow', [
        <>Select the Train tool and click a track</>,
        <>Choose an engine type from the engine picker</>,
        <>Select the Coach tool and click an engine to add coaches</>,
        <>Select an engine with Hand to open train actions</>,
        <>Use Start/Stop to control movement</>,
        <>Use Reverse to change direction</>,
      ]],
      ['Train actions', [
        <>Focus moves the camera to the train</>,
        <>Follow keeps the camera with the train</>,
        <>Train management opens live drawer from HUD or Pause</>,
        <>Each train has its own target speed (0.10–1.50)</>,
        <>Remove coach acts on one coach without deleting the engine</>,
      ]],
    ],
    note: 'Trains traverse connected track graphs. A train with coaches stays together as one consist.',
  },
  {
    label: 'World',
    title: 'Worlds, camera, and settings',
    sections: [
      ['Camera and pause', [
        <><strong>W / A / S / D</strong> move the camera relative to its view</>,
        <><strong>Arrow keys</strong> rotate the camera in place</>,
        <>LMB drag orbits around the focus point</>,
        <>RMB drag pans the view</>,
        <>Wheel zooms in and out</>,
        <><strong>Esc</strong> opens pause, then resumes</>,
        <>Reset overview restores the map view</>,
        <>Frame railway centers the active network</>,
      ]],
      ['World management', [
        <>Worlds stores named local worlds</>,
        <>Duplicate creates a separate copy</>,
        <>Export downloads a .world file</>,
        <>Import adds a file as a new world</>,
        <>Save locally updates the current world</>,
        <>Recover autosave restores the latest recovery snapshot</>,
      ]],
    ],
    note: 'Graphics and audio settings are saved globally or inside the current world as appropriate. Developer diagnostics never enter world saves.',
  },
  {
    label: 'Advanced',
    title: 'Advanced controls',
    sections: [
      ['Keyboard', [
        <><strong>Ctrl/Cmd+Z</strong> undo</>,
        <><strong>Ctrl/Cmd+Y</strong> redo</>,
        <><strong>Ctrl/Cmd+Shift+Z</strong> redo</>,
        <><strong>F9</strong> show or hide diagnostics when enabled</>,
        <>Use the pause menu button when browser function keys intercept input</>,
      ]],
      ['Inspection', [
        <>Object selection shows practical information by default</>,
        <>Enable Technical selection details in Developer settings for IDs and route measurements</>,
        <>Diagnostics supports compact/full detail and four screen positions</>,
        <>Copy diagnostics creates a local text report for troubleshooting</>,
      ]],
    ],
    note: 'Keep technical details disabled during normal play for a cleaner view.',
  },
];

export default function HelpPanel({ onClose, onReplayTutorial }) {
  const closeRef = useRef(null);
  const [page, setPage] = useState(0);
  const current = PAGES[page];

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto bg-[#08101c]/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <div className="scrollbar-none max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#101a2b] p-5 text-[#f7f0df] shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#63c9dc]">Field guide · {page + 1}/{PAGES.length}</div>
            <h2 id="help-title" className="mt-1 text-2xl font-bold">{current.title}</h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close help" className="min-h-11 min-w-11 rounded-xl bg-white/10 text-2xl leading-none hover:bg-white/20">×</button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PAGES.map((item, index) => <button key={item.label} type="button" onClick={() => setPage(index)} aria-pressed={page === index} className={`min-h-10 rounded-xl px-2 py-2 text-xs font-semibold sm:text-sm ${page === index ? 'bg-[#244b67] text-white ring-1 ring-[#e5a94f]' : 'bg-[#18263b] text-[#aebbd0] hover:text-white'}`}>{item.label}</button>)}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {current.sections.map(([title, items]) => (
            <section key={title} className="rounded-2xl border border-white/10 bg-[#18263b] p-4">
              <h3 className="font-semibold text-[#e5a94f]">{title}</h3>
              <ul className="mt-3 space-y-2 text-sm text-[#c5d0df]">{items.map((item, index) => <li key={index}>{item}</li>)}</ul>
            </section>
          ))}
        </div>
        <p className="mt-5 text-sm leading-6 text-[#aebbd0]">{current.note}</p>

        {onReplayTutorial && <button type="button" onClick={onReplayTutorial} className="mt-5 min-h-11 w-full rounded-xl border border-[#63c9dc]/40 bg-[#18384a] px-4 py-2 text-sm font-semibold text-[#d9f7ff] hover:bg-[#20536a]">Replay tutorial</button>}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => setPage((value) => Math.max(0, value - 1))} disabled={page === 0} className="min-h-12 flex-1 rounded-xl border border-white/10 bg-[#18263b] px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
          {page < PAGES.length - 1 ? <button type="button" onClick={() => setPage((value) => Math.min(PAGES.length - 1, value + 1))} className="min-h-12 flex-1 rounded-xl bg-[#4b8dff] px-4 py-3 font-semibold text-white hover:bg-[#387be8]">Next</button> : <button type="button" onClick={onClose} className="min-h-12 flex-1 rounded-xl bg-[#4b8dff] px-4 py-3 font-semibold text-white hover:bg-[#387be8]">Back to railway</button>}
        </div>
      </div>
    </div>
  );
}
