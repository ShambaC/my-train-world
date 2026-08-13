/**
 * Small persisted settings store (localStorage).
 * Used for render preferences that must survive reloads without touching
 * world state: frame limit, vsync mode.
 */
const SETTINGS_KEY = 'mytrainworld.settings.v1';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveSettings(patch) {
  try {
    const merged = { ...loadSettings(), ...patch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch {
    // Storage unavailable (private mode etc.) — settings just don't persist.
  }
}
