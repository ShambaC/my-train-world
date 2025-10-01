import * as THREE from 'three';

const VOXEL_SIZE = 0.5;
const TRACK_WIDTH = 1.5;
const RAIL_HEIGHT = 0.15;
const SLEEPER_SPACING = 0.5;

// Track colors
const COLORS = {
  rail: 0x4a4a4a,        // Dark gray steel
  sleeper: 0x8b4513,     // Brown wood
  gravel: 0x808080,      // Gray gravel
  validGhost: 0x00ff00,  // Green for valid
  invalidGhost: 0xff0000, // Red for invalid
};

/**
 * Create a straight track piece
 */
export function createStraightTrack(isGhost = false, isValid = true) {
  const group = new THREE.Group();
  const length = 2; // 2 units long
  
  if (isGhost) {
    // Ghost preview with transparency
    const geometry = new THREE.BoxGeometry(TRACK_WIDTH, RAIL_HEIGHT * 2, length);
    const material = new THREE.MeshBasicMaterial({
      color: isValid ? COLORS.validGhost : COLORS.invalidGhost,
      transparent: true,
      opacity: 0.5,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.y = RAIL_HEIGHT;
    group.add(mesh);
    return group;
  }
  
  // Gravel base
  const gravelGeometry = new THREE.BoxGeometry(TRACK_WIDTH, RAIL_HEIGHT * 0.5, length);
  const gravelMaterial = new THREE.MeshLambertMaterial({ color: COLORS.gravel, flatShading: true });
  const gravel = new THREE.Mesh(gravelGeometry, gravelMaterial);
  gravel.position.y = RAIL_HEIGHT * 0.25;
  gravel.castShadow = true;
  gravel.receiveShadow = true;
  group.add(gravel);
  
  // Sleepers (cross ties)
  const sleeperGeometry = new THREE.BoxGeometry(TRACK_WIDTH, RAIL_HEIGHT * 0.8, RAIL_HEIGHT * 2);
  const sleeperMaterial = new THREE.MeshLambertMaterial({ color: COLORS.sleeper, flatShading: true });
  
  for (let z = -length / 2; z <= length / 2; z += SLEEPER_SPACING) {
    const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
    sleeper.position.set(0, RAIL_HEIGHT * 0.6, z);
    sleeper.castShadow = true;
    sleeper.receiveShadow = true;
    group.add(sleeper);
  }
  
  // Rails (two parallel)
  const railGeometry = new THREE.BoxGeometry(RAIL_HEIGHT, RAIL_HEIGHT, length);
  const railMaterial = new THREE.MeshLambertMaterial({ color: COLORS.rail, flatShading: true });
  
  const rail1 = new THREE.Mesh(railGeometry, railMaterial);
  rail1.position.set(-TRACK_WIDTH / 3, RAIL_HEIGHT, 0);
  rail1.castShadow = true;
  rail1.receiveShadow = true;
  group.add(rail1);
  
  const rail2 = new THREE.Mesh(railGeometry, railMaterial);
  rail2.position.set(TRACK_WIDTH / 3, RAIL_HEIGHT, 0);
  rail2.castShadow = true;
  rail2.receiveShadow = true;
  group.add(rail2);
  
  return group;
}

/**
 * Create a curved track piece (90 degree curve)
 */
export function createCurvedTrack(isGhost = false, isValid = true) {
  const group = new THREE.Group();
  const radius = 2; // Curve radius
  const segments = 16;
  
  if (isGhost) {
    // Ghost preview
    const curve = new THREE.EllipseCurve(
      0, 0,
      radius, radius,
      0, Math.PI / 2,
      false,
      0
    );
    
    const points = curve.getPoints(segments);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: isValid ? COLORS.validGhost : COLORS.invalidGhost,
      linewidth: 5,
      transparent: true,
      opacity: 0.7,
    });
    
    const line = new THREE.Line(geometry, material);
    line.rotation.x = -Math.PI / 2;
    line.position.y = RAIL_HEIGHT * 2;
    group.add(line);
    
    // Add a box to show the area
    const boxGeometry = new THREE.BoxGeometry(radius * 1.2, RAIL_HEIGHT * 2, radius * 1.2);
    const boxMaterial = new THREE.MeshBasicMaterial({
      color: isValid ? COLORS.validGhost : COLORS.invalidGhost,
      transparent: true,
      opacity: 0.2,
    });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.set(radius / 2, RAIL_HEIGHT, radius / 2);
    group.add(box);
    
    return group;
  }
  
  // Create curved track with gravel, sleepers, and rails
  const angleStep = (Math.PI / 2) / segments;
  
  // Gravel base along curve
  for (let i = 0; i <= segments; i++) {
    const angle = i * angleStep;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    const gravelGeometry = new THREE.BoxGeometry(TRACK_WIDTH, RAIL_HEIGHT * 0.5, SLEEPER_SPACING);
    const gravelMaterial = new THREE.MeshLambertMaterial({ color: COLORS.gravel, flatShading: true });
    const gravel = new THREE.Mesh(gravelGeometry, gravelMaterial);
    gravel.position.set(x, RAIL_HEIGHT * 0.25, z);
    gravel.rotation.y = -angle;
    gravel.castShadow = true;
    gravel.receiveShadow = true;
    group.add(gravel);
    
    // Sleepers
    if (i % 2 === 0) {
      const sleeperGeometry = new THREE.BoxGeometry(TRACK_WIDTH, RAIL_HEIGHT * 0.8, RAIL_HEIGHT * 2);
      const sleeperMaterial = new THREE.MeshLambertMaterial({ color: COLORS.sleeper, flatShading: true });
      const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
      sleeper.position.set(x, RAIL_HEIGHT * 0.6, z);
      sleeper.rotation.y = -angle;
      sleeper.castShadow = true;
      sleeper.receiveShadow = true;
      group.add(sleeper);
    }
  }
  
  // Rails along curve
  const railCurve = new THREE.EllipseCurve(0, 0, radius - TRACK_WIDTH / 6, radius - TRACK_WIDTH / 6, 0, Math.PI / 2, false, 0);
  const railCurve2 = new THREE.EllipseCurve(0, 0, radius + TRACK_WIDTH / 6, radius + TRACK_WIDTH / 6, 0, Math.PI / 2, false, 0);
  
  const railPoints1 = railCurve.getPoints(segments * 2);
  const railPoints2 = railCurve2.getPoints(segments * 2);
  
  const railGeometry1 = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(railPoints1.map(p => new THREE.Vector3(p.x, RAIL_HEIGHT, p.y))),
    segments * 2,
    RAIL_HEIGHT / 2,
    8,
    false
  );
  
  const railGeometry2 = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(railPoints2.map(p => new THREE.Vector3(p.x, RAIL_HEIGHT, p.y))),
    segments * 2,
    RAIL_HEIGHT / 2,
    8,
    false
  );
  
  const railMaterial = new THREE.MeshLambertMaterial({ color: COLORS.rail, flatShading: true });
  
  const rail1 = new THREE.Mesh(railGeometry1, railMaterial);
  rail1.castShadow = true;
  rail1.receiveShadow = true;
  group.add(rail1);
  
  const rail2 = new THREE.Mesh(railGeometry2, railMaterial);
  rail2.castShadow = true;
  rail2.receiveShadow = true;
  group.add(rail2);
  
  return group;
}

/**
 * Get track dimensions for collision detection
 */
export function getTrackDimensions(type) {
  if (type === 'straight') {
    return { width: TRACK_WIDTH, length: 2 };
  } else if (type === 'curved') {
    return { width: 2, length: 2 };
  }
  return { width: 0, length: 0 };
}

export { VOXEL_SIZE, TRACK_WIDTH, RAIL_HEIGHT };
