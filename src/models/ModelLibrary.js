/**
 * Model Library — loads, normalizes and caches all GLB assets.
 * Every model is a single Draco-compressed mesh with vertex colors.
 * Normalization bakes node transforms, moves the base to y=0 and applies
 * the global MODEL_SCALE so models match the miniature voxel world.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

import bigRedBarnUrl from '../assets/Models/Buildings/big-red-barn.glb';
import bufferStopUrl from '../assets/Models/Buildings/buffer-stop.glb';
import crossingKeeperHutUrl from '../assets/Models/Buildings/crossing-keeper-hut.glb';
import footbridgeSpanUrl from '../assets/Models/Buildings/footbridge-span.glb';
import footbridgeStairsUrl from '../assets/Models/Buildings/footbridge-stairs.glb';
import goodsShedUrl from '../assets/Models/Buildings/goods-shed.glb';
import platformCanopyUrl from '../assets/Models/Buildings/platform-canopy.glb';
import stationBuildingUrl from '../assets/Models/Buildings/station-building.glb';
import colourLightSignalUrl from '../assets/Models/Props/colour-light-signal.glb';
import platformBenchUrl from '../assets/Models/Props/platform-bench.glb';
import platformGasLampUrl from '../assets/Models/Props/platform-gas-lamp.glb';
import platformLitterBinUrl from '../assets/Models/Props/platform-litter-bin.glb';
import stationClockUrl from '../assets/Models/Props/station-clock.glb';
import railwayBoulderUrl from '../assets/Models/Rocks/railway-boulder.glb';
import railwayRockClusterUrl from '../assets/Models/Rocks/railway-rock-cluster.glb';
import linesideFenceRunUrl from '../assets/Models/Trees/lineside-fence-run.glb';
import linesideOakUrl from '../assets/Models/Trees/lineside-oak.glb';
import linesidePineUrl from '../assets/Models/Trees/lineside-pine.glb';
import linesideShrubUrl from '../assets/Models/Trees/lineside-shrub.glb';

export const MODEL_SCALE = 0.3;

export const MODEL_DEFS = [
  { key: 'big-red-barn', category: 'buildings', url: bigRedBarnUrl },
  { key: 'buffer-stop', category: 'buildings', url: bufferStopUrl },
  { key: 'crossing-keeper-hut', category: 'buildings', url: crossingKeeperHutUrl },
  { key: 'footbridge-span', category: 'buildings', url: footbridgeSpanUrl },
  { key: 'footbridge-stairs', category: 'buildings', url: footbridgeStairsUrl },
  { key: 'goods-shed', category: 'buildings', url: goodsShedUrl },
  { key: 'platform-canopy', category: 'buildings', url: platformCanopyUrl },
  { key: 'station-building', category: 'buildings', url: stationBuildingUrl },
  { key: 'colour-light-signal', category: 'props', url: colourLightSignalUrl },
  { key: 'platform-bench', category: 'props', url: platformBenchUrl },
  { key: 'platform-gas-lamp', category: 'props', url: platformGasLampUrl },
  { key: 'platform-litter-bin', category: 'props', url: platformLitterBinUrl },
  { key: 'station-clock', category: 'props', url: stationClockUrl },
  { key: 'railway-boulder', category: 'rocks', url: railwayBoulderUrl },
  { key: 'railway-rock-cluster', category: 'rocks', url: railwayRockClusterUrl },
  { key: 'lineside-fence-run', category: 'trees', url: linesideFenceRunUrl },
  { key: 'lineside-oak', category: 'trees', url: linesideOakUrl },
  { key: 'lineside-pine', category: 'trees', url: linesidePineUrl },
  { key: 'lineside-shrub', category: 'trees', url: linesideShrubUrl },
];

function findFirstMesh(object) {
  let found = null;
  object.traverse((child) => {
    if (!found && child.isMesh) found = child;
  });
  return found;
}

class ModelLibrary {
  constructor() {
    this.entries = new Map();
    this.ready = false;
    this.pending = new Map();

    const draco = new DRACOLoader();
    draco.setDecoderPath(import.meta.env.BASE_URL + 'draco/');
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    this.loader = loader;
  }

  /**
   * Load (cached) and normalize a model.
   * @returns {{key: string, category: string, geometry: THREE.BufferGeometry,
   *   material: THREE.Material, bounds: THREE.Box3}}
   */
  load(key) {
    if (this.entries.has(key)) return Promise.resolve(this.entries.get(key));
    if (this.pending.has(key)) return this.pending.get(key);

    const def = MODEL_DEFS.find((d) => d.key === key);
    if (!def) return Promise.reject(new Error('Unknown model: ' + key));

    const promise = new Promise((resolve, reject) => {
      this.loader.load(def.url, (gltf) => {
        const mesh = findFirstMesh(gltf.scene);
        if (!mesh) {
          reject(new Error('No mesh in model: ' + key));
          return;
        }
        const geometry = mesh.geometry.clone();
        mesh.updateWorldMatrix(true, false);
        geometry.applyMatrix4(mesh.matrixWorld);
        geometry.computeBoundingBox();
        geometry.translate(0, -geometry.boundingBox.min.y, 0);
        geometry.scale(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
        geometry.computeBoundingBox();

        const entry = {
          key,
          category: def.category,
          geometry,
          material: mesh.material,
          bounds: geometry.boundingBox.clone(),
        };
        this.entries.set(key, entry);
        this.pending.delete(key);
        resolve(entry);
      }, undefined, reject);
    });
    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Preload every model. Calls onProgress with 0..1 as assets finish.
   */
  async preloadAll(onProgress) {
    const defs = MODEL_DEFS;
    let loaded = 0;
    await Promise.all(defs.map(async (def) => {
      await this.load(def.key);
      loaded += 1;
      if (onProgress) onProgress(loaded / defs.length);
    }));
    this.ready = true;
  }

  getEntry(key) {
    const entry = this.entries.get(key);
    if (!entry) throw new Error('Model not loaded: ' + key);
    return entry;
  }

  /**
   * Standalone renderable mesh (shares cached geometry/material).
   */
  getMesh(key) {
    const entry = this.getEntry(key);
    const mesh = new THREE.Mesh(entry.geometry, entry.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  getGeometry(key) {
    return this.getEntry(key).geometry;
  }

  getMaterial(key) {
    return this.getEntry(key).material;
  }
}

export default new ModelLibrary();
