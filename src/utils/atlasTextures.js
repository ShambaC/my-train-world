/**
 * Atlas textures — loads individual tile PNGs and builds Lambert materials
 * from them. Each tile is a separate seamless 1024x1024 file.
 *
 * New simplified API: makeAtlasMaterial(name, opts) and
 * makeAtlasTexture(name, repeat) where name is the flat tile filename stem.
 *
 * Materials may be created before textures finish loading (module-level
 * constants). They register as pending and get their map applied once
 * preloadAtlases() resolves.
 */
import * as THREE from 'three';

// ── Tile imports ──────────────────────────────────────────────────────────
import grassTex from '../assets/Textures/tiles/grass.png';
import forestTex from '../assets/Textures/tiles/forest.png';
import sandTex from '../assets/Textures/tiles/sand.png';
import rockTex from '../assets/Textures/tiles/rock.png';
import dirtTex from '../assets/Textures/tiles/dirt.png';
import wetlandTex from '../assets/Textures/tiles/wetland.png';
import highlandTex from '../assets/Textures/tiles/highland.png';
import snowTex from '../assets/Textures/tiles/snow.png';
import asphaltTex from '../assets/Textures/tiles/asphalt.png';
import shoulderTex from '../assets/Textures/tiles/shoulder.png';
import roadDirtTex from '../assets/Textures/tiles/road_dirt.png';
import deckTex from '../assets/Textures/tiles/deck.png';
import edgeTex from '../assets/Textures/tiles/edge.png';
import ballastTex from '../assets/Textures/tiles/ballast.png';
import barkTex from '../assets/Textures/tiles/bark.png';
import leafDarkTex from '../assets/Textures/tiles/leaf_dark.png';
import leafLightTex from '../assets/Textures/tiles/leaf_light.png';
import bushTex from '../assets/Textures/tiles/bush.png';
import planksTex from '../assets/Textures/tiles/planks.png';
import beamTex from '../assets/Textures/tiles/beam.png';
import woodDeckTex from '../assets/Textures/tiles/wood_deck.png';
import forestGroundTex from '../assets/Textures/tiles/forest_ground.png';
import railTex from '../assets/Textures/tiles/rail.png';
import lampPostTex from '../assets/Textures/tiles/lamp_post.png';
import steelBeamTex from '../assets/Textures/tiles/steel_beam.png';
import galvanizedTex from '../assets/Textures/tiles/galvanized.png';
import redPaintTex from '../assets/Textures/tiles/red_paint.png';
import greenSignTex from '../assets/Textures/tiles/green_sign.png';
import tankerTex from '../assets/Textures/tiles/tanker.png';
import containerTex from '../assets/Textures/tiles/container.png';
import crateTex from '../assets/Textures/tiles/crate.png';
import crateLidTex from '../assets/Textures/tiles/crate_lid.png';
import sackTex from '../assets/Textures/tiles/sack.png';
import coalTex from '../assets/Textures/tiles/coal.png';
import fabricTex from '../assets/Textures/tiles/fabric.png';
import denimTex from '../assets/Textures/tiles/denim.png';
import insulatorTex from '../assets/Textures/tiles/insulator.png';
import wickerTex from '../assets/Textures/tiles/wicker.png';

// ── Flat name → URL map ───────────────────────────────────────────────────
const TILES = {
  grass: grassTex, forest: forestTex, sand: sandTex, rock: rockTex,
  dirt: dirtTex, wetland: wetlandTex, highland: highlandTex, snow: snowTex,
  asphalt: asphaltTex, shoulder: shoulderTex, road_dirt: roadDirtTex,
  deck: deckTex, edge: edgeTex, ballast: ballastTex,
  bark: barkTex, leaf_dark: leafDarkTex, leaf_light: leafLightTex,
  bush: bushTex, planks: planksTex, beam: beamTex,
  wood_deck: woodDeckTex, forest_ground: forestGroundTex,
  rail: railTex, lamp_post: lampPostTex, steel_beam: steelBeamTex,
  galvanized: galvanizedTex, red_paint: redPaintTex,
  green_sign: greenSignTex, tanker: tankerTex, container: containerTex,
  crate: crateTex, crate_lid: crateLidTex, sack: sackTex, coal: coalTex,
  fabric: fabricTex, denim: denimTex, insulator: insulatorTex,
  wicker: wickerTex,
};

// ── State ─────────────────────────────────────────────────────────────────
const baseTextures = new Map();   // name → THREE.Texture (base, repeat 1)
const pendingMats = [];           // { mat, name, opts }

/**
 * Configure a texture for use as a game asset diffuse map.
 */
function configureTexture(tex) {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
}

/**
 * Returns the base texture for a tile name (shared, repeat 1).
 * Each import is a URL that Vite resolves at build time; the browser
 * begins loading the image at module import. By the time React mounts
 * and materials are first rendered, the images are typically ready.
 */
function getBaseTexture(name) {
  let tex = baseTextures.get(name);
  if (tex) return tex;
  const url = TILES[name];
  if (!url) {
    console.warn(`[atlasTextures] Unknown tile: ${name}`);
    return null;
  }
  tex = new THREE.TextureLoader().load(url);
  configureTexture(tex);
  baseTextures.set(name, tex);
  return tex;
}

/**
 * Preload all tiles. Called from App.jsx — resolves once every image
 * has been decoded by the browser. Keeps the old call site happy.
 */
export function preloadAtlases() {
  const promises = Object.values(TILES).map((url) =>
    new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(url, resolve, undefined, reject);
    })
  );
  return Promise.all(promises).then(() => {
    for (const { mat, name, opts } of pendingMats.splice(0)) {
      assignMap(mat, name, opts);
    }
  });
}

function assignMap(mat, name, opts = {}) {
  const base = getBaseTexture(name);
  if (!base) return;
  mat.map = base.clone();
  mat.map.needsUpdate = true;
  mat.map.repeat.set(opts.repeat?.[0] ?? 1, opts.repeat?.[1] ?? 1);
  mat.needsUpdate = true;
}

/**
 * MeshLambertMaterial with a textured tile map.
 * The material color keeps the original palette so biome/type identity
 * is preserved on top of the texture detail.
 */
export function makeAtlasMaterial(name, opts = {}) {
  const mat = new THREE.MeshLambertMaterial({
    color: opts.color ?? 0xffffff,
    flatShading: opts.flatShading ?? true,
  });
  const base = getBaseTexture(name);
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
 * Returns a cloned texture with the given repeat, independent per caller.
 * Used by ForestBorder (MeshStandardMaterial) and any future use case
 * that needs a raw texture instead of a full material.
 */
export function makeAtlasTexture(name, repeat = [1, 1]) {
  const base = getBaseTexture(name);
  if (!base) return null;
  const tex = base.clone();
  tex.needsUpdate = true;
  tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}
