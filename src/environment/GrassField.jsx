import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BIOME, mulberry32 } from '../terrain.js';
import { windTime } from './wind.js';
import { scatterRegistry } from './scatterRegistry.js';
import { addSetDiff, collectExclusionSets, cellKey } from './instanceExclusion.js';
import { makeBladeGeometry, makeBladeMaterial, makeFlowerMaterial, makeFlowerDepthMaterial } from './grassMaterials.js';
import maskFlowerA from '../assets/Textures/flower/flowers.png';
import rgbFlowerA from '../assets/Textures/flower/flowersRGB.png';
import gradFlowerA from '../assets/Textures/flower/flowersGradient.png';
import maskFlowerB from '../assets/Textures/flower3/flowers.png';
import rgbFlowerB from '../assets/Textures/flower3/flowersRGB.png';
import gradFlowerB from '../assets/Textures/flower3/flowersGradient.png';

const VOXEL = 0.5;
const MAX_BLADES = 150000;
const SINK = 0.02;
// General patch spawn probability per grassy cell (tree patches are
// unconditional — every scattered tree gets one).
const PATCH_PROB = 0.12;
// Minimum center distance between patches (cells) — stops adjacent cells from
// merging into one big region and keeps tufts distinct.
const PATCH_SPACING = 3.5;
// Angular samples of a patch's irregular outline (blob, not circle).
const SHAPE_SAMPLES = 16;

// ── Shared blade uniforms (Spring look, terrain-matched palette) ────────────
const bladeUniforms = {
  uTime: { value: 0 },
  uWindStrength: { value: 0.1 },
  uWindSpeed: { value: 1.3 },
  uWindFreq: { value: 4.0 },
  uWindTurb: { value: 0.3 },
  uWindLean: { value: 0.06 },
  uWindDir: { value: new THREE.Vector2(0.85, 0.53) },
  uWindFixLocal: { value: 1 },
  uPatchScale: { value: 0.6 },
  uShadowSampleY: { value: 0.5 },
  uShadowRadius: { value: 0.06 },
  uGrassBottom: { value: new THREE.Color(0x549e54) },
  uGrassTop: { value: new THREE.Color(0x7cc46b) },
  uBrightness: { value: 0.85 },
  uGradStart: { value: 0.15 },
  uGradEnd: { value: 1.0 },
  uGradPower: { value: 1.0 },
  uPatchLush: { value: new THREE.Color(0x549e54) },
  uPatchDry: { value: new THREE.Color(0x8aa25a) },
  uPatchStrength: { value: 0.18 },
  uPatchBias: { value: 1.5 },
  uShadowSamples: { value: 4 },
  uShadowStrength: { value: 0.45 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunColor: { value: new THREE.Color(1, 1, 1) },
  uTransColor: { value: new THREE.Color(0xc1e54d) },
  uTransStrength: { value: 2.2 },
  uTransPower: { value: 2.0 },
  uTransTip: { value: 0.4 },
  uTransShadow: { value: 0.6 },
};

// ── Flower textures ─────────────────────────────────────────────────────────
const flowerTextureCache = new Map();
const flowerTexturePromises = new Map();

function loadTexture(path) {
  const cached = flowerTextureCache.get(path);
  if (cached) return cached;

  let tex;
  let resolveTexture;
  let rejectTexture;
  const ready = new Promise((resolve, reject) => {
    resolveTexture = resolve;
    rejectTexture = reject;
  });
  tex = new THREE.TextureLoader().load(path, () => resolveTexture(tex), undefined, rejectTexture);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  flowerTextureCache.set(path, tex);
  flowerTexturePromises.set(path, ready);
  return tex;
}

const FLOWER_TEX_A = {
  mask: loadTexture(maskFlowerA),
  rgb: loadTexture(rgbFlowerA),
  grad: loadTexture(gradFlowerA),
};
const FLOWER_TEX_B = {
  mask: loadTexture(maskFlowerB),
  rgb: loadTexture(rgbFlowerB),
  grad: loadTexture(gradFlowerB),
};

export const GRASS_TEXTURE_COUNT = flowerTexturePromises.size;

export function preloadGrassTextures(onProgress) {
  const promises = [...flowerTexturePromises.values()];
  let loaded = 0;
  return Promise.all(promises.map((promise) => promise.then(() => {
    loaded += 1;
    onProgress?.(loaded / promises.length);
  })));
}

function makeFlowerUniforms(tex) {
  return {
    uTime: { value: 0 },
    uWindStrength: { value: 0.12 },
    uWindSpeed: { value: 1.3 },
    uWindFreq: { value: 4.0 },
    uWindTurb: { value: 0.3 },
    uWindLean: { value: 0.03 },
    uWindDir: bladeUniforms.uWindDir,
    uBendAmp: { value: 0.02 },
    uBendFreq: { value: 6.0 },
    uFlowerMask: { value: tex.mask },
    uFlowerRGB: { value: tex.rgb },
    uFlowerGradient: { value: tex.grad },
    uColorR: { value: new THREE.Color(0xff5d73) },
    uColorG: { value: new THREE.Color(0xffd34d) },
    uColorB: { value: new THREE.Color(0x6a7dff) },
    uColorStem: { value: new THREE.Color(0x3f6d2a) },
    uGrassColor: bladeUniforms.uGrassBottom,
    uBrightness: { value: 0.85 },
  };
}

// Shared flower quad (pivot at the base: uv.y = 0 → ground).
const FLOWER_GEO = new THREE.PlaneGeometry(1, 1);
FLOWER_GEO.translate(0, 0.5, 0);

/**
 * Stylized instanced grass field for meadow/forest biome cells — dense
 * irregular patches of wind-swayed shader blades (gradient/patch coloring,
 * backlit translucency, soft shadows) plus alpha-mask flower cross-billboards.
 * Every scattered tree gets a patch at its base; other patches spawn randomly
 * across grassy cells with organic blob outlines. Blades and flowers are
 * hidden (zero-scaled) under tracks, stations, roads and scattered buildings,
 * exactly like ScatterProps. Deterministic per terrain seed.
 */
export default function GrassField({ terrainData, trackManager, stationManager, trackCount, stationsVersion, roadManager, lighting, quality, simulationPaused = false }) {
  const groupRef = useRef(new THREE.Group());
  const layoutRef = useRef([]);
  const layoutByCellRef = useRef(new Map());
  const exclusionSetsRef = useRef(null);

  const length = terrainData?.length || 0;
  const breadth = terrainData?.breadth || 0;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();

  // Materials/geometries live for the component's lifetime; instance matrices
  // are rewritten per rebuild, so the shader programs compile once. Each flower
  // variant shares ONE uniform bag between its visible and depth materials, so
  // the shadow pass sways with the same live values.
  const flowerUniforms = useMemo(
    () => ({ A: makeFlowerUniforms(FLOWER_TEX_A), B: makeFlowerUniforms(FLOWER_TEX_B) }),
    [],
  );
  const bladeMat = useMemo(() => makeBladeMaterial(bladeUniforms), []);
  const flowerMats = useMemo(
    () => ({
      A: {
        mat: makeFlowerMaterial(FLOWER_TEX_A, flowerUniforms.A),
        depth: makeFlowerDepthMaterial(FLOWER_TEX_A, flowerUniforms.A),
      },
      B: {
        mat: makeFlowerMaterial(FLOWER_TEX_B, flowerUniforms.B),
        depth: makeFlowerDepthMaterial(FLOWER_TEX_B, flowerUniforms.B),
      },
    }),
    [flowerUniforms],
  );

  // Build the field whenever terrain changes (or first mounts).
  useMemo(() => {
    const old = groupRef.current;
    for (const c of old.children) {
      if (c.geometry && c.geometry !== FLOWER_GEO) c.geometry.dispose();
    }
    old.clear();
    layoutRef.current = [];
    layoutByCellRef.current = new Map();
    exclusionSetsRef.current = null;

    if (!terrainData?.heightMap) return;

    const { heightMap, biomeMask } = terrainData;
    const seed = terrainData.seed ?? 1337;
    const halfL = length / 2;
    const halfB = breadth / 2;

    const isGrassCell = (x, z) => {
      if (x < 0 || x >= length || z < 0 || z >= breadth) return false;
      const h = heightMap[x][z];
      if (h <= 3) return false;
      const biome = biomeMask[x * breadth + z];
      return biome === BIOME.meadow || biome === BIOME.forest;
    };
    // Tree patches are allowed on any dry cell (a tuft under a lone tree on a
    // rock field reads naturally); general patches are grass-biome only.
    const isDryCell = (x, z) =>
      x >= 0 && x < length && z >= 0 && z < breadth && heightMap[x][z] > 3;

    const rng = mulberry32((((seed * 2654435761) >>> 0) ^ 0x9e3779b9) >>> 0);

    // ── Patches ──────────────────────────────────────────────────────────────
    // One patch under every scattered tree (compulsory), plus random general
    // patches kept apart by PATCH_SPACING. Each patch carries an irregular
    // outline: SHAPE_SAMPLES radial distances around the center, so blades
    // cluster in organic blobs.
    const patches = [];
    const tooClose = (cx, cz, minDist) => {
      for (const p of patches) {
        const dx = p.cx - cx;
        const dz = p.cz - cz;
        if (dx * dx + dz * dz < minDist * minDist) return true;
      }
      return false;
    };

    let treePatchCount = 0;
    for (const t of scatterRegistry.trees) {
      if (isDryCell(t.cellX, t.cellZ)) {
        patches.push({ cx: t.cellX, cz: t.cellZ, r: 0.8 + rng() * 0.6, loose: true });
        treePatchCount++;
      }
    }
    for (let x = 0; x < length; x++) {
      for (let z = 0; z < breadth; z++) {
        if (
          isGrassCell(x, z) &&
          rng() < PATCH_PROB &&
          !tooClose(x, z, PATCH_SPACING)
        ) {
          patches.push({ cx: x, cz: z, r: 0.55 + rng() * 0.5, loose: false });
        }
      }
    }

    const grassMul = quality?.grassDensityMultiplier ?? 1.0;
    let total = 0;
    for (const p of patches) {
      const baseCount = p.loose ? 180 + Math.floor(rng() * 140) : 160 + Math.floor(rng() * 120);
      p.count = Math.max(1, Math.floor(baseCount * grassMul));
      p.shape = new Array(SHAPE_SAMPLES);
      for (let i = 0; i < SHAPE_SAMPLES; i++) {
        p.shape[i] = p.r * (0.45 + rng() * 0.55);
      }
      total += p.count;
    }
    // Scale every patch's budget down if the global instance cap is exceeded.
    const scale = total > MAX_BLADES ? MAX_BLADES / total : 1;
    let bladeCount = 0;
    for (const p of patches) {
      p.count = Math.max(1, Math.floor(p.count * scale));
      bladeCount += p.count;
    }

    // ── Blades ───────────────────────────────────────────────────────────────
    const bladeGeo = makeBladeGeometry(3);
    const bladeMesh = new THREE.InstancedMesh(bladeGeo, bladeMat, bladeCount);
    bladeMesh.castShadow = false;
    bladeMesh.receiveShadow = true;
    bladeMesh.frustumCulled = false;

    const dummy = new THREE.Object3D();
    const registerLayout = (entry) => {
      layoutRef.current.push(entry);
      const key = cellKey(entry.cellX, entry.cellZ);
      const bucket = layoutByCellRef.current.get(key);
      if (bucket) bucket.push(entry);
      else layoutByCellRef.current.set(key, [entry]);
    };
    let bi = 0;
    for (const p of patches) {
      const px = (p.cx - halfL + 0.5) * VOXEL;
      const pz = (p.cz - halfB + 0.5) * VOXEL;
      for (let k = 0; k < p.count; k++) {
        const a = rng() * Math.PI * 2;
        const seg = Math.floor(rng() * SHAPE_SAMPLES);
        const t = rng();
        const r0 = p.shape[seg];
        const r1 = p.shape[(seg + 1) % SHAPE_SAMPLES];
        const rad = (r0 + (r1 - r0) * t) * Math.sqrt(rng());
        const wx = px + Math.cos(a) * rad;
        const wz = pz + Math.sin(a) * rad;
        const cx = Math.round(wx / VOXEL + halfL - 0.5);
        const cz = Math.round(wz / VOXEL + halfB - 0.5);
        const placeable = p.loose ? isDryCell(cx, cz) : isGrassCell(cx, cz);
        if (!placeable) continue;
        const cy = heightMap[cx][cz] * VOXEL + 0.25 - SINK;
        const sLen = 0.16 + rng() * 0.12;
        // Blades spray outward from the patch center (yaw aligned with the
        // outward direction, lean growing toward the rim) so a patch reads as
        // a radiating tuft instead of upright sticks.
        const outAngle = Math.atan2(wx - px, wz - pz);
        const lean = (0.12 + rng() * 0.14) * Math.min(1.1, Math.max(0.3, rad / (p.r * 0.5)));
        dummy.position.set(wx, cy, wz);
        dummy.rotation.set(0, outAngle + (rng() - 0.5) * 0.9, 0);
        dummy.rotateX(lean);
        dummy.scale.set(0.09, sLen, 1);
        dummy.updateMatrix();
        bladeMesh.setMatrixAt(bi, dummy.matrix);
        registerLayout({
          mesh: bladeMesh, index: bi,
          cellX: cx, cellZ: cz,
          ox: wx, oy: cy, oz: wz,
          rotQ: dummy.quaternion.clone(), scale: [0.09, sLen, 1],
        });
        bi++;
      }
    }
    bladeMesh.instanceMatrix.needsUpdate = true;
    old.add(bladeMesh);

    if (import.meta.env.DEV && window.__mtw) {
      window.__mtw.grassStats = {
        patches: patches.length,
        treePatches: treePatchCount,
        blades: bladeCount,
        patchList: patches.map((p) => ({ cx: p.cx, cz: p.cz, count: p.count, r: p.r, loose: p.loose })),
      };
    }

    // ── Flowers ──────────────────────────────────────────────────────────────
    const flowers = [];
    const typeRng = mulberry32((((seed * 2654435761) >>> 0) ^ 0x85ebca6b) >>> 0);
    for (let x = 0; x < length; x++) {
      for (let z = 0; z < breadth; z++) {
        if (isGrassCell(x, z) && typeRng() < 1 / 8) flowers.push({ x, z });
      }
    }
    const useA = flowers.map(() => typeRng() < 0.5);
    const nA = useA.filter(Boolean).length;
    const nB = flowers.length - nA;

    const flowerMeshes = {
      A: new THREE.InstancedMesh(FLOWER_GEO, flowerMats.A.mat, nA * 2),
      B: new THREE.InstancedMesh(FLOWER_GEO, flowerMats.B.mat, nB * 2),
    };
    for (const key of ['A', 'B']) {
      const im = flowerMeshes[key];
      im.castShadow = true;
      im.receiveShadow = true;
      im.frustumCulled = false;
      im.renderOrder = 1;
      im.customDepthMaterial = flowerMats[key].depth;
    }

    const frng = mulberry32((((seed * 2654435761) >>> 0) ^ 0xcc9e2d51) >>> 0);
    const size = 0.35;
    let iA = 0;
    let iB = 0;
    for (let i = 0; i < flowers.length; i++) {
      const cell = flowers[i];
      const cx = (cell.x - halfL + 0.5) * VOXEL;
      const cz = (cell.z - halfB + 0.5) * VOXEL;
      const cy = heightMap[cell.x][cell.z] * VOXEL + 0.25 - SINK;
      const ox = cx + (frng() - 0.5) * VOXEL;
      const oz = cz + (frng() - 0.5) * VOXEL;
      const ry = frng() * Math.PI * 2;
      const target = useA[i] ? 'A' : 'B';
      const slot = useA[i] ? iA++ : iB++;
      const im = flowerMeshes[target];

      dummy.position.set(ox, cy, oz);
      dummy.scale.setScalar(size);
      dummy.rotation.set(0, ry, 0);
      dummy.updateMatrix();
      im.setMatrixAt(slot * 2, dummy.matrix);
      const rotQ1 = dummy.quaternion.clone();

      dummy.rotation.set(0, ry + Math.PI * 0.5, 0);
      dummy.updateMatrix();
      im.setMatrixAt(slot * 2 + 1, dummy.matrix);
      const rotQ2 = dummy.quaternion.clone();

      registerLayout({
        mesh: im, index: slot * 2, cellX: cell.x, cellZ: cell.z,
        ox, oy: cy, oz, rotQ: rotQ1, scale: [size, size, size],
      });
      registerLayout({
        mesh: im, index: slot * 2 + 1, cellX: cell.x, cellZ: cell.z,
        ox, oy: cy, oz, rotQ: rotQ2, scale: [size, size, size],
      });
    }
    for (const key of ['A', 'B']) flowerMeshes[key].instanceMatrix.needsUpdate = true;
    if (flowers.length) old.add(flowerMeshes.A, flowerMeshes.B);
  }, [terrainData, length, breadth, flowerMats]);

  // Exclusion pass: update only cells whose dynamic exclusion sources changed.
  useEffect(() => {
    const layout = layoutRef.current;
    if (!layout.length) return;

    const run = () => {
      const next = collectExclusionSets({ trackManager, stationManager, roadManager, length, breadth });
      const previous = exclusionSetsRef.current;
      const affected = new Set();

      if (!previous) {
        for (const key of layoutByCellRef.current.keys()) affected.add(key);
      } else {
        for (const name of ['tracks', 'stations', 'roads', 'buildings']) {
          addSetDiff(previous[name], next[name], affected);
        }
      }
      exclusionSetsRef.current = next;

      const dirtyMeshes = new Set();
      for (const key of affected) {
        const isExcluded = next.tracks.has(key) || next.stations.has(key) || next.roads.has(key) || next.buildings.has(key);
        for (const inst of layoutByCellRef.current.get(key) || []) {
          if (isExcluded === inst.hidden) continue;
          inst.hidden = isExcluded;

          const s = inst.scale;
          position.set(inst.ox, inst.oy, inst.oz);
          quaternion.copy(inst.rotQ);
          scaleVec.set(isExcluded ? 0 : s[0], isExcluded ? 0 : s[1], isExcluded ? 0 : s[2]);
          matrix.compose(position, quaternion, scaleVec);
          inst.mesh.setMatrixAt(inst.index, matrix);
          dirtyMeshes.add(inst.mesh);
        }
      }
      for (const mesh of dirtyMeshes) mesh.instanceMatrix.needsUpdate = true;
    };

    run();
    let lastRoadVersion = roadManager?.version ?? -1;
    const interval = setInterval(() => {
      if ((roadManager?.version ?? -1) !== lastRoadVersion) {
        lastRoadVersion = roadManager?.version ?? -1;
        run();
      }
    }, 500);
    return () => clearInterval(interval);
  }, [trackCount, stationsVersion, terrainData, trackManager, stationManager, roadManager, length, breadth]);

  // Per-frame: shared wind clock (trees sway in sync), sun dir/color for
  // translucency, and a night dim on brightness.
  useFrame(() => {
    const s = bladeUniforms;
    if (!simulationPaused) {
      s.uTime.value = windTime.value;
    }
    if (simulationPaused) return;
    s.uSunDir.value.copy(lighting.sun.position).normalize();
    s.uSunColor.value.copy(lighting.sun.color).multiplyScalar(lighting.sun.intensity);
    s.uBrightness.value = 0.85 * (1 - 0.7 * lighting.nightness);

    const f = flowerUniforms;
    f.A.uTime.value = windTime.value;
    f.B.uTime.value = windTime.value;
    f.A.uBrightness.value = s.uBrightness.value;
    f.B.uBrightness.value = s.uBrightness.value;
  });

  return <primitive object={groupRef.current} />;
}
