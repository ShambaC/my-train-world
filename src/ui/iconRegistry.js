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
});
