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

/**
 * Generate vegetation (trees and bushes) on terrain
 */
function generateVegetation(terrain, heightMap, length, breadth, voxelGeometry, seed) {
  const noise2D = createNoise2D(() => seed * 2); // Different seed for vegetation
  const vegetationInstances = new Map();
  
  // Vegetation parameters
  const vegetationDensity = 0.08; // 8% chance of vegetation per suitable spot
  const minSpacing = 3; // Minimum spacing between vegetation
  
  const placedVegetation = [];
  
  for (let x = 0; x < length; x += 2) { // Sample every 2 units for performance
    for (let z = 0; z < breadth; z += 2) {
      const height = heightMap[x][z];
      
      // Only place vegetation on grass areas (above water)
      if (height <= 1) continue;
      
      // Use noise to determine if vegetation should be placed
      const vegetationNoise = noise2D(x * 0.1, z * 0.1);
      if (vegetationNoise < (1 - vegetationDensity * 2)) continue;
      
      // Check spacing from other vegetation
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
      
      // Decide between tree and bush
      const isBush = vegetationNoise > 0.5;
      
      if (isBush) {
        // Generate bush (2 voxels high, rounded shape)
        const bushPositions = [
          { x: 0, y: 1, z: 0 }, // Bottom
          { x: 0, y: 2, z: 0 }, // Top
          { x: 1, y: 1, z: 0 }, // Side
          { x: -1, y: 1, z: 0 }, // Side
          { x: 0, y: 1, z: 1 }, // Side
          { x: 0, y: 1, z: -1 }, // Side
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
        // Generate tree (trunk + leaves)
        const treeHeight = 3 + Math.floor(Math.random() * 2); // 3-4 voxels tall
        
        // Trunk
        for (let y = 1; y <= treeHeight; y++) {
          const pos = new THREE.Vector3(
            worldX,
            (height + y) * VOXEL_SIZE,
            worldZ
          );
          
          const colorKey = TERRAIN_COLORS.treeTrunk.toString();
          if (!vegetationInstances.has(colorKey)) {
            vegetationInstances.set(colorKey, []);
          }
          vegetationInstances.get(colorKey).push({ position: pos });
        }
        
        // Leaves (canopy on top)
        const canopyPositions = [
          { x: 0, y: treeHeight + 1, z: 0 }, // Top center
          { x: 1, y: treeHeight, z: 0 },
          { x: -1, y: treeHeight, z: 0 },
          { x: 0, y: treeHeight, z: 1 },
          { x: 0, y: treeHeight, z: -1 },
          { x: 1, y: treeHeight + 1, z: 0 },
          { x: -1, y: treeHeight + 1, z: 0 },
          { x: 0, y: treeHeight + 1, z: 1 },
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
  
  // Create instanced meshes for vegetation
  vegetationInstances.forEach((instances, colorKey) => {
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
}

/**
 * Generate voxel terrain using simplex noise
 * @param {number} length - Length of the terrain (X axis)
 * @param {number} breadth - Breadth of the terrain (Z axis)
 * @param {number} seed - Random seed for terrain generation
 * @returns {THREE.Group} Group containing all terrain voxels
 */
export function generateTerrain(length, breadth, seed = Math.random()) {
  const terrain = new THREE.Group();
  const noise2D = createNoise2D(() => seed);
  
  // Create voxel geometry (reuse for performance)
  const voxelGeometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
  
  // Instance tracking for optimization
  const voxelInstances = new Map();
  
  // Terrain generation parameters - adjusted for flatter terrain
  const scale = 0.03; // Larger scale = broader, gentler features
  const heightMultiplier = 4; // Reduced from 10 for flatter terrain
  const waterLevel = 1; // Slightly lower water level
  
  // Store heights for tree placement
  const heightMap = [];
  
  for (let x = 0; x < length; x++) {
    heightMap[x] = [];
    for (let z = 0; z < breadth; z++) {
      // Generate height using fewer octaves for smoother terrain
      const nx = x * scale;
      const nz = z * scale;
      
      let height = 0;
      let amplitude = 1;
      let frequency = 1;
      
      // Reduced octaves and adjusted amplitudes for gentler terrain
      for (let octave = 0; octave < 3; octave++) {
        height += noise2D(nx * frequency, nz * frequency) * amplitude;
        amplitude *= 0.4; // Reduced from 0.5 for less dramatic changes
        frequency *= 1.5; // Reduced from 2 for smoother transitions
      }
      
      // Convert to positive height with bias toward middle values (plains)
      height = (height + 1) * heightMultiplier;
      height = Math.floor(height * 0.6 + 2); // Bias toward plains height
      height = Math.max(0, height);
      
      // Store height for later tree placement
      heightMap[x][z] = height;
      
      // Store height for later tree placement
      heightMap[x][z] = height;
      
      // Stack voxels from bottom to height
      for (let y = 0; y <= height; y++) {
        const worldX = (x - length / 2) * VOXEL_SIZE;
        const worldY = y * VOXEL_SIZE;
        const worldZ = (z - breadth / 2) * VOXEL_SIZE;
        
        // Determine voxel color based on height - adjusted for flatter terrain
        let color;
        if (y <= waterLevel) {
          color = TERRAIN_COLORS.water;
        } else if (y <= waterLevel + 1) {
          color = TERRAIN_COLORS.sand;
        } else if (y <= height) {
          // Most terrain is now grass (plains)
          color = TERRAIN_COLORS.grass;
        } else if (y === height && height > 6) {
          // Only very rare high points get rock
          color = TERRAIN_COLORS.rock;
        }
        
        // Use instanced rendering for better performance
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
  
  // Generate trees and bushes on grass terrain
  generateVegetation(terrain, heightMap, length, breadth, voxelGeometry, seed);
  
  // Create instanced meshes for each color
  voxelInstances.forEach((instances, colorKey) => {
    const color = parseInt(colorKey);
    const material = new THREE.MeshLambertMaterial({ 
      color,
      flatShading: true, // Low-poly look
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
