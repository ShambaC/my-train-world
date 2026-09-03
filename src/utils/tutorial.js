export const TUTORIAL_STEPS = Object.freeze(['camera', 'track', 'station', 'engine', 'coach', 'road', 'complete']);

export const TUTORIAL_COPY = Object.freeze({
  camera: { title: 'Move camera', action: 'Use WASD, arrows, Space/C, or OrbitControls.', hint: 'Move, orbit, pan, or zoom to continue.' },
  track: { title: 'Place track', action: 'Open Tracks, choose Straight, then click terrain.', hint: 'Press 2 to open Tracks.' },
  station: { title: 'Place station', action: 'Choose Station, place both station markers.', hint: 'Station placement needs two clicks.' },
  engine: { title: 'Place engine', action: 'Open Trains, choose Engine, then click track.', hint: 'Press 4 to open Trains.' },
  coach: { title: 'Add coach', action: 'Choose Coach, click engine, then choose coach type.', hint: 'Coach activates after engine placement.' },
  road: { title: 'Place road', action: 'Choose Road and click terrain.', hint: 'Roads cross rail only at 90°.' },
});

export const initialTutorialState = () => ({ step: 'camera', skipped: false });
export const completedTutorialState = () => ({ step: 'complete', skipped: false });

export function normalizeTutorialState(value) {
  if (!value || !TUTORIAL_STEPS.includes(value.step)) return completedTutorialState();
  return { step: value.step, skipped: value.skipped === true };
}

export function advanceTutorial(state, action) {
  const current = normalizeTutorialState(state);
  if (current.skipped || current.step === 'complete' || current.step !== action) return current;
  const index = TUTORIAL_STEPS.indexOf(current.step);
  return { step: TUTORIAL_STEPS[Math.min(index + 1, TUTORIAL_STEPS.length - 1)], skipped: false };
}

export function skipTutorial(state) {
  return { step: 'complete', skipped: true };
}
