import { useRef, useState, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { WATER_LEVEL } from '../terrain.js';
import { COACH_LENGTH, DEFAULT_COACH } from '../trains/coachTypes.js';

// Water plane sits at WATER_LEVEL but the shader waves crest ~0.08 above.
// Tracks placed at exact WATER_LEVEL get partially submerged by wave peaks.
const WATER_TRACK_OFFSET = 0.25;

/**
 * Custom hook for raycasting and track placement.
 *
 * Ghost state recomputes on: pointer movement, tool/rotation/height/direction
 * changes, camera movement (orbit/pan/zoom/WASD/follow), terrain changes and
 * track/station count changes — so placement never needs a mouse-away nudge.
 * The click handler also recomputes synchronously from the click event.
 */
export function useTrackPlacement(terrainRef, trackManager, stationManager, trainManager, selectedTool, rotation, heightOffset, trainDirection, signalManager, roadManager, waterRef) {
  const { camera, gl } = useThree();
  const [ghostPosition, setGhostPosition] = useState(null);
  const [isValidPosition, setIsValidPosition] = useState(true);
  const [ghostReason, setGhostReason] = useState(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const lastMousePos = useRef({ x: 0, y: 0 }); // Store last mouse position
  const hasMouseRef = useRef(false);
  const pointerInside = useRef(false); // pointer currently over the canvas
  const latestRef = useRef({ ghostPosition: null, isValidPosition: true, ghostReason: null, hitPoint: null }); // synchronous mirror for clicks
  const selectedToolRef = useRef(selectedTool);
  const lastCamPos = useRef(new THREE.Vector3());
  const lastCamQuat = useRef(new THREE.Quaternion());
  selectedToolRef.current = selectedTool;

  // Combined raycast: terrain first, water surface fallback.
  // Returns { point, isWater, faceNormal } or null.
  const raycastGround = useCallback(() => {
    const targets = [terrainRef.current];
    if (waterRef?.current) targets.push(waterRef.current);
    const hits = raycaster.current.intersectObjects(targets, true);
    if (hits.length === 0) return null;
    const hit = hits[0];
    const isWater = waterRef?.current && hit.object === waterRef.current;
    return { point: hit.point, isWater, faceNormal: hit.face?.normal };
  }, [terrainRef, waterRef]);

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
    lastMousePos.current = { x: event.clientX, y: event.clientY };
    hasMouseRef.current = true;

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
        // Offset behind last coach (or engine if no coaches yet)
        let totalOffset = 0;
        for (const c of train.coaches) totalOffset += c.spacing;
        const nextSpacing = COACH_LENGTH[DEFAULT_COACH] ?? 1.2;
        totalOffset += nextSpacing;
        const head = {
          x: Math.sin(train.rotation),
          z: Math.cos(train.rotation),
        };
        publish({
          x: train.position.x - head.x * totalOffset,
          y: train.position.y,
          z: train.position.z - head.z * totalOffset,
          rotation: train.rotation,
          type: null,
          target: { kind: 'train', id: train.id },
          coachCount: train.coaches.length,
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
      const groundHit = raycastGround();

      if (groundHit) {
        const point = groundHit.point;

        if (tool.type === 'train') {
          // Check if hovering over an existing train first (allows changing engine type)
          let hoveredTrain = null;
          for (const t of trainManager.getAllTrains()) {
            const dx = Math.abs(t.position.x - point.x);
            const dz = Math.abs(t.position.z - point.z);
            if (dx < 0.45 && dz < 0.45) {
              hoveredTrain = t;
              break;
            }
          }
          if (hoveredTrain) {
            publish({
              x: hoveredTrain.position.x,
              y: hoveredTrain.position.y,
              z: hoveredTrain.position.z,
              rotation: hoveredTrain.rotation,
              type: null,
              target: { kind: 'train', id: hoveredTrain.id },
            }, true, null);
          } else {
            // Snap ghost to the actual track under cursor
            const track = trackManager.getTrackAtPosition(point, 0.35, raycaster.current, camera);
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
            const track = trackManager.getTrackAtPosition(point, 0.35, raycaster.current, camera);
            if (track) {
              target = { kind: 'track', id: track.id, position: track.position, rotation: track.rotation || 0, type: track.type };
            }
          }
          if (!target) {
            const station = stationManager?.getStationAtPosition(point, 0.05);
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

    // Update raycaster
    raycaster.current.setFromCamera(mouse.current, camera);

    // Check intersection with terrain + water surface
    const groundHit = raycastGround();

    if (groundHit) {
      const point = groundHit.point;
      const isWater = groundHit.isWater;

      // Only allow placement on top surface (normal pointing up) — skip for water surface
      if (!isWater) {
        const normal = groundHit.faceNormal;
        if (normal && Math.abs(normal.y) < 0.8) {
          publish(null, true, null);
          return;
        }
      }

      // Snap to grid (y = voxel top) + height offset
      const snapped = trackManager.snapToGrid(point);
      // For water hits, use WATER_LEVEL as the base instead of terrain voxel top.
      // Offset above the water plane so tracks sit on the surface, not inside waves.
      if (isWater) snapped.y = WATER_LEVEL + WATER_TRACK_OFFSET;
      snapped.y = snapped.y + heightOffset;

      let valid = true;
      let reason = null;
      if (selectedToolRef.current.type === 'track') {
        valid = trackManager.isValidPlacement(
          snapped,
          selectedToolRef.current.trackType,
          rotation,
          point.y,
          isWater ? null : groundHit.faceNormal
        );
        if (!valid) {
          reason = (point.y < WATER_LEVEL && snapped.y < WATER_LEVEL + 0.15) ? 'water' : 'occupied or invalid spot';
        }

        publish({
          ...snapped,
          rotation,
          type: selectedToolRef.current.trackType,
        }, valid, reason);
        return;
      } else if (selectedToolRef.current.type === 'road') {
        // Roads stay permissive: allow track overlap/crossings, reject only
        // water, duplicate same-axis road tiles, and stations.
        valid = point.y >= WATER_LEVEL && roadManager?.isRoadPlacementValid(snapped, rotation) !== false;
        if (valid && stationManager) {
          const st = stationManager.getStationAtPosition(snapped, 0);
          if (st) { valid = false; reason = 'station here'; }
        }
        if (!valid && !reason) reason = point.y < WATER_LEVEL ? 'water' : 'road already here';
      }

      publish({
        ...snapped,
        rotation: rotation,
        type: selectedToolRef.current.type === 'road' ? 'road' : selectedToolRef.current.trackType,
      }, valid, reason);
    } else {
      publish(null, true, null);
    }
  }, [camera, gl, terrainRef, waterRef, trackManager, trainManager, rotation, heightOffset, trainDirection, roadManager]);

  // Recalculate ghost position when rotation, height, direction or tool changes
  const recalculateGhostPosition = useCallback(() => {
    if (!terrainRef.current || !selectedToolRef.current || !hasMouseRef.current) {
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
