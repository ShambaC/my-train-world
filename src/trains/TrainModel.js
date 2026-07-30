import * as THREE from 'three';

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

  // Headlight (front)
  const lightGeo = new THREE.SphereGeometry(0.05, 8, 8);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffea00 });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.position.set(0, 0.24, 0.36);
  group.add(light);
  
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
  
  // Cowcatcher
  const catcherGeo = new THREE.BoxGeometry(ENGINE_WIDTH * 0.9, 0.06, 0.12);
  const catcherMat = new THREE.MeshLambertMaterial({ color: COLORS.details, flatShading: true });
  const catcher = new THREE.Mesh(catcherGeo, catcherMat);
  catcher.position.set(0, 0.06, 0.42);
  group.add(catcher);
  
  return group;
}

/**
 * Create transparent ghost silhouette for train engine
 */
export function createTrainGhost(isValid = true) {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(ENGINE_WIDTH * 0.9, ENGINE_HEIGHT * 0.8, ENGINE_LENGTH * 0.9);
  const material = new THREE.MeshBasicMaterial({
    color: isValid ? 0x00ff00 : 0xff0000,
    transparent: true,
    opacity: 0.5,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = ENGINE_HEIGHT * 0.4;
  group.add(mesh);
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
