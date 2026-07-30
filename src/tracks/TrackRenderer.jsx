import { useRef, useState, useEffect, useMemo } from 'react';
import { createStraightTrack, createCurvedTrack, createSupportBeams } from './TrackModels';
import { createTrainGhost } from '../trains/TrainModel';
import { useTrackPlacement } from '../hooks/useTrackPlacement';
import * as THREE from 'three';

/**
 * Track Renderer Component - Renders all placed tracks and ghost preview
 */
export default function TrackRenderer({ 
  trackManager, 
  terrainRef, 
  selectedTool, 
  rotation,
  heightOffset,
  onTracksChange,
  trainManager // Add trainManager prop
}) {
  const [tracks, setTracks] = useState([]);
  const ghostMeshRef = useRef(null);
  const trackMeshesRef = useRef(new Map());
  const mouseDownPosRef = useRef(null); // Track mousedown position to prevent drag-placing
  
  const {
    ghostPosition,
    isValidPosition,
    updateGhostPosition,
    handlePlacement,
    handleDelete,
  } = useTrackPlacement(terrainRef, trackManager, selectedTool, rotation, heightOffset);

  // Update tracks list when changed
  useEffect(() => {
    setTracks(trackManager.getAllTracks());
  }, [trackManager]);

  // Handle mouse move for ghost preview
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const handleMouseMove = (e) => {
      updateGhostPosition(e);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    return () => canvas.removeEventListener('mousemove', handleMouseMove);
  }, [updateGhostPosition]);

  // Handle click for placement/deletion
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const handleMouseDown = (e) => {
      // Record mouse position on mousedown
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleClick = (e) => {
      // Check if click is on canvas (not UI)
      const rect = canvas.getBoundingClientRect();
      const isOnCanvas = 
        e.clientX >= rect.left && 
        e.clientX <= rect.right && 
        e.clientY >= rect.top && 
        e.clientY <= rect.bottom;

      if (!isOnCanvas) return;

      // Prevent placement if mouse moved significantly (drag)
      if (mouseDownPosRef.current) {
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
        const dragThreshold = 5; // pixels
        
        if (dx > dragThreshold || dy > dragThreshold) {
          mouseDownPosRef.current = null;
          return; // Don't place if user was dragging
        }
      }

      if (selectedTool?.type === 'train') {
        // Place train on track at cursor position
        if (ghostPosition) {
          const track = trackManager.getTrackAtPosition(ghostPosition, 0.8);
          if (track) {
            trainManager.addTrain(track.id, 1);
          }
        }
      } else if (selectedTool?.type === 'delete') {
        // Delete track at position
        if (ghostPosition) {
          const trackToDelete = trackManager.getTrackAtPosition(ghostPosition, 1.0);
          if (trackToDelete) {
            // Also remove any trains on this track
            const trainsOnTrack = trainManager.getAllTrains().filter(
              train => train.currentTrackId === trackToDelete.id
            );
            trainsOnTrack.forEach(train => {
              trainManager.removeTrain(train.id);
            });
            
            trackManager.removeTrack(trackToDelete.id);
            setTracks(trackManager.getAllTracks());
            onTracksChange?.(trackManager.getAllTracks());
          } else {
            // Try to delete a train directly
            const trains = trainManager.getAllTrains();
            for (const train of trains) {
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

  // Cleanup old track meshes
  useEffect(() => {
    const currentTrackIds = new Set(tracks.map(t => t.id));
    
    // Remove meshes for deleted tracks
    for (const [id, mesh] of trackMeshesRef.current.entries()) {
      if (!currentTrackIds.has(id)) {
        // Dispose geometry and material
        mesh.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        trackMeshesRef.current.delete(id);
      }
    }
  }, [tracks]);

  // Create ghost mesh - handles tracks, train placement, and delete red silhouette
  const ghostMesh = useMemo(() => {
    if (!ghostPosition || !selectedTool) {
      if (ghostMeshRef.current) {
        ghostMeshRef.current.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        ghostMeshRef.current = null;
      }
      return null;
    }

    if (ghostMeshRef.current) {
      ghostMeshRef.current.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }

    let mesh = null;

    if (selectedTool.type === 'train') {
      const trackUnder = trackManager.getTrackAtPosition(ghostPosition, 0.8);
      mesh = createTrainGhost(!!trackUnder);
    } else if (selectedTool.type === 'delete') {
      const trackToDelete = trackManager.getTrackAtPosition(ghostPosition, 1.0);
      if (trackToDelete) {
        mesh = trackToDelete.type === 'straight'
          ? createStraightTrack(true, false)
          : createCurvedTrack(true, false);
      } else {
        mesh = createTrainGhost(false);
      }
    } else if (selectedTool.type === 'track') {
      mesh = ghostPosition.type === 'straight'
        ? createStraightTrack(true, isValidPosition)
        : createCurvedTrack(true, isValidPosition);
    }

    ghostMeshRef.current = mesh;
    return mesh;
  }, [ghostPosition, isValidPosition, selectedTool, rotation, heightOffset, trackManager]);

  return (
    <group>
      {/* Render placed tracks */}
      {tracks.map((track) => {
        if (!trackMeshesRef.current.has(track.id)) {
          const trackMesh = track.type === 'straight' 
            ? createStraightTrack(false) 
            : createCurvedTrack(false);
          
          // Support beams if elevated (heightOffset > 0.05 or positioned above 0.6)
          const effectiveHeight = track.heightOffset > 0.05 ? track.heightOffset : (track.position.y > 0.6 ? track.position.y : 0);
          if (effectiveHeight > 0.05) {
            const beams = createSupportBeams(effectiveHeight, track.type);
            if (beams) {
              trackMesh.add(beams);
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

      {/* Ghost preview */}
      {ghostMesh && ghostPosition && (
        <primitive
          object={ghostMesh}
          position={[ghostPosition.x, ghostPosition.y, ghostPosition.z]}
          rotation={[0, ghostPosition.rotation, 0]}
        />
      )}
    </group>
  );
}
