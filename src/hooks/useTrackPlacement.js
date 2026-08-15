import { useRef, useState, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WATER_LEVEL } from '../terrain.js';
import { getEndpoints } from '../tracks/trackGeometry.js';

// Endpoint snap assist radius — small enough that deliberate near-miss
// placements (scenery right beside a track) are never hijacked.
const SNAP_RADIUS = 0.4;

/**
 * Soft snap: if a ghost endpoint lands within SNAP_RADIUS of an existing
 * track endpoint (same height), shift the ghost so the endpoints meet
 * exactly and align straight-track rotation with the neighbor's axis.
 * Advisory only — the user always sees where the ghost actually lands.
 */
function findEndpointSnap(trackManager, type, position, rotation) {
  const eps = getEndpoints(type, position, rotation);
  let best = null;

  for (const track of trackManager.getAllTracks()) {
    if (Math.abs(track.position.y - position.y) > 0.15) continue;
    const other = getEndpoints(track.type, track.position, track.rotation);
    for (const myEp of [eps.front, eps.back]) {
      for (const otherEp of [other.front, other.back]) {
        const d = Math.hypot(myEp.x - otherEp.x, myEp.z - otherEp.z);
        if (d < SNAP_RADIUS && (!best || d < best.d)) {
          best = { d, myEp, otherEp, track };
        }
      }
    }
  }

  if (!best) return null;

  const newPos = {
    x: position.x + (best.otherEp.x - best.myEp.x),
    y: position.y,
    z: position.z + (best.otherEp.z - best.myEp.z),
  };

  let newRot = rotation;
  if (type === 'straight') {
    // Align with the neighbor's axis (grid rotations: 0/90/180/270)
    const ax = best.otherEp.x - best.track.position.x;
    const az = best.otherEp.z - best.track.position.z;
    newRot = Math.atan2(ax, az);
  }

  return { position: newPos, rotation: newRot };
}

/**
 * Custom hook for raycasting and track placement.
 *
 * Ghost state recomputes on: pointer movement, tool/rotation/height/direction
 * changes, camera movement (orbit/pan/zoom/WASD/follow), terrain changes and
 * track/station count changes — so placement never needs a mouse-away nudge.
 * The click handler also recomputes synchronously from the click event.
 */
export function useTrackPlacement(terrainRef, trackManager, stationManager, trainManager, selectedTool, rotation, heightOffset, trainDirection, signalManager, roadManager) {
  const { camera, gl } = useThree();
  const [ghostPosition, setGhostPosition] = useState(null);
  const [isValidPosition, setIsValidPosition] = useState(true);
  const [ghostReason, setGhostReason] = useState(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const lastMousePos = useRef({ x: 0, y: 0 }); // Store last mouse position
  const pointerInside = useRef(false); // pointer currently over the canvas
  const latestRef = useRef({ ghostPosition: null, isValidPosition: true, ghostReason: null, hitPoint: null }); // synchronous mirror for clicks
  const selectedToolRef = useRef(selectedTool);
  const lastCamPos = useRef(new THREE.Vector3());
  const lastCamQuat = useRef(new THREE.Quaternion());
  selectedToolRef.current = selectedTool;

  // Keep the synchronous mirror current for click handlers that run before
  // React re-renders (placement right after tool/rotation/camera changes).
  const publish = (gp, valid, reason) => {
    latestRef.current = { ...latestRef.current, ghostPosition: gp, isValidPosition: valid, ghostReason: reason };
    setGhostPosition(gp);
    setIsValidPosition(valid);
    setGhostReason(reason);
  };

  const updateGhostPosition = useCallback((event) => {
    if (!terrainRef.current || !selectedToolRef.current) {
      publish(null, true, null);
      return;
    }

    const tool = selectedToolRef.current;

    // Hand tool: no ghost, but remember the exact terrain hit so the
    // hand-tool click can select whatever sits under the cursor.
    if (tool.type === 'hand') {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObject(terrainRef.current, true);
      latestRef.current = {
        ...latestRef.current,
        hitPoint: intersects.length ? { ...intersects[0].point } : null,
      };
      publish(null, true, null);
      return;
    }

    // Station tool: handled by StationRenderer
    if (tool.type === 'station') {
      publish(null, true, null);
      return;
    }

    // Coach tool: target an engine in the world
    if (tool.type === 'coach') {
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObject(terrainRef.current, true);
      if (intersects.length === 0) {
        publish(null, true, null);
        return;
      }
      const point = intersects[0].point;
      let train = null;
      for (const t of trainManager.getAllTrains()) {
        const dx = Math.abs(t.position.x - point.x);
        const dz = Math.abs(t.position.z - point.z);
        if (dx < 0.45 && dz < 0.45) {
          train = t;
          break;
        }
      }
      if (train) {
        publish({
          x: train.position.x,
          y: train.position.y,
          z: train.position.z,
          rotation: train.rotation,
          type: null,
          target: { kind: 'train', id: train.id },
        }, true, null);
      } else {
        publish(null, true, null);
      }
      return;
    }

    // For delete and train tools, we still need ghost position to show where we're clicking
    if (tool.type === 'delete' || tool.type === 'train') {
      // Get mouse position for raycasting
      const rect = gl.domElement.getBoundingClientRect();
      mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      lastMousePos.current = { x: event.clientX, y: event.clientY };

      raycaster.current.setFromCamera(mouse.current, camera);
      const intersects = raycaster.current.intersectObject(terrainRef.current, true);

      if (intersects.length > 0) {
        const point = intersects[0].point;

        if (tool.type === 'train') {
          // Snap ghost to the actual track under cursor
          const track = trackManager.getTrackAtPosition(point, 0.35);
          if (track) {
            const flip = trainDirection === -1 ? Math.PI : 0;
            publish({
              x: track.position.x,
              y: track.position.y,
              z: track.position.z,
              rotation: (track.rotation || 0) + flip,
              type: track.type,
              isTrack: true,
            }, true, null);
          } else {
            const snapped = trackManager.snapToGrid(point);
            publish({
              x: snapped.x,
              y: snapped.y,
              z: snapped.z,
              rotation: 0,
              type: null,
              isTrack: false,
            }, false, 'no track under cursor');
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
          if (!target && roadManager) {
            const road = roadManager.findRoadAtPosition(point, 0.7);
            if (road) {
              target = { kind: 'road', id: road.road.id, position: road.center, rotation: road.rotation, type: null };
            }
          }
          if (target) {
            publish({
              x: target.position.x,
              y: target.position.y,
              z: target.position.z,
              rotation: target.rotation,
              type: target.type,
              target,
            }, true, null);
          } else {
            publish(null, true, null);
          }
        }
      } else {
        publish(null, true, null);
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
        publish(null, true, null);
        return;
      }

      // Snap to grid (y = voxel top) + height offset
      const snapped = trackManager.snapToGrid(point);
      snapped.y = snapped.y + heightOffset;

      let valid = true;
      let reason = null;
      if (selectedToolRef.current.type === 'track') {
        valid = trackManager.isValidPlacement(
          snapped,
          selectedToolRef.current.trackType,
          rotation,
          point.y,
          normal
        );
        if (!valid) {
          reason = point.y < WATER_LEVEL ? 'water' : 'occupied or invalid spot';
        }

        // Endpoint snap assist — advisory, moves ghost only when it already
        // nearly touches an existing endpoint.
        const snap = findEndpointSnap(trackManager, selectedToolRef.current.trackType, snapped, rotation);
        if (snap) {
          snapped.x = snap.position.x;
          snapped.z = snap.position.z;
        }
        const ghostRot = snap ? snap.rotation : rotation;
        publish({
          ...snapped,
          rotation: ghostRot,
          type: selectedToolRef.current.trackType,
          snappedToEndpoint: !!snap,
        }, valid, reason);
        return;
      } else if (selectedToolRef.current.type === 'road') {
        // Roads stay permissive: allow track overlap/crossings, reject only
        // water and duplicate same-axis road tiles.
        valid = point.y >= WATER_LEVEL && roadManager?.isRoadPlacementValid(snapped, rotation) !== false;
        if (!valid) reason = point.y < WATER_LEVEL ? 'water' : 'road already here';
      }

      publish({
        ...snapped,
        rotation: rotation,
        type: selectedToolRef.current.type === 'road' ? 'road' : selectedToolRef.current.trackType,
      }, valid, reason);
    } else {
      publish(null, true, null);
    }
  }, [camera, gl, terrainRef, trackManager, trainManager, rotation, heightOffset, trainDirection, roadManager]);

  // Recalculate ghost position when rotation, height, direction or tool changes
  const recalculateGhostPosition = useCallback(() => {
    if (!terrainRef.current || !selectedToolRef.current || !pointerInside.current || lastMousePos.current.x === undefined) {
      return;
    }

    // Simulate a mouse move event with the last known position
    const syntheticEvent = {
      clientX: lastMousePos.current.x,
      clientY: lastMousePos.current.y
    };
    updateGhostPosition(syntheticEvent);
  }, [terrainRef, updateGhostPosition]);

  // Trigger recalculation when rotation/height/direction/tool/terrain changes
  useEffect(() => {
    recalculateGhostPosition();
  }, [rotation, heightOffset, trainDirection, selectedTool?.type, selectedTool?.trackType, terrainRef, recalculateGhostPosition]);

  // Recompute after track/station count changes (placement/deletion without
  // a subsequent mouse move — delete ghost must show the new target).
  const trackCount = trackManager.getAllTracks().length;
  const stationCount = stationManager?.getAllStations().length ?? 0;
  useEffect(() => {
    recalculateGhostPosition();
  }, [trackCount, stationCount, recalculateGhostPosition]);

  // Pointer leave/enter on the canvas: hide the ghost while away, but keep
  // the last pointer position so returning restores it immediately.
  useEffect(() => {
    const canvas = gl.domElement;
    const onEnter = () => {
      pointerInside.current = true;
      recalculateGhostPosition();
    };
    const onLeave = () => {
      pointerInside.current = false;
      publish(null, true, null);
    };
    canvas.addEventListener('pointerenter', onEnter);
    canvas.addEventListener('pointerleave', onLeave);
    return () => {
      canvas.removeEventListener('pointerenter', onEnter);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, [gl, recalculateGhostPosition]);

  // Camera-driven recompute: orbit, pan, zoom, WASD and follow all move the
  // camera — the ghost must track the new view without any pointer motion.
  useFrame(() => {
    if (camera.position.distanceToSquared(lastCamPos.current) < 1e-6 && camera.quaternion.equals(lastCamQuat.current)) {
      return;
    }
    lastCamPos.current.copy(camera.position);
    lastCamQuat.current.copy(camera.quaternion);
    if (pointerInside.current && selectedToolRef.current) recalculateGhostPosition();
  });

  const handlePlacement = useCallback(() => {
    const { ghostPosition, isValidPosition } = latestRef.current;
    if (!ghostPosition || !isValidPosition || !selectedToolRef.current) return null;

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
  }, [trackManager, heightOffset]);

  const handleDelete = useCallback((event) => {
    if (!selectedToolRef.current || selectedToolRef.current.type !== 'delete') return null;

    // Get mouse position
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, camera);

    if (latestRef.current.ghostPosition) {
      const track = trackManager.getTrackAtPosition(latestRef.current.ghostPosition);
      if (track) {
        trackManager.removeTrack(track.id);
        return track.id;
      }
    }

    return null;
  }, [camera, gl, trackManager]);

  return {
    ghostPosition,
    isValidPosition,
    ghostReason,
    latestRef,
    updateGhostPosition,
    handlePlacement,
    handleDelete,
    recalculateGhostPosition,
  };
}
