import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const SIZE = 128;
const AXIS_LEN = 40;
const LABEL_R = 14;

const AXES = [
  { color: '#ff4444', label: 'X', dir: [1, 0, 0] },
  { color: '#44ff44', label: 'Y', dir: [0, 1, 0] },
  { color: '#4488ff', label: 'Z', dir: [0, 0, 1] },
];

/**
 * Axis gizmo — 2D canvas overlay appended to document.body.
 * Shows X (red), Y (green), Z (blue) that rotate with camera.
 * Returns null from R3F tree; manages its own DOM element.
 */
export default function AxisGizmo({ visible = true }) {
  const { camera } = useThree();
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const dummyObj = useRef(new THREE.Object3D());
  const axisVecs = useRef(AXES.map(a => new THREE.Vector3(...a.dir)));

  // Create overlay DOM element on mount
  useEffect(() => {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      width: ${SIZE}px;
      height: ${SIZE}px;
      pointer-events: none;
      z-index: 100;
    `;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE * 2;
    canvas.height = SIZE * 2;
    canvas.style.cssText = `width: ${SIZE}px; height: ${SIZE}px;`;
    wrapper.appendChild(canvas);
    document.body.appendChild(wrapper);
    wrapperRef.current = wrapper;
    canvasRef.current = canvas;

    return () => {
      document.body.removeChild(wrapper);
    };
  }, []);

  // Toggle visibility
  useEffect(() => {
    if (wrapperRef.current) {
      wrapperRef.current.style.display = visible ? 'block' : 'none';
    }
  }, [visible]);

  useFrame(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    // Inverse camera quaternion
    dummyObj.current.quaternion.copy(camera.quaternion).invert();
    dummyObj.current.updateMatrixWorld();

    ctx.clearRect(0, 0, w, h);

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, cy - 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fill();

    // Project each axis
    const projected = [];
    for (let i = 0; i < AXES.length; i++) {
      const v = axisVecs.current[i].clone().applyMatrix4(dummyObj.current.matrixWorld);
      projected.push({ x: v.x, y: -v.y, z: v.z, color: AXES[i].color, label: AXES[i].label });
    }

    // Draw back-to-front
    projected.sort((a, b) => a.z - b.z);

    for (const p of projected) {
      const endX = cx + p.x * AXIS_LEN;
      const endY = cy + p.y * AXIS_LEN;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(endX, endY, LABEL_R, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#000';
      ctx.fillText(p.label, endX, endY);
    }
  }, 2);

  return null;
}
