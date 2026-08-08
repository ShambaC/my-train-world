import { useRef, useState, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Custom hook for raycasting and track placement
 */
export function useTrackPlacement(terrainRef, trackManager, stationManager, trainManager, selectedTool, rotation, heightOffset, trainDirection) {
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
    
    // Hand tool: no ghost
    if (selectedTool.type === 'hand') {
      setGhostPosition(null);
      return;
    }
    
    // Station tool: handled by StationRenderer
    if (selectedTool.type === 'station') {
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

        if (selectedTool.type === 'train') {
          // Snap ghost to the actual track under cursor
          const track = trackManager.getTrackAtPosition(point, 0.35);
          if (track) {
            const flip = trainDirection === -1 ? Math.PI : 0;
            setGhostPosition({
              x: track.position.x,
              y: track.position.y,
              z: track.position.z,
              rotation: (track.rotation || 0) + flip,
              type: track.type,
              isTrack: true,
            });
            setIsValidPosition(true);
          } else {
            const snapped = trackManager.snapToGrid(point);
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
          // Delete tool: resolve exact target — trains first, then tracks
          let target = null;
          for (const train of trainManager.getAllTrains()) {
            const dx = Math.abs(train.position.x - point.x);
            const dz = Math.abs(train.position.z - point.z);
            if (dx < 0.45 && dz < 0.45) {
              target = { kind: 'train', id: train.id, position: train.position, rotation: train.rotation, type: null };
              break;
            }
          }
          if (!target) {
            const track = trackManager.getTrackAtPosition(point, 0.35);
            if (track) {
              target = { kind: 'track', id: track.id, position: track.position, rotation: track.rotation || 0, type: track.type };
            }
          }
          if (!target) {
            const station = stationManager?.getStationAtPosition(point, 0.9);
            if (station) {
              target = { kind: 'station', id: station.id, position: station.centerWorld, rect: station.worldRect };
            }
          }
          if (target) {
            setGhostPosition({
              x: target.position.x,
              y: target.position.y,
              z: target.position.z,
              rotation: target.rotation,
              type: target.type,
              target,
            });
            setIsValidPosition(true);
          } else {
            setGhostPosition(null);
          }
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
      
      // Only allow placement on top surface (normal pointing up)
      if (Math.abs(normal.y) < 0.8) {
        setGhostPosition(null);
        return;
      }
      
      // Snap to grid (y = voxel top) + height offset
      const snapped = trackManager.snapToGrid(point);
      snapped.y = snapped.y + heightOffset;

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
  }, [camera, gl, terrainRef, trackManager, trainManager, selectedTool, rotation, heightOffset, trainDirection]);

  // Recalculate ghost position when rotation or heightOffset changes
  const recalculateGhostPosition = useCallback(() => {
    if (!terrainRef.current || !selectedTool || !lastMousePos.current.x) {
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
  }, [rotation, heightOffset, trainDirection, recalculateGhostPosition]);

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
