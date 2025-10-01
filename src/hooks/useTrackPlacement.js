import { useRef, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Custom hook for raycasting and track placement
 */
export function useTrackPlacement(terrainRef, trackManager, selectedTool, rotation, heightOffset) {
  const { camera, gl } = useThree();
  const [ghostPosition, setGhostPosition] = useState(null);
  const [isValidPosition, setIsValidPosition] = useState(true);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  const updateGhostPosition = useCallback((event) => {
    if (!terrainRef.current || !selectedTool || selectedTool.type === 'delete') {
      setGhostPosition(null);
      return;
    }

    // Get mouse position in normalized device coordinates
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Update raycaster
    raycaster.current.setFromCamera(mouse.current, camera);

    // Check intersection with terrain
    const intersects = raycaster.current.intersectObject(terrainRef.current, true);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      const normal = intersects[0].face ? intersects[0].face.normal : new THREE.Vector3(0, 1, 0);
      
      // Snap to grid
      const snapped = trackManager.snapToGrid(point);
      snapped.y = point.y + heightOffset;

      // Check if valid placement (only for track tools) - pass surface normal
      const valid = selectedTool.type === 'track' ? trackManager.isValidPlacement(
        snapped,
        selectedTool.trackType,
        rotation,
        point.y,
        normal
      ) : true;

      setIsValidPosition(valid);
      setGhostPosition({
        ...snapped,
        rotation: rotation,
        type: selectedTool.trackType,
      });
    } else {
      setGhostPosition(null);
    }
  }, [camera, gl, terrainRef, trackManager, selectedTool, rotation, heightOffset]);

  const handlePlacement = useCallback((event) => {
    if (!ghostPosition || !isValidPosition || !selectedTool) return null;

    // Add track at ghost position
    const track = trackManager.addTrack(
      ghostPosition.type,
      {
        x: ghostPosition.x,
        y: ghostPosition.y,
        z: ghostPosition.z,
      },
      ghostPosition.rotation,
      heightOffset
    );

    return track;
  }, [ghostPosition, isValidPosition, trackManager, selectedTool, heightOffset]);

  const handleDelete = useCallback((event) => {
    if (!selectedTool || selectedTool.type !== 'delete') return null;

    // Get mouse position
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);

    // Check for track under cursor (would need track meshes)
    // For now, check position-based
    if (ghostPosition) {
      const track = trackManager.getTrackAtPosition(ghostPosition);
      if (track) {
        trackManager.removeTrack(track.id);
        return track.id;
      }
    }

    return null;
  }, [camera, gl, ghostPosition, trackManager, selectedTool]);

  return {
    ghostPosition,
    isValidPosition,
    updateGhostPosition,
    handlePlacement,
    handleDelete,
  };
}
