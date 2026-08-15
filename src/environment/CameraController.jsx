import { useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const pressedKeys = new Set();

function isKeyDown(code) {
  return pressedKeys.has(code);
}

/**
 * Camera Controller — WASD camera-relative movement (Shift to sprint).
 * The OrbitControls target moves with the camera so the view never
 * pitches toward a static point.
 */
export default function CameraController({ terrainSize, enabled = true, orbitRef }) {
  const { camera } = useThree();

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e) => {
      pressedKeys.add(e.key.toLowerCase());
      if (e.key === ' ') e.preventDefault();
    };
    const onKeyUp = (e) => pressedKeys.delete(e.key.toLowerCase());
    const onBlur = () => pressedKeys.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      pressedKeys.clear();
    };
  }, [enabled]);

  useFrame((state, delta) => {
    if (!enabled) return;

    const move = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0) forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));

    if (isKeyDown('w')) move.add(forward);
    if (isKeyDown('s')) move.sub(forward);
    if (isKeyDown('d')) move.add(right);
    if (isKeyDown('a')) move.sub(right);
    if (isKeyDown(' ')) move.y += 1; // Space: rise
    if (isKeyDown('c')) move.y -= 1; // C: lower

    if (move.lengthSq() === 0) return;

    const speed = isKeyDown('shift') ? 15 : 6;
    move.normalize().multiplyScalar(speed * Math.min(delta, 0.05));

    camera.position.add(move);
    if (orbitRef?.current) orbitRef.current.target.add(move);

    // Boundaries
    const pad = 10;
    const maxX = terrainSize.length / 2 + pad;
    const maxZ = terrainSize.breadth / 2 + pad;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -maxX, maxX);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -maxZ, maxZ);
    camera.position.y = THREE.MathUtils.clamp(camera.position.y, 2.5, 150);
  });

  return null;
}
