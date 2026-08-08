import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStationPlacement } from '../hooks/useStationPlacement';
import { STATION_WIDTH_WORLD, easeOutBack } from './StationBuilder';

const GHOST_GREEN = 0x00ff00;
const GHOST_RED = 0xff0000;
const POP_DURATION = 0.45;

function makeGhostBox(width, height, depth, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false })
  );
  mesh.renderOrder = 10;
  return mesh;
}

/**
 * Renders stations with a wave pop-out animation and the two-marker
 * placement ghost for the station tool.
 */
export default function StationRenderer({
  stationManager,
  terrainRef,
  selectedTool,
  rotation,
  terrainData,
  stationsVersion,
  onStationsChange,
}) {
  const [stations, setStations] = useState([]);
  const mouseDownPosRef = useRef(null);
  const ghostMeshesRef = useRef([]);

  const { ghost, handleClick, computeGhost, reset } = useStationPlacement(
    terrainRef, stationManager, rotation, terrainData
  );

  // Latest callbacks via refs — the canvas listeners attach ONCE so that
  // re-renders during a click event never re-attach mid-dispatch (which
  // made the same click recurse and crash placement).
  const selectedToolRef = useRef(selectedTool);
  const handleClickRef = useRef(handleClick);
  const computeGhostRef = useRef(computeGhost);
  const onStationsChangeRef = useRef(onStationsChange);
  selectedToolRef.current = selectedTool;
  handleClickRef.current = handleClick;
  computeGhostRef.current = computeGhost;
  onStationsChangeRef.current = onStationsChange;

  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__mtw = { ...window.__mtw, stationGhost: { ghost, handleClick, computeGhost } };
    }
  }, [ghost, handleClick, computeGhost]);

  // Sync station list with the manager
  useEffect(() => {
    setStations(stationManager.getAllStations());
  }, [stationManager, stationsVersion, terrainData]);

  // Cancel placement when switching tools
  useEffect(() => {
    if (selectedTool?.type !== 'station') reset();
  }, [selectedTool, reset]);

  // Mouse events (only active for the station tool) — attached once
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const handleMouseMove = (e) => {
      if (selectedToolRef.current?.type === 'station') computeGhostRef.current(e);
    };
    const handleMouseDown = (e) => {
      mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    };
    const handleClick = (e) => {
      if (selectedToolRef.current?.type !== 'station') return;
      const rect = canvas.getBoundingClientRect();
      const isOnCanvas =
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!isOnCanvas) return;
      if (mouseDownPosRef.current) {
        const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
        const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
        if (dx > 5 || dy > 5) return;
      }
      const station = handleClickRef.current(e);
      if (station) onStationsChangeRef.current?.();
    };
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('click', handleClick);
    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('click', handleClick);
    };
  }, []);

  // Ghost preview meshes
  const ghostMeshes = useMemo(() => {
    for (const m of ghostMeshesRef.current) {
      m.geometry.dispose();
      m.material.dispose();
    }
    ghostMeshesRef.current = [];

    if (!ghost || !terrainData) return null;

    if (ghost.phase === 'start') {
      const marker = makeGhostBox(STATION_WIDTH_WORLD, 0.15, 0.5, GHOST_GREEN);
      marker.position.set(ghost.world.x, ghost.world.y + 0.3, ghost.world.z);
      ghostMeshesRef.current.push(marker);
      return ghostMeshesRef.current;
    }

    const color = ghost.valid ? GHOST_GREEN : GHOST_RED;
    const len = Math.max(0.5, ghost.lengthCells * 0.5);
    const slab = makeGhostBox(STATION_WIDTH_WORLD, 0.12, len, color);
    const midX = (ghost.startWorld.x + ghost.endWorld.x) / 2;
    const midZ = (ghost.startWorld.z + ghost.endWorld.z) / 2;
    slab.position.set(midX, ghost.height * 0.5 + 0.25 + 0.3, midZ);
    slab.rotation.y = Math.atan2(ghost.dir.x, ghost.dir.z);
    ghostMeshesRef.current.push(slab);

    const startMarker = makeGhostBox(STATION_WIDTH_WORLD, 0.15, 0.5, color);
    startMarker.position.set(ghost.startWorld.x, ghost.height * 0.5 + 0.25 + 0.3, ghost.startWorld.z);
    ghostMeshesRef.current.push(startMarker);

    // End marker follows the cursor cell exactly
    const endMarker = makeGhostBox(0.5, 0.5, 0.5, color);
    endMarker.position.set(ghost.endWorld.x, ghost.endWorld.y + 0.35, ghost.endWorld.z);
    ghostMeshesRef.current.push(endMarker);

    return ghostMeshesRef.current;
  }, [ghost, terrainData]);

  // Wave pop-out animation
  useFrame((state) => {
    for (const station of stations) {
      if (!station.group) continue;
      if (station.animStart === null) station.animStart = state.clock.elapsedTime;
      const t0 = state.clock.elapsedTime - station.animStart;
      for (const piece of station.pieces) {
        const t = Math.min(1, Math.max(0, (t0 - piece.delay) / POP_DURATION));
        if (t <= 0) {
          piece.obj.visible = false;
          continue;
        }
        piece.obj.visible = true;
        const e = easeOutBack(t);
        piece.obj.position.y = piece.fromY + (piece.toY - piece.fromY) * e;
        piece.obj.scale.setScalar(Math.max(e, 0.001));
      }
    }
  });

  return (
    <group>
      {stations.map((station) =>
        station.group ? (
          <primitive key={station.id} object={station.group} />
        ) : null
      )}
      {ghostMeshes?.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  );
}
