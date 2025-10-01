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
};

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
  
  // Terrain generation parameters
  const scale = 0.05; // Noise scale - smaller = more variation
  const heightMultiplier = 10; // Maximum height variation
  const waterLevel = 2;
  
  for (let x = 0; x < length; x++) {
    for (let z = 0; z < breadth; z++) {
      // Generate height using multiple octaves of noise for more interesting terrain
      const nx = x * scale;
      const nz = z * scale;
      
      let height = 0;
      let amplitude = 1;
      let frequency = 1;
      
      // Multiple octaves for detail
      for (let octave = 0; octave < 4; octave++) {
        height += noise2D(nx * frequency, nz * frequency) * amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }
      
      // Convert to positive height
      height = Math.floor((height + 1) * heightMultiplier);
      height = Math.max(0, height);
      
      // Stack voxels from bottom to height
      for (let y = 0; y <= height; y++) {
        const worldX = (x - length / 2) * VOXEL_SIZE;
        const worldY = y * VOXEL_SIZE;
        const worldZ = (z - breadth / 2) * VOXEL_SIZE;
        
        // Determine voxel color based on height
        let color;
        if (y <= waterLevel) {
          color = TERRAIN_COLORS.water;
        } else if (y <= waterLevel + 1) {
          color = TERRAIN_COLORS.sand;
        } else if (y <= height - 3) {
          color = TERRAIN_COLORS.grass;
        } else if (y <= height - 1) {
          color = TERRAIN_COLORS.rock;
        } else {
          color = TERRAIN_COLORS.snow;
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
