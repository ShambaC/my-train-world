import hand from '../assets/ui/ui-crop-tools-hand.png';
import straight from '../assets/ui/ui-crop-tools-straight.png';
import curved from '../assets/ui/ui-crop-tools-curved.png';
import ramp from '../assets/ui/ui-crop-tools-ramp.png';
import road from '../assets/ui/ui-crop-tools-road.png';
import train from '../assets/ui/ui-crop-tools-train.png';
import station from '../assets/ui/ui-crop-tools-station.png';
import coach from '../assets/ui/ui-crop-tools-coach.png';
import deleteTool from '../assets/ui/ui-crop-tools-delete.png';
import brandMark from '../assets/ui/ui-brand-mark.png';
import engineHub from '../assets/ui/ui-icon-hub-engine.png';
import coachHub from '../assets/ui/ui-icon-hub-coach.png';
import stationRoleHub from '../assets/ui/ui-icon-hub-station-role.png';
import actionSave from '../assets/ui/ui-crop-actions-save.png';
import actionLoad from '../assets/ui/ui-crop-actions-load.png';
import actionRecover from '../assets/ui/ui-crop-actions-recover.png';
import actionUndo from '../assets/ui/ui-crop-actions-undo.png';
import actionRedo from '../assets/ui/ui-crop-actions-redo.png';
import actionResetOverview from '../assets/ui/ui-crop-actions-reset-overview.png';
import actionFrameRailway from '../assets/ui/ui-crop-actions-frame-railway.png';
import actionHelp from '../assets/ui/ui-crop-actions-help.png';
import actionPause from '../assets/ui/ui-crop-actions-pause.png';
import actionSettings from '../assets/ui/ui-crop-actions-settings.png';
import actionBack from '../assets/ui/ui-crop-actions-back.png';
import actionClose from '../assets/ui/ui-crop-actions-close.png';
import actionWorldTools from '../assets/ui/ui-crop-actions-world-tools.png';
import actionRandomize from '../assets/ui/ui-crop-actions-randomize.png';
import envDawn from '../assets/ui/ui-crop-environment-dawn.png';
import envDay from '../assets/ui/ui-crop-environment-day.png';
import envDusk from '../assets/ui/ui-crop-environment-dusk.png';
import envNight from '../assets/ui/ui-crop-environment-night.png';
import envFog from '../assets/ui/ui-crop-environment-fog.png';
import envShadowOff from '../assets/ui/ui-crop-environment-shadow-off.png';
import envShadowHard from '../assets/ui/ui-crop-environment-shadow-hard.png';
import envShadowSoft from '../assets/ui/ui-crop-environment-shadow-soft.png';
import envMiniature from '../assets/ui/ui-crop-environment-miniature.png';
import envCel from '../assets/ui/ui-crop-environment-cel.png';
import envActivity from '../assets/ui/ui-crop-environment-activity.png';
import envAudioTrain from '../assets/ui/ui-crop-environment-audio-train.png';
import envAudioMaster from '../assets/ui/ui-crop-environment-audio-master.png';
import envTraffic from '../assets/ui/ui-crop-environment-traffic.png';
import envSignals from '../assets/ui/ui-crop-environment-signals.png';
import envPerformance from '../assets/ui/ui-crop-environment-performance-vsync.png';
import trainStart from '../assets/ui/ui-crop-train-controls-start.png';
import trainStop from '../assets/ui/ui-crop-train-controls-stop.png';
import trainReverse from '../assets/ui/ui-crop-train-controls-reverse.png';
import trainFocus from '../assets/ui/ui-crop-train-controls-focus.png';
import trainFollow from '../assets/ui/ui-crop-train-controls-follow.png';
import trainDeleteCoach from '../assets/ui/ui-crop-train-controls-delete-coach.png';
import trainSpeedSlow from '../assets/ui/ui-crop-train-controls-speed-slow.png';
import trainSpeedFast from '../assets/ui/ui-crop-train-controls-speed-fast.png';
import trainEntity from '../assets/ui/ui-crop-train-controls-entity-train.png';
import trainEntityStation from '../assets/ui/ui-crop-train-controls-entity-station.png';
import trainEntityTrack from '../assets/ui/ui-crop-train-controls-entity-track.png';
import statusLoading from '../assets/ui/ui-crop-status-loading.png';
import statusSaving from '../assets/ui/ui-crop-status-saving.png';
import statusSuccess from '../assets/ui/ui-crop-status-success.png';
import statusWarning from '../assets/ui/ui-crop-status-warning.png';
import statusError from '../assets/ui/ui-crop-status-error.png';
import statusInfo from '../assets/ui/ui-crop-status-info.png';
import statusDeveloper from '../assets/ui/ui-crop-status-developer.png';
import worldVillage from '../assets/ui/ui-crop-world-cards-village-station.png';
import worldBridge from '../assets/ui/ui-crop-world-cards-river-bridge.png';
import worldMeadow from '../assets/ui/ui-crop-world-cards-meadow.png';
import worldDusk from '../assets/ui/ui-crop-world-cards-dusk-yard.png';

export const TOOL_ICONS = Object.freeze({
  hand,
  straight,
  curved,
  ramp,
  road,
  train,
  station,
  coach,
  delete: deleteTool,
});

export const UI_ICONS = Object.freeze({
  brandMark,
  hubs: Object.freeze({
    engine: engineHub,
    coach: coachHub,
    stationRole: stationRoleHub,
  }),
  actions: Object.freeze({ save: actionSave, load: actionLoad, recover: actionRecover, undo: actionUndo, redo: actionRedo, resetOverview: actionResetOverview, frameRailway: actionFrameRailway, help: actionHelp, pause: actionPause, settings: actionSettings, back: actionBack, close: actionClose, worldTools: actionWorldTools, randomize: actionRandomize }),
  environment: Object.freeze({ dawn: envDawn, day: envDay, dusk: envDusk, night: envNight, fog: envFog, shadowOff: envShadowOff, shadowHard: envShadowHard, shadowSoft: envShadowSoft, miniature: envMiniature, cel: envCel, activity: envActivity, audioTrain: envAudioTrain, audioMaster: envAudioMaster, traffic: envTraffic, signals: envSignals, performance: envPerformance }),
  trainControls: Object.freeze({ start: trainStart, stop: trainStop, reverse: trainReverse, focus: trainFocus, follow: trainFollow, deleteCoach: trainDeleteCoach, speedSlow: trainSpeedSlow, speedFast: trainSpeedFast, entityTrain: trainEntity, entityStation: trainEntityStation, entityTrack: trainEntityTrack }),
  status: Object.freeze({ loading: statusLoading, saving: statusSaving, success: statusSuccess, warning: statusWarning, error: statusError, info: statusInfo, developer: statusDeveloper }),
  worldCards: Object.freeze([worldVillage, worldBridge, worldMeadow, worldDusk]),
});
