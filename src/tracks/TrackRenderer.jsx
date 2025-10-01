import { useRef, useState, useEffect } from 'react';
import { createStraightTrack, createCurvedTrack } from './TrackModels';
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
  onTracksChange 
}) {
  const [tracks, setTracks] = useState([]);
  const [ghostTrack, setGhostTrack] = useState(null);
  const tracksGroupRef = useRef(new THREE.Group());
  
  const {
    ghostPosition,
    isValidPosition,
    updateGhostPosition,
    handlePlacement,
    handleDelete,
  } = useTrackPlacement(terrainRef, trackManager, selectedTool, rotation, heightOffset);

  // Update ghost track preview
  useEffect(() => {
    if (ghostPosition && selectedTool && selectedTool.type !== 'delete') {
      setGhostTrack({
        ...ghostPosition,
        isValid: isValidPosition,
      });
    } else {
      setGhostTrack(null);
    }
  }, [ghostPosition, isValidPosition, selectedTool]);

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

    const handleClick = (e) => {
      // Check if click is on canvas (not UI)
      const rect = canvas.getBoundingClientRect();
      const isOnCanvas = 
        e.clientX >= rect.left && 
        e.clientX <= rect.right && 
        e.clientY >= rect.top && 
        e.clientY <= rect.bottom;

      if (!isOnCanvas) return;

      if (selectedTool?.type === 'delete') {
        const deleted = handleDelete(e);
        if (deleted) {
          setTracks(trackManager.getAllTracks());
          onTracksChange?.(trackManager.getAllTracks());
        }
      } else if (selectedTool && ghostPosition && isValidPosition) {
        const track = handlePlacement(e);
        if (track) {
          setTracks(trackManager.getAllTracks());
          onTracksChange?.(trackManager.getAllTracks());
        }
      }
    };

    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
  }, [selectedTool, ghostPosition, isValidPosition, handlePlacement, handleDelete, trackManager, onTracksChange]);

  return (
    <group ref={tracksGroupRef}>
      {/* Render placed tracks */}
      {tracks.map((track) => {
        const trackMesh = track.type === 'straight' 
          ? createStraightTrack(false) 
          : createCurvedTrack(false);
        
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
      {ghostTrack && (
        <primitive
          object={
            ghostTrack.type === 'straight'
              ? createStraightTrack(true, ghostTrack.isValid)
              : createCurvedTrack(true, ghostTrack.isValid)
          }
          position={[ghostTrack.x, ghostTrack.y, ghostTrack.z]}
          rotation={[0, ghostTrack.rotation, 0]}
        />
      )}
    </group>
  );
}
