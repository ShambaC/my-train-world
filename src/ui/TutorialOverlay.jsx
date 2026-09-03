import { TUTORIAL_COPY, TUTORIAL_STEPS } from '../utils/tutorial.js';

export default function TutorialOverlay({ state, onSkip }) {
  if (!state || state.skipped || state.step === 'complete') return null;
  const copy = TUTORIAL_COPY[state.step];
  if (!copy) return null;
  const progress = TUTORIAL_STEPS.indexOf(state.step) + 1;
  return (
    <section className="pointer-events-none fixed left-1/2 top-[5.4rem] z-30 w-[min(23rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-[#63c9dc]/35 bg-[#101a2b]/92 p-4 text-[#f7f0df] shadow-xl backdrop-blur-md" aria-live="polite" aria-labelledby="tutorial-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#63c9dc]">Tutorial · {progress} / 6</p>
          <h2 id="tutorial-title" className="mt-1 text-lg font-bold">{copy.title}</h2>
        </div>
        <button type="button" onClick={onSkip} className="pointer-events-auto rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold text-[#aebbd0] hover:bg-white/10">Skip Tutorial</button>
      </div>
      <p className="mt-2 text-sm text-[#c5d0df]">{copy.action}</p>
      <p className="mt-2 text-xs text-[#e5a94f]">{copy.hint}</p>
    </section>
  );
}
