import { useRef, useState, useCallback, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { buildStation, STATION_WIDTH, STATION_WIDTH_WORLD, MIN_STATION_LENGTH, MAX_STATION_LENGTH } from '../stations/StationBuilder';
import { pointOnTrack } from '../tracks/trackGeometry.js';

/**
 * Station placement hook — two-click flow:
 * click 1 = start marker, click 2 = end marker (cursor cell).
 *
 * Orientation is binary: 'horizontal' (station extends along X) or
 * 'vertical' (along Z), toggled by the R key. The station extends on
 * either side of the start marker — the side the cursor sits on.
 * Validates flat same-height ground, no holes, no water, no overlap.
 */
export function useStationPlacement(terrainRef, stationManager, orientation, terrainData, active = true, trackManager = null, roadManager = null) {
  const { camera, gl } = useThree();
  const [ghost, setGhost] = useState(null);
  const [stationStart, setStationStart] = useState(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const lastMousePos = useRef({ x: 0, y: 0 });
  const pointerInside = useRef(false);
  const lastCamPos = useRef(new THREE.Vector3());
  const lastCamQuat = useRef(new THREE.Quaternion());

  const length = terrainData?.length || 0;
  const breadth = terrainData?.breadth || 0;
  const heightMap = terrainData?.heightMap || null;

  const worldToCell = useCallback((p) => ({
    x: Math.round(p.x / 0.5 + length / 2 - 0.5),
    z: Math.round(p.z / 0.5 + breadth / 2 - 0.5),
  }), [length, breadth]);

  const validate = useCallback((start, lengthCells, dir) => {
    if (!heightMap) return { ok: false, reason: 'no terrain' };
    if (lengthCells < MIN_STATION_LENGTH) return { ok: false, reason: `too short (min ${MIN_STATION_LENGTH})` };
    if (lengthCells > MAX_STATION_LENGTH) return { ok: false, reason: `too long (max ${MAX_STATION_LENGTH})` };

    const perp = { x: -dir.z, z: dir.x };
    for (let i = 0; i < lengthCells; i++) {
      for (let j = -1; j <= 1; j++) {
        const cx = start.cell.x + dir.x * i + perp.x * j;
        const cz = start.cell.z + dir.z * i + perp.z * j;
        if (cx < 1 || cx >= length - 1 || cz < 1 || cz >= breadth - 1) {
          return { ok: false, reason: 'out of bounds' };
        }
        if (heightMap[cx][cz] !== start.height) {
          return { ok: false, reason: 'uneven ground or hole' };
        }
      }
    }

    // Compute station cell rect bounds
    const axMinX = Math.min(start.cell.x, start.cell.x + dir.x * (lengthCells - 1));
    const axMaxX = Math.max(start.cell.x, start.cell.x + dir.x * (lengthCells - 1));
    const axMinZ = Math.min(start.cell.z, start.cell.z + dir.z * (lengthCells - 1));
    const axMaxZ = Math.max(start.cell.z, start.cell.z + dir.z * (lengthCells - 1));
    const ppMinX = Math.min(0, perp.x * (STATION_WIDTH - 1));
    const ppMaxX = Math.max(0, perp.x * (STATION_WIDTH - 1));
    const ppMinZ = Math.min(0, perp.z * (STATION_WIDTH - 1));
    const ppMaxZ = Math.max(0, perp.z * (STATION_WIDTH - 1));
    const minX = axMinX + ppMinX;
    const maxX = axMaxX + ppMaxX;
    const minZ = axMinZ + ppMinZ;
    const maxZ = axMaxZ + ppMaxZ;

    for (const other of stationManager.getAllStations()) {
      const r = other.voxelRect;
      const overlaps =
        minX <= r.maxX + 1 && maxX >= r.minX - 1 &&
        minZ <= r.maxZ + 1 && maxZ >= r.minZ - 1;
      if (overlaps) {
        return { ok: false, reason: 'overlaps another station' };
      }
    }

    // Reject tracks whose swept ballast enters station footprint. Sampling
    // the actual path also catches curved tracks that turn into the platform.
    if (trackManager) {
      const platformHalfWidth = STATION_WIDTH_WORLD / 2;
      const trackHalfWidth = 0.25;
      for (const track of trackManager.getAllTracks()) {
        const sameHeight = Math.abs(track.position.y - start.height * 0.5 - 0.25) < 0.6;
        if (!sameHeight) continue;
        const samples = Array.from({ length: 9 }, (_, index) => index / 8);
        for (const t of samples) {
          const local = pointOnTrack(track.type, t);
          const cos = Math.cos(track.rotation);
          const sin = Math.sin(track.rotation);
          const wx = track.position.x + local.x * cos + local.z * sin;
          const wz = track.position.z + -local.x * sin + local.z * cos;
          const trackDx = wx - start.world.x;
          const trackDz = wz - start.world.z;
          const axial = trackDx * dir.x + trackDz * dir.z;
          const lateral = Math.abs(trackDx * dir.z - trackDz * dir.x);
          if (
            axial >= -trackHalfWidth &&
            axial <= lengthCells * 0.5 + trackHalfWidth &&
            lateral < platformHalfWidth + trackHalfWidth
          ) {
            return { ok: false, reason: 'track in the way' };
          }
        }
      }
    }

    // Reject if road cells overlap the station
    if (roadManager) {
      const roadCells = roadManager.getRoadCells();
      for (let i = 0; i < lengthCells; i++) {
        for (let j = -1; j <= 1; j++) {
          const cx = start.cell.x + dir.x * i + perp.x * j;
          const cz = start.cell.z + dir.z * i + perp.z * j;
          // Check this cell and adjacent cells (road width spans ~1 cell)
          for (const [dx, dz] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
            if (roadCells.has(`${cx+dx},${cz+dz}`)) {
              return { ok: false, reason: 'road in the way' };
            }
          }
        }
      }
    }

    return { ok: true };
  }, [heightMap, length, breadth, stationManager, trackManager, roadManager]);

  const cellToWorld = useCallback((cell, h) => ({
    x: (cell.x - length / 2 + 0.5) * 0.5,
    y: h * 0.5 + 0.25,
    z: (cell.z - breadth / 2 + 0.5) * 0.5,
  }), [length, breadth]);

  /**
   * The world axis (X or Z) that appears horizontal on the current screen,
   * derived from the camera's right basis vector projected onto the XZ
   * plane. This makes the 'horizontal'/'vertical' labels camera-relative:
   * 'horizontal' always extends left-right on screen, 'vertical' up-down,
   * no matter how the camera is rotated.
   */
  const screenAxisFor = useCallback((cam) => {
    const m = cam.matrixWorld.elements;
    const rx = m[0]; // camera right, world x
    const rz = m[8]; // camera right, world z
    return Math.abs(rx) >= Math.abs(rz) ? 'X' : 'Z';
  }, []);

  /**
   * Extension from the cursor delta for the current orientation:
   * horizontal → along the screen-horizontal world axis (extend on either
   * side of the marker), vertical → along the other axis.
   */
  const extensionFor = useCallback((dx, dz) => {
    const screenIsX = screenAxisFor(camera) === 'X';
    const useX = (orientation === 'horizontal') === screenIsX;
    const axial = useX ? dx : dz;
    const lengthCells = Math.abs(axial);
    const dir = useX
      ? { x: axial >= 0 ? 1 : -1, z: 0 }
      : { x: 0, z: axial >= 0 ? 1 : -1 };
    return { dir, lengthCells };
  }, [orientation, camera, screenAxisFor]);

  const computeGhost = useCallback((event) => {
    if (!terrainRef.current || !heightMap) {
      setGhost(null);
      return;
    }

    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    lastMousePos.current = { x: event.clientX, y: event.clientY };

    raycaster.current.setFromCamera(mouse.current, camera);
    const intersects = raycaster.current.intersectObject(terrainRef.current, true);
    if (intersects.length === 0) {
      setGhost(null);
      return;
    }

    const point = intersects[0].point;
    const normal = intersects[0].face ? intersects[0].face.normal : new THREE.Vector3(0, 1, 0);
    if (Math.abs(normal.y) < 0.8) {
      setGhost(null);
      return;
    }

    const cell = worldToCell(point);
    if (cell.x < 0 || cell.x >= length || cell.z < 0 || cell.z >= breadth) {
      setGhost(null);
      return;
    }

    const height = heightMap[cell.x][cell.z];
    if (height <= 3) {
      setGhost(null); // water
      return;
    }

    if (!stationStart) {
      setGhost({
        phase: 'start',
        cell,
        world: cellToWorld(cell, height),
        height,
        valid: true,
      });
      return;
    }

    // End marker: the station extends along the orientation axis on the
    // side of the marker the cursor sits on. The ghost always shows the
    // snapped slab + end marker, even at length 0.
    const dx = cell.x - stationStart.cell.x;
    const dz = cell.z - stationStart.cell.z;
    const { dir, lengthCells } = extensionFor(dx, dz);
    const endCell = {
      x: stationStart.cell.x + dir.x * lengthCells,
      z: stationStart.cell.z + dir.z * lengthCells,
    };
    const result = validate(stationStart, lengthCells, dir);

    setGhost({
      phase: 'end',
      dir,
      lengthCells,
      endCell,
      startWorld: stationStart.world,
      endWorld: cellToWorld(endCell, stationStart.height),
      height: stationStart.height,
      valid: result.ok && lengthCells > 0,
      reason: result.reason,
    });
  }, [terrainRef, gl, camera, heightMap, length, breadth, stationStart, orientation, worldToCell, cellToWorld, extensionFor, validate]);
  // Recompute ghost when the orientation toggles
  useEffect(() => {
    if (!active || !stationStart) return;
    if (lastMousePos.current.x !== undefined) {
      computeGhost({ clientX: lastMousePos.current.x, clientY: lastMousePos.current.y });
    }
  }, [active, orientation, stationStart, computeGhost]);

  // Pointer leave/enter: hide the ghost while away, keep the start marker
  // and the last pointer position so returning restores it immediately.
  useEffect(() => {
    const canvas = gl.domElement;
    const onEnter = () => {
      pointerInside.current = true;
      if (active && lastMousePos.current.x !== undefined) {
        computeGhost({ clientX: lastMousePos.current.x, clientY: lastMousePos.current.y });
      }
    };
    const onLeave = () => {
      pointerInside.current = false;
      setGhost(null);
    };
    canvas.addEventListener('pointerenter', onEnter);
    canvas.addEventListener('pointerleave', onLeave);
    return () => {
      canvas.removeEventListener('pointerenter', onEnter);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, [gl, active, computeGhost]);

  // Camera-driven recompute: orbit/pan/zoom/WASD/follow must keep the ghost
  // slab under the cursor without any pointer motion.
  useFrame(() => {
    if (!active) return;
    if (camera.position.distanceToSquared(lastCamPos.current) < 1e-6 && camera.quaternion.equals(lastCamQuat.current)) {
      return;
    }
    lastCamPos.current.copy(camera.position);
    lastCamQuat.current.copy(camera.quaternion);
    if (!pointerInside.current || lastMousePos.current.x === undefined) return;
    computeGhost({ clientX: lastMousePos.current.x, clientY: lastMousePos.current.y });
  });

  const handleClick = useCallback((event) => {
    if (!terrainRef.current || !heightMap) return null;
    const rect = gl.domElement.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.current.setFromCamera(mouse.current, camera);
    const intersects = raycaster.current.intersectObject(terrainRef.current, true);
    if (intersects.length === 0) return null;

    const point = intersects[0].point;
    const normal = intersects[0].face ? intersects[0].face.normal : new THREE.Vector3(0, 1, 0);
    if (Math.abs(normal.y) < 0.8) return null;

    const cell = worldToCell(point);
    if (cell.x < 0 || cell.x >= length || cell.z < 0 || cell.z >= breadth) return null;
    const height = heightMap[cell.x][cell.z];
    if (height <= 3) return null;

    if (!stationStart) {
      setStationStart({
        cell,
        height,
        world: cellToWorld(cell, height),
      });
      return null;
    }

    // End marker — build the station along the orientation axis on the
    // side of the marker the cursor sits on.
    const dx = cell.x - stationStart.cell.x;
    const dz = cell.z - stationStart.cell.z;
    const { dir, lengthCells } = extensionFor(dx, dz);
    const endCell = {
      x: stationStart.cell.x + dir.x * lengthCells,
      z: stationStart.cell.z + dir.z * lengthCells,
    };

    // Clicking near the start marker cancels placement
    if (lengthCells === 0) {
      setStationStart(null);
      setGhost(null);
      return null;
    }

    const result = validate(stationStart, lengthCells, dir);
    if (!result.ok) {
      // Keep the start marker so the user can retry — no silent reset
      return null;
    }

    const endWorld = cellToWorld(endCell, stationStart.height);
    const centerX = (stationStart.world.x + endWorld.x) / 2;
    const centerZ = (stationStart.world.z + endWorld.z) / 2;
    const cameraDx = camera.position.x - centerX;
    const cameraDz = camera.position.z - centerZ;
    // Choose camera-facing side, but keep building aligned to station axis.
    const cameraSide = cameraDx * (-dir.z) + cameraDz * dir.x;
    const buildingRotation = cameraSide >= 0 ? -Math.PI / 2 : Math.PI / 2;

    const { station, group } = buildStation({
      startCell: stationStart.cell,
      endCell,
      dir,
      lengthCells,
      startHeight: stationStart.height,
      terrainLength: length,
      terrainBreadth: breadth,
      buildingRotation,
    });

    const saved = stationManager.addStation(station);
    saved.group = group;
    setStationStart(null);
    setGhost(null);
    return saved;
  }, [terrainRef, gl, camera, heightMap, length, breadth, stationStart, orientation, worldToCell, cellToWorld, extensionFor, validate, stationManager]);

  const reset = useCallback(() => {
    setStationStart(null);
    setGhost(null);
  }, []);

  return { ghost, stationStart, handleClick, computeGhost, reset };
}
