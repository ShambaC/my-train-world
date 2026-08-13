import { useRef, useState, useEffect, useMemo } from 'react';
import { createStraightTrack, createCurvedTrack, createSupportBeams } from './TrackModels';
import { createTrainEngine } from '../trains/TrainModel';
import { createPassengerCoach } from '../trains/PassengerCoachModel';
import { createCoalCart } from '../trains/CoalCartModel';
import { createGasCoach } from '../trains/GasCoachModel';
import { createGoodsCoach } from '../trains/GoodsCoachModel';
import { createContainerCoach } from '../trains/ContainerCoachModel';
import { createViewdeckCoach } from '../trains/ViewdeckCoachModel';
import { makeGhost, GHOST_GREEN, GHOST_RED } from '../utils/ghost';
import { useTrackPlacement } from '../hooks/useTrackPlacement';
import ModelLibrary from '../models/ModelLibrary';
import { DEFAULT_COACH, COACH_SPACING } from '../trains/coachTypes';
import * as THREE from 'three';

export default function TrackRenderer({
  trackManager,
  stationManager,
  terrainRef,
  selectedTool,
  rotation,
  heightOffset,
  onTracksChange,
  trainManager,
  trainDirection,
  onStationsChange,
  onCoachPick,
}) {
  const [tracks, setTracks] = useState([]);
  const ghostMeshRef = useRef(null);
  const trackMeshesRef = useRef(new Map());
  const mouseDownPosRef = useRef(null);
  const ghostOffsetRef = useRef(null);

  const {
    ghostPosition,
    isValidPosition,
    updateGhostPosition,
    handlePlacement,
    handleDelete,
  } = useTrackPlacement(terrainRef, trackManager, stationManager, trainManager, selectedTool, rotation, heightOffset, trainDirection);

  // Latest values via refs — canvas listeners attach ONCE so re-renders
  // during a click event never re-attach mid-dispatch (which made clicks
  // recurse and double-place / crash).
  const selectedToolRef = useRef(selectedTool);
  const ghostRef = useRef({ ghostPosition, isValidPosition });
  const updateGhostRef = useRef(updateGhostPosition);
  const handlePlacementRef = useRef(handlePlacement);
  const trackManagerRef = useRef(trackManager);
  const stationManagerRef = useRef(stationManager);
  const trainManagerRef = useRef(trainManager);
  const trainDirectionRef = useRef(trainDirection);
  const onTracksChangeRef = useRef(onTracksChange);
  const onStationsChangeRef = useRef(onStationsChange);
  const onCoachPickRef = useRef(onCoachPick);
  selectedToolRef.current = selectedTool;
  ghostRef.current = { ghostPosition, isValidPosition };
  updateGhostRef.current = updateGhostPosition;
  handlePlacementRef.current = handlePlacement;
  trackManagerRef.current = trackManager;
  stationManagerRef.current = stationManager;
  trainManagerRef.current = trainManager;
  trainDirectionRef.current = trainDirection;
  onTracksChangeRef.current = onTracksChange;
  onStationsChangeRef.current = onStationsChange;
  onCoachPickRef.current = onCoachPick;

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

  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const handleMouseDown = (e) => {
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const isOnCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!isOnCanvas) return;

      if (mouseDownPosRef.current) {
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
        if (dx > 5 || dy > 5) {
          mouseDownPosRef.current = null;
          return;
        }
      }

      const tool = selectedToolRef.current;
      const { ghostPosition, isValidPosition } = ghostRef.current;

      if (tool?.type === 'train') {
        if (ghostPosition?.isTrack) {
          const track = trackManagerRef.current.getTrackAtPosition(ghostPosition, 0.35);
          if (track) trainManagerRef.current.addTrain(track.id, trainDirectionRef.current);
        }
      } else if (tool?.type === 'coach') {
        const target = ghostPosition?.target;
        if (target?.kind === 'train') {
          onCoachPickRef.current?.(target.id, e.clientX, e.clientY);
        }
      } else if (tool?.type === 'delete') {
        const target = ghostPosition?.target;
        if (target?.kind === 'station') {
          stationManagerRef.current.removeStation(target.id);
          setTracks(trackManagerRef.current.getAllTracks());
          onStationsChangeRef.current?.();
        } else if (target?.kind === 'track') {
          trainManagerRef.current.getAllTrains()
            .filter(t => t.currentTrackId === target.id)
            .forEach(t => trainManagerRef.current.removeTrain(t.id));
          trackManagerRef.current.removeTrack(target.id);
          setTracks(trackManagerRef.current.getAllTracks());
          onTracksChangeRef.current?.(trackManagerRef.current.getAllTracks());
        } else if (target?.kind === 'train') {
          trainManagerRef.current.removeTrain(target.id);
        }
      } else if (tool && ghostPosition && isValidPosition) {
        const track = handlePlacementRef.current(e);
        if (track) {
          setTracks(trackManagerRef.current.getAllTracks());
          onTracksChangeRef.current?.(trackManagerRef.current.getAllTracks());
        }
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
        : makeGhost(createCurvedTrack(), color);
    } else if (selectedTool.type === 'train') {
      mesh = makeGhost(createTrainEngine(0), isValidPosition ? GHOST_GREEN : GHOST_RED);
    } else if (selectedTool.type === 'coach') {
      // Green ghost of the default coach, hovering behind the engine
      if (ghostPosition?.target?.kind === 'train') {
        const spacing = COACH_SPACING[DEFAULT_COACH] ?? 1.2;
        const head = new THREE.Vector3(
          Math.sin(ghostPosition.rotation),
          0,
          Math.cos(ghostPosition.rotation)
        );
        const ghostPos = {
          x: ghostPosition.x - head.x * spacing,
          y: ghostPosition.y,
          z: ghostPosition.z - head.z * spacing,
        };
        ghostOffsetRef.current = ghostPos;
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
      // Red silhouette of hovered target: train engine, track model or station
      if (ghostPosition?.target?.kind === 'station') {
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
        mesh = makeGhost(createTrainEngine(0), GHOST_RED, 0.5);
      } else if (ghostPosition?.type) {
        mesh = ghostPosition.type === 'straight'
          ? makeGhost(createStraightTrack(), GHOST_RED, 0.5)
          : makeGhost(createCurvedTrack(), GHOST_RED, 0.5);
      }
    }

    ghostMeshRef.current = mesh;
    return mesh;
  }, [selectedTool?.type, selectedTool?.trackType, isValidPosition, ghostPosition?.type, ghostPosition?.target?.id]);

  return (
    <group>
      {tracks.map((track) => {
        if (!trackMeshesRef.current.has(track.id)) {
          const trackMesh = track.type === 'straight'
            ? createStraightTrack()
            : createCurvedTrack();

          const effectiveHeight = track.heightOffset > 0.05 ? track.heightOffset : (track.position.y > 0.6 ? track.position.y : 0);
          if (effectiveHeight > 0.05) {
            const beams = createSupportBeams(effectiveHeight, track.type);
            if (beams) trackMesh.add(beams);
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
    </group>
  );
}
