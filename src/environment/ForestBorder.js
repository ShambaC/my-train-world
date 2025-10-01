import * as THREE from 'three';

/**
 * Creates an optimized forest border using InstancedMesh and adds a ground plane.
 * @param {object} terrainSize - An object with { length, breadth } properties.
 * @param {number} borderDepth - How far the forest extends from the terrain edge.
 * @param {number} density - How dense the trees are (trees per square unit).
 * @returns {THREE.Group} A group containing the forest and the ground.
 */
export function createForestBorder(terrainSize, borderDepth = 15, density = 0.3) {
  const borderGroup = new THREE.Group();
  borderGroup.name = 'forestBorder';

  const halfLength = terrainSize.length / 2;
  const halfBreadth = terrainSize.breadth / 2;

  // --- 1. Add a Ground Plane for the Trees ---
  const groundSize = Math.max(terrainSize.length, terrainSize.breadth) + borderDepth * 2;
  const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a4d2a, // A dark, earthy green
    roughness: 0.9,
    metalness: 0.1,
  });
  const groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
  groundPlane.rotation.x = -Math.PI / 2; // Rotate plane to be horizontal
  groundPlane.position.y = -0.05; // Position slightly below y=0 to avoid z-fighting
  groundPlane.receiveShadow = true;
  borderGroup.add(groundPlane);

  // --- 2. Setup for Instanced Rendering ---

  // Calculate the total number of trees needed first
  let totalTrees = 0;
  const areas = [
    { w: terrainSize.length + 2 * borderDepth, d: borderDepth }, // North
    { w: terrainSize.length + 2 * borderDepth, d: borderDepth }, // South
    { w: borderDepth, d: terrainSize.breadth }, // East
    { w: borderDepth, d: terrainSize.breadth }, // West
  ];
  areas.forEach(area => {
    totalTrees += Math.floor(area.w * area.d * density);
  });

  console.log(`Generating an optimized forest with approximately ${totalTrees} trees.`);

  // Create base geometries and materials ONCE
  const trunkGeometry = new THREE.CylinderGeometry(0.15, 0.2, 2, 6);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728 });

  const coneGeometries = [
    new THREE.ConeGeometry(0.8, 1.5, 6),
    new THREE.ConeGeometry(0.6, 1.3, 6),
    new THREE.ConeGeometry(0.4, 1.0, 6),
  ];
  const foliageMaterial = new THREE.MeshStandardMaterial({
    color: 0x3a6b1f,
    flatShading: true,
  });

  // Create InstancedMesh for each tree part
  const trunkInstances = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, totalTrees);
  const cone1Instances = new THREE.InstancedMesh(coneGeometries[0], foliageMaterial, totalTrees);
  const cone2Instances = new THREE.InstancedMesh(coneGeometries[1], foliageMaterial, totalTrees);
  const cone3Instances = new THREE.InstancedMesh(coneGeometries[2], foliageMaterial, totalTrees);

  // Enable shadows for all instances
  [trunkInstances, cone1Instances, cone2Instances, cone3Instances].forEach(instancedMesh => {
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true; // Trees can receive shadows from each other
  });

  // --- 3. Placement Logic using Matrices ---
  let treeIndex = 0;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();

  const placeTrees = (startX, endX, startZ, endZ) => {
    const width = Math.abs(endX - startX);
    const depth = Math.abs(endZ - startZ);
    const numTrees = Math.floor(width * depth * density);

    for (let i = 0; i < numTrees; i++) {
        if (treeIndex >= totalTrees) break; // Safety break

        const x = startX + Math.random() * width;
        const z = startZ + Math.random() * depth;
        const scale = 0.8 + Math.random() * 0.7; // Randomize scale for variety
        
        // Use a dummy object to easily compose transformations
        const rotationY = Math.random() * Math.PI * 2;
        quaternion.setFromEuler(new THREE.Euler(0, rotationY, 0));

        // Set matrix for each part of the tree, relative to the tree's root position
        const setPartMatrix = (instancedMesh, offsetY) => {
            position.set(x, offsetY * scale, z);
            scaleVec.set(scale, scale, scale);
            matrix.compose(position, quaternion, scaleVec);
            instancedMesh.setMatrixAt(treeIndex, matrix);
        };
        
        setPartMatrix(trunkInstances, 1.0);
        setPartMatrix(cone1Instances, 2.5);
        setPartMatrix(cone2Instances, 3.5);
        setPartMatrix(cone3Instances, 4.5);
        
        treeIndex++;
    }
  };

  // Define border zones
  // North
  placeTrees(-halfLength, halfLength, halfBreadth, halfBreadth + borderDepth);
  // South
  placeTrees(-halfLength, halfLength, -halfBreadth - borderDepth, -halfBreadth);
  // East
  placeTrees(halfLength, halfLength + borderDepth, -halfBreadth, halfBreadth);
  // West
  placeTrees(-halfLength - borderDepth, -halfLength, -halfBreadth, halfBreadth);

  // Corners
  placeTrees(halfLength, halfLength + borderDepth, halfBreadth, halfBreadth + borderDepth);
  placeTrees(-halfLength - borderDepth, -halfLength, halfBreadth, halfBreadth + borderDepth);
  placeTrees(halfLength, halfLength + borderDepth, -halfBreadth - borderDepth, -halfBreadth);
  placeTrees(-halfLength - borderDepth, -halfLength, -halfBreadth - borderDepth, -halfBreadth);

  // Add the instanced meshes to the group
  borderGroup.add(trunkInstances, cone1Instances, cone2Instances, cone3Instances);

  return borderGroup;
}