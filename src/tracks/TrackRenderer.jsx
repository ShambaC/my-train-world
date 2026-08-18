import { useRef, useState, useEffect, useMemo } from 'react';
import { createStraightTrack, createCurvedTrack, createSupportBeams, createRampTrack, createRampBeams } from './TrackModels';
import { createTrainEngine } from '../trains/TrainModel';
import { createPassengerCoach } from '../trains/PassengerCoachModel';
import { createCoalCart } from '../trains/CoalCartModel';
import { createGasCoach } from '../trains/GasCoachModel';
import { createGoodsCoach } from '../trains/GoodsCoachModel';
import { createContainerCoach } from '../trains/ContainerCoachModel';
import { createViewdeckCoach } from '../trains/ViewdeckCoachModel';
import { makeGhost, GHOST_GREEN, GHOST_RED } from '../utils/ghost';
import { useTrackPlacement } from '../hooks/useTrackPlacement';
import OverheadLine from './OverheadLine';
import { deleteEntity, clone, stripStation, rebuildStation } from '../utils/editActions';
import ModelLibrary from '../models/ModelLibrary';
import { DEFAULT_COACH } from '../trains/coachTypes';
import * as THREE from 'three';
import { trainAudio } from '../audio/trainAudio';

// Road tool rotation 0 follows local +Z: width X, tile length Z.
const ROAD_GHOST_GEO = new THREE.BoxGeometry(0.75, 0.02, 0.5);

export default function TrackRenderer({
  trackManager,
  stationManager,
  terrainRef,
  waterRef,
  selectedTool,
  rotation,
  heightOffset,
  onTracksChange,
  trainManager,
  trainDirection,
  onStationsChange,
  onCoachPick,
  onEnginePick,
  currentEngineType = 'steam-engine',
  signalManager,
  roadManager,
  history,
  onSelect,
  terrainData,
}) {
  const [tracks, setTracks] = useState([]);
  const ghostMeshRef = useRef(null);
  const trackMeshesRef = useRef(new Map());
  const mouseDownPosRef = useRef(null);
  const ghostOffsetRef = useRef(null);

  const {
    ghostPosition,
    isValidPosition,
    ghostReason,
    latestRef,
    updateGhostPosition,
    handlePlacement,
  } = useTrackPlacement(terrainRef, trackManager, stationManager, trainManager, selectedTool, rotation, heightOffset, trainDirection, signalManager, roadManager, waterRef);

  // Latest values via refs — canvas listeners attach ONCE so re-renders
  // during a click event never re-attach mid-dispatch (which made clicks
  // recurse and double-place / crash).
  const selectedToolRef = useRef(selectedTool);
  const latestRefMirror = useRef(latestRef);
  const updateGhostRef = useRef(updateGhostPosition);
  const handlePlacementRef = useRef(handlePlacement);
  const trackManagerRef = useRef(trackManager);
  const stationManagerRef = useRef(stationManager);
  const trainManagerRef = useRef(trainManager);
  const trainDirectionRef = useRef(trainDirection);
  const onTracksChangeRef = useRef(onTracksChange);
  const onStationsChangeRef = useRef(onStationsChange);
  const onCoachPickRef = useRef(onCoachPick);
  const onEnginePickRef = useRef(onEnginePick);
  const currentEngineTypeRef = useRef(currentEngineType);
  const signalManagerRef = useRef(signalManager);
  const roadManagerRef = useRef(roadManager);
  const historyRef = useRef(history);
  const onSelectRef = useRef(onSelect);
  selectedToolRef.current = selectedTool;
  latestRefMirror.current = latestRef;
  updateGhostRef.current = updateGhostPosition;
  handlePlacementRef.current = handlePlacement;
  trackManagerRef.current = trackManager;
  stationManagerRef.current = stationManager;
  trainManagerRef.current = trainManager;
  trainDirectionRef.current = trainDirection;
  onTracksChangeRef.current = onTracksChange;
  onStationsChangeRef.current = onStationsChange;
  onCoachPickRef.current = onCoachPick;
  onEnginePickRef.current = onEnginePick;
  currentEngineTypeRef.current = currentEngineType;
  signalManagerRef.current = signalManager;
  roadManagerRef.current = roadManager;
  historyRef.current = history;
  onSelectRef.current = onSelect;

  useEffect(() => {
    setTracks(trackManager.getAllTracks());
  }, [trackManager]);

  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const handleMouseMove = (e) => updateGhostRef.current(e);
    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Resolve the entity under the pointer (trains first, then tracks,
  // stations, roads) — shared by the delete tool and hand-tool selection.
  const resolveTarget = (point) => {
    let target = null;
    for (const train of trainManagerRef.current.getAllTrains()) {
      const dx = Math.abs(train.position.x - point.x);
      const dz = Math.abs(train.position.z - point.z);
      if (dx < 0.45 && dz < 0.45) {
        target = { kind: 'train', id: train.id };
        break;
      }
    }
    if (!target) {
      const track = trackManagerRef.current.getTrackAtPosition(point, 0.35);
      if (track) target = { kind: 'track', id: track.id };
    }
    if (!target && stationManagerRef.current) {
      const st = stationManagerRef.current.getStationAtPosition(point);
      if (st) target = { kind: 'station', id: st.id };
    }
    if (!target && roadManagerRef.current) {
      const rd = roadManagerRef.current.getRoadAtPosition(point);
      if (rd) target = { kind: 'road', id: rd.id };
    }
    return target;
  };

  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const handleMouseDown = (e) => {
      if (e.target !== canvas) return;
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleClick = (e) => {
      if (e.target !== canvas) return;
      if (!mouseDownPosRef.current) return;
      const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
      const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
      mouseDownPosRef.current = null;
      // Filter out drags (orbit / pan)
      if (dx > 5 || dy > 5) return;

      const tool = selectedToolRef.current;

      // Recompute the ghost synchronously from THIS click event, so a click
      // right after tool/rotation/camera changes never acts on stale state
      // (no mouse-away workaround needed).
      updateGhostRef.current(e);
      const latest = latestRefMirror.current.current;
      const { ghostPosition, isValidPosition } = latest;
      if (import.meta.env.DEV) {
        window.__clickDebug = { tool: tool?.type, ghost: ghostPosition, valid: isValidPosition };
      }

      if (tool?.type === 'hand') {
        // Selection: train → track → station → road under the cursor.
        updateGhostRef.current(e);
        const point = latestRefMirror.current.current.hitPoint;
        const target = point ? resolveTarget(point) : null;
        onSelectRef.current?.(target ? { kind: target.kind, id: target.id } : null);
      } else if (tool?.type === 'train') {
        const target = ghostPosition?.target;
        if (target?.kind === 'train') {
          onEnginePickRef.current?.({ trainId: target.id }, e.clientX, e.clientY);
        } else if (ghostPosition?.isTrack) {
          const track = trackManagerRef.current.getTrackAtPosition(ghostPosition, 0.35);
          if (track) {
            onEnginePickRef.current?.(
              { trackId: track.id, direction: trainDirectionRef.current },
              e.clientX,
              e.clientY
            );
          }
        }
      } else if (tool?.type === 'road') {
        if (ghostPosition && isValidPosition) {
          const road = roadManagerRef.current?.addRoad(
            { x: ghostPosition.x, y: ghostPosition.y, z: ghostPosition.z },
            ghostPosition.rotation || 0
          );
           if (road && historyRef.current) {
            const snap = clone(road);
            historyRef.current.push({
              undo: () => roadManagerRef.current.removeRoad(road.id),
              redo: () => roadManagerRef.current.restoreUserRoad(clone(snap)),
              });
            }
            if (road) trainAudio.roadPlaced();
        }
      } else if (tool?.type === 'coach') {
        const target = ghostPosition?.target;
        if (target?.kind === 'train') {
          onCoachPickRef.current?.(target.id, e.clientX, e.clientY);
        }
      } else if (tool?.type === 'delete') {
        const target = ghostPosition?.target;
        if (target) {
           deleteEntity({
            target,
            trackManager: trackManagerRef.current,
            stationManager: stationManagerRef.current,
            trainManager: trainManagerRef.current,
            signalManager: signalManagerRef.current,
            roadManager: roadManagerRef.current,
             history: historyRef.current,
           });
           trainAudio.deleted(target.kind);
          if (target.kind === 'track') {
            setTracks(trackManagerRef.current.getAllTracks());
            onTracksChangeRef.current?.(trackManagerRef.current.getAllTracks());
          } else if (target.kind === 'station') {
            setTracks(trackManagerRef.current.getAllTracks());
            onStationsChangeRef.current?.();
          }
          onSelectRef.current?.(null);
        }
      } else if (tool && ghostPosition && isValidPosition) {
        const track = handlePlacementRef.current();
        if (track) {
          if (historyRef.current) {
            const snap = clone(track);
            historyRef.current.push({
              undo: () => trackManagerRef.current.removeTrack(track.id),
              redo: () => trackManagerRef.current.restoreTrack(clone(snap)),
            });
          }
          setTracks(trackManagerRef.current.getAllTracks());
           onTracksChangeRef.current?.(trackManagerRef.current.getAllTracks());
           trainAudio.trackPlaced(track.type);
         }
        } else if (tool && ghostPosition && !isValidPosition) {
          trainAudio.invalid();
        }
      mouseDownPosRef.current = null;
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('click', handleClick);
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('click', handleClick);
    };
  }, []);

  useEffect(() => {
    const currentTrackIds = new Set(tracks.map(t => t.id));
    for (const [id, mesh] of trackMeshesRef.current.entries()) {
      if (!currentTrackIds.has(id)) {
        // Geometries and materials are shared per track type (TrackModels
        // caches them) — remove from the scene but never dispose.
        if (mesh.parent) mesh.parent.remove(mesh);
        trackMeshesRef.current.delete(id);
      }
    }
  }, [tracks]);

  // Build ghost based on tool type + validity (deps change rarely)
  const ghostMesh = useMemo(() => {
    if (!selectedTool) return null;

    ghostOffsetRef.current = null;

    // Dispose old ghost — geometries are shared (TrackModels caches them),
    // only the ghost's own materials are disposed.
    if (ghostMeshRef.current) {
      ghostMeshRef.current.traverse((child) => {
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
      ghostMeshRef.current = null;
    }

    let mesh = null;
    const color = isValidPosition ? GHOST_GREEN : GHOST_RED;

    if (selectedTool.type === 'track') {
      mesh = ghostPosition?.type === 'straight'
        ? makeGhost(createStraightTrack(), color)
        : ghostPosition?.type === 'ramp'
        ? makeGhost(createRampTrack(), color)
        : makeGhost(createCurvedTrack(), color);
    } else if (selectedTool.type === 'road') {
      mesh = ghostPosition?.type === 'road'
        ? makeGhost(new THREE.Mesh(ROAD_GHOST_GEO, new THREE.MeshBasicMaterial({ color: GHOST_GREEN })), color)
        : null;
    } else if (selectedTool.type === 'train') {
      if (ghostPosition?.target?.kind === 'train') {
        const t = trainManager?.getTrain?.(ghostPosition.target.id);
        mesh = makeGhost(createTrainEngine(t?.engineType || currentEngineType || 'steam-engine'), GHOST_GREEN);
      } else {
        mesh = makeGhost(createTrainEngine(currentEngineType || 'steam-engine'), isValidPosition ? GHOST_GREEN : GHOST_RED);
      }
    } else if (selectedTool.type === 'coach') {
      // Green ghost of the default coach, positioned behind the engine
      if (ghostPosition?.target?.kind === 'train') {
        ghostOffsetRef.current = null; // use ghostPosition directly (offset computed in useTrackPlacement)
        const coachMesh = DEFAULT_COACH === 'passenger-coach'
          ? createPassengerCoach()
          : DEFAULT_COACH === 'coal-cart'
          ? createCoalCart()
          : DEFAULT_COACH === 'gas-coach'
          ? createGasCoach()
          : (DEFAULT_COACH === 'goods-coach' || DEFAULT_COACH === 'freight-van')
          ? createGoodsCoach()
          : (DEFAULT_COACH === 'container-coach' || DEFAULT_COACH === 'container-flat-wagon')
          ? createContainerCoach()
          : (DEFAULT_COACH === 'viewdeck-coach' || DEFAULT_COACH === 'mail-coach')
          ? createViewdeckCoach()
          : ModelLibrary.getMesh(DEFAULT_COACH);
        mesh = makeGhost(coachMesh, GHOST_GREEN);
      }
    } else if (selectedTool.type === 'delete') {
      // Red silhouette of hovered target: road, station, train engine or track
      if (ghostPosition?.target?.kind === 'road') {
        mesh = makeGhost(new THREE.Mesh(ROAD_GHOST_GEO, new THREE.MeshBasicMaterial({ color: GHOST_RED })), GHOST_RED, 0.5);
      } else if (ghostPosition?.target?.kind === 'station') {
        const r = ghostPosition.target.rect;
        const w = r.maxX - r.minX;
        const d = r.maxZ - r.minZ;
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(w, 1.2, d),
          new THREE.MeshBasicMaterial({ color: GHOST_RED, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false })
        );
        box.position.set(ghostPosition.x, ghostPosition.y + 0.5, ghostPosition.z);
        box.renderOrder = 10;
        mesh = box;
      } else if (ghostPosition?.target?.kind === 'train') {
        const t = trainManager?.getTrain?.(ghostPosition.target.id);
        mesh = makeGhost(createTrainEngine(t?.engineType || 'steam-engine'), GHOST_RED, 0.5);
      } else if (ghostPosition?.type) {
        mesh = ghostPosition.type === 'straight'
          ? makeGhost(createStraightTrack(), GHOST_RED, 0.5)
          : ghostPosition.type === 'ramp'
          ? makeGhost(createRampTrack(), GHOST_RED, 0.5)
          : makeGhost(createCurvedTrack(), GHOST_RED, 0.5);
      }
    }

    ghostMeshRef.current = mesh;
    return mesh;
  }, [selectedTool?.type, selectedTool?.trackType, isValidPosition, ghostPosition?.type, ghostPosition?.target?.id, ghostPosition?.coachCount]);

  // Debug-only ghost reason (advisory, never a blocker).
  useEffect(() => {
    if (import.meta.env.DEV && window.__mtw) {
      Object.assign(window.__mtw, {
        ghost: { position: ghostPosition, valid: isValidPosition, reason: ghostReason },
        trackTool: { rotation, heightOffset },
      });
    }
  }, [ghostPosition, isValidPosition, ghostReason, rotation, heightOffset]);

  return (
    <group>
      {tracks.map((track) => {
        if (!trackMeshesRef.current.has(track.id)) {
          const trackMesh = track.type === 'straight'
            ? createStraightTrack()
            : track.type === 'ramp'
            ? createRampTrack()
            : createCurvedTrack();

          let groundY = null;
          if (terrainData?.heightMap) {
            const { heightMap, length, breadth } = terrainData;
            const cx = Math.round(track.position.x / 0.5 + length / 2 - 0.5);
            const cz = Math.round(track.position.z / 0.5 + breadth / 2 - 0.5);
            if (cx >= 0 && cx < length && cz >= 0 && cz < breadth) {
              // Match OverheadLine support logic: post bottoms target voxel
              // center height, leaving lower section visibly underwater.
              groundY = heightMap[cx][cz] * 0.5;
            }
          }
          // Support clearance is world track Y minus real terrain top. Never
          // use world Y as height; that sends ordinary land beams to y=0.
          const effectiveHeight = groundY === null
            ? (track.heightOffset > 0.05 ? track.heightOffset : 0)
            : Math.max(0, track.position.y - groundY);
          if (effectiveHeight > 0.05) {
            if (track.type === 'ramp' && terrainData?.heightMap) {
              // Ramp: compute clearance at each endpoint from terrain heightmap
              const { heightMap, length, breadth } = terrainData;
              const VOXEL = 0.5;
              const groundAt = (wx, wz) => {
                const cx = Math.round(wx / VOXEL + length / 2 - 0.5);
                const cz = Math.round(wz / VOXEL + breadth / 2 - 0.5);
                if (cx < 0 || cx >= length || cz < 0 || cz >= breadth) return 0;
                return heightMap[cx][cz] * VOXEL;
              };
              const cos = Math.cos(track.rotation);
              const sin = Math.sin(track.rotation);
              // Back endpoint (t=0): ramp low end at track.position.y
              const backX = track.position.x + (-0.25) * sin;
              const backZ = track.position.z + (-0.25) * cos;
              const backGround = groundAt(backX, backZ);
              const backClearance = track.position.y - backGround;
              // Front endpoint (t=1): ramp high end is +0.5 above base
              const frontX = track.position.x + 0.25 * sin;
              const frontZ = track.position.z + 0.25 * cos;
              const frontGround = groundAt(frontX, frontZ);
              const frontClearance = track.position.y + 0.5 - frontGround;
              const avgClearance = (backClearance + frontClearance) / 2;
              if (avgClearance > 0.05) {
                const beams = createRampBeams(
                  avgClearance,
                  Math.max(0, backClearance),
                  Math.max(0, frontClearance),
                );
                if (beams) trackMesh.add(beams);
              }
            } else {
              const beams = createSupportBeams(effectiveHeight, track.type);
              if (beams) trackMesh.add(beams);
            }
          }

          trackMeshesRef.current.set(track.id, trackMesh);
        }

        const trackMesh = trackMeshesRef.current.get(track.id);
        return (
          <primitive
            key={track.id}
            object={trackMesh}
            position={[track.position.x, track.position.y, track.position.z]}
            rotation={[0, track.rotation, 0]}
          />
        );
      })}

      {ghostMesh && ghostPosition && (
        <primitive
          object={ghostMesh}
          position={[
            ghostOffsetRef.current?.x ?? ghostPosition.x,
            ghostOffsetRef.current?.y ?? ghostPosition.y,
            ghostOffsetRef.current?.z ?? ghostPosition.z,
          ]}
          rotation={[0, ghostPosition.rotation || 0, 0]}
        />
      )}

      {/* Electrification gantries + overhead wires (derived from track layout) */}
      <OverheadLine tracks={tracks} terrainData={terrainData} />
    </group>
  );
}
