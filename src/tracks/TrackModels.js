import * as THREE from 'three';

const VOXEL_SIZE = 0.5;
const TRACK_WIDTH = 1.0; // Reduced from 1.5
const RAIL_HEIGHT = 0.1; // Reduced from 0.15
const SLEEPER_SPACING = 0.4; // Reduced from 0.5
const TRACK_LENGTH = 2; // 2 units long

// Track colors
const COLORS = {
  rail: 0x4a4a4a,        // Dark gray steel
  sleeper: 0x8b4513,     // Brown wood
  gravel: 0x808080,      // Gray gravel
  beam: 0x654321,        // Dark brown support beam
  validGhost: 0x00ff00,  // Green for valid
  invalidGhost: 0xff0000, // Red for invalid
};

/**
 * Create a straight track piece
 */
export function createStraightTrack(isGhost = false, isValid = true) {
  const group = new THREE.Group();
  
  if (isGhost) {
    // Simplified ghost preview
    const geometry = new THREE.BoxGeometry(TRACK_WIDTH, RAIL_HEIGHT * 2, TRACK_LENGTH);
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
  
  // Gravel base (simplified)
  const gravelGeometry = new THREE.BoxGeometry(TRACK_WIDTH, RAIL_HEIGHT * 0.5, TRACK_LENGTH);
  const gravelMaterial = new THREE.MeshLambertMaterial({ color: COLORS.gravel, flatShading: true });
  const gravel = new THREE.Mesh(gravelGeometry, gravelMaterial);
  gravel.position.y = RAIL_HEIGHT * 0.25;
  gravel.castShadow = true;
  gravel.receiveShadow = true;
  group.add(gravel);
  
  // Fewer sleepers for performance
  const sleeperGeometry = new THREE.BoxGeometry(TRACK_WIDTH, RAIL_HEIGHT * 0.6, RAIL_HEIGHT * 1.5);
  const sleeperMaterial = new THREE.MeshLambertMaterial({ color: COLORS.sleeper, flatShading: true });
  
  for (let z = -TRACK_LENGTH / 2; z <= TRACK_LENGTH / 2; z += SLEEPER_SPACING) {
    const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
    sleeper.position.set(0, RAIL_HEIGHT * 0.5, z);
    sleeper.castShadow = true;
    sleeper.receiveShadow = true;
    group.add(sleeper);
  }
  
  // Rails (two parallel) - simplified
  const railGeometry = new THREE.BoxGeometry(RAIL_HEIGHT * 0.8, RAIL_HEIGHT * 0.8, TRACK_LENGTH);
  const railMaterial = new THREE.MeshLambertMaterial({ color: COLORS.rail, flatShading: true });
  
  const rail1 = new THREE.Mesh(railGeometry, railMaterial);
  rail1.position.set(-TRACK_WIDTH / 3, RAIL_HEIGHT * 0.8, 0);
  rail1.castShadow = true;
  rail1.receiveShadow = true;
  group.add(rail1);
  
  const rail2 = new THREE.Mesh(railGeometry, railMaterial);
  rail2.position.set(TRACK_WIDTH / 3, RAIL_HEIGHT * 0.8, 0);
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
  const radius = 1.5; // Reduced from 2
  const segments = 8; // Reduced from 16 for performance
  
  if (isGhost) {
    // Simplified ghost preview
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
      linewidth: 3,
      transparent: true,
      opacity: 0.7,
    });
    
    const line = new THREE.Line(geometry, material);
    line.rotation.x = -Math.PI / 2;
    line.position.y = RAIL_HEIGHT * 2;
    group.add(line);
    
    // Add a smaller box to show the area
    const boxGeometry = new THREE.BoxGeometry(radius, RAIL_HEIGHT * 2, radius);
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
  
  // Simplified curved track
  const angleStep = (Math.PI / 2) / segments;
  
  // Gravel and sleepers
  for (let i = 0; i <= segments; i++) {
    const angle = i * angleStep;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    
    // Gravel
    const gravelGeometry = new THREE.BoxGeometry(TRACK_WIDTH * 0.8, RAIL_HEIGHT * 0.5, SLEEPER_SPACING);
    const gravelMaterial = new THREE.MeshLambertMaterial({ color: COLORS.gravel, flatShading: true });
    const gravel = new THREE.Mesh(gravelGeometry, gravelMaterial);
    gravel.position.set(x, RAIL_HEIGHT * 0.25, z);
    gravel.rotation.y = -angle;
    gravel.castShadow = true;
    gravel.receiveShadow = true;
    group.add(gravel);
    
    // Sleepers (every other segment)
    if (i % 2 === 0) {
      const sleeperGeometry = new THREE.BoxGeometry(TRACK_WIDTH * 0.8, RAIL_HEIGHT * 0.6, RAIL_HEIGHT * 1.5);
      const sleeperMaterial = new THREE.MeshLambertMaterial({ color: COLORS.sleeper, flatShading: true });
      const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
      sleeper.position.set(x, RAIL_HEIGHT * 0.5, z);
      sleeper.rotation.y = -angle;
      sleeper.castShadow = true;
      sleeper.receiveShadow = true;
      group.add(sleeper);
    }
  }
  
  // Simplified rails using tubes
  const railCurve = new THREE.EllipseCurve(0, 0, radius - TRACK_WIDTH / 4, radius - TRACK_WIDTH / 4, 0, Math.PI / 2, false, 0);
  const railCurve2 = new THREE.EllipseCurve(0, 0, radius + TRACK_WIDTH / 4, radius + TRACK_WIDTH / 4, 0, Math.PI / 2, false, 0);
  
  const railPoints1 = railCurve.getPoints(segments);
  const railPoints2 = railCurve2.getPoints(segments);
  
  const railGeometry1 = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(railPoints1.map(p => new THREE.Vector3(p.x, RAIL_HEIGHT * 0.8, p.y))),
    segments,
    RAIL_HEIGHT * 0.4,
    4,
    false
  );
  
  const railGeometry2 = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(railPoints2.map(p => new THREE.Vector3(p.x, RAIL_HEIGHT * 0.8, p.y))),
    segments,
    RAIL_HEIGHT * 0.4,
    4,
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
 * Create support beams for elevated tracks
 */
export function createSupportBeams(height, trackType = 'straight') {
  if (height <= 0.5) return null; // No beams needed for ground-level tracks
  
  const group = new THREE.Group();
  const beamSize = 0.15;
  const beamGeometry = new THREE.BoxGeometry(beamSize, height, beamSize);
  const beamMaterial = new THREE.MeshLambertMaterial({ color: COLORS.beam, flatShading: true });
  
  if (trackType === 'straight') {
    // 4 support beams for straight track
    const positions = [
      [-TRACK_WIDTH / 3, -height / 2, -TRACK_LENGTH / 3],
      [TRACK_WIDTH / 3, -height / 2, -TRACK_LENGTH / 3],
      [-TRACK_WIDTH / 3, -height / 2, TRACK_LENGTH / 3],
      [TRACK_WIDTH / 3, -height / 2, TRACK_LENGTH / 3],
    ];
    
    positions.forEach(pos => {
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.set(...pos);
      beam.castShadow = true;
      beam.receiveShadow = true;
      group.add(beam);
    });
  } else if (trackType === 'curved') {
    // Support beams along the curve
    const radius = 1.5;
    const segments = 4;
    const angleStep = (Math.PI / 2) / segments;
    
    for (let i = 0; i <= segments; i++) {
      const angle = i * angleStep;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.set(x, -height / 2, z);
      beam.castShadow = true;
      beam.receiveShadow = true;
      group.add(beam);
    }
  }
  
  return group;
}

/**
 * Get track dimensions for collision detection
 */
export function getTrackDimensions(type) {
  if (type === 'straight') {
    return { width: TRACK_WIDTH, length: TRACK_LENGTH };
  } else if (type === 'curved') {
    return { width: 1.5, length: 1.5 }; // Adjusted from 2
  }
  return { width: 0, length: 0 };
}

export { VOXEL_SIZE, TRACK_WIDTH, RAIL_HEIGHT, TRACK_LENGTH };
