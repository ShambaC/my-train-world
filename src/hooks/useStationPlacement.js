import { useRef, useState, useCallback, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { buildStation, STATION_WIDTH, MIN_STATION_LENGTH, MAX_STATION_LENGTH } from '../stations/StationBuilder';

/**
 * Station placement hook — two-click flow:
 * click 1 = start marker (rotatable in 4 directions), click 2 = end marker.
 * Validates flat same-height ground, no holes, no water, no overlap.
 */
export function useStationPlacement(terrainRef, stationManager, rotation, terrainData) {
  const { camera, gl } = useThree();
  const [ghost, setGhost] = useState(null);
  const [stationStart, setStationStart] = useState(null);
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());
  const lastMousePos = useRef({ x: 0, y: 0 });

  const length = terrainData?.length || 0;
  const breadth = terrainData?.breadth || 0;
  const heightMap = terrainData?.heightMap || null;

  const dirFromRotation = useCallback((rot) => ({ x: Math.sin(rot), z: Math.cos(rot) }), []);

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
      for (let j = 0; j < STATION_WIDTH; j++) {
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

    for (const other of stationManager.getAllStations()) {
      const r = other.voxelRect;
      const axMinX = Math.min(start.cell.x, start.cell.x + dir.x * (lengthCells - 1));
      const axMaxX = Math.max(start.cell.x, start.cell.x + dir.x * (lengthCells - 1));
      const axMinZ = Math.min(start.cell.z, start.cell.z + dir.z * (lengthCells - 1));
      const axMaxZ = Math.max(start.cell.z, start.cell.z + dir.z * (lengthCells - 1));
      const ppMinX = Math.min(0, perp.x * (STATION_WIDTH - 1));
      const ppMaxX = Math.max(0, perp.x * (STATION_WIDTH - 1));
      const ppMinZ = Math.min(0, perp.z * (STATION_WIDTH - 1));
      const ppMaxZ = Math.max(0, perp.z * (STATION_WIDTH - 1));
      const overlaps =
        axMinX + ppMinX <= r.maxX + 1 && axMaxX + ppMaxX >= r.minX - 1 &&
        axMinZ + ppMinZ <= r.maxZ + 1 && axMaxZ + ppMaxZ >= r.minZ - 1;
      if (overlaps) {
        return { ok: false, reason: 'overlaps another station' };
      }
    }

    return { ok: true };
  }, [heightMap, length, breadth, stationManager]);

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
    if (height <= 2) {
      setGhost(null); // water
      return;
    }

    if (!stationStart) {
      setGhost({
        phase: 'start',
        cell,
        world: { x: (cell.x - length / 2 + 0.5) * 0.5, y: height * 0.5 + 0.25, z: (cell.z - breadth / 2 + 0.5) * 0.5 },
        height,
        valid: true,
      });
      return;
    }

    // End marker: project cursor onto the station axis
    const dir = dirFromRotation(rotation);
    const dx = cell.x - stationStart.cell.x;
    const dz = cell.z - stationStart.cell.z;
    const lengthCells = Math.round(dx * dir.x + dz * dir.z);
    const lateral = Math.abs(dx * dir.z - dz * dir.x);

    const result = validate(stationStart, lengthCells, dir);
    const endWorld = {
      x: (stationStart.cell.x + dir.x * lengthCells - length / 2 + 0.5) * 0.5,
      z: (stationStart.cell.z + dir.z * lengthCells - breadth / 2 + 0.5) * 0.5,
    };

    setGhost({
      phase: 'end',
      dir,
      lengthCells,
      lateral,
      startWorld: stationStart.world,
      endWorld,
      height: stationStart.height,
      valid: result.ok && lateral <= 2,
      reason: result.reason,
    });
  }, [terrainRef, gl, camera, heightMap, length, breadth, stationStart, rotation, dirFromRotation, worldToCell, validate]);

  // Recompute ghost when rotation changes
  useEffect(() => {
    if (!stationStart) return;
    if (lastMousePos.current.x !== undefined) {
      computeGhost({ clientX: lastMousePos.current.x, clientY: lastMousePos.current.y });
    }
  }, [rotation, stationStart, computeGhost]);

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
    if (height <= 2) return null;

    if (!stationStart) {
      setStationStart({
        cell,
        height,
        world: { x: (cell.x - length / 2 + 0.5) * 0.5, y: height * 0.5 + 0.25, z: (cell.z - breadth / 2 + 0.5) * 0.5 },
      });
      return null;
    }

    // Place end marker — build the station
    const dir = dirFromRotation(rotation);
    const dx = cell.x - stationStart.cell.x;
    const dz = cell.z - stationStart.cell.z;
    const lengthCells = Math.round(dx * dir.x + dz * dir.z);
    const lateral = Math.abs(dx * dir.z - dz * dir.x);
    const result = validate(stationStart, lengthCells, dir);
    if (!result.ok || lateral > 2) {
      setStationStart(null);
      return null;
    }

    const endCell = {
      x: stationStart.cell.x + dir.x * lengthCells,
      z: stationStart.cell.z + dir.z * lengthCells,
    };

    const { station, group } = buildStation({
      startCell: stationStart.cell,
      endCell,
      dir,
      lengthCells,
      startHeight: stationStart.height,
      terrainLength: length,
      terrainBreadth: breadth,
    });

    const saved = stationManager.addStation(station);
    saved.group = group;
    setStationStart(null);
    setGhost(null);
    return saved;
  }, [terrainRef, gl, camera, heightMap, length, breadth, stationStart, rotation, dirFromRotation, worldToCell, validate, stationManager]);

  const reset = useCallback(() => {
    setStationStart(null);
    setGhost(null);
  }, []);

  return { ghost, stationStart, handleClick, computeGhost, reset };
}
