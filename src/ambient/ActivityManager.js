/**
 * Activity Manager — optional ambient passenger and cargo simulation.
 *
 * Visual story only. No money, no demand, no capacity, no timeout, no
 * targets, no failure. People and goods may idle at a station forever if
 * no train ever serves it. Cargo boards coaches whose visual role matches
 * its type, rides along, and unloads at a later station stop.
 */
import { COACH_ROLE } from '../trains/coachTypes';
import { STATION_WIDTH_WORLD } from '../stations/StationBuilder';
import { ROLE_BY_KEY, ROLE_CARGO_BUDGET } from '../stations/stationRoles';
import { trainAudio } from '../audio/trainAudio';

const PLATFORM_HEIGHT = 0.15;
const BOARD_TIME = 1.2;   // fade duration for boarding/arriving/leaving
const MAX_ITEMS = 120;
const SPAWN_INTERVAL_MIN = 4;
const SPAWN_INTERVAL_MAX = 9;
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

export class ActivityManager {
  constructor(stationManager, trainManager) {
    this.stationManager = stationManager;
    this.trainManager = trainManager;
    this.items = new Map();
    this.targets = new Map(); // stationId -> { passenger: n, cargo: {type: n} }
    this.nextId = 0;
    this.time = 0;
    this.spawnTimers = new Map(); // stationId -> next spawn time
    this.dwellState = new Map();  // trainId -> stationId while dwelling
  }

  /**
   * Re-sync item targets after stations changed (added/removed/role).
   * Idle items beyond the new target fade out; deficits refill gradually.
   */
  sync() {
    const alive = new Set();
    for (const station of this.stationManager.getAllStations()) {
      alive.add(station.id);
      const role = ROLE_BY_KEY[station.role] || ROLE_BY_KEY.village;
      const targets = { passenger: randInt(...role.passengers), cargo: {} };
      for (const [type, range] of Object.entries(ROLE_CARGO_BUDGET[station.role] || {})) {
        targets.cargo[type] = randInt(...range);
      }
      this.targets.set(station.id, targets);
    }
    for (const [id, item] of this.items) {
      if (!alive.has(item.stationId) && item.state !== 'riding') {
        this.items.delete(id);
        continue;
      }
      if (item.state === 'riding') {
        if (!alive.has(item.rideStationId) && !this.trainManager.getTrain(item.trainId)) {
          this.items.delete(id);
        }
        continue;
      }
      if (!this.budgetOk(item)) {
        this.markLeaving(item);
      }
    }
  }

  budgetOk(item) {
    const targets = this.targets.get(item.stationId);
    if (!targets) return false;
    if (item.type === 'passenger') return targets.passenger > 0;
    return (targets.cargo[item.type] || 0) > 0;
  }

  /**
   * Obstacle zones in station-local coords (axial, side) — mirrors the
   * StationBuilder layout so walkers never fuse into the building, bench/
   * lamp/bin row, canopies, goods shed or signals.
   */
  stationZones(station) {
    const len = station.lengthCells * 0.5;
    const zones = [{ a: len * 0.5, s: 0, r: 0.9 }]; // station building
    const canopyCells = station.lengthCells >= 22
      ? [3, station.lengthCells - 4]
      : station.lengthCells >= 14
        ? [station.lengthCells - 4]
        : [];
    for (const c of canopyCells) zones.push({ a: c * 0.5 + 0.25, s: 0.35, r: 0.55 });
    if (station.lengthCells >= 20) zones.push({ a: (station.lengthCells - 1) * 0.5 + 0.25, s: 0.4, r: 0.6 });
    zones.push({ a: 0.25, s: 0.4, r: 0.35 });
    zones.push({ a: (station.lengthCells - 1) * 0.5 + 0.25, s: 0.4, r: 0.35 });
    for (let i = 2; i < station.lengthCells - 2; i += 3) {
      zones.push({ a: i * 0.5 + 0.25, s: 0.5, r: 0.38 });
      zones.push({ a: i * 0.5 + 0.25, s: -0.42, r: 0.32 });
    }
    return zones;
  }

  inZone(zones, a, s) {
    for (const z of zones) {
      const da = a - z.a;
      const ds = s - z.s;
      if (da * da + ds * ds < z.r * z.r) return true;
    }
    return false;
  }

  /** Pick a random walk target clear of the station's props. */
  pickWalkTarget(station) {
    const len = station.lengthCells * 0.5;
    const zones = this.stationZones(station);
    for (let attempt = 0; attempt < 24; attempt++) {
      const a = 0.35 + Math.random() * (len - 0.7);
      const s = (Math.random() < 0.5 ? -1 : 1) * (0.45 + Math.random() * 0.1);
      if (!this.inZone(zones, a, s)) return { a, s };
    }
    return null;
  }

  markLeaving(item) {
    if (item.state !== 'idle') return;
    item.state = 'leaving';
    item.fadeT = 0;
  }

  /** Platform world position for a station item: axial/side local coords. */
  itemWorld(station, item) {
    const perp = { x: -station.dir.z, z: station.dir.x };
    return {
      x: station.startWorld.x + station.dir.x * item.axial + perp.x * item.side,
      y: station.groundY + PLATFORM_HEIGHT,
      z: station.startWorld.z + station.dir.z * item.axial + perp.z * item.side,
    };
  }

  spawnItem(station, type) {
    const len = station.lengthCells * 0.5;
    let axial = 0.6 + Math.random() * (len - 1.2);
    // Keep the building (center ~0.9 wide) clear
    const mid = len * 0.5;
    if (Math.abs(axial - mid) < 0.75) axial = Math.random() < 0.5 ? mid - 0.75 - Math.random() * 0.4 : mid + 0.75 + Math.random() * 0.4;
    axial = Math.max(0.3, Math.min(len - 0.3, axial));
    const side = (Math.random() < 0.5 ? -1 : 1) * (STATION_WIDTH_WORLD / 2 - 0.2);
    const item = {
      id: `act_${this.nextId++}`,
      stationId: station.id,
      type,
      state: 'idle',
      axial,
      side,
      yaw: Math.random() * Math.PI * 2,
      scale: 0,
      age: Math.random() * 10,
      phase: Math.random() * Math.PI * 2,
      fadeT: 0,
      leaveTimer: 0,
      coachId: null,
      trainId: null,
      rideStationId: null,
      walkTarget: null, // { a, s } for passenger wandering
      walkSpeed: 0,
      pauseT: 1 + Math.random() * 3,
    };
    this.items.set(item.id, item);
    return item;
  }

  /**
   * Core update — call once per frame with the simulation delta.
   */
  update(dt) {
    this.time += dt;

    // ── Gradual spawn to soft targets ──
    for (const station of this.stationManager.getAllStations()) {
      const targets = this.targets.get(station.id);
      if (!targets) continue;
      let next = this.spawnTimers.get(station.id) ?? 0;
      if (this.time >= next) {
        this.spawnTimers.set(station.id, this.time + SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN));
        if (this.items.size < MAX_ITEMS) {
          const counts = { passenger: 0, crate: 0, sack: 0, coal: 0, container: 0, tanker: 0 };
          for (const item of this.items.values()) {
            if (item.stationId === station.id && item.state !== 'leaving') counts[item.type]++;
          }
          const wantPassenger = targets.passenger - counts.passenger;
          const wantCargo = Object.entries(targets.cargo)
            .map(([t, n]) => ({ t, n: n - (counts[t] || 0) }))
            .filter((c) => c.n > 0);
          if (wantPassenger > 0 || wantCargo.length > 0) {
            const cargoPick = wantCargo.length > 0 ? wantCargo[Math.floor(Math.random() * wantCargo.length)] : null;
            const type = cargoPick && (wantPassenger <= 0 || Math.random() < 0.6) ? cargoPick.t : 'passenger';
            this.spawnItem(station, type);
          }
        }
      }
    }

    // ── Dwell events: board + unload + whistle/bell ──
    for (const train of this.trainManager.getAllTrains()) {
      const dwelling = train.dwell ? train.dwell.stationId : null;
      const prev = this.dwellState.get(train.id);
      if (dwelling && prev !== dwelling) {
        this.dwellState.set(train.id, dwelling);
        trainAudio.stationArrival(train.engineType, train.position);
        this.unloadRiding(train, dwelling);
        this.boardAtStation(train, dwelling);
      } else if (!dwelling && prev) {
        this.dwellState.delete(train.id);
        trainAudio.bell(train.position);
      }
    }

    // ── Item state machine ──
    for (const [id, item] of this.items) {
      if (item.state === 'boarding') {
        item.fadeT += dt;
        item.scale = Math.min(1, item.fadeT / BOARD_TIME);
        if (item.fadeT >= BOARD_TIME) {
          item.state = 'riding';
          item.scale = 1;
        }
      } else if (item.state === 'arriving') {
        item.fadeT += dt;
        item.scale = Math.min(1, item.fadeT / BOARD_TIME);
        if (item.fadeT >= BOARD_TIME) {
          item.state = 'idle';
          item.scale = 1;
          item.leaveTimer = 5 + Math.random() * 5;
        }
      } else if (item.state === 'leaving') {
        item.fadeT += dt;
        item.scale = Math.max(0, 1 - item.fadeT / BOARD_TIME);
        item.axial += dt * 0.35; // drift toward the platform end
        if (item.fadeT >= BOARD_TIME) {
          this.items.delete(id);
          continue;
        }
      } else if (item.state === 'idle') {
        item.age += dt;
        // Pop in after spawn — idle items start at scale 0 and ease up
        item.scale = Math.min(1, item.scale + dt * 2.5);
        if (item.leaveTimer > 0) {
          item.leaveTimer -= dt;
          if (item.leaveTimer <= 0) this.markLeaving(item);
        }
        // Passengers walk between waypoints, keeping clear of buildings
        // and platform props. Cargo piles stay put.
        if (item.type === 'passenger') {
          const station = this.stationManager.getStation(item.stationId);
          if (station) {
            if (item.walkTarget) {
              const t = item.walkTarget;
              const da = t.a - item.axial;
              const ds = t.s - item.side;
              const dist = Math.hypot(da, ds);
              const step = item.walkSpeed * dt;
              if (dist <= step) {
                item.axial = t.a;
                item.side = t.s;
                item.walkTarget = null;
                item.pauseT = 2 + Math.random() * 4;
              } else {
                item.axial += (da / dist) * step;
                item.side += (ds / dist) * step;
                // Face the direction of travel
                const perp = { x: -station.dir.z, z: station.dir.x };
                item.yaw = Math.atan2(perp.x * ds + station.dir.x * da, perp.z * ds + station.dir.z * da) || item.yaw;
              }
            } else {
              item.pauseT -= dt;
              if (item.pauseT <= 0) {
                const target = this.pickWalkTarget(station);
                if (target) {
                  item.walkTarget = target;
                  item.walkSpeed = 0.09 + Math.random() * 0.06;
                } else {
                  item.pauseT = 3 + Math.random() * 3;
                }
              }
            }
          }
        } else {
          item.yaw += Math.sin(this.time * 0.15 + item.phase) * dt * 0.12;
        }
      } else if (item.state === 'riding') {
        // Ride until the owning coach/train disappears
        const train = this.trainManager.getTrain(item.trainId);
        const coach = train?.coaches?.find((c) => c.id === item.coachId);
        if (!coach || !coach.position) {
          const station = this.stationManager.getStation(item.rideStationId);
          if (station) {
            item.state = 'arriving';
            item.stationId = station.id;
            item.fadeT = 0;
            item.axial = 0.6 + Math.random() * (station.lengthCells * 0.5 - 1.2);
            item.side = (Math.random() < 0.5 ? -1 : 1) * (STATION_WIDTH_WORLD / 2 - 0.2);
          } else {
            this.items.delete(id);
          }
        }
      }
    }
  }

  /** Cargo/passengers with a matching coach board the parked train. */
  boardAtStation(train, stationId) {
    for (const coach of train.coaches || []) {
      const role = COACH_ROLE[coach.type];
      if (!role) continue;
      const already = [...this.items.values()].find((i) => i.coachId === coach.id);
      if (already) continue;
      const waiting = [...this.items.values()].find(
        (i) => i.stationId === stationId && i.state === 'idle' && i.type === role
      );
      if (!waiting) continue;
      waiting.state = 'boarding';
      waiting.fadeT = 0;
      waiting.coachId = coach.id;
      waiting.trainId = train.id;
      waiting.rideStationId = stationId;
      if (waiting.type === 'passenger') trainAudio.passengerBoarded(train.position);
      else trainAudio.cargoLoaded(train.position);
    }
  }

  /** Riding cargo unloads at a stop that is not its boarding station. */
  unloadRiding(train, stationId) {
    for (const item of this.items.values()) {
      if (item.state === 'riding' && item.trainId === train.id && item.rideStationId !== stationId) {
        const station = this.stationManager.getStation(stationId);
        if (!station) continue;
        item.stationId = stationId;
        item.state = 'arriving';
        item.fadeT = 0;
        item.coachId = null;
        if (item.type === 'passenger') trainAudio.passengerUnloaded(train.position);
        else trainAudio.cargoUnloaded(train.position);
        item.axial = 0.6 + Math.random() * (station.lengthCells * 0.5 - 1.2);
        item.side = (Math.random() < 0.5 ? -1 : 1) * (STATION_WIDTH_WORLD / 2 - 0.2);
      }
    }
  }

  getAllItems() {
    return Array.from(this.items.values());
  }

  clear() {
    this.items.clear();
    this.spawnTimers.clear();
    this.dwellState.clear();
    this.nextId = 0;
  }
}
