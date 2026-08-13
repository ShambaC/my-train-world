import * as THREE from 'three';
import { createContactPatch } from '../utils/contactPatch';

const VOXEL_SIZE = 0.5;
// Train engine is 2 voxels long, 1 voxel wide, 1 voxel high
const ENGINE_LENGTH = 1.0; // 2 voxels
const ENGINE_WIDTH = 0.5;  // 1 voxel
const ENGINE_HEIGHT = 0.5; // 1 voxel

const COLORS = {
  body: 0x2c5f8d,      // Blue engine body
  cabin: 0x87ceeb,     // Light blue windows
  wheels: 0x1a1a1a,    // Dark wheels
  details: 0xffcc00,   // Yellow/gold details
  smoke: 0x666666,     // Gray smoke
};

/**
 * Create a simple train engine
 */
export function createTrainEngine(colorIndex = 0) {
  const group = new THREE.Group();
  
  const bodyColors = [0x2c5f8d, 0xc0392b, 0x27ae60, 0xd35400, 0x8e44ad];
  const mainColor = bodyColors[colorIndex % bodyColors.length];
  
  // Base chassis
  const chassisGeo = new THREE.BoxGeometry(ENGINE_WIDTH * 0.95, 0.06, ENGINE_LENGTH * 0.95);
  const chassisMat = new THREE.MeshLambertMaterial({ color: 0x1e1e1e, flatShading: true });
  const chassis = new THREE.Mesh(chassisGeo, chassisMat);
  chassis.position.y = 0.06;
  chassis.castShadow = true;
  group.add(chassis);

  // Cylindrical Boiler
  const boilerGeo = new THREE.CylinderGeometry(0.16, 0.16, ENGINE_LENGTH * 0.5, 8);
  const boilerMat = new THREE.MeshLambertMaterial({ color: mainColor, flatShading: true });
  const boiler = new THREE.Mesh(boilerGeo, boilerMat);
  boiler.rotation.x = Math.PI / 2;
  boiler.position.set(0, 0.22, 0.1);
  boiler.castShadow = true;
  group.add(boiler);
  
  // Cabin (back)
  const cabinGeo = new THREE.BoxGeometry(ENGINE_WIDTH * 0.85, ENGINE_HEIGHT * 0.6, ENGINE_LENGTH * 0.35);
  const cabinMat = new THREE.MeshLambertMaterial({ color: mainColor, flatShading: true });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 0.28, -0.22);
  cabin.castShadow = true;
  group.add(cabin);

  // Cabin Roof
  const roofGeo = new THREE.BoxGeometry(ENGINE_WIDTH * 0.92, 0.05, ENGINE_LENGTH * 0.4);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x111111, flatShading: true });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 0.45, -0.22);
  group.add(roof);

  // Windows
  const winGeo = new THREE.BoxGeometry(ENGINE_WIDTH * 0.88, 0.12, 0.18);
  const winMat = new THREE.MeshLambertMaterial({ color: COLORS.cabin, flatShading: true });
  const win = new THREE.Mesh(winGeo, winMat);
  win.position.set(0, 0.32, -0.22);
  group.add(win);
  
  // Smokestack
  const stackGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.2, 8);
  const stackMat = new THREE.MeshLambertMaterial({ color: 0x111111, flatShading: true });
  const stack = new THREE.Mesh(stackGeo, stackMat);
  stack.position.set(0, 0.42, 0.25);
  stack.castShadow = true;
  group.add(stack);

  // Headlight (front) — bright core + soft additive glow + beam cone.
  // Emissive-style so the engine reads as a lit lamp at night.
  const lightGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, toneMapped: false });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.position.set(0, 0.24, 0.36);
  group.add(light);

  const glowGeo = new THREE.SphereGeometry(0.09, 8, 8);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xffd9a0,
    transparent: true,
    opacity: 0.35,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.set(0, 0.24, 0.36);
  glow.userData.lightGlow = 'glow'; // nightness-scaled by TrainRenderer
  group.add(glow);
  
  // Wheels (4 wheels)
  const wheelGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: COLORS.wheels, flatShading: true });
  
  const wheelPositions = [
    [-ENGINE_WIDTH / 2, 0.09, -ENGINE_LENGTH * 0.25],
    [-ENGINE_WIDTH / 2, 0.09, ENGINE_LENGTH * 0.25],
    [ENGINE_WIDTH / 2, 0.09, -ENGINE_LENGTH * 0.25],
    [ENGINE_WIDTH / 2, 0.09, ENGINE_LENGTH * 0.25],
  ];
  
  wheelPositions.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(...pos);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    group.add(wheel);
  });
  
  // Cowcatcher — lifted just above the chassis top (y=0.09) so its faces
  // are never coplanar with the black base (fixes z-fighting)
  const catcherGeo = new THREE.BoxGeometry(ENGINE_WIDTH * 0.9, 0.07, 0.12);
  const catcherMat = new THREE.MeshLambertMaterial({ color: COLORS.details, flatShading: true });
  const catcher = new THREE.Mesh(catcherGeo, catcherMat);
  catcher.position.set(0, 0.095, 0.44);
  group.add(catcher);

  // Fake contact shadow patch under the engine (see utils/contactPatch.js)
  const patch = createContactPatch(0.32, 0.3, -0.088);
  group.add(patch);
  
  return group;
}

/**
 * Get train dimensions
 */
export function getTrainDimensions() {
  return {
    length: ENGINE_LENGTH,
    width: ENGINE_WIDTH,
    height: ENGINE_HEIGHT
  };
}

export { ENGINE_LENGTH, ENGINE_WIDTH, ENGINE_HEIGHT };
export { createPassengerCoach } from './PassengerCoachModel';
export { createCoalCart } from './CoalCartModel';
export { createGasCoach } from './GasCoachModel';
export { createGoodsCoach } from './GoodsCoachModel';
export { createContainerCoach } from './ContainerCoachModel';
export { createViewdeckCoach } from './ViewdeckCoachModel';
