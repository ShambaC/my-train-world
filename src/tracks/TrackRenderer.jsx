import { useRef, useState, useEffect, useMemo } from 'react';
import { createStraightTrack, createCurvedTrack, createSupportBeams } from './TrackModels';
import { createTrainEngine } from '../trains/TrainModel';
import { makeGhost, GHOST_GREEN, GHOST_RED } from '../utils/ghost';
import { useTrackPlacement } from '../hooks/useTrackPlacement';
import * as THREE from 'three';

export default function TrackRenderer({
  trackManager,
  terrainRef,
  selectedTool,
  rotation,
  heightOffset,
  onTracksChange,
  trainManager,
  trainDirection,
}) {
  const [tracks, setTracks] = useState([]);
  const ghostMeshRef = useRef(null);
  const trackMeshesRef = useRef(new Map());
  const mouseDownPosRef = useRef(null);

  const {
    ghostPosition,
    isValidPosition,
    updateGhostPosition,
    handlePlacement,
    handleDelete,
  } = useTrackPlacement(terrainRef, trackManager, selectedTool, rotation, heightOffset);

  useEffect(() => {
    setTracks(trackManager.getAllTracks());
  }, [trackManager]);

  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const handleMouseMove = (e) => updateGhostPosition(e);
    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }, [updateGhostPosition]);

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

      if (selectedTool?.type === 'train') {
        if (ghostPosition?.isTrack) {
          const track = trackManager.getTrackAtPosition(ghostPosition, 0.8);
          if (track) trainManager.addTrain(track.id, trainDirection);
        }
      } else if (selectedTool?.type === 'delete') {
        if (ghostPosition) {
          const trackToDelete = trackManager.getTrackAtPosition(ghostPosition, 1.0);
          if (trackToDelete) {
            trainManager.getAllTrains()
              .filter(t => t.currentTrackId === trackToDelete.id)
              .forEach(t => trainManager.removeTrain(t.id));
            trackManager.removeTrack(trackToDelete.id);
            setTracks(trackManager.getAllTracks());
            onTracksChange?.(trackManager.getAllTracks());
          } else {
            for (const train of trainManager.getAllTrains()) {
              const dx = Math.abs(train.position.x - ghostPosition.x);
              const dz = Math.abs(train.position.z - ghostPosition.z);
              if (dx < 0.5 && dz < 0.5) {
                trainManager.removeTrain(train.id);
                break;
              }
            }
          }
        }
      } else if (selectedTool && ghostPosition && isValidPosition) {
        const track = handlePlacement(e);
        if (track) {
          setTracks(trackManager.getAllTracks());
          onTracksChange?.(trackManager.getAllTracks());
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
  }, [selectedTool, ghostPosition, isValidPosition, handlePlacement, handleDelete, trackManager, onTracksChange]);

  useEffect(() => {
    const currentTrackIds = new Set(tracks.map(t => t.id));
    for (const [id, mesh] of trackMeshesRef.current.entries()) {
      if (!currentTrackIds.has(id)) {
        mesh.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
            else child.material.dispose();
          }
        });
        trackMeshesRef.current.delete(id);
      }
    }
  }, [tracks]);

  // Build ghost based on tool type + validity (deps change rarely)
  const ghostMesh = useMemo(() => {
    if (!selectedTool) return null;

    // Dispose old ghost
    if (ghostMeshRef.current) {
      ghostMeshRef.current.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
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
    } else if (selectedTool.type === 'delete') {
      // Red silhouette of hovered object
      if (ghostPosition?.isTrack && ghostPosition?.type) {
        mesh = ghostPosition.type === 'straight'
          ? makeGhost(createStraightTrack(), GHOST_RED, 0.5)
          : makeGhost(createCurvedTrack(), GHOST_RED, 0.5);
      } else {
        mesh = makeGhost(createTrainEngine(0), GHOST_RED, 0.5);
      }
    }

    ghostMeshRef.current = mesh;
    return mesh;
  }, [selectedTool?.type, selectedTool?.trackType, isValidPosition, ghostPosition?.type, ghostPosition?.isTrack]);

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
          position={[ghostPosition.x, ghostPosition.y, ghostPosition.z]}
          rotation={[0, ghostPosition.rotation || 0, 0]}
        />
      )}
    </group>
  );
}
