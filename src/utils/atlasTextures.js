/**
 * Style & Atlas textures loader
 * Loads high-quality painterly style textures (KTX2 / PNG) and manages material caching.
 */
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { STYLE_TEXTURES, STYLE_ATLASES, STYLE_TEXTURE_COUNT } from '../assets/Textures/style/styleTextureManifest.js';

// ── State ─────────────────────────────────────────────────────────────────
const textureCache = new Map(); // name -> THREE.Texture
const texturePromises = new Map();
const pendingMats = []; // { mat, name, opts }

let ktx2Loader = null;

export function initKTX2Loader(renderer) {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath(`${import.meta.env.BASE_URL}basis/`);
    if (renderer) {
      ktx2Loader.detectSupport(renderer);
    }
  }
  return ktx2Loader;
}

/**
 * Configure a texture for rendering in sRGB or linear data mode.
 */
function configureTexture(tex, isColor = true, anisotropy = 4) {
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = Math.min(anisotropy, 8);
}

const STYLE_ALIASES = {
  // Stations & Platforms
  'deck': 'platform_deck',
  'platform_deck': 'platform_deck',
  'platform_edge': 'platform_edge_stone',
  // Roads & Curbs
  'shoulder': 'road_shoulder',
  'road_shoulder': 'road_shoulder',
  'road_dirt': 'dirt_road',
  'dirt_road': 'dirt_road',
  'lamp_post': 'lamp_metal',
  'green_sign': 'sign_green_paint',
  // Tracks & Infrastructure
  'rail': 'rail_steel',
  'rail_steel': 'rail_steel',
  'planks': 'sleeper_planks',
  'sleeper_planks': 'sleeper_planks',
  'beam': 'structural_beam',
  'structural_beam': 'structural_beam',
  'wood_deck': 'bridge_deck',
  'bridge_deck': 'bridge_deck',
  'steel_beam': 'structural_beam',
  'insulator': 'ceramic_insulator',
  'red_paint': 'crossing_red_metal',
  // Props & Cargo
  'crate': 'woven_cargo',
  'sack': 'fabric_variation',
  'coal': 'boiler_chassis_metal',
  'container': 'cargo_variation',
  'tanker': 'galvanized_steel',
  'crate_lid': 'warm_timber',
};

/**
 * Get or load a style texture by semantic name.
 */
export function getStyleTexture(name, opts = {}) {
  const resolvedName = STYLE_ALIASES[name] || STYLE_ALIASES[name?.replace(/-/g, '_')] || name;
  let tex = textureCache.get(resolvedName);
  if (tex) return tex;

  const def = STYLE_TEXTURES[resolvedName] || STYLE_TEXTURES[resolvedName.replace(/-/g, '_')];
  if (!def) {
    console.warn(`[atlasTextures] Unknown style texture: ${name} (resolved: ${resolvedName})`);
    return null;
  }

  let resolveTexture;
  let rejectTexture;
  const ready = new Promise((resolve, reject) => {
    resolveTexture = resolve;
    rejectTexture = reject;
  });

  const isColor = def.colorSpace === 'srgb';
  const url = def.url; // Use resolved Vite asset URL

  tex = new THREE.TextureLoader().load(url, (loadedTex) => {
    configureTexture(loadedTex, isColor, opts.anisotropy || 4);
    if (opts.repeat) {
      loadedTex.repeat.set(opts.repeat[0], opts.repeat[1]);
    }
    resolveTexture(loadedTex);
  }, undefined, (err) => {
    console.error(`[atlasTextures] Failed loading texture: ${name}`, err);
    rejectTexture(err);
  });

  configureTexture(tex, isColor, opts.anisotropy || 4);
  if (opts.repeat) {
    tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  }

  textureCache.set(name, tex);
  texturePromises.set(name, ready);
  return tex;
}

/**
 * Preload all style textures. Called during asset initialization.
 */
export const ATLAS_TEXTURE_COUNT = STYLE_TEXTURE_COUNT;

export function preloadAtlases(onProgress) {
  const names = Object.keys(STYLE_TEXTURES);
  let loaded = 0;
  const promises = names.map((name) => {
    getStyleTexture(name);
    return texturePromises.get(name)?.then(() => {
      loaded += 1;
      onProgress?.(loaded / names.length);
    }) || Promise.resolve();
  });

  return Promise.all(promises).then(() => {
    for (const { mat, name, opts } of pendingMats.splice(0)) {
      assignMap(mat, name, opts);
    }
  });
}

function assignMap(mat, name, opts = {}) {
  const base = getStyleTexture(name, opts);
  if (!base) return;
  const clone = base.clone();
  clone.colorSpace = base.colorSpace;
  clone.generateMipmaps = true;
  clone.minFilter = THREE.LinearMipmapLinearFilter;
  clone.magFilter = THREE.LinearFilter;
  clone.anisotropy = 8;
  clone.wrapS = THREE.RepeatWrapping;
  clone.wrapT = THREE.RepeatWrapping;
  if (opts.repeat) {
    clone.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  clone.needsUpdate = true;
  mat.map = clone;
  mat.needsUpdate = true;
}

/**
 * Make a material with a textured tile map.
 * Supports MeshStandardMaterial or MeshLambertMaterial.
 */
export function makeAtlasMaterial(name, opts = {}) {
  const isStandard = opts.standard !== false;
  const MatClass = isStandard ? THREE.MeshStandardMaterial : THREE.MeshLambertMaterial;

  const mat = new MatClass({
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 0.82,
    metalness: opts.metalness ?? 0.08,
    flatShading: opts.flatShading ?? false,
    dithering: true,
    polygonOffset: opts.polygonOffset ?? false,
    polygonOffsetFactor: opts.polygonOffsetFactor ?? 0,
    polygonOffsetUnits: opts.polygonOffsetUnits ?? 0,
  });

  const base = getStyleTexture(name, opts);
  if (base) {
    assignMap(mat, name, opts);
  } else {
    pendingMats.push({ mat, name, opts });
  }

  if (opts.emissive !== undefined) {
    mat.emissive.set(opts.emissive);
    mat.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }

  return mat;
}

/**
 * Return a cloned texture with the given repeat.
 */
export function makeAtlasTexture(name, repeat = [1, 1]) {
  const base = getStyleTexture(name);
  if (!base) return null;
  const tex = base.clone();
  tex.needsUpdate = true;
  tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}
