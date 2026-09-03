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
const LIBRARY_KEY = 'mytrainworld.library.v1';
const LAST_WORLD_KEY = 'mytrainworld.world.last';
const WORLD_KEY_PREFIX = 'mytrainworld.world.';
const LIBRARY_VERSION = 1;
const WORLD_RECORD_VERSION = 1;

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

function removeKey(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable — caller already handles the failed operation.
  }
}

function worldKey(id) {
  return `${WORLD_KEY_PREFIX}${id}.v${WORLD_RECORD_VERSION}`;
}

function cloneJSON(data) {
  return data == null ? data : JSON.parse(JSON.stringify(data));
}

function makeWorldId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `world-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function cleanWorldName(name) {
  const value = String(name ?? '').trim().replace(/\s+/g, ' ').slice(0, 64);
  return value || 'New Railway';
}

function emptyLibrary() {
  return { version: LIBRARY_VERSION, worlds: [] };
}

function readLibrary() {
  const library = readJSON(LIBRARY_KEY);
  if (!library || library.version !== LIBRARY_VERSION || !Array.isArray(library.worlds)) {
    return emptyLibrary();
  }
  return {
    version: LIBRARY_VERSION,
    worlds: library.worlds.filter((world) => world && typeof world.id === 'string'),
  };
}

function snapshotCounts(snapshot) {
  return {
    tracks: Array.isArray(snapshot?.tracks?.tracks) ? snapshot.tracks.tracks.length : 0,
    stations: Array.isArray(snapshot?.stations?.stations) ? snapshot.stations.stations.length : 0,
    trains: Array.isArray(snapshot?.trains?.trains) ? snapshot.trains.trains.length : 0,
    roads: Array.isArray(snapshot?.roads?.userRoads) ? snapshot.roads.userRoads.length : 0,
  };
}

function recordMeta({ id, name, snapshot, thumbnail, source, createdAt, updatedAt, lastPlayedAt }) {
  return {
    id,
    name: cleanWorldName(name),
    createdAt,
    updatedAt,
    lastPlayedAt: lastPlayedAt ?? updatedAt,
    terrain: {
      length: snapshot?.terrain?.length ?? 0,
      breadth: snapshot?.terrain?.breadth ?? 0,
      seed: snapshot?.terrain?.seed ?? 0,
    },
    counts: snapshotCounts(snapshot),
    thumbnail: typeof thumbnail === 'string' ? thumbnail : null,
    source: source || 'local',
  };
}

function recordFromStorage(id) {
  const raw = readJSON(worldKey(id));
  return migrateWorldRecord(raw);
}

function writeRecord(record) {
  return writeJSON(worldKey(record.meta.id), record);
}

function updateLibraryMeta(library, record) {
  const summary = { ...record.meta };
  const index = library.worlds.findIndex((world) => world.id === record.meta.id);
  if (index < 0) library.worlds.push(summary);
  else library.worlds[index] = summary;
  return library;
}

function snapshotForRecord(worldPayload) {
  if (worldPayload?.version === SAVE_VERSION && worldPayload.terrain) {
    return cloneJSON(worldPayload);
  }
  return captureWorld(worldPayload);
}

/**
 * Normalize and validate one library record. Returns null for unsupported or
 * corrupt data so callers never expose malformed storage to UI code.
 */
export function migrateWorldRecord(record) {
  if (!record || record.version !== WORLD_RECORD_VERSION || !record.snapshot) return null;
  if (record.snapshot.version !== SAVE_VERSION) return null;
  if (!record.meta || typeof record.meta.id !== 'string') return null;

  const now = Date.now();
  const snapshot = cloneJSON(record.snapshot);
  const meta = recordMeta({
    ...record.meta,
    snapshot,
    name: record.meta.name,
    thumbnail: record.meta.thumbnail,
    source: record.meta.source,
    createdAt: record.meta.createdAt || now,
    updatedAt: record.meta.updatedAt || now,
    lastPlayedAt: record.meta.lastPlayedAt || record.meta.updatedAt || now,
  });
  return { version: WORLD_RECORD_VERSION, meta, snapshot };
}

export function getStorageStatus() {
  const probeKey = `${LIBRARY_KEY}.probe`;
  try {
    localStorage.setItem(probeKey, '1');
    localStorage.removeItem(probeKey);
    return { available: true, reason: null };
  } catch (error) {
    return { available: false, reason: error?.name || 'storage-unavailable' };
  }
}

export function listWorlds() {
  const library = readLibrary();
  const worlds = library.worlds
    .map((summary) => recordFromStorage(summary.id)?.meta ?? null)
    .filter(Boolean)
    .sort((a, b) => (b.lastPlayedAt || 0) - (a.lastPlayedAt || 0));
  return worlds;
}

export function getWorldMeta(id) {
  return recordFromStorage(id)?.meta ?? null;
}

export function getWorld(id) {
  return recordFromStorage(id);
}

export function getLastWorldId() {
  try {
    return localStorage.getItem(LAST_WORLD_KEY);
  } catch {
    return null;
  }
}

export function setLastWorldId(id) {
  if (!id) {
    removeKey(LAST_WORLD_KEY);
    return true;
  }
  try {
    localStorage.setItem(LAST_WORLD_KEY, id);
    return true;
  } catch {
    return false;
  }
}

export function createWorldRecord({ name = 'New Railway', snapshot, thumbnail = null, source = 'local' }) {
  if (!snapshot || snapshot.version !== SAVE_VERSION) {
    return { ok: false, error: 'invalid-world-snapshot' };
  }

  const now = Date.now();
  const id = makeWorldId();
  const record = {
    version: WORLD_RECORD_VERSION,
    meta: recordMeta({ id, name, snapshot, thumbnail, source, createdAt: now, updatedAt: now }),
    snapshot: cloneJSON(snapshot),
  };
  const library = readLibrary();

  if (!writeRecord(record) || !writeJSON(LIBRARY_KEY, updateLibraryMeta(library, record))) {
    removeKey(worldKey(id));
    return { ok: false, error: 'storage-write-failed' };
  }
  setLastWorldId(id);
  return { ok: true, world: record };
}

export function saveWorldRecord(id, worldPayload, metaPatch = {}) {
  const current = recordFromStorage(id);
  if (!current) return { ok: false, error: 'world-not-found' };

  const snapshot = snapshotForRecord(worldPayload);
  const now = Date.now();
  const record = {
    version: WORLD_RECORD_VERSION,
    meta: recordMeta({
      ...current.meta,
      ...metaPatch,
      id,
      name: metaPatch.name ?? current.meta.name,
      thumbnail: metaPatch.thumbnail ?? current.meta.thumbnail,
      source: metaPatch.source ?? current.meta.source,
      snapshot,
      createdAt: current.meta.createdAt,
      updatedAt: now,
      lastPlayedAt: metaPatch.lastPlayedAt ?? now,
    }),
    snapshot,
  };
  const library = readLibrary();
  if (!writeRecord(record) || !writeJSON(LIBRARY_KEY, updateLibraryMeta(library, record))) {
    return { ok: false, error: 'storage-write-failed' };
  }
  setLastWorldId(id);
  return { ok: true, world: record };
}

export function updateWorldRecord(id, patch = {}) {
  const current = recordFromStorage(id);
  if (!current) return { ok: false, error: 'world-not-found' };
  const record = {
    ...current,
    meta: recordMeta({
      ...current.meta,
      ...patch,
      id,
      snapshot: current.snapshot,
      name: patch.name ?? current.meta.name,
      thumbnail: patch.thumbnail ?? current.meta.thumbnail,
      source: patch.source ?? current.meta.source,
      createdAt: current.meta.createdAt,
      updatedAt: Date.now(),
      lastPlayedAt: patch.lastPlayedAt ?? current.meta.lastPlayedAt,
    }),
  };
  const library = readLibrary();
  if (!writeRecord(record) || !writeJSON(LIBRARY_KEY, updateLibraryMeta(library, record))) {
    return { ok: false, error: 'storage-write-failed' };
  }
  return { ok: true, world: record };
}

export function renameWorld(id, name) {
  return updateWorldRecord(id, { name: cleanWorldName(name) });
}

export function duplicateWorld(id, name) {
  const source = recordFromStorage(id);
  if (!source) return { ok: false, error: 'world-not-found' };
  return createWorldRecord({
    name: name || `${source.meta.name} Copy`,
    snapshot: source.snapshot,
    thumbnail: source.meta.thumbnail,
    source: 'local',
  });
}

export function deleteWorld(id) {
  const current = recordFromStorage(id);
  if (!current) return { ok: false, error: 'world-not-found' };
  const library = readLibrary();
  library.worlds = library.worlds.filter((world) => world.id !== id);
  if (!writeJSON(LIBRARY_KEY, library)) return { ok: false, error: 'storage-write-failed' };
  removeKey(worldKey(id));
  if (getLastWorldId() === id) setLastWorldId(listWorlds()[0]?.id ?? null);
  return { ok: true };
}

export function importWorldRecord(data, name, thumbnail = null) {
  if (!data || data.version !== SAVE_VERSION) {
    return { ok: false, error: 'unsupported-world-version' };
  }
  return createWorldRecord({ name: name || 'Imported Railway', snapshot: data, thumbnail, source: 'imported' });
}

export function exportWorldRecord(id) {
  const record = recordFromStorage(id);
  if (!record) return { ok: false, error: 'world-not-found' };
  return { ok: true, name: `${record.meta.name}.world`, data: cloneJSON(record.snapshot) };
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
        trackSide: s.trackSide,
        buildingRotation: s.buildingRotation,
        terrainLength: s.terrainLength,
        terrainBreadth: s.terrainBreadth,
      });
      station.id = s.id;
      station.role = s.role;
      station.group = group;
      stationManager.restoreStation(station);
    }
    stationManager?.rebuildBindings?.(trackManager);

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
