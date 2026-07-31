import { useRef, useState, useCallback, useEffect } from 'react';
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
  const lastMousePos = useRef({ x: 0, y: 0 }); // Store last mouse position

  const updateGhostPosition = useCallback((event) => {
    if (!terrainRef.current || !selectedTool) {
      setGhostPosition(null);
      return;
    }
    
    // For delete and train tools, we still need ghost position to show where we're clicking
    if (selectedTool.type === 'delete' || selectedTool.type === 'train') {
      // Get mouse position for raycasting
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      lastMousePos.current = { x: event.clientX, y: event.clientY };
      
      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObject(terrainRef.current, true);
      
      if (intersects.length > 0) {
        const point = intersects[0].point;
        const snapped = trackManager.snapToGrid(point);

        if (selectedTool.type === 'train') {
          // Snap ghost to the actual track under cursor
          const track = trackManager.getTrackAtPosition(snapped, 0.8);
          if (track) {
            setGhostPosition({
              x: track.position.x,
              y: track.position.y,
              z: track.position.z,
              rotation: track.rotation || 0,
              type: track.type,
              isTrack: true,
            });
            setIsValidPosition(true);
          } else {
            setGhostPosition({
              x: snapped.x,
              y: snapped.y,
              z: snapped.z,
              rotation: 0,
              type: null,
              isTrack: false,
            });
            setIsValidPosition(false);
          }
        } else {
          // Delete tool: snap to hovered track
          const track = trackManager.getTrackAtPosition(snapped, 1.0);
          setGhostPosition({
            x: track ? track.position.x : snapped.x,
            y: track ? track.position.y : snapped.y,
            z: track ? track.position.z : snapped.z,
            rotation: track ? (track.rotation || 0) : 0,
            type: track ? track.type : null,
            isTrack: !!track,
          });
          setIsValidPosition(!!track);
        }
      } else {
        setGhostPosition(null);
      }
      return;
    }

    // Get mouse position in normalized device coordinates
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Store last mouse position
    lastMousePos.current = { x: event.clientX, y: event.clientY };

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

  // Recalculate ghost position when rotation or heightOffset changes
  const recalculateGhostPosition = useCallback(() => {
    if (!terrainRef.current || !selectedTool || !lastMousePos.current.x) {
      return;
    }
    
    // Skip recalculation for delete and train tools
    if (selectedTool.type === 'delete' || selectedTool.type === 'train') {
      return;
    }

    // Simulate a mouse move event with the last known position
    const syntheticEvent = {
      clientX: lastMousePos.current.x,
      clientY: lastMousePos.current.y
    };
    updateGhostPosition(syntheticEvent);
  }, [terrainRef, selectedTool, updateGhostPosition]);

  // Trigger recalculation when rotation or heightOffset changes
  useEffect(() => {
    recalculateGhostPosition();
  }, [rotation, heightOffset, recalculateGhostPosition]);

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
