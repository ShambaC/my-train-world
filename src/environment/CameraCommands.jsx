import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { cameraBus } from '../utils/cameraBus';

/**
 * CameraCommands — in-scene camera assistant. Listens on the cameraBus and
 * eases the view toward focus/reset/frame targets. Camera-relative WASD
 * movement, orbit/pan/zoom and train-follow all keep working (commands are
 * advisory; the user can always take back control).
 */
export default function CameraCommands({ terrainSize, trackManager, stationManager, trainManager, followTrainId, orbitRef }) {
  const { camera } = useThree();
  const controlsRef = useRef(null);
  const desiredPos = useRef(null);
  const desiredTarget = useRef(null);
  const animating = useRef(false);

  const cancelAnimation = () => {
    if (!animating.current) return;
    animating.current = false;
    desiredPos.current = null;
    desiredTarget.current = null;
    if (controlsRef.current && !followTrainId) {
      controlsRef.current.enabled = true;
      controlsRef.current.update();
    }
  };

  useEffect(() => {
    controlsRef.current = orbitRef?.current || null;
  }, [orbitRef]);

  useEffect(() => {
    const cameraKeys = new Set(['w', 'a', 's', 'd', ' ', 'c']);
    const onKeyDown = (event) => {
      if (cameraKeys.has(event.key.toLowerCase())) cancelAnimation();
    };

    window.addEventListener('pointerdown', cancelAnimation);
    window.addEventListener('wheel', cancelAnimation, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', cancelAnimation);
      window.removeEventListener('wheel', cancelAnimation);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [followTrainId]);

  const commandFor = (cmd) => {
    if (cmd.type === 'restore') {
      animating.current = false;
      desiredPos.current = null;
      desiredTarget.current = null;
      camera.position.set(cmd.position.x, cmd.position.y, cmd.position.z);
      const ctrl = controlsRef.current;
      if (ctrl && cmd.target) {
        ctrl.target.set(cmd.target.x, cmd.target.y, cmd.target.z);
        ctrl.enabled = true;
        ctrl.update();
      }
    } else if (cmd.type === 'focus') {
      const t = new THREE.Vector3(cmd.target.x, cmd.target.y, cmd.target.z);
      const distance = cmd.distance ?? 3.5;
      const dir = camera.position.clone().sub(t);
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.set(1, 0, 1);
      dir.normalize();
      desiredTarget.current = t;
      desiredPos.current = t.clone().add(dir.multiplyScalar(distance));
      desiredPos.current.y = Math.max(t.y + 1.2, desiredPos.current.y);
      animating.current = true;
    } else if (cmd.type === 'reset') {
      const half = Math.max(terrainSize.length, terrainSize.breadth) * 0.5;
      desiredTarget.current = new THREE.Vector3(0, 0, 0);
      desiredPos.current = new THREE.Vector3(half * 0.4, half * 0.38, half * 0.4);
      animating.current = true;
    } else if (cmd.type === 'frame') {
      // Frame the full user-built railway (tracks + stations + trains).
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, maxY = 0;
      const include = (p) => {
        if (!p) return;
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
        maxY = Math.max(maxY, p.y ?? 0);
      };
      for (const t of trackManager.getAllTracks()) include(t.position);
      for (const s of stationManager?.getAllStations?.() ?? []) include(s.centerWorld);
      for (const t of trainManager?.getAllTrains() ?? []) include(t.position);

      if (minX === Infinity) return; // nothing built — keep current view
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      const radius = Math.max(Math.hypot(maxX - minX, maxZ - minZ) * 0.62, 4);
      const dir = camera.position.clone();
      dir.y = 0;
      if (dir.lengthSq() < 1e-6) dir.set(1, 0, 1);
      dir.normalize();
      desiredTarget.current = new THREE.Vector3(cx, maxY, cz);
      desiredPos.current = new THREE.Vector3(cx, maxY, cz).add(dir.multiplyScalar(radius));
      desiredPos.current.y = Math.max(desiredPos.current.y, maxY + 1.6);
      animating.current = true;
    }
  };

  useEffect(() => {
    return cameraBus.subscribe(commandFor);
  }, [camera, terrainSize, trackManager]);
  useFrame((_, delta) => {
    cameraBus.setState(camera.position, controlsRef.current ? controlsRef.current.target : null);

    if (!animating.current || followTrainId) return;
    if (!desiredPos.current) {
      animating.current = false;
      return;
    }

    const ctrl = controlsRef.current;
    if (ctrl) ctrl.enabled = false;

    const k = 1 - Math.exp(-6 * Math.min(delta, 0.1));
    camera.position.lerp(desiredPos.current, k);
    if (ctrl) {
      ctrl.target.lerp(desiredTarget.current, k);
      ctrl.update();
    }

    const close = camera.position.distanceTo(desiredPos.current) < 0.03;
    if (close) {
      animating.current = false;
      if (ctrl) ctrl.enabled = true;
    }
  });

  return null;
}
