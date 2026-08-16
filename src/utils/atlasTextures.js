/**
 * Atlas textures — crops cells from generated texture sheets into small
 * per-cell CanvasTextures and builds shared Lambert materials from them.
 *
 * Sheets are single images with an NxM grid of stylized textures. Each cell
 * is cropped ONCE into its own small texture (kills black separator lines,
 * mipmap bleed and the VRAM cost of re-uploading whole sheets), then cloned
 * per material with the repeat/offset baked into the clone.
 *
 * Materials may be created before the sheets finish loading (module-level
 * constants are built at import time); they register as pending and get
 * their map applied once preloadAtlases() resolves.
 */
import * as THREE from 'three';

import terrainSurfacesUrl from '../assets/Textures/terrain_surfaces.png';
import roadsPlatformsUrl from '../assets/Textures/roads_and_platforms.png';
import woodVegetationUrl from '../assets/Textures/wood_and_vegetation.png';
import metalInfraUrl from '../assets/Textures/metal_and_infrastructure.png';
import cargoPropsUrl from '../assets/Textures/cargo_and_props.png';

// Row-major cell indices (row 0 = top of the sheet).
const SHEETS = {
  terrain: { url: terrainSurfacesUrl, cols: 4, rows: 2, cells: {
    grass: 0, forest: 1, sand: 2, rock: 3,
    dirt: 4, wetland: 5, highland: 6, snow: 7,
  } },
  roads: { url: roadsPlatformsUrl, cols: 3, rows: 2, cells: {
    asphalt: 0, shoulder: 1, dirt: 2,
    deck: 3, edge: 4, ballast: 5,
  } },
  wood: { url: woodVegetationUrl, cols: 4, rows: 2, cells: {
    bark: 0, leafDark: 1, leafLight: 2, bush: 3,
    planks: 4, beam: 5, deck: 6, forestGround: 7,
  } },
  metal: { url: metalInfraUrl, cols: 4, rows: 2, cells: {
    rail: 0, lampPost: 1, beam: 2, galvanized: 3,
    redPaint: 4, greenSign: 5, tanker: 6, container: 7,
  } },
  cargo: { url: cargoPropsUrl, cols: 4, rows: 2, cells: {
    crate: 0, crateLid: 1, sack: 2, coal: 3,
    fabric: 4, denim: 5, insulator: 6, wicker: 7,
  } },
};

const INSET = 3; // px cropped from each cell edge (kills separator lines)
const MAX_CELL = 512; // crop target size cap

const loadedImages = new Map(); // sheetName -> HTMLImageElement
const cellTextures = new Map(); // `${sheet}:${cell}` -> base CanvasTexture (repeat 1)
const pendingMats = []; // { mat, sheet, cell, opts } awaiting sheet load

function buildCellTexture(sheetName, cellName) {
  const img = loadedImages.get(sheetName);
  if (!img) return null;
  const def = SHEETS[sheetName];
  const idx = def.cells[cellName];
  const col = idx % def.cols;
  const row = Math.floor(idx / def.cols);

  const cellW = img.width / def.cols;
  const cellH = img.height / def.rows;
  const outW = Math.min(MAX_CELL, Math.floor(cellW - INSET * 2));
  const outH = Math.min(MAX_CELL, Math.floor(cellH - INSET * 2));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    col * cellW + INSET, row * cellH + INSET,
    cellW - INSET * 2, cellH - INSET * 2,
    0, 0, outW, outH
  );

  // Normalize mean luminance: the generated sheets are darker than the flat
  // palette they replace, and Lambert multiplies map x color. Lifting the
  // cell mean to ~0.68 keeps surfaces reading as bright as the old solids.
  const imgData = ctx.getImageData(0, 0, outW, outH);
  const px = imgData.data;
  let sum = 0;
  for (let i = 0; i < px.length; i += 4) {
    sum += px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
  }
  const mean = sum / (px.length / 4);
  const scale = mean > 0 ? Math.min(1.9, 173 / mean) : 1;
  if (scale > 1.02) {
    for (let i = 0; i < px.length; i += 4) {
      px[i] = Math.min(255, px[i] * scale);
      px[i + 1] = Math.min(255, px[i + 1] * scale);
      px[i + 2] = Math.min(255, px[i + 2] * scale);
    }
    ctx.putImageData(imgData, 0, 0);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  cellTextures.set(`${sheetName}:${cellName}`, tex);
  return tex;
}

/**
 * Load all sheets, crop every cell, then attach maps to materials that were
 * created before the images arrived. Resolves when every cell is ready.
 */
export function preloadAtlases() {
  return Promise.all(Object.entries(SHEETS).map(([name, def]) =>
    new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(def.url, (tex) => {
        loadedImages.set(name, tex.image);
        tex.dispose(); // full sheet not needed once cells are cropped
        for (const cellName of Object.keys(def.cells)) buildCellTexture(name, cellName);
        resolve();
      }, undefined, reject);
    })
  )).then(() => {
    for (const { mat, sheet, cell, opts } of pendingMats.splice(0)) {
      const tex = getCellTexture(sheet, cell);
      if (tex) {
        mat.map = tex.clone();
        mat.map.needsUpdate = true;
        mat.map.repeat.set(opts.repeat?.[0] ?? 1, opts.repeat?.[1] ?? 1);
        mat.needsUpdate = true;
      }
    }
  });
}

function getCellTexture(sheetName, cellName) {
  const key = `${sheetName}:${cellName}`;
  let tex = cellTextures.get(key);
  if (!tex) tex = buildCellTexture(sheetName, cellName);
  return tex;
}

/**
 * Textured texture with the given cell + repeat, independent per caller.
 * @returns {THREE.Texture | null} — null before the sheet has loaded.
 */
export function makeAtlasTexture(sheetName, cellName, repeat = [1, 1]) {
  const base = getCellTexture(sheetName, cellName);
  if (!base) return null;
  const tex = base.clone();
  tex.needsUpdate = true;
  tex.repeat.set(repeat[0], repeat[1]);
  return tex;
}

/**
 * MeshLambertMaterial with a textured map from an atlas cell.
 * The material's color keeps the original palette so biome/type identity
 * is preserved on top of the texture detail.
 */
export function makeAtlasMaterial(sheetName, cellName, opts = {}) {
  const mat = new THREE.MeshLambertMaterial({
    color: opts.color ?? 0xffffff,
    flatShading: opts.flatShading ?? true,
  });
  const tex = getCellTexture(sheetName, cellName);
  if (tex) {
    mat.map = tex.clone();
    mat.map.needsUpdate = true;
    mat.map.repeat.set(opts.repeat?.[0] ?? 1, opts.repeat?.[1] ?? 1);
  } else {
    pendingMats.push({ mat, sheet: sheetName, cell: cellName, opts });
  }
  if (opts.emissive !== undefined) {
    mat.emissive.set(opts.emissive);
    mat.emissiveIntensity = opts.emissiveIntensity ?? 1;
  }
  return mat;
}
