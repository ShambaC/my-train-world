/**
 * Model Library — loads, normalizes and caches all GLB assets.
 * Every model is a single Draco-compressed mesh with vertex colors.
 * Normalization bakes node transforms, moves the base to y=0 and applies
 * the global MODEL_SCALE so models match the miniature voxel world.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { makeStyleMaterial } from '../render/styleMaterials.js';

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
import containerFlatWagonUrl from '../assets/Models/Trains/container-flat-wagon.glb';
import freightVanUrl from '../assets/Models/Trains/freight-van.glb';
import mailCoachUrl from '../assets/Models/Trains/mail-coach.glb';
import openCoalWagonUrl from '../assets/Models/Trains/open-coal-wagon.glb';
import passengerCoachUrl from '../assets/Models/Trains/passenger-coach.glb';

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
  { key: 'container-flat-wagon', category: 'trains', url: containerFlatWagonUrl },
  { key: 'freight-van', category: 'trains', url: freightVanUrl },
  { key: 'mail-coach', category: 'trains', url: mailCoachUrl },
  { key: 'open-coal-wagon', category: 'trains', url: openCoalWagonUrl },
  { key: 'passenger-coach', category: 'trains', url: passengerCoachUrl },
];

function findFirstMesh(object) {
  let found = null;
  object.traverse((child) => {
    if (!found && child.isMesh) found = child;
  });
  return found;
}
function styleRole(category) {
  if (category === 'buildings') return 'cream-plaster';
  if (category === 'rocks') return 'warm_rock';
  if (category === 'trains') return 'rolling_brass';
  if (category === 'trees') return 'foliage';
  return 'galvanized';
}

function styleLoadedMaterial(material, category, geometry) {
  const source = Array.isArray(material) ? material[0] : material;
  const styled = makeStyleMaterial(styleRole(category), {
    color: source?.color?.getHex?.() ?? 0xffffff,
    roughness: category === 'trains' ? 0.72 : 0.9,
    metalness: category === 'trains' || category === 'rocks' ? 0.18 : 0.04,
    vertexColors: Boolean(geometry.attributes.color),
    // Protected GLBs use vertex colors but no UV channel. Sample their
    // painterly family through stable object/world-space projections instead
    // of letting a missing UV silently select a pale atlas corner.
    triplanar: !geometry.attributes.uv,
  });
  if (source?.emissive) styled.emissive.copy(source.emissive);
  if (source?.emissiveIntensity) styled.emissiveIntensity = source.emissiveIntensity;
  return Array.isArray(material) ? material.map(() => styled) : styled;
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
          material: styleLoadedMaterial(mesh.material, def.category, geometry),
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
