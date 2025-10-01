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
export function createTrainEngine() {
  const group = new THREE.Group();
  
  // Main body
  const bodyGeometry = new THREE.BoxGeometry(ENGINE_WIDTH * 0.9, ENGINE_HEIGHT * 0.6, ENGINE_LENGTH * 0.8);
  const bodyMaterial = new THREE.MeshLambertMaterial({ 
    color: COLORS.body,
    flatShading: true 
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = ENGINE_HEIGHT * 0.35;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  
  // Cabin (front)
  const cabinGeometry = new THREE.BoxGeometry(ENGINE_WIDTH * 0.7, ENGINE_HEIGHT * 0.4, ENGINE_LENGTH * 0.3);
  const cabinMaterial = new THREE.MeshLambertMaterial({ 
    color: COLORS.cabin,
    flatShading: true 
  });
  const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
  cabin.position.set(0, ENGINE_HEIGHT * 0.6, -ENGINE_LENGTH * 0.3);
  cabin.castShadow = true;
  group.add(cabin);
  
  // Smokestack
  const stackGeometry = new THREE.CylinderGeometry(0.05, 0.06, ENGINE_HEIGHT * 0.4, 6);
  const stackMaterial = new THREE.MeshLambertMaterial({ 
    color: COLORS.details,
    flatShading: true 
  });
  const stack = new THREE.Mesh(stackGeometry, stackMaterial);
  stack.position.set(0, ENGINE_HEIGHT * 0.85, ENGINE_LENGTH * 0.15);
  stack.castShadow = true;
  group.add(stack);
  
  // Wheels (4 wheels - 2 on each side)
  const wheelGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8);
  const wheelMaterial = new THREE.MeshLambertMaterial({ 
    color: COLORS.wheels,
    flatShading: true 
  });
  
  const wheelPositions = [
    [-ENGINE_WIDTH / 2, 0.08, -ENGINE_LENGTH * 0.25],
    [-ENGINE_WIDTH / 2, 0.08, ENGINE_LENGTH * 0.25],
    [ENGINE_WIDTH / 2, 0.08, -ENGINE_LENGTH * 0.25],
    [ENGINE_WIDTH / 2, 0.08, ENGINE_LENGTH * 0.25],
  ];
  
  wheelPositions.forEach(pos => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.position.set(...pos);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    group.add(wheel);
  });
  
  // Front detail (cowcatcher)
  const catcherGeometry = new THREE.BoxGeometry(ENGINE_WIDTH * 1.1, 0.05, ENGINE_LENGTH * 0.15);
  const catcherMaterial = new THREE.MeshLambertMaterial({ 
    color: COLORS.details,
    flatShading: true 
  });
  const catcher = new THREE.Mesh(catcherGeometry, catcherMaterial);
  catcher.position.set(0, 0.05, -ENGINE_LENGTH * 0.5);
  catcher.castShadow = true;
  group.add(catcher);
  
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
