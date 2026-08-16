/**
 * World save / load / autosave — persistence for the sandbox.
 *
 * - Explicit Save / Load: real files picked by the user (.world = JSON),
 *   via the File System Access API or download/file-input fallbacks.
 * - RECENT_KEY: debounced autosave after meaningful edits.
 * - FALLBACK_KEY: one older rotated autosave (never erase the last valid
 *   snapshot silently). Quiet localStorage — no dialogs.
 *
 * Loading restores creative state without any network/route validation and
 * never rejects unusual layouts. Signals/crossings are derived from tracks
 * + roads and rebuild themselves, so they are not stored.
 */
import { buildStation } from '../stations/StationBuilder';

const RECENT_KEY = 'mytrainworld.world.recent';
const FALLBACK_KEY = 'mytrainworld.world.fallback';
const SAVE_VERSION = 1;

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJSON(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false; // storage full/unavailable — autosave just skips quietly
  }
}

export function hasRecoverySnapshot() {
  return !!readJSON(RECENT_KEY);
}

export function recoverySnapshotTime() {
  const data = readJSON(RECENT_KEY);
  return data?.savedAt ?? null;
}

/**
 * Capture the whole creative state as plain JSON-safe data.
 * @param {object} p { terrainSize, terrainSeed, trackManager, stationManager,
 *   trainManager, roadManager, env (plain object), camera (plain) }
 */
export function captureWorld({ terrainSize, terrainSeed, trackManager, stationManager, trainManager, roadManager, env, camera }) {
  const trains = trainManager.getAllTrains().map((t) => ({
    id: t.id,
    currentTrackId: t.currentTrackId,
    progress: t.progress,
    speed: t.speed,
    speedMax: t.speedMax,
    heading: { ...t.heading },
    position: { ...t.position },
    rotation: t.rotation,
    bank: t.bank,
    active: t.active,
    engineType: t.engineType || 'steam-engine',
    coaches: (t.coaches || []).map((c) => ({ ...c })),
  }));

  return {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    terrain: { length: terrainSize.length, breadth: terrainSize.breadth, seed: terrainSeed },
    tracks: trackManager.exportData(),
    stations: stationManager.exportData(),
    trains: { trains, nextId: trainManager.nextId, globalSpeed: trainManager.globalSpeed ?? 0.5 },
    roads: roadManager?.exportUserData?.() ?? null,
    env: { ...env },
    camera,
  };
}

/**
 * Apply a captured world to the managers. Station groups are rebuilt from
 * marker data (deterministic), roads are merged back over the natural
 * network, and no validation of any kind runs.
 * @returns {boolean} success
 */
export function applyWorld(data, { trackManager, stationManager, trainManager, roadManager }) {
  if (!data || data.version !== SAVE_VERSION) return false;

  try {
    trackManager.importData(data.tracks);

    stationManager.clear();
    for (const s of data.stations?.stations ?? []) {
      const { station, group } = buildStation({
        startCell: s.startCell,
        endCell: s.endCell,
        dir: s.dir,
        lengthCells: s.lengthCells,
        startHeight: s.startHeight,
        terrainLength: s.terrainLength,
        terrainBreadth: s.terrainBreadth,
      });
      station.id = s.id;
      station.role = s.role;
      station.group = group;
      stationManager.restoreStation(station);
    }

    trainManager.clear();
    trainManager.nextId = data.trains?.nextId ?? 0;
    trainManager.globalSpeed = data.trains?.globalSpeed ?? 0.5;
    for (const t of data.trains?.trains ?? []) {
      trainManager.restoreTrain({
        ...t,
        dwell: null,
        cooldowns: {},
        coaches: (t.coaches || []).map((c) => ({ ...c })),
      });
    }
    trainManager.setGlobalSpeed(trainManager.globalSpeed);

    roadManager?.importUserData?.(data.roads);
    return true;
  } catch (err) {
    console.error('World restore failed:', err);
    return false;
  }
}

/**
 * Save the world to a real file (.world = JSON) picked by the user.
 * Uses the browser File System Access API when available (Chrome/Edge and
 * modern Tauri WebView2); otherwise falls back to a download.
 * Returns { ok: boolean, name?: string }.
 */
export async function saveWorldToFile(world) {
  const json = JSON.stringify(captureWorld(world), null, 2);
  const bytes = new TextEncoder().encode(json);

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'mytrainworld.world',
        types: [{ description: 'MyTrainWorld save', accept: { 'application/json': ['.world'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(bytes);
      await writable.close();
      return { ok: true, name: handle.name };
    } catch (err) {
      if (err?.name === 'AbortError') return { ok: false, cancelled: true };
      // Picker unavailable/blocked — fall through to the download path.
    }
  }

  try {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mytrainworld.world';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return { ok: true, name: a.download };
  } catch {
    return { ok: false };
  }
}

/**
 * Load a world from a user-picked .world file.
 * Uses the File System Access API when available; otherwise a hidden file
 * input. Returns { data } on success, { error } on failure, { cancelled }.
 */
export async function loadWorldFromFile() {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{ description: 'MyTrainWorld save', accept: { 'application/json': ['.world'] } }],
      });
      const file = await handle.getFile();
      return parseWorldFile(file);
    } catch (err) {
      if (err?.name === 'AbortError') return { cancelled: true };
      // Picker unavailable/blocked — fall through to the input path.
    }
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.world,application/json';
    input.style.display = 'none';
    input.onchange = async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return resolve({ cancelled: true });
      resolve(await parseWorldFile(file));
    };
    input.oncancel = () => {
      input.remove();
      resolve({ cancelled: true });
    };
    document.body.appendChild(input);
    input.click();
  });
}

async function parseWorldFile(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || data.version === undefined) return { error: 'Not a MyTrainWorld save file' };
    return { data, name: file.name };
  } catch {
    return { error: 'Could not read file (corrupt or wrong format)' };
  }
}

/**
 * Debounced autosave — writes RECENT and rotates the previous autosave
 * into FALLBACK so one older recovery point always survives.
 */
export function autosaveWorld(world) {
  const snap = captureWorld(world);
  const prev = readJSON(RECENT_KEY);
  if (prev) writeJSON(FALLBACK_KEY, prev);
  return writeJSON(RECENT_KEY, snap);
}

export function loadRecoverySnapshot() {
  return readJSON(RECENT_KEY) ?? readJSON(FALLBACK_KEY);
}

/**
 * Immediate snapshot before destructive operations (terrain regeneration,
 * world clear) — writes both slots so the pre-destruction world is
 * recoverable even if the next autosave would rotate it out.
 */
export function saveSnapshot(world) {
  const snap = captureWorld(world);
  writeJSON(RECENT_KEY, snap);
  writeJSON(FALLBACK_KEY, snap);
}
