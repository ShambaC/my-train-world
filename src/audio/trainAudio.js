/**
 * Runtime audio: Opus SFX, ambient beds, and random background music.
 * AudioContext stays lazy until user interaction satisfies autoplay rules.
 */

const SFX_URLS = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/audio/sfxs_opus/*.opus', { eager: true, query: '?url', import: 'default' }))
    .map(([path, url]) => [path.split('/').pop().replace(/\.opus$/, ''), url])
);
const BGM_URLS = Object.fromEntries(
  Object.entries(import.meta.glob('../assets/audio/bgm_opus/*.opus', { eager: true, query: '?url', import: 'default' }))
    .map(([path, url]) => [path.split('/').pop().replace(/\.opus$/, ''), url])
);

const ENGINE_SOUNDS = {
  'steam-engine': ['train_steam_engine_idle_loop', 'train_steam_engine_moving_loop'],
  'diesel-engine': ['train_diesel_engine_idle_loop', 'train_diesel_engine_moving_loop'],
  'electric-engine': ['train_electric_engine_idle_loop', 'train_electric_engine_moving_loop'],
  'checker-engine': ['train_checker_engine_idle_loop', 'train_checker_engine_moving_loop'],
};

const ENGINE_HORNS = {
  'steam-engine': 'train_steam_whistle',
  'diesel-engine': 'train_diesel_horn',
  'electric-engine': 'train_electric_horn',
  'checker-engine': 'train_checker_horn',
};

const BIOME = { water: 0, meadow: 1, forest: 2, highland: 3, wetland: 4 };
const VOXEL_SIZE = 0.5;
const MAX_AUDIO_DISTANCE = 45;
const LOOP_FADE = 0.18;

function setAudioParam(param, value) {
  if (param) param.value = value;
}

class TrainAudio {
  constructor() {
    this.ctx = null;
    this.userActivated = false;
    this.trainEnabled = true;
    this.ambientEnabled = true;
    this.musicEnabled = true;
    this.volumes = { master: 1, train: 1, ambient: 1, music: 0.6 };
    this.buses = {};
    this.buffers = new Map();
    this.loading = new Map();
    this.loops = new Map();
    this.trainStates = new Map();
    this.musicWanted = false;
    this.musicSource = null;
    this.musicGain = null;
    this.musicLoading = false;
    this.musicKey = null;
    this.musicTimer = null;
    this.ambientSignature = '';
    this.nextAmbientEvent = 0;

    if (typeof window !== 'undefined') {
      const activate = () => {
        this.userActivated = true;
        this.resume();
        this.startMusic();
      };
      window.addEventListener('pointerdown', activate, { capture: true });
      window.addEventListener('keydown', activate, { capture: true });
    }
  }

  setEnabled(on) {
    this.setTrainEnabled(on);
  }

  setTrainEnabled(on) {
    this.trainEnabled = on;
    if (!on) this.stopLoopsByPrefix('train:');
  }

  setAmbientEnabled(on) {
    this.ambientEnabled = on;
    if (!on) {
      this.stopLoopsByPrefix('ambient:');
      this.ambientSignature = '';
    }
  }

  setMusicEnabled(on) {
    this.musicEnabled = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  setVolumes(volumes) {
    for (const key of ['master', 'train', 'ambient', 'music']) {
      if (volumes[key] !== undefined) this.volumes[key] = volumes[key];
    }
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [key, gain] of Object.entries(this.buses)) {
      if (!gain?.gain) continue;
      const value = key === 'master' ? this.volumes.master :
        key === 'train' ? this.volumes.train :
          key === 'ambient' ? this.volumes.ambient :
            key === 'music' ? this.volumes.music * 0.5 : 1;
      gain.gain.setTargetAtTime(value, t, 0.05);
    }
  }

  resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  ensure() {
    if (!this.userActivated || typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        const master = this.ctx.createGain();
        master.connect(this.ctx.destination);
        const train = this.makeBus(master);
        const ambient = this.makeBus(master);
        const music = this.makeBus(master);
        this.buses = {
          master,
          train,
          ambient,
          music,
          tools: this.makeBus(train),
          station: this.makeBus(train),
          crossing: this.makeBus(train),
        };
        this.applyVolumes();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  makeBus(parent) {
    const gain = this.ctx.createGain();
    gain.connect(parent);
    return gain;
  }

  busEnabled(bus) {
    if (bus === 'ambient') return this.ambientEnabled;
    if (bus === 'music') return this.musicEnabled;
    return this.trainEnabled;
  }

  async loadBuffer(key) {
    if (this.buffers.has(key)) return this.buffers.get(key);
    if (this.loading.has(key)) return this.loading.get(key);
    const url = SFX_URLS[key] || BGM_URLS[key];
    if (!url || !this.ctx) return null;
    const request = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Audio request failed: ${key}`);
        return response.arrayBuffer();
      })
      .then((data) => this.ctx.decodeAudioData(data))
      .then((buffer) => {
        this.buffers.set(key, buffer);
        this.loading.delete(key);
        return buffer;
      })
      .catch((error) => {
        this.loading.delete(key);
        console.warn(`Audio load failed: ${key}`, error);
        return null;
      });
    this.loading.set(key, request);
    return request;
  }

  makeOutput(bus, gainValue, position) {
    const gain = this.ctx.createGain();
    gain.gain.value = gainValue;
    const busGain = this.buses[bus] || this.buses.train;
    if (position) {
      const panner = this.ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 4;
      panner.maxDistance = MAX_AUDIO_DISTANCE;
      panner.rolloffFactor = 1.4;
      this.setPannerPosition(panner, position);
      gain.connect(panner);
      panner.connect(busGain);
      return { gain, panner };
    }
    gain.connect(busGain);
    return { gain, panner: null };
  }

  setPannerPosition(panner, position) {
    if (!panner || !position) return;
    const t = this.ctx.currentTime;
    setAudioParam(panner.positionX, position.x);
    setAudioParam(panner.positionY, position.y || 0);
    setAudioParam(panner.positionZ, position.z);
    if (panner.positionX?.setValueAtTime) {
      panner.positionX.setValueAtTime(position.x, t);
      panner.positionY.setValueAtTime(position.y || 0, t);
      panner.positionZ.setValueAtTime(position.z, t);
    }
  }

  play(key, { bus = 'train', gain = 1, position = null, rate = 1, detune = 0, offset = 0 } = {}) {
    const ctx = this.ensure();
    if (!ctx || !this.busEnabled(bus)) return Promise.resolve(false);
    return this.loadBuffer(key).then((buffer) => {
      if (!buffer || !this.busEnabled(bus)) return false;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      source.detune.value = detune;
      const output = this.makeOutput(bus, gain, position);
      source.connect(output.gain);
      source.start(0, Math.min(Math.max(offset, 0), Math.max(0, buffer.duration - 0.01)));
      return true;
    });
  }

  startLoop(id, key, { bus = 'train', gain = 1, position = null, rate = 1 } = {}) {
    if (!this.busEnabled(bus) || this.loops.has(id)) {
      const current = this.loops.get(id);
      if (current?.key === key) return;
      if (current) this.stopLoop(id);
      if (!this.busEnabled(bus)) return;
    }
    const ctx = this.ensure();
    if (!ctx) return;
    const entry = { id, key, bus, gain, position, rate, source: null, output: null };
    this.loops.set(id, entry);
    this.loadBuffer(key).then((buffer) => {
      if (!buffer || this.loops.get(id) !== entry || !this.busEnabled(bus)) return;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = rate;
      const output = this.makeOutput(bus, 0.0001, position);
      source.connect(output.gain);
      entry.source = source;
      entry.output = output;
      source.start(0, Math.random() * Math.max(0, buffer.duration - 0.05));
      output.gain.gain.setTargetAtTime(gain, ctx.currentTime, LOOP_FADE);
    });
  }

  stopLoop(id) {
    const entry = this.loops.get(id);
    if (!entry) return;
    this.loops.delete(id);
    if (entry.output?.gain?.gain && this.ctx) {
      const t = this.ctx.currentTime;
      entry.output.gain.gain.cancelScheduledValues(t);
      entry.output.gain.gain.setTargetAtTime(0.0001, t, LOOP_FADE);
      try { entry.source?.stop(t + LOOP_FADE * 4); } catch { /* already stopped */ }
    } else {
      try { entry.source?.stop(); } catch { /* already stopped */ }
    }
  }

  stopLoopsByPrefix(prefix) {
    for (const id of this.loops.keys()) {
      if (id.startsWith(prefix)) this.stopLoop(id);
    }
  }

  updateLoop(id, position, camera) {
    const entry = this.loops.get(id);
    if (!entry) return;
    entry.position = position;
    this.setPannerPosition(entry.output?.panner, position);
  }

  updateListener(camera) {
    if (!this.ctx?.listener || !camera) return;
    const listener = this.ctx.listener;
    const t = this.ctx.currentTime;
    setAudioParam(listener.positionX, camera.position.x);
    setAudioParam(listener.positionY, camera.position.y);
    setAudioParam(listener.positionZ, camera.position.z);
    if (listener.positionX?.setValueAtTime) {
      listener.positionX.setValueAtTime(camera.position.x, t);
      listener.positionY.setValueAtTime(camera.position.y, t);
      listener.positionZ.setValueAtTime(camera.position.z, t);
    }
  }

  updateTrain(train, camera) {
    this.updateListener(camera);
    if (!this.trainEnabled || !this.userActivated) return;
    const previous = this.trainStates.get(train.id);
    if (previous && previous.active !== train.active) {
      if (train.active) {
        this.play('train_brake_release', { gain: 0.25, position: train.position });
        this.play('train_startup', { gain: 0.45, position: train.position });
      } else {
        this.play('train_brake_squeal', { gain: 0.25, position: train.position });
        this.play('train_shutdown', { gain: 0.35, position: train.position });
      }
    }
    this.trainStates.set(train.id, { active: train.active });

    const [idleKey, movingKey] = ENGINE_SOUNDS[train.engineType] || ENGINE_SOUNDS['steam-engine'];
    const moving = train.active && !train.dwell && train.speed > 0.03;
    const engineId = `train:${train.id}:engine`;
    this.startLoop(engineId, moving ? movingKey : idleKey, {
      gain: moving ? 0.42 : 0.25,
      position: train.position,
    });
    this.updateLoop(engineId, train.position, camera);

    const rollingId = `train:${train.id}:rolling`;
    if (moving) {
      this.startLoop(rollingId, 'train_wheel_rail_roll_loop', { gain: 0.2, position: train.position, rate: 0.85 + train.speed * 0.35 });
      this.updateLoop(rollingId, train.position, camera);
      this.startLoop(`train:${train.id}:clack`, 'train_rail_joint_clack_loop', { gain: 0.12, position: train.position, rate: 0.8 + train.speed * 0.45 });
      this.updateLoop(`train:${train.id}:clack`, train.position, camera);
    } else {
      this.stopLoop(rollingId);
      this.stopLoop(`train:${train.id}:clack`);
    }
  }

  removeTrain(trainId) {
    this.trainStates.delete(trainId);
    this.stopLoopsByPrefix(`train:${trainId}:`);
  }

  startCrossing(id, position) {
    this.startLoop(`crossing:${id}`, 'crossing_warning_bell_loop', { bus: 'crossing', gain: 0.34, position });
    this.updateLoop(`crossing:${id}`, position);
  }

  stopCrossing(id) {
    this.stopLoop(`crossing:${id}`);
  }

  startMusic() {
    this.musicWanted = true;
    if (!this.musicEnabled || this.musicSource || this.musicLoading) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const keys = Object.keys(BGM_URLS);
    if (!keys.length) return;
    const choices = keys.filter((key) => key !== this.musicKey);
    const key = choices[Math.floor(Math.random() * choices.length)] || keys[0];
    this.musicKey = key;
    this.musicLoading = true;
    this.loadBuffer(key).then((buffer) => {
      this.musicLoading = false;
      if (!buffer || !this.musicWanted || !this.musicEnabled || this.musicSource) return;
      const source = ctx.createBufferSource();
      const output = ctx.createGain();
      source.buffer = buffer;
      source.connect(output);
      output.connect(this.buses.music);
      output.gain.setValueAtTime(0.0001, ctx.currentTime);
      output.gain.linearRampToValueAtTime(0.65, ctx.currentTime + 0.8);
      this.musicSource = source;
      this.musicGain = output;
      source.onended = () => {
        if (this.musicSource !== source) return;
        this.musicSource = null;
        this.musicGain = null;
        this.startMusic();
      };
      source.start();
    });
  }

  stopMusic() {
    this.musicWanted = false;
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this.musicTimer = null;
    if (this.musicGain && this.ctx) {
      const t = this.ctx.currentTime;
      this.musicGain.gain.cancelScheduledValues(t);
      this.musicGain.gain.setTargetAtTime(0.0001, t, 0.2);
    }
    try { this.musicSource?.stop(this.ctx ? this.ctx.currentTime + 0.8 : undefined); } catch { /* already stopped */ }
    this.musicSource = null;
    this.musicGain = null;
    this.musicLoading = false;
  }

  updateAmbient(camera, terrainData, timeOfDay) {
    this.updateListener(camera);
    if (!this.ambientEnabled || !this.userActivated || !camera || !terrainData) return;
    const x = Math.max(0, Math.min(terrainData.length - 1, Math.floor(camera.position.x / VOXEL_SIZE + terrainData.length / 2)));
    const z = Math.max(0, Math.min(terrainData.breadth - 1, Math.floor(camera.position.z / VOXEL_SIZE + terrainData.breadth / 2)));
    const biome = terrainData.biomeMask?.[x * terrainData.breadth + z] ?? BIOME.meadow;
    const desired = new Set(['ambient:wind']);
    if (timeOfDay !== 'night' && biome !== BIOME.highland) desired.add('ambient:birds');
    if (biome === BIOME.forest) desired.add('ambient:forest');
    if (biome === BIOME.water || biome === BIOME.wetland) desired.add('ambient:water');
    const signature = [...desired].sort().join('|');
    if (signature !== this.ambientSignature) {
      for (const id of this.loops.keys()) {
        if (id.startsWith('ambient:') && !desired.has(id)) this.stopLoop(id);
      }
      const keys = {
        'ambient:wind': ['ambient_wind_loop', 0.22],
        'ambient:birds': ['ambient_birds_loop', 0.1],
        'ambient:forest': ['ambient_forest_loop', 0.13],
        'ambient:water': ['ambient_water_loop', 0.15],
      };
      for (const id of desired) {
        const [key, gain] = keys[id];
        this.startLoop(id, key, { bus: 'ambient', gain });
      }
      this.ambientSignature = signature;
    }
    const now = performance.now();
    if (now >= this.nextAmbientEvent) {
      const key = Math.random() < 0.55 ? 'ambient_distant_train' : 'ambient_distant_traffic';
      this.play(key, { bus: 'ambient', gain: 0.12 });
      this.nextAmbientEvent = now + 18000 + Math.random() * 22000;
    }
  }

  stopAmbient() {
    this.stopLoopsByPrefix('ambient:');
    this.ambientSignature = '';
  }

  whistle(engineType = 'steam-engine', position = null) {
    this.play(ENGINE_HORNS[engineType] || ENGINE_HORNS['steam-engine'], { bus: 'station', gain: 0.7, position });
  }

  bell(position = null) {
    this.play('station_departure_bell', { bus: 'station', gain: 0.65, position });
  }

  crossingWarning(position = null) {
    this.play('crossing_warning_horn', { bus: 'crossing', gain: 0.7, position });
  }

  gateMotor(direction = 'lower', position = null) {
    this.play(direction === 'raise' ? 'crossing_gate_raise' : 'crossing_gate_lower', { bus: 'crossing', gain: 0.5, position });
  }

  gateStop(position = null) {
    this.play('crossing_gate_mechanical_stop', { bus: 'crossing', gain: 0.35, position });
  }

  trackPlaced(type) {
    this.play(type === 'curved' ? 'tool_curved_track_place' : type === 'ramp' ? 'tool_bridge_ramp_place' : 'tool_track_place', { bus: 'tools', gain: 0.6 });
  }

  roadPlaced() { this.play('tool_road_place', { bus: 'tools', gain: 0.55 }); }
  roadDeleted() { this.play('tool_road_delete', { bus: 'tools', gain: 0.55 }); }
  stationPlaced() { this.play('tool_station_place', { bus: 'tools', gain: 0.55 }); }
  trainPlaced() { this.play('tool_train_place', { bus: 'tools', gain: 0.55 }); }
  coachAttached() {
    this.play('tool_coach_attach', { bus: 'tools', gain: 0.55 });
    this.play('train_coach_coupling', { bus: 'train', gain: 0.45 });
  }
  coachRemoved() {
    this.play('tool_coach_remove', { bus: 'tools', gain: 0.55 });
    this.play('train_coach_uncoupling', { bus: 'train', gain: 0.45 });
  }
  invalid() { this.play('tool_invalid_action', { bus: 'tools', gain: 0.4 }); }
  undo() { this.play('tool_undo', { bus: 'tools', gain: 0.35 }); }
  redo() { this.play('tool_redo', { bus: 'tools', gain: 0.35 }); }

  deleted(kind) {
    if (kind === 'road') return this.roadDeleted();
    this.play('tool_track_delete', { bus: 'tools', gain: 0.5 });
  }

  passengerBoarded(position = null) { this.play('station_passenger_board', { bus: 'station', gain: 0.25, position }); }
  passengerUnloaded(position = null) { this.play('station_passenger_unload', { bus: 'station', gain: 0.25, position }); }
  cargoLoaded(position = null) { this.play('station_cargo_load', { bus: 'station', gain: 0.3, position }); }
  cargoUnloaded(position = null) { this.play('station_cargo_unload', { bus: 'station', gain: 0.3, position }); }
  stationArrival(engineType = 'steam-engine', position = null) {
    this.whistle(engineType, position);
    this.play('station_arrival_bell', { bus: 'station', gain: 0.45, position });
  }
}

export const trainAudio = new TrainAudio();
