// Real-time reactive DoF state for live tuning and gameplay
const STORAGE_KEY = 'mytrainworld_dof_settings';

const defaultDof = {
  mode: 'screen',
  focusDistance: 18.0,
  focalRange: 11.5,    // In-focus window size (from user calibration)
  maxBlur: 4.2,        // Max bokeh blur radius (from user calibration)
  autoTrack: true,
  autoTrackScale: 0.78,
  tiltFocusY: 0.61,    // Vertical focus center (from user calibration)
  showTuner: false,    // Hidden by default; toggleable in Developer settings
};

function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultDof, ...JSON.parse(raw) };
  } catch (e) {
    // Ignore error
  }
  return { ...defaultDof };
}

export const dofState = loadSaved();
const listeners = new Set();

export function subscribeDof(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function updateDof(partial) {
  Object.assign(dofState, partial);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dofState));
  } catch (e) {
    // Ignore error
  }
  listeners.forEach((cb) => cb(dofState));
}
