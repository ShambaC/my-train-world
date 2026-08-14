import { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStationPlacement } from '../hooks/useStationPlacement';
import { buildStation, STATION_WIDTH_WORLD, easeOutBack } from './StationBuilder';

const GHOST_GREEN = 0x00ff00;
const GHOST_RED = 0xff0000;
const POP_DURATION = 0.45;

function makeGhostBox(width, height, depth, color) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.5, depthWrite: false,
      toneMapped: false, // stay visible under the effects pipeline
    })
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
  orientation,
  terrainData,
  stationsVersion,
  onStationsChange,
  onStationPlaced,
  lighting,
}) {
  const [stations, setStations] = useState([]);
  const mouseDownPosRef = useRef(null);
  const ghostMeshesRef = useRef([]);
  const camera = useThree((s) => s.camera);

  const { ghost, stationStart, handleClick, computeGhost, reset } = useStationPlacement(
    terrainRef, stationManager, orientation, terrainData
  );

  // Latest callbacks via refs — the canvas listeners attach ONCE so that
  // re-renders during a click event never re-attach mid-dispatch (which
  // made the same click recurse and crash placement).
  const selectedToolRef = useRef(selectedTool);
  const handleClickRef = useRef(handleClick);
  const computeGhostRef = useRef(computeGhost);
  const onStationsChangeRef = useRef(onStationsChange);
  const onStationPlacedRef = useRef(onStationPlaced);
  selectedToolRef.current = selectedTool;
  handleClickRef.current = handleClick;
  computeGhostRef.current = computeGhost;
  onStationsChangeRef.current = onStationsChange;
  onStationPlacedRef.current = onStationPlaced;

  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__mtw = { ...window.__mtw, stationGhost: { ghost, handleClick, computeGhost, stationStart }, buildStation, stationOrientation: orientation };
    }
  }, [ghost, handleClick, computeGhost, stationStart, orientation]);

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
      if (station) {
        onStationsChangeRef.current?.();
        onStationPlacedRef.current?.(station, e.clientX, e.clientY);
      }
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

    // Marker = narrow platform lying ALONG the station axis (long side =
    // extension direction). Start phase shows the orientation — aligned to
    // the screen-horizontal world axis so the label always matches what
    // the user sees. End phase snaps to the actual extension.
    const makeAxisMarker = (color) => {
      const marker = makeGhostBox(0.5, 0.15, 1.0, color);
      if (ghost.phase === 'end') {
        marker.rotation.y = Math.atan2(ghost.dir.x, ghost.dir.z);
      } else {
        const m = camera.matrixWorld.elements;
        const screenIsX = Math.abs(m[0]) >= Math.abs(m[8]);
        const longSideX = (orientation === 'horizontal') === screenIsX;
        marker.rotation.y = (longSideX ? Math.PI / 2 : 0) + Math.PI / 2;
      }
      return marker;
    };

    if (ghost.phase === 'start') {
      const marker = makeAxisMarker(GHOST_GREEN);
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

    const startMarker = makeAxisMarker(color);
    startMarker.position.set(ghost.startWorld.x, ghost.height * 0.5 + 0.25 + 0.3, ghost.startWorld.z);
    ghostMeshesRef.current.push(startMarker);

    // End marker follows the cursor cell exactly
    const endMarker = makeGhostBox(0.5, 0.5, 0.5, color);
    endMarker.position.set(ghost.endWorld.x, ghost.endWorld.y + 0.35, ghost.endWorld.z);
    ghostMeshesRef.current.push(endMarker);

    return ghostMeshesRef.current;
  }, [ghost, terrainData, orientation, camera]);

  // Wave pop-out animation + chimney smoke + day/night lamp scaling
  useFrame((state, delta) => {
    const nightness = lighting ? lighting.nightness : 0.6;
    for (const station of stations) {
      if (!station.group) continue;
      if (station.smoke) station.smoke.update(delta, true);
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
      // All station lamps/glows fade to near-zero during the day
      station.group.traverse((child) => {
        if (child.isPointLight) {
          child.intensity = 4.5 * (0.04 + nightness * 0.96);
        }
        const mat = child.material;
        if (mat?.userData?.nightGlow) {
          mat.opacity = mat.userData.baseOpacity * (0.03 + nightness * 0.97);
        }
      });
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
