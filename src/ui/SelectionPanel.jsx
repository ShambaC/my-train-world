import { useState, useEffect } from 'react';
import { cameraBus } from '../utils/cameraBus';
import {
  connectedComponent,
  disconnectedSegments,
  totalTrackDistance,
  consistDistance,
  stationForTrack,
  stationsAlongComponent,
} from '../utils/inspect';
import { deleteEntity } from '../utils/editActions';

/**
 * Selection panel — read-only inspection + permissive controls for the
 * entity selected with the Hand tool. Describes world state, never judges
 * layouts, and no control rejects a train/station/layout.
 */
export default function SelectionPanel({
  selection,
  trackManager,
  stationManager,
  trainManager,
  roadManager,
  signalManager,
  history,
  followTrainId,
  onFollowTrain,
  onSelect,
  onRefreshWorld,
  showTechnicalInfo = false,
}) {
  const [now, setNow] = useState(Date.now());

  // Refresh inspection numbers periodically (trains move, counts change).
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Entity deleted elsewhere (undo, delete tool) — drop the selection.
    if (!selection) return;
    let alive = false;
    if (selection.kind === 'train') alive = !!trainManager.getTrain(selection.id);
    if (selection.kind === 'station') alive = !!stationManager.getStation(selection.id);
    if (selection.kind === 'track') alive = !!trackManager.getTrack(selection.id);
    if (!alive) onSelect?.(null);
  }, [selection, now, trainManager, stationManager, trackManager, onSelect]);

  if (!selection) return null;

  const focus = (target, distance) => {
    cameraBus.emit({ type: 'focus', target, distance });
  };

  const doDelete = () => {
    let target = null;
    if (selection.kind === 'train') {
      const t = trainManager.getTrain(selection.id);
      if (t) target = { kind: 'train', id: t.id, position: t.position, rotation: t.rotation };
    } else if (selection.kind === 'station') {
      const s = stationManager.getStation(selection.id);
      if (s) target = { kind: 'station', id: s.id, position: s.centerWorld, rect: s.worldRect };
    } else if (selection.kind === 'track') {
      const t = trackManager.getTrack(selection.id);
      if (t) target = { kind: 'track', id: t.id, position: t.position, rotation: t.rotation, type: t.type };
    }
    if (target) {
      deleteEntity({
        target,
        trackManager,
        stationManager,
        trainManager,
        signalManager,
        roadManager,
        history,
      });
      onSelect?.(null);
      onRefreshWorld?.();
    }
  };

  const btn = 'px-2 py-1 rounded text-xs font-medium transition-colors';
  const btnPrimary = `${btn} bg-blue-600 hover:bg-blue-700 text-white`;
  const btnGreen = `${btn} bg-green-600 hover:bg-green-700 text-white`;
  const btnYellow = `${btn} bg-yellow-600 hover:bg-yellow-700 text-white`;
  const btnRed = `${btn} bg-red-600 hover:bg-red-700 text-white`;
  const btnGray = `${btn} bg-gray-600 hover:bg-gray-500 text-white`;

  let title = '';
  let body = [];
  let technicalBody = [];
  let actions = [];

  if (selection.kind === 'train') {
    const train = trainManager.getTrain(selection.id);
    if (!train) return null;
    title = 'Train';
    const comp = connectedComponent(trackManager, train.currentTrackId);
    const stops = stationsAlongComponent(stationManager, trackManager, train.currentTrackId);
    const stop = stationForTrack(stationManager, train.currentTrackId);
    body = [
      `${train.active ? 'Moving' : 'Stopped'} • speed ${train.speed.toFixed(2)}`,
      `Coaches: ${(train.coaches || []).length} • consist ${consistDistance(train).toFixed(1)}u`,
      stop ? `Station stop here: ${stop.role}` : null,
    ].filter(Boolean);
    technicalBody = [
      `Current track: ${train.currentTrackId}`,
      comp.trackCount > 0 ? `Connected tracks: ${comp.trackCount} • route ${comp.distance.toFixed(1)}u • dead ends ${comp.deadEnds}` : null,
      stops.length > 0 ? `Stations reachable: ${stops.length}` : null,
    ].filter(Boolean);
    actions = [
      <button type="button" key="toggle" className={train.active ? btnYellow : btnGreen} onClick={() => { trainManager.toggleTrain(selection.id); setNow(Date.now()); onRefreshWorld?.(); }}>{train.active ? 'Stop' : 'Start'}</button>,
      <button type="button" key="reverse" className={btnGray} onClick={() => { trainManager.reverseTrain(selection.id); setNow(Date.now()); onRefreshWorld?.(); }}>Reverse</button>,
      <button type="button" key="focus" className={btnPrimary} onClick={() => focus(train.position, 3.5)}>Focus</button>,
      <button type="button" key="follow" className={followTrainId === train.id ? btnYellow : btnPrimary} onClick={() => onFollowTrain?.(followTrainId === train.id ? null : train.id)}>{followTrainId === train.id ? 'Unfollow' : 'Follow'}</button>,
      <button type="button" key="del" className={btnRed} onClick={doDelete}>Delete</button>,
    ];
  } else if (selection.kind === 'station') {
    const station = stationManager.getStation(selection.id);
    if (!station) return null;
    title = 'Station';
    const bound = [];
    for (const [trackId, stationId] of stationManager.trackBindings) {
      if (stationId === station.id) bound.push(trackId);
    }
    body = [
      `Role: ${station.role}`,
      `Length: ${station.lengthCells} cells • width ${station.lengthCells * 0.5}u`,
    ];
    technicalBody = [
      `Stopping tracks beside it: ${bound.length}`,
      `Size ${Math.round(station.worldRect.maxX - station.worldRect.minX)}x${Math.round(station.worldRect.maxZ - station.worldRect.minZ)}u`,
    ];
    actions = [
      <button type="button" key="focus" className={btnPrimary} onClick={() => focus(station.centerWorld, 8)}>Focus</button>,
      <button type="button" key="del" className={btnRed} onClick={doDelete}>Delete</button>,
    ];
  } else if (selection.kind === 'track') {
    const track = trackManager.getTrack(selection.id);
    if (!track) return null;
    title = 'Track';
    const comp = connectedComponent(trackManager, track.id);
    const stop = stationForTrack(stationManager, track.id);
    body = [
      `${track.type} track`,
      track.heightOffset > 0.05 ? `Bridge height: ${track.heightOffset.toFixed(1)}u` : null,
    ].filter(Boolean);
    technicalBody = [
      `Rotation ${Math.round((track.rotation * 180) / Math.PI)}°`,
      `Connected tracks: ${comp.trackCount} • route ${comp.distance.toFixed(1)}u • dead ends ${comp.deadEnds}`,
      stop ? `Station stop here: ${stop.role}` : null,
      `Total network: ${trackManager.getAllTracks().length} tracks • ${totalTrackDistance(trackManager).toFixed(1)}u • ${disconnectedSegments(trackManager)} segment(s)`,
    ].filter(Boolean);
    actions = [
      <button type="button" key="focus" className={btnPrimary} onClick={() => focus(track.position, 4)}>Focus</button>,
      <button type="button" key="del" className={btnRed} onClick={doDelete}>Delete</button>,
    ];
  } else {
    return null;
  }

  return (
    <div className="absolute bottom-24 left-4 z-30 w-80 max-w-[90vw] bg-black bg-opacity-75 backdrop-blur-sm text-white px-4 py-3 rounded-lg text-sm space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-bold text-green-400">{title}</div>
        <button type="button" className="text-gray-400 hover:text-white text-xs px-1" onClick={() => onSelect?.(null)} title="Close details">×</button>
      </div>
      <div className="space-y-0.5 text-xs text-gray-300">
        {[...body, ...(showTechnicalInfo ? technicalBody : [])].map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      {showTechnicalInfo && <div className="text-[10px] uppercase tracking-[0.12em] text-[#aebbd0]">Technical details enabled</div>}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {actions}
      </div>
    </div>
  );
}
