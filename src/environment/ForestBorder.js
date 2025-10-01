import * as THREE from 'three';

/**
 * Creates a forest border around the terrain edges
 * Makes the play area feel less like an island floating in space
 */
export function createForestBorder(terrainSize, borderDepth = 15, density = 0.3) {
  const borderGroup = new THREE.Group();
  borderGroup.name = 'forestBorder';

  const halfLength = terrainSize.length / 2;
  const halfBreadth = terrainSize.breadth / 2;

  // Tree geometry (simple pine tree shape)
  const createTree = (x, z, scale = 1) => {
    const treeGroup = new THREE.Group();

    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.15 * scale, 0.2 * scale, 2 * scale, 6);
    const trunkMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x4a3728,
      roughness: 0.9,
      metalness: 0.1
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1 * scale;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Foliage (3 cone layers)
    const foliageColors = [0x2d5016, 0x3a6b1f, 0x456d25];
    const foliageMaterial = new THREE.MeshStandardMaterial({ 
      color: foliageColors[Math.floor(Math.random() * foliageColors.length)],
      roughness: 0.8,
      metalness: 0.0,
      flatShading: true
    });

    // Bottom cone
    const cone1 = new THREE.Mesh(
      new THREE.ConeGeometry(0.8 * scale, 1.5 * scale, 6),
      foliageMaterial
    );
    cone1.position.y = 2.5 * scale;
    cone1.castShadow = true;
    treeGroup.add(cone1);

    // Middle cone
    const cone2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.6 * scale, 1.3 * scale, 6),
      foliageMaterial
    );
    cone2.position.y = 3.5 * scale;
    cone2.castShadow = true;
    treeGroup.add(cone2);

    // Top cone
    const cone3 = new THREE.Mesh(
      new THREE.ConeGeometry(0.4 * scale, 1 * scale, 6),
      foliageMaterial
    );
    cone3.position.y = 4.5 * scale;
    cone3.castShadow = true;
    treeGroup.add(cone3);

    // Random rotation for variety
    treeGroup.rotation.y = Math.random() * Math.PI * 2;
    treeGroup.position.set(x, 0, z);

    return treeGroup;
  };

  // Place trees in border zones
  const placeTrees = (startX, endX, startZ, endZ, edgeType) => {
    const width = Math.abs(endX - startX);
    const depth = Math.abs(endZ - startZ);
    const area = width * depth;
    const numTrees = Math.floor(area * density);

    for (let i = 0; i < numTrees; i++) {
      const x = startX + Math.random() * width;
      const z = startZ + Math.random() * depth;
      
      // Vary tree size based on distance from terrain edge
      let distanceFromEdge;
      if (edgeType === 'north' || edgeType === 'south') {
        distanceFromEdge = Math.abs(z - (edgeType === 'north' ? halfBreadth : -halfBreadth));
      } else {
        distanceFromEdge = Math.abs(x - (edgeType === 'east' ? halfLength : -halfLength));
      }
      
      // Trees closer to edge are taller and denser
      const edgeFactor = 1 - (distanceFromEdge / borderDepth);
      const scale = 0.7 + Math.random() * 0.6 + edgeFactor * 0.4;
      
      borderGroup.add(createTree(x, z, scale));
    }
  };

  // North border (positive Z)
  placeTrees(
    -halfLength - borderDepth, 
    halfLength + borderDepth, 
    halfBreadth, 
    halfBreadth + borderDepth,
    'north'
  );

  // South border (negative Z)
  placeTrees(
    -halfLength - borderDepth, 
    halfLength + borderDepth, 
    -halfBreadth - borderDepth, 
    -halfBreadth,
    'south'
  );

  // East border (positive X)
  placeTrees(
    halfLength, 
    halfLength + borderDepth, 
    -halfBreadth, 
    halfBreadth,
    'east'
  );

  // West border (negative X)
  placeTrees(
    -halfLength - borderDepth, 
    -halfLength, 
    -halfBreadth, 
    halfBreadth,
    'west'
  );

  // Corners (fill in gaps)
  // NE corner
  placeTrees(halfLength, halfLength + borderDepth, halfBreadth, halfBreadth + borderDepth, 'corner');
  // NW corner
  placeTrees(-halfLength - borderDepth, -halfLength, halfBreadth, halfBreadth + borderDepth, 'corner');
  // SE corner
  placeTrees(halfLength, halfLength + borderDepth, -halfBreadth - borderDepth, -halfBreadth, 'corner');
  // SW corner
  placeTrees(-halfLength - borderDepth, -halfLength, -halfBreadth - borderDepth, -halfBreadth, 'corner');

  return borderGroup;
}
