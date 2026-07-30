import * as THREE from 'three';

const VOXEL_SIZE = 0.5;
// Tracks are now exactly 1x1 voxel (0.5 units = 1 voxel)
const STRAIGHT_TRACK_WIDTH = 0.5;
const CURVED_TRACK_WIDTH = 0.5;
const TRACK_LENGTH = 0.5; // 1 voxel long
const RAIL_HEIGHT = 0.05;
const SLEEPER_SPACING = 0.15;

// Calculate rail offset to ensure alignment between straight and curved tracks
const RAIL_OFFSET = STRAIGHT_TRACK_WIDTH / 2 - RAIL_HEIGHT * 0.4;

// Track colors
const COLORS = {
  rail: 0x4a4a4a,        // Dark gray steel
  sleeper: 0x8b4513,     // Brown wood
  gravel: 0x808080,      // Gray gravel
  beam: 0x5a3d28,        // Dark wood trestle pillar
  deck: 0x7c5a3c,        // Bridge deck beam
  brace: 0x4a3220,       // Cross braces
  cap: 0x3a2618,         // Pillar cap
  validGhost: 0x00ff00,  // Green for valid
  invalidGhost: 0xff0000, // Red for invalid
};

/**
 * Create a straight track piece
 */
export function createStraightTrack(isGhost = false, isValid = true) {
  const group = new THREE.Group();
  
  if (isGhost) {
    const geometry = new THREE.BoxGeometry(STRAIGHT_TRACK_WIDTH, RAIL_HEIGHT * 2, TRACK_LENGTH);
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
  const gravelGeometry = new THREE.BoxGeometry(STRAIGHT_TRACK_WIDTH, RAIL_HEIGHT * 0.5, TRACK_LENGTH);
  const gravelMaterial = new THREE.MeshLambertMaterial({ color: COLORS.gravel, flatShading: true });
  const gravel = new THREE.Mesh(gravelGeometry, gravelMaterial);
  gravel.position.y = RAIL_HEIGHT * 0.25;
  gravel.castShadow = true;
  gravel.receiveShadow = true;
  group.add(gravel);
  
  // Sleepers
  const sleeperGeometry = new THREE.BoxGeometry(STRAIGHT_TRACK_WIDTH * 0.9, RAIL_HEIGHT * 0.6, RAIL_HEIGHT * 1.5);
  const sleeperMaterial = new THREE.MeshLambertMaterial({ color: COLORS.sleeper, flatShading: true });
  
  for (let z = -TRACK_LENGTH / 2 + 0.05; z <= TRACK_LENGTH / 2 - 0.05; z += SLEEPER_SPACING) {
    const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
    sleeper.position.set(0, RAIL_HEIGHT * 0.5, z);
    sleeper.castShadow = true;
    sleeper.receiveShadow = true;
    group.add(sleeper);
  }
  
  // Rails
  const railGeometry = new THREE.BoxGeometry(RAIL_HEIGHT * 0.8, RAIL_HEIGHT * 0.8, TRACK_LENGTH);
  const railMaterial = new THREE.MeshLambertMaterial({ color: COLORS.rail, flatShading: true });
  
  const rail1 = new THREE.Mesh(railGeometry, railMaterial);
  rail1.position.set(-RAIL_OFFSET, RAIL_HEIGHT, 0);
  rail1.castShadow = true;
  rail1.receiveShadow = true;
  group.add(rail1);
  
  const rail2 = new THREE.Mesh(railGeometry, railMaterial);
  rail2.position.set(RAIL_OFFSET, RAIL_HEIGHT, 0);
  rail2.castShadow = true;
  rail2.receiveShadow = true;
  group.add(rail2);
  
  return group;
}

/**
 * Create a curved track piece (90 degree curve fitting exactly within 0.5x0.5 voxel)
 */
export function createCurvedTrack(isGhost = false, isValid = true) {
  const group = new THREE.Group();
  const radius = 0.5; // Radius from pivot point (-0.25, -0.25)
  const pivotX = -0.25;
  const pivotZ = -0.25;
  const segments = 8;
  
  if (isGhost) {
    const boxGeometry = new THREE.BoxGeometry(0.5, RAIL_HEIGHT * 2, 0.5);
    const boxMaterial = new THREE.MeshBasicMaterial({
      color: isValid ? COLORS.validGhost : COLORS.invalidGhost,
      transparent: true,
      opacity: 0.5,
    });
    const box = new THREE.Mesh(boxGeometry, boxMaterial);
    box.position.y = RAIL_HEIGHT;
    group.add(box);
    return group;
  }
  
  const angleStep = (Math.PI / 2) / segments;
  
  // Gravel and sleepers along recentered arc
  for (let i = 0; i <= segments; i++) {
    const angle = i * angleStep;
    const x = pivotX + Math.cos(angle) * radius;
    const z = pivotZ + Math.sin(angle) * radius;
    
    // Gravel segment
    const gravelGeometry = new THREE.BoxGeometry(CURVED_TRACK_WIDTH * 0.9, RAIL_HEIGHT * 0.5, SLEEPER_SPACING * 1.1);
    const gravelMaterial = new THREE.MeshLambertMaterial({ color: COLORS.gravel, flatShading: true });
    const gravel = new THREE.Mesh(gravelGeometry, gravelMaterial);
    gravel.position.set(x, RAIL_HEIGHT * 0.25, z);
    gravel.rotation.y = -angle;
    gravel.castShadow = true;
    gravel.receiveShadow = true;
    group.add(gravel);
    
    // Sleepers
    if (i % 2 === 0) {
      const sleeperGeometry = new THREE.BoxGeometry(CURVED_TRACK_WIDTH * 0.9, RAIL_HEIGHT * 0.6, RAIL_HEIGHT * 1.5);
      const sleeperMaterial = new THREE.MeshLambertMaterial({ color: COLORS.sleeper, flatShading: true });
      const sleeper = new THREE.Mesh(sleeperGeometry, sleeperMaterial);
      sleeper.position.set(x, RAIL_HEIGHT * 0.5, z);
      sleeper.rotation.y = -angle;
      sleeper.castShadow = true;
      sleeper.receiveShadow = true;
      group.add(sleeper);
    }
  }
  
  // Curved Rails
  const innerRadius = radius - RAIL_OFFSET;
  const outerRadius = radius + RAIL_OFFSET;
  
  const buildRailMesh = (r) => {
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const angle = i * angleStep;
      points.push(new THREE.Vector3(
        pivotX + Math.cos(angle) * r,
        RAIL_HEIGHT * 0.8,
        pivotZ + Math.sin(angle) * r
      ));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, segments, RAIL_HEIGHT * 0.4, 4, false);
  };
  
  const railMaterial = new THREE.MeshLambertMaterial({ color: COLORS.rail, flatShading: true });
  
  const rail1 = new THREE.Mesh(buildRailMesh(innerRadius), railMaterial);
  rail1.castShadow = true;
  rail1.receiveShadow = true;
  group.add(rail1);
  
  const rail2 = new THREE.Mesh(buildRailMesh(outerRadius), railMaterial);
  rail2.castShadow = true;
  rail2.receiveShadow = true;
  group.add(rail2);
  
  return group;
}

/**
 * Create aesthetically pleasing wooden/steel trestle bridges & support beams
 */
export function createSupportBeams(height, trackType = 'straight') {
  if (height <= 0.05) return null;
  
  const group = new THREE.Group();
  const pillarRadius = 0.04;
  const pillarHeight = height;
  
  const pillarMat = new THREE.MeshLambertMaterial({ color: COLORS.beam, flatShading: true });
  const deckMat = new THREE.MeshLambertMaterial({ color: COLORS.deck, flatShading: true });
  const braceMat = new THREE.MeshLambertMaterial({ color: COLORS.brace, flatShading: true });
  const capMat = new THREE.MeshLambertMaterial({ color: COLORS.cap, flatShading: true });
  
  const pillarGeo = new THREE.CylinderGeometry(pillarRadius * 0.8, pillarRadius, pillarHeight, 6);
  
  if (trackType === 'straight') {
    // Under-deck horizontal beams
    const deckBeamGeo = new THREE.BoxGeometry(STRAIGHT_TRACK_WIDTH * 1.1, 0.08, TRACK_LENGTH);
    const deckBeam = new THREE.Mesh(deckBeamGeo, deckMat);
    deckBeam.position.set(0, -0.04, 0);
    deckBeam.castShadow = true;
    deckBeam.receiveShadow = true;
    group.add(deckBeam);

    // 4 Vertical Pillars
    const offsetX = STRAIGHT_TRACK_WIDTH * 0.35;
    const offsetZ = TRACK_LENGTH * 0.35;
    
    const pillarPositions = [
      [-offsetX, -pillarHeight / 2, -offsetZ],
      [offsetX, -pillarHeight / 2, -offsetZ],
      [-offsetX, -pillarHeight / 2, offsetZ],
      [offsetX, -pillarHeight / 2, offsetZ],
    ];
    
    pillarPositions.forEach(pos => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(...pos);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      group.add(pillar);

      // Pillar Top Cap
      const capGeo = new THREE.BoxGeometry(pillarRadius * 3, 0.04, pillarRadius * 3);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.position.set(pos[0], -0.08, pos[2]);
      group.add(cap);
    });

    // Cross Bracing for heights > 0.8
    if (height > 0.8) {
      const braceLevels = Math.floor(height / 0.8);
      for (let l = 0; l < braceLevels; l++) {
        const yPos = -height + (l + 0.5) * (height / braceLevels);
        
        // Transverse horizontal brace
        const horizBraceGeo = new THREE.BoxGeometry(offsetX * 2, 0.04, 0.04);
        const hBrace = new THREE.Mesh(horizBraceGeo, braceMat);
        hBrace.position.set(0, yPos, -offsetZ);
        group.add(hBrace);

        const hBrace2 = hBrace.clone();
        hBrace2.position.set(0, yPos, offsetZ);
        group.add(hBrace2);
      }
    }
  } else if (trackType === 'curved') {
    const pivotX = -0.25;
    const pivotZ = -0.25;
    const radius = 0.5;
    const segments = 4;
    const angleStep = (Math.PI / 2) / segments;

    for (let i = 0; i <= segments; i++) {
      const angle = i * angleStep;
      const cx = pivotX + Math.cos(angle) * radius;
      const cz = pivotZ + Math.sin(angle) * radius;

      // Deck block segment
      const capGeo = new THREE.BoxGeometry(0.18, 0.08, 0.18);
      const cap = new THREE.Mesh(capGeo, deckMat);
      cap.position.set(cx, -0.04, cz);
      group.add(cap);

      // Pillar underneath
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(cx, -pillarHeight / 2, cz);
      pillar.castShadow = true;
      pillar.receiveShadow = true;
      group.add(pillar);
    }
  }
  
  return group;
}

/**
 * Get track dimensions for collision detection
 */
export function getTrackDimensions(type) {
  if (type === 'straight') {
    return { width: STRAIGHT_TRACK_WIDTH, length: TRACK_LENGTH };
  } else if (type === 'curved') {
    return { width: 0.5, length: 0.5 }; // 1x1 voxel for curved
  }
  return { width: 0, length: 0 };
}

export { VOXEL_SIZE, STRAIGHT_TRACK_WIDTH, CURVED_TRACK_WIDTH, RAIL_HEIGHT, TRACK_LENGTH };
