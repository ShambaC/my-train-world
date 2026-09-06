import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { trainAudio } from '../audio/trainAudio.js';
import { createTrailerSequences } from './trailerSequence.js';
import {
  addRoute,
  addRoutePiece,
  addTrailerRoadCrossing,
  addTrailerStation,
  addTrailerTrain,
  buildTrailerLayout,
  resetTrailerWorld,
  validateTrailerLayout,
} from './trailerWorld.js';

const SHOT_LIST = ['reveal', 'tracks', 'station', 'assembly', 'run', 'beauty', 'all'];
const CARD_FINAL = { title: 'MyTrainWorld', subtitle: 'Build. Connect. Watch it run.', footer: 'mytrain.world' };
const clamp01 = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => THREE.MathUtils.smootherstep(clamp01(value), 0, 1);
const vec = (value) => new THREE.Vector3(value.x, value.y, value.z);

function makeCurve(points) {
  return new THREE.CatmullRomCurve3(points.map(vec), false, 'centripetal', 0.45);
}

function pathPoint(layout, index, y = 1.2) {
  const piece = layout.route[Math.max(0, Math.min(layout.route.length - 1, index))];
  return new THREE.Vector3(piece.position.x, piece.position.y + y, piece.position.z);
}

function buildCameraSpec(layout, mode) {
  const start = pathPoint(layout, 0, 1.0);
  const middle = pathPoint(layout, Math.floor(layout.route.length * 0.45), 1.5);
  const bridge = pathPoint(layout, Math.max(1, layout.bridgeRange.start === Infinity ? 16 : layout.bridgeRange.start + 1), 1.3);
  const end = pathPoint(layout, layout.route.length - 1, 2.0);
  const station = new THREE.Vector3(layout.station.centerWorld.x, layout.station.centerWorld.y + 1.4, layout.station.centerWorld.z);
  const crossing = new THREE.Vector3(layout.crossing.x, layout.crossing.y + 1.0, layout.crossing.z);
  const routeTarget = (index, y = 0.35) => {
    const piece = layout.route[Math.max(0, Math.min(layout.route.length - 1, index))];
    return new THREE.Vector3(piece.position.x, piece.position.y + y, piece.position.z);
  };
  const stationTrackTarget = station.clone().lerp(routeTarget(10), 0.35);

  let positions;
  let targets;
  let fov = [48, 52];
  if (mode === 'reveal') {
    positions = [
      new THREE.Vector3(start.x - 2.8, start.y - 0.2, start.z - 3.8),
      new THREE.Vector3(start.x - 1.5, start.y + 2.8, start.z - 2.5),
      new THREE.Vector3(middle.x - 5, middle.y + 8, middle.z - 8),
      new THREE.Vector3(middle.x - 10, middle.y + 12, middle.z - 15),
    ];
    targets = [routeTarget(0), routeTarget(8), routeTarget(17), routeTarget(24)];
    fov = [52, 58];
  } else if (mode === 'tracks') {
    positions = [
      new THREE.Vector3(start.x - 3, start.y + 0.2, start.z - 3),
      new THREE.Vector3(start.x + 1.5, start.y + 0.8, start.z - 2.5),
      new THREE.Vector3(middle.x - 1.5, middle.y + 1.0, middle.z - 3.2),
      new THREE.Vector3(bridge.x - 1.5, bridge.y + 1.4, bridge.z - 3.5),
    ];
    targets = [routeTarget(0), routeTarget(8), routeTarget(18), routeTarget(30)];
    fov = [44, 48];
  } else if (mode === 'station') {
    positions = [
      new THREE.Vector3(station.x - 4.5, station.y + 3.5, station.z - 5.5),
      new THREE.Vector3(station.x - 1.5, station.y + 2.4, station.z - 4.0),
      new THREE.Vector3(station.x + 4.5, station.y + 2.2, station.z - 3.0),
      new THREE.Vector3(station.x + 7.0, station.y + 3.0, station.z - 5.5),
    ];
    targets = [station, station, stationTrackTarget, stationTrackTarget];
    fov = [46, 50];
  } else if (mode === 'assembly') {
    positions = [
      new THREE.Vector3(start.x - 2.5, start.y + 0.7, start.z - 2.8),
      new THREE.Vector3(start.x - 1.3, start.y + 0.9, start.z - 2.2),
      new THREE.Vector3(start.x + 1.5, start.y + 1.1, start.z - 2.0),
      new THREE.Vector3(start.x + 4.0, start.y + 1.7, start.z - 3.4),
    ];
    targets = [routeTarget(8), routeTarget(10), routeTarget(12), routeTarget(15)];
    fov = [42, 46];
  } else if (mode === 'beauty') {
    positions = [
      new THREE.Vector3(bridge.x - 3.5, bridge.y + 1.3, bridge.z - 3.4),
      new THREE.Vector3(station.x - 5.0, station.y + 5.0, station.z - 8.5),
      new THREE.Vector3(middle.x - 10, middle.y + 9.5, middle.z - 13),
      new THREE.Vector3(end.x + 4, end.y + 4.0, end.z + 7),
    ];
    targets = [routeTarget(18), station, routeTarget(20), routeTarget(32)];
    fov = [44, 54];
  } else {
    positions = [
      new THREE.Vector3(start.x - 3, start.y + 0.8, start.z - 3),
      new THREE.Vector3(station.x - 4, station.y + 3, station.z - 5),
      new THREE.Vector3(middle.x - 8, middle.y + 7, middle.z - 10),
      new THREE.Vector3(end.x + 6, end.y + 7, end.z + 9),
    ];
    targets = [routeTarget(2), station, routeTarget(20), routeTarget(30)];
    fov = [46, 54];
  }

  return {
    positionCurve: makeCurve(positions),
    targetCurve: makeCurve(targets),
    fov,
    crossing,
    station,
  };
}

function setCard(state, card, onCardChange) {
  const key = card ? JSON.stringify(card) : '';
  if (state.cardKey === key) return;
  state.cardKey = key;
  onCardChange?.(card);
}

export default function TrailerDirector({
  shot,
  autoplay = true,
  terrainData,
  trackManager,
  stationManager,
  trainManager,
  roadManager,
  signalManager,
  crossingManager,
  trailerSeed,
  onTracksChanged,
  onStationsChanged,
  onTrainsChanged,
  onEnvironmentChange,
  onCardChange,
  debug = false,
}) {
  const { camera } = useThree();
  const stateRef = useRef({
    shotId: shot,
    elapsed: 0,
    playing: autoplay,
    ready: false,
    initialized: false,
    layout: null,
    sequences: null,
    events: [],
    eventIndex: 0,
    trainId: null,
    cardKey: null,
    cameraSpec: null,
  });
  const state = stateRef.current;

  const notifyTracks = () => onTracksChanged?.(trackManager.getAllTracks(), 'trailer');
  const notifyStations = () => onStationsChanged?.();
  const notifyTrains = () => onTrainsChanged?.();

  const clearAndNotify = () => {
    resetTrailerWorld({ trackManager, stationManager, trainManager, roadManager });
    state.trainId = null;
    notifyTracks();
    notifyStations();
    notifyTrains();
  };

  const setupShot = (shotId) => {
    if (!state.layout || !state.sequences) return;
    clearAndNotify();
    const sequence = state.sequences[shotId] || state.sequences.all;
    state.events = sequence.events;
    state.eventIndex = 0;
    state.cameraSpec = buildCameraSpec(state.layout, sequence.cameraMode);
    state.trainId = null;

    if (shotId === 'station') {
      addRoute(state.layout, trackManager);
      notifyTracks();
    } else if (shotId === 'assembly') {
      addRoute(state.layout, trackManager);
      addTrailerStation(state.layout, stationManager);
      notifyTracks();
      notifyStations();
    } else if (shotId === 'run' || shotId === 'beauty') {
      addRoute(state.layout, trackManager);
      addTrailerStation(state.layout, stationManager);
      const train = addTrailerTrain(state.layout, trainManager);
      state.trainId = train?.id || null;
      addTrailerRoadCrossing(state.layout, roadManager);
      crossingManager?.rebuild();
      notifyTracks();
      notifyStations();
      notifyTrains();
    }

    validateTrailerLayout(state.layout, terrainData, trackManager, roadManager, ['run', 'beauty', 'all'].includes(shotId));
    state.initialized = true;
    setCard(state, sequence.card, onCardChange);
    if (sequence.events[0]?.at === 0) processEvents(0);
    if (debug) console.info('[Trailer] setup', shotId, state.layout);
  };

  const processEvents = (elapsed) => {
    while (state.eventIndex < state.events.length && state.events[state.eventIndex].at <= elapsed) {
      const current = state.events[state.eventIndex++];
      switch (current.action) {
        case 'add-track': {
          const track = addRoutePiece(state.layout, trackManager, current.value);
          if (track) {
            notifyTracks();
            trainAudio.trackPlaced(track.type);
          }
          break;
        }
        case 'add-station':
          addTrailerStation(state.layout, stationManager);
          notifyStations();
          trainAudio.stationPlaced();
          break;
        case 'add-train': {
          const train = trainManager.addTrain(state.layout.route[state.layout.spawnIndex].trackId, 1, 'steam-engine');
          state.trainId = train?.id || null;
          notifyTrains();
          if (train) trainAudio.trainPlaced();
          break;
        }
        case 'add-coach': {
          const train = state.trainId ? trainManager.getTrain(state.trainId) : null;
          if (train && trainManager.addCoach(train.id, current.value)) {
            notifyTrains();
            trainAudio.coachAttached();
          }
          break;
        }
        case 'add-crossing':
          addTrailerRoadCrossing(state.layout, roadManager);
          crossingManager?.rebuild();
          break;
        case 'start-train':
          if (state.trainId) {
            trainManager.setTrainSpeed(state.trainId, 1.2);
            trainManager.setTrainActive(state.trainId, true);
          }
          break;
        case 'environment':
          onEnvironmentChange?.({ timeOfDay: current.value });
          break;
        case 'card':
          setCard(state, current.value, onCardChange);
          break;
        case 'finale':
          setCard(state, CARD_FINAL, onCardChange);
          if (state.trainId) {
            const train = trainManager.getTrain(state.trainId);
            if (train) trainAudio.whistle(train.engineType, train.position);
          }
          break;
        default:
          break;
      }
    }
  };

  const restart = (nextShot = state.shotId) => {
    state.shotId = SHOT_LIST.includes(nextShot) ? nextShot : 'all';
    state.elapsed = 0;
    state.initialized = false;
    state.eventIndex = 0;
    state.playing = true;
    if (state.ready) setupShot(state.shotId);
  };

  const setPlaying = (value) => {
    state.playing = value;
  };
  const roadReady = Boolean(roadManager?.ready);

  useEffect(() => {
    if (!terrainData || !roadReady) return undefined;
    state.layout = buildTrailerLayout(terrainData);
    state.sequences = createTrailerSequences(state.layout);
    state.ready = true;
    restart(shot);
    return undefined;
  }, [terrainData, roadManager, roadReady, shot, trailerSeed]);

  useEffect(() => {
    const api = {
      play: () => setPlaying(true),
      pause: () => setPlaying(false),
      resume: () => setPlaying(true),
      restart: () => restart(),
      nextShot: () => {
        const index = SHOT_LIST.indexOf(state.shotId);
        restart(SHOT_LIST[(index + 1) % SHOT_LIST.length]);
      },
      previousShot: () => {
        const index = SHOT_LIST.indexOf(state.shotId);
        restart(SHOT_LIST[(index - 1 + SHOT_LIST.length) % SHOT_LIST.length]);
      },
      listShots: () => [...SHOT_LIST],
      getState: () => {
        const sequence = state.sequences?.[state.shotId];
        return {
          shot: state.shotId,
          playing: state.playing,
          elapsed: state.elapsed,
          duration: sequence?.duration ?? 0,
          ready: state.ready,
        };
      },
    };
    const root = window.__mtw || (window.__mtw = {});
    root.trailer = api;
    return () => {
      if (window.__mtw?.trailer === api) delete window.__mtw.trailer;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented) return;
      if (event.code === 'Space') {
        event.preventDefault();
        state.playing = !state.playing;
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault();
        restart();
      } else if (event.key === ']') {
        event.preventDefault();
        const index = SHOT_LIST.indexOf(state.shotId);
        restart(SHOT_LIST[(index + 1) % SHOT_LIST.length]);
      } else if (event.key === '[') {
        event.preventDefault();
        const index = SHOT_LIST.indexOf(state.shotId);
        restart(SHOT_LIST[(index - 1 + SHOT_LIST.length) % SHOT_LIST.length]);
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, []);

  useFrame((_, delta) => {
    if (!state.ready && terrainData && roadManager?.ready) {
      state.layout = buildTrailerLayout(terrainData);
      state.sequences = createTrailerSequences(state.layout);
      state.ready = true;
      restart(shot);
    }
    if (!state.ready || !state.initialized) {
      if (state.ready && !state.initialized) setupShot(state.shotId);
      return;
    }
    const sequence = state.sequences[state.shotId] || state.sequences.all;
    const dt = Math.min(delta, 0.1);
    if (state.playing) {
      state.elapsed += dt;
      processEvents(state.elapsed);
      if (state.elapsed >= sequence.duration) state.playing = false;
    }

    const progress = ease(state.elapsed / sequence.duration);
    const spec = state.cameraSpec;
    if (!spec) return;

    if (sequence.cameraMode === 'beauty' && state.trainId && state.elapsed >= 6.2) {
      const train = trainManager.getTrain(state.trainId);
      if (train) {
        const heading = new THREE.Vector3(train.heading.x, 0, train.heading.z).normalize();
        const side = new THREE.Vector3(-heading.z, 0, heading.x);
        const desired = new THREE.Vector3(train.position.x, train.position.y + 2.4, train.position.z)
          .addScaledVector(heading, -4.2)
          .addScaledVector(side, 2.1);
        const target = new THREE.Vector3(train.position.x, train.position.y + 0.65, train.position.z)
          .addScaledVector(heading, 1.4);
        camera.position.lerp(desired, 1 - Math.exp(-4 * dt));
        camera.lookAt(target);
        camera.fov = 48;
        camera.updateProjectionMatrix();
      }
    } else if (sequence.cameraMode === 'run' && state.trainId && state.elapsed < 5.2) {
      const train = trainManager.getTrain(state.trainId);
      if (train) {
        const heading = new THREE.Vector3(train.heading.x, 0, train.heading.z).normalize();
        const side = new THREE.Vector3(-heading.z, 0, heading.x);
        const desired = new THREE.Vector3(train.position.x, train.position.y + 1.2, train.position.z)
          .addScaledVector(heading, -3.4)
          .addScaledVector(side, 1.45);
        const target = new THREE.Vector3(train.position.x, train.position.y + 0.45, train.position.z).addScaledVector(heading, 1.5);
        camera.position.lerp(desired, 1 - Math.exp(-5 * dt));
        camera.lookAt(target);
      }
    } else if (sequence.cameraMode === 'run' && state.elapsed >= 5.2 && state.elapsed < 8.8) {
      const crossingT = ease((state.elapsed - 5.2) / 3.6);
      const position = new THREE.Vector3(spec.crossing.x - 4.5, spec.crossing.y + 1.0, spec.crossing.z + 3.5);
      camera.position.lerp(position, 1 - Math.exp(-4 * dt));
      camera.lookAt(spec.crossing);
      camera.fov = THREE.MathUtils.lerp(46, 42, crossingT);
      camera.updateProjectionMatrix();
    } else {
      const point = spec.positionCurve.getPointAt(progress);
      const target = spec.targetCurve.getPointAt(progress);
      camera.position.copy(point);
      camera.lookAt(target);
      const fov = THREE.MathUtils.lerp(spec.fov[0], spec.fov[1], progress);
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }
  });

  return null;
}
