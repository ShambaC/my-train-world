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
export default function CameraController({ terrainSize, enabled = true, orbitRef, followActive = false }) {
  const { camera } = useThree();

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e) => {
      const key = e.key.toLowerCase();
      pressedKeys.add(key);
      if (key.startsWith('arrow') || key === ' ') e.preventDefault();
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

    const rotateX = (isKeyDown('arrowup') ? 1 : 0) - (isKeyDown('arrowdown') ? 1 : 0);
    const rotateY = (isKeyDown('arrowleft') ? 1 : 0) - (isKeyDown('arrowright') ? 1 : 0);
    const controls = orbitRef?.current;
    const rotating = rotateX !== 0 || rotateY !== 0;
    if (controls && !followActive) controls.enabled = !rotating;
    if (move.lengthSq() === 0 && (followActive || (rotateX === 0 && rotateY === 0))) return;

    if (move.lengthSq() > 0) {
      const speed = isKeyDown('shift') ? 15 : 6;
      move.normalize().multiplyScalar(speed * Math.min(delta, 0.05));

      camera.position.add(move);
      if (orbitRef?.current) orbitRef.current.target.add(move);
    }

    // Arrow keys look in place: move OrbitControls target on a sphere around
    // the fixed camera position, instead of orbiting camera around target.
    if (!followActive && controls && rotating) {
      const distance = camera.position.distanceTo(controls.target);
      if (distance > 1e-4) {
        const direction = controls.target.clone().sub(camera.position).normalize();
        direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotateY * 1.8 * Math.min(delta, 0.05));

        const pitch = THREE.MathUtils.clamp(
          Math.asin(THREE.MathUtils.clamp(direction.y, -1, 1)) + rotateX * 1.8 * Math.min(delta, 0.05),
          -Math.PI / 2 + 0.08,
          Math.PI / 2 - 0.08,
        );
        const horizontal = Math.hypot(direction.x, direction.z);
        if (horizontal > 1e-5) {
          const horizontalScale = Math.cos(pitch) / horizontal;
          direction.x *= horizontalScale;
          direction.y = Math.sin(pitch);
          direction.z *= horizontalScale;
        }

        controls.target.copy(camera.position).addScaledVector(direction, distance);
        camera.lookAt(controls.target);
      }
    }

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
