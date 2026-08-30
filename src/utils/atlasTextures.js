import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { STYLE_TEXTURE_MANIFEST } from '../assets/Textures/style/styleTextureManifest.js';
import cloudCutoutAtlasUrl from '../assets/Textures/style/cloudCutout.ktx2?url';
import foliageCutoutAtlasUrl from '../assets/Textures/style/foliageCutout.ktx2?url';
import infrastructureColorAtlasUrl from '../assets/Textures/style/infrastructureColor.ktx2?url';
import roadColorAtlasUrl from '../assets/Textures/style/roadColor.ktx2?url';
import rollingStockColorAtlasUrl from '../assets/Textures/style/rollingStockColor.ktx2?url';
import styleColorAtlasUrl from '../assets/Textures/style/styleColor.ktx2?url';
import waterDataAtlasUrl from '../assets/Textures/style/waterData.ktx2?url';
import weatheringMaskAtlasUrl from '../assets/Textures/style/weatheringMask.ktx2?url';

import meadowUrl from '../assets/art-source/painterly-diorama/cropped/style-meadow.png';
import forestGroundUrl from '../assets/art-source/painterly-diorama/cropped/style-forest-ground.png';
import creamPlasterUrl from '../assets/art-source/painterly-diorama/cropped/style-cream-plaster.png';
import wetlandGroundUrl from '../assets/art-source/painterly-diorama/cropped/style-wetland-ground.png';
import highlandGroundUrl from '../assets/art-source/painterly-diorama/cropped/style-highland-ground.png';
import soilUrl from '../assets/art-source/painterly-diorama/cropped/style-soil.png';
import shoreSandUrl from '../assets/art-source/painterly-diorama/cropped/style-shore-sand.png';
import warmRockUrl from '../assets/art-source/painterly-diorama/cropped/style-warm-rock.png';
import coolRockUrl from '../assets/art-source/painterly-diorama/cropped/style-cool-rock.png';
import asphaltUrl from '../assets/art-source/painterly-diorama/cropped/style-asphalt.png';
import roadShoulderUrl from '../assets/art-source/painterly-diorama/cropped/style-road-shoulder.png';
import dirtRoadUrl from '../assets/art-source/painterly-diorama/cropped/style-dirt-road.png';
import platformDeckUrl from '../assets/art-source/painterly-diorama/cropped/style-platform-deck.png';
import platformEdgeUrl from '../assets/art-source/painterly-diorama/cropped/style-platform-edge-stone.png';
import ballastUrl from '../assets/art-source/painterly-diorama/cropped/style-ballast.png';
import warmTimberUrl from '../assets/art-source/painterly-diorama/cropped/style-warm-timber.png';
import darkTimberUrl from '../assets/art-source/painterly-diorama/cropped/style-dark-timber.png';
import bridgeDeckUrl from '../assets/art-source/painterly-diorama/cropped/style-bridge-deck.png';
import beamUrl from '../assets/art-source/painterly-diorama/cropped/style-structural-beam.png';
import sleepersUrl from '../assets/art-source/painterly-diorama/cropped/style-sleeper-planks.png';
import railUrl from '../assets/art-source/painterly-diorama/cropped/style-rail-steel.png';
import galvanizedUrl from '../assets/art-source/painterly-diorama/cropped/style-galvanized-steel.png';
import redPaintUrl from '../assets/art-source/painterly-diorama/cropped/style-crossing-red-metal.png';
import lampMetalUrl from '../assets/art-source/painterly-diorama/cropped/style-lamp-metal.png';
import signGreenUrl from '../assets/art-source/painterly-diorama/cropped/style-sign-green-paint.png';
import insulatorUrl from '../assets/art-source/painterly-diorama/cropped/style-ceramic-insulator.png';
import redEnamelUrl from '../assets/art-source/painterly-diorama/cropped/style-red-enamel.png';
import blueEnamelUrl from '../assets/art-source/painterly-diorama/cropped/style-blue-enamel.png';
import greenEnamelUrl from '../assets/art-source/painterly-diorama/cropped/style-green-enamel.png';
import brassUrl from '../assets/art-source/painterly-diorama/cropped/style-rolling-brass.png';
import wheelSteelUrl from '../assets/art-source/painterly-diorama/cropped/style-wheel-rod-steel.png';
import boilerMetalUrl from '../assets/art-source/painterly-diorama/cropped/style-boiler-chassis-metal.png';
import fabricUrl from '../assets/art-source/painterly-diorama/cropped/style-fabric-variation.png';
import cargoUrl from '../assets/art-source/painterly-diorama/cropped/style-woven-cargo.png';
import foliageUrl from '../assets/art-source/painterly-diorama/cropped/style-foliage-variation.png';
import shrubUrl from '../assets/art-source/painterly-diorama/cropped/style-shrub-clump-a.png';

const STYLE_SOURCES = Object.freeze({
  meadow: meadowUrl,
  forest: forestGroundUrl,
  forest_ground: forestGroundUrl,
  wetland: wetlandGroundUrl,
  highland: highlandGroundUrl,
  grass: meadowUrl,
  sand: shoreSandUrl,
  dirt: soilUrl,
  soil: soilUrl,
  rock: warmRockUrl,
  warm_rock: warmRockUrl,
  cool_rock: coolRockUrl,
  'cream-plaster': creamPlasterUrl,
  plaster: creamPlasterUrl,
  foliage: meadowUrl,
  bush: meadowUrl,
  asphalt: asphaltUrl,
  shoulder: roadShoulderUrl,
  road_dirt: dirtRoadUrl,
  deck: platformDeckUrl,
  edge: platformEdgeUrl,
  ballast: ballastUrl,
  bark: warmTimberUrl,
  leaf_dark: meadowUrl,
  leaf_light: meadowUrl,
  planks: sleepersUrl,
  beam: beamUrl,
  wood_deck: bridgeDeckUrl,
  rail: railUrl,
  lamp_post: lampMetalUrl,
  steel_beam: galvanizedUrl,
  galvanized: galvanizedUrl,
  red_paint: redPaintUrl,
  green_sign: signGreenUrl,
  insulator: insulatorUrl,
  tanker: blueEnamelUrl,
  container: greenEnamelUrl,
  crate: cargoUrl,
  crate_lid: warmTimberUrl,
  sack: fabricUrl,
  coal: boilerMetalUrl,
  fabric: fabricUrl,
  denim: blueEnamelUrl,
  wicker: warmTimberUrl,
  rolling_brass: brassUrl,
  wheel_rod_steel: wheelSteelUrl,
  boiler_chassis_metal: boilerMetalUrl,
  red_enamel: redEnamelUrl,
  blue_enamel: blueEnamelUrl,
  green_enamel: greenEnamelUrl,
});
const textureCache = new Map();
const texturePromises = new Map();
const materialBindings = new Map();
const textureBindings = new Map();
const styleAtlases = new Map();
let ktx2Loader = null;
let ktx2Ready = null;
function configureTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
}
const STYLE_ATLAS_URLS = Object.freeze({
  cloudCutout: cloudCutoutAtlasUrl,
  foliageCutout: foliageCutoutAtlasUrl,
  infrastructureColor: infrastructureColorAtlasUrl,
  roadColor: roadColorAtlasUrl,
  rollingStockColor: rollingStockColorAtlasUrl,
  styleColor: styleColorAtlasUrl,
  waterData: waterDataAtlasUrl,
  weatheringMask: weatheringMaskAtlasUrl,
});

const STYLE_ENTRY_KEYS = Object.freeze({
  meadow: 'style-meadow',
  forest: 'style-forest-ground',
  forest_ground: 'style-forest-ground',
  wetland: 'style-wetland-ground',
  highland: 'style-highland-ground',
  grass: 'style-meadow',
  sand: 'style-shore-sand',
  dirt: 'style-soil',
  soil: 'style-soil',
  rock: 'style-warm-rock',
  warm_rock: 'style-warm-rock',
  cool_rock: 'style-cool-rock',
  'cream-plaster': 'style-cream-plaster',
  plaster: 'style-cream-plaster',
  foliage: 'style-meadow',
  bush: 'style-meadow',
  asphalt: 'style-asphalt',
  shoulder: 'style-road-shoulder',
  road_dirt: 'style-dirt-road',
  edge: 'style-platform-edge-stone',
  ballast: 'style-ballast',
  leaf_dark: 'style-meadow',
  leaf_light: 'style-meadow',
  planks: 'style-sleeper-planks',
  beam: 'style-structural-beam',
  wood_deck: 'style-bridge-deck',
  rail: 'style-rail-steel',
  lamp_post: 'style-lamp-metal',
  steel_beam: 'style-galvanized-steel',
  galvanized: 'style-galvanized-steel',
  red_paint: 'style-crossing-red-metal',
  green_sign: 'style-sign-green-paint',
  insulator: 'style-ceramic-insulator',
  tanker: 'style-blue-enamel',
  container: 'style-green-enamel',
  crate: 'style-woven-cargo',
  crate_lid: 'style-warm-timber',
  sack: 'style-fabric-variation',
  coal: 'style-boiler-chassis-metal',
  fabric: 'style-fabric-variation',
  denim: 'style-blue-enamel',
  wicker: 'style-warm-timber',
  rolling_brass: 'style-rolling-brass',
  wheel_rod_steel: 'style-wheel-rod-steel',
  boiler_chassis_metal: 'style-boiler-chassis-metal',
  red_enamel: 'style-red-enamel',
  blue_enamel: 'style-blue-enamel',
  green_enamel: 'style-green-enamel',
});

function styleEntry(name) {
  return STYLE_TEXTURE_MANIFEST[STYLE_ENTRY_KEYS[name] || name] || null;
}

function configureAtlasTexture(texture, entry) {
  // Atlas encoder stores RGB values as linear; compressed textures must not
  // receive a second sRGB decode. Source PNGs remain correctly tagged sRGB.
  texture.colorSpace = entry?.colorSpace === 'linear' || texture.isCompressedTexture
    ? THREE.NoColorSpace
    : THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = !texture.isCompressedTexture;
  texture.needsUpdate = true;
}

function createStyleMap(name, opts = {}) {
  const entry = styleEntry(name);
  const atlas = entry ? styleAtlases.get(entry.atlas) : null;
  const source = atlas || getStyleTexture(name);
  const texture = source.clone();
  if (atlas && entry?.uv) {
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(entry.uv.width, entry.uv.height);
    // Manifest UVs use WebGL's bottom-left origin. Do not invert again:
    // double inversion selects a different atlas tile (often pale/blank).
    texture.offset.set(entry.uv.x, entry.uv.y);
  } else {
    texture.repeat.set(opts.repeat?.[0] ?? 1, opts.repeat?.[1] ?? 1);
  }
  configureAtlasTexture(texture, entry);
  return texture;
}

export function getStyleTexture(name) {
  const source = STYLE_SOURCES[name] || (typeof name === 'string' && (name.startsWith('/') || name.startsWith('http')) ? name : STYLE_SOURCES.meadow);
  const key = source;
  if (textureCache.has(key)) return textureCache.get(key);

  let texture;
  let resolveTexture;
  let rejectTexture;
  const ready = new Promise((resolve, reject) => {
    resolveTexture = resolve;
    rejectTexture = reject;
  });
  texture = new THREE.TextureLoader().load(source, () => resolveTexture(texture), undefined, rejectTexture);
  configureTexture(texture);
  textureCache.set(key, texture);
  texturePromises.set(key, ready);
  return texture;
}
export function initializeStyleKTX2(renderer) {
  if (ktx2Ready) return ktx2Ready;
  ktx2Loader = new KTX2Loader()
    .setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)
    .setWorkerLimit(4)
    .detectSupport(renderer);
  ktx2Ready = Promise.all(Object.entries(STYLE_ATLAS_URLS).map(async ([name, url]) => {
    const texture = await ktx2Loader.loadAsync(url);
    const isLinear = name === 'waterData' || name === 'weatheringMask';
    configureAtlasTexture(texture, { colorSpace: isLinear ? 'linear' : 'srgb' });
    styleAtlases.set(`${name}.ktx2`, texture);
  })).then(() => {
    for (const [material, binding] of materialBindings) {
      const next = createStyleMap(binding.name, binding.opts);
      if (material.userData.styleTriplanar) {
        material.userData.styleTexture?.dispose();
        material.userData.styleTexture = next;
        const shader = material.userData.styleShader;
        if (shader) {
          shader.uniforms.styleTexture.value = next;
          shader.uniforms.styleRepeat.value.copy(next.repeat);
          shader.uniforms.styleOffset.value.copy(next.offset);
        }
      } else {
        material.map?.dispose();
        material.map = next;
      }
      material.needsUpdate = true;
    }
    for (const [texture, binding] of textureBindings) {
      const next = createStyleMap(binding.name, binding.opts);
      texture.copy(next);
      texture.needsUpdate = true;
    }
    return styleAtlases;
  });
  return ktx2Ready;
}
export const STYLE_TEXTURE_COUNT = new Set(Object.values(STYLE_SOURCES)).size;


export function preloadStyleTextures(onProgress) {
  const sources = [...new Set(Object.values(STYLE_SOURCES))];
  let loaded = 0;
  return Promise.all(sources.map((source) => {
    getStyleTexture(source);
    return texturePromises.get(source).then(() => {
      loaded += 1;
      onProgress?.(loaded / sources.length);
    });
  }));
}
export function assignStyleTexture(material, name, opts = {}) {
  const next = createStyleMap(name, opts);
  material.map?.dispose();
  material.map = next;
  materialBindings.set(material, { name, opts });
  material.needsUpdate = true;
}

export function makeStyleTexture(name, repeat = [1, 1]) {
  const texture = createStyleMap(name, { repeat });
  textureBindings.set(texture, { name, opts: { repeat } });
  return texture;
}
