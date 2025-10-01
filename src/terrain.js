import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// Voxel size - smaller than Minecraft for higher resolution
const VOXEL_SIZE = 0.5;

// Terrain colors based on height
const TERRAIN_COLORS = {
  water: 0x4a90e2,
  sand: 0xddc490,
  grass: 0x5cb85c,
  rock: 0x808080,
  snow: 0xffffff,
  // Vegetation colors
  treeLeaf: 0x2d5a2d,
  treeTrunk: 0x8b4513,
  bush: 0x3a7a3a,
};

// --- generateVegetation function remains unchanged ---
function generateVegetation(terrain, heightMap, length, breadth, voxelGeometry, seed) {
  // This function is fine as it is, since it only places vegetation
  // on the top surface, which is always visible. No changes needed here.
  const noise2D = createNoise2D(() => seed * 2); 
  const vegetationInstances = new Map();
  
  const vegetationDensity = 0.08; 
  const minSpacing = 3; 
  
  const placedVegetation = [];
  
  for (let x = 0; x < length; x += 2) { 
    for (let z = 0; z < breadth; z += 2) {
      const height = heightMap[x][z];
      
      if (height <= 1) continue;
      
      const vegetationNoise = noise2D(x * 0.1, z * 0.1);
      if (vegetationNoise < (1 - vegetationDensity * 2)) continue;
      
      let tooClose = false;
      for (const placed of placedVegetation) {
        const dist = Math.sqrt(Math.pow(x - placed.x, 2) + Math.pow(z - placed.z, 2));
        if (dist < minSpacing) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;
      
      const worldX = (x - length / 2) * VOXEL_SIZE;
      const worldZ = (z - breadth / 2) * VOXEL_SIZE;
      
      const isBush = vegetationNoise > 0.5;
      
      if (isBush) {
        const bushPositions = [
          { x: 0, y: 1, z: 0 }, { x: 0, y: 2, z: 0 }, { x: 1, y: 1, z: 0 },
          { x: -1, y: 1, z: 0 }, { x: 0, y: 1, z: 1 }, { x: 0, y: 1, z: -1 },
        ];
        
        bushPositions.forEach(offset => {
          const pos = new THREE.Vector3(
            worldX + offset.x * VOXEL_SIZE,
            (height + offset.y) * VOXEL_SIZE,
            worldZ + offset.z * VOXEL_SIZE
          );
          
          const colorKey = TERRAIN_COLORS.bush.toString();
          if (!vegetationInstances.has(colorKey)) {
            vegetationInstances.set(colorKey, []);
          }
          vegetationInstances.get(colorKey).push({ position: pos });
        });
      } else {
        const treeHeight = 3 + Math.floor(Math.random() * 2);
        
        for (let y = 1; y <= treeHeight; y++) {
          const pos = new THREE.Vector3(worldX, (height + y) * VOXEL_SIZE, worldZ);
          const colorKey = TERRAIN_COLORS.treeTrunk.toString();
          if (!vegetationInstances.has(colorKey)) {
            vegetationInstances.set(colorKey, []);
          }
          vegetationInstances.get(colorKey).push({ position: pos });
        }
        
        const canopyPositions = [
          { x: 0, y: treeHeight + 1, z: 0 }, { x: 1, y: treeHeight, z: 0 },
          { x: -1, y: treeHeight, z: 0 }, { x: 0, y: treeHeight, z: 1 },
          { x: 0, y: treeHeight, z: -1 }, { x: 1, y: treeHeight + 1, z: 0 },
          { x: -1, y: treeHeight + 1, z: 0 }, { x: 0, y: treeHeight + 1, z: 1 },
          { x: 0, y: treeHeight + 1, z: -1 },
        ];
        
        canopyPositions.forEach(offset => {
          const pos = new THREE.Vector3(
            worldX + offset.x * VOXEL_SIZE,
            (height + offset.y) * VOXEL_SIZE,
            worldZ + offset.z * VOXEL_SIZE
          );
          const colorKey = TERRAIN_COLORS.treeLeaf.toString();
          if (!vegetationInstances.has(colorKey)) {
            vegetationInstances.set(colorKey, []);
          }
          vegetationInstances.get(colorKey).push({ position: pos });
        });
      }
      placedVegetation.push({ x, z });
    }
  }
  
  vegetationInstances.forEach((instances, colorKey) => {
    const color = parseInt(colorKey);
    const material = new THREE.MeshLambertMaterial({ color, flatShading: true });
    const instancedMesh = new THREE.InstancedMesh(voxelGeometry, material, instances.length);
    const matrix = new THREE.Matrix4();
    instances.forEach((instance, index) => {
      matrix.setPosition(instance.position);
      instancedMesh.setMatrixAt(index, matrix);
    });
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    terrain.add(instancedMesh);
  });
}


/**
 * Generate voxel terrain using simplex noise (OPTIMIZED)
 * @param {number} length - Length of the terrain (X axis)
 * @param {number} breadth - Breadth of the terrain (Z axis)
 * @param {number} seed - Random seed for terrain generation
 * @returns {THREE.Group} Group containing all terrain voxels
 */
export function generateTerrain(length, breadth, seed = Math.random()) {
  const terrain = new THREE.Group();
  const noise2D = createNoise2D(() => seed);
  
  const voxelGeometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
  const voxelInstances = new Map();
  
  const scale = 0.03;
  const heightMultiplier = 4;
  const waterLevel = 1;
  
  const heightMap = [];

  // =================================================================
  // OPTIMIZATION PHASE 1: Generate the entire height map first.
  // We need this data to check neighboring voxels later.
  // =================================================================
  for (let x = 0; x < length; x++) {
    heightMap[x] = [];
    for (let z = 0; z < breadth; z++) {
      const nx = x * scale;
      const nz = z * scale;
      let height = 0;
      let amplitude = 1;
      let frequency = 1;
      
      for (let octave = 0; octave < 3; octave++) {
        height += noise2D(nx * frequency, nz * frequency) * amplitude;
        amplitude *= 0.4;
        frequency *= 1.5;
      }
      
      height = (height + 1) * heightMultiplier;
      height = Math.floor(height * 0.6 + 2);
      heightMap[x][z] = Math.max(0, height);
    }
  }

  // =================================================================
  // OPTIMIZATION PHASE 2: Iterate again and generate ONLY visible voxels.
  // A voxel is visible if any of its 6 faces is exposed to air.
  // =================================================================
  for (let x = 0; x < length; x++) {
    for (let z = 0; z < breadth; z++) {
      const height = heightMap[x][z];

      // Get heights of neighbours, handling edges of the map.
      // If a neighbor is out of bounds, treat its height as -1 (deep below ground)
      // to ensure the voxels on the edge of the terrain are always rendered.
      const h_neg_x = (x > 0) ? heightMap[x - 1][z] : -1;
      const h_pos_x = (x < length - 1) ? heightMap[x + 1][z] : -1;
      const h_neg_z = (z > 0) ? heightMap[x][z - 1] : -1;
      const h_pos_z = (z < breadth - 1) ? heightMap[x][z + 1] : -1;
      
      // Stack voxels from bottom to top for this (x, z) column
      for (let y = 0; y <= height; y++) {
        // A voxel is exposed if:
        // 1. It's the top block of its column (y === height).
        // 2. It's adjacent to a shorter column of blocks.
        const isExposed =
          y === height ||
          y > h_neg_x ||
          y > h_pos_x ||
          y > h_neg_z ||
          y > h_pos_z;
        
        // If the voxel is not exposed, skip it and continue to the next one.
        if (!isExposed) {
          continue;
        }

        const worldX = (x - length / 2) * VOXEL_SIZE;
        const worldY = y * VOXEL_SIZE;
        const worldZ = (z - breadth / 2) * VOXEL_SIZE;
        
        let color;
        if (y <= waterLevel) {
          color = TERRAIN_COLORS.water;
        } else if (y <= waterLevel + 1) {
          color = TERRAIN_COLORS.sand;
        } else if (y < height) { // A side-block
          color = TERRAIN_COLORS.grass; 
        } else if (y === height) { // The top-most block
           if (height > 6) {
             color = TERRAIN_COLORS.rock;
           } else {
             color = TERRAIN_COLORS.grass;
           }
        }
        
        const colorKey = color.toString();
        if (!voxelInstances.has(colorKey)) {
          voxelInstances.set(colorKey, []);
        }
        
        voxelInstances.get(colorKey).push({
          position: new THREE.Vector3(worldX, worldY, worldZ),
        });
      }
    }
  }
  
  // Generate trees and bushes on the now-generated terrain surface
  generateVegetation(terrain, heightMap, length, breadth, voxelGeometry, seed);
  
  // Create instanced meshes (this part remains the same)
  voxelInstances.forEach((instances, colorKey) => {
    const color = parseInt(colorKey);
    const material = new THREE.MeshLambertMaterial({ 
      color,
      flatShading: true,
    });
    
    const instancedMesh = new THREE.InstancedMesh(
      voxelGeometry,
      material,
      instances.length
    );
    
    const matrix = new THREE.Matrix4();
    instances.forEach((instance, index) => {
      matrix.setPosition(instance.position);
      instancedMesh.setMatrixAt(index, matrix);
    });
    
    instancedMesh.instanceMatrix.needsUpdate = true;
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    
    terrain.add(instancedMesh);
  });
  
  return terrain;
}

/**
 * Create a simple grid helper for reference
 */
export function createGrid(size) {
  const gridHelper = new THREE.GridHelper(size * VOXEL_SIZE, size, 0x888888, 0x444444);
  gridHelper.position.y = 0;
  return gridHelper;
}

export { VOXEL_SIZE };