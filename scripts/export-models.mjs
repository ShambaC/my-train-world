import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { createServer } from 'vite';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODELS_ROOT = path.join(ROOT, 'src', 'assets', 'Models');
const OUTPUT_ROOT = path.join(MODELS_ROOT, 'Exports');

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

class NodeFileReader {
  result = null;
  error = null;
  onload = null;
  onloadend = null;
  onerror = null;

  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(
      (result) => this.#finish(result),
      (error) => this.#fail(error),
    );
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then(
      (result) => {
        const base64 = Buffer.from(result).toString('base64');
        this.#finish(`data:${blob.type || 'application/octet-stream'};base64,${base64}`);
      },
      (error) => this.#fail(error),
    );
  }

  #finish(result) {
    this.result = result;
    this.onload?.({ target: this });
    this.onloadend?.({ target: this });
  }

  #fail(error) {
    this.error = error;
    this.onerror?.({ target: this });
    this.onloadend?.({ target: this });
  }
}

class UnloadedImage {
  width = 0;
  height = 0;

  addEventListener() {}
  removeEventListener() {}
  set src(_value) {}
}

globalThis.FileReader ??= NodeFileReader;
globalThis.document ??= {
  createElementNS(_namespace, tagName) {
    if (tagName === 'img') return new UnloadedImage();
    throw new Error(`Unsupported export-time DOM element: ${tagName}`);
  },
};

function seeded(seed, factory) {
  const original = Math.random;
  let state = seed >>> 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  try {
    return factory();
  } finally {
    Math.random = original;
  }
}

function nameAnimationNodes(root) {
  const animationNodes = root.userData?.animNodes;
  if (!animationNodes) return;
  for (const [name, node] of Object.entries(animationNodes)) {
    if (node?.isObject3D && !node.name) node.name = name;
  }
}

function expandInstances(source) {
  if (source.isInstancedMesh) {
    const group = new THREE.Group();
    group.copy(source, false);
    group.name ||= 'ExpandedInstances';
    group.position.copy(source.position);
    group.quaternion.copy(source.quaternion);
    group.scale.copy(source.scale);

    const instanceMatrix = new THREE.Matrix4();
    for (let i = 0; i < source.count; i += 1) {
      source.getMatrixAt(i, instanceMatrix);
      const mesh = new THREE.Mesh(source.geometry, source.material);
      mesh.name = `${group.name}_Instance_${String(i + 1).padStart(3, '0')}`;
      mesh.applyMatrix4(instanceMatrix);
      group.add(mesh);
    }
    return group;
  }

  const clone = source.clone(false);
  clone.clear();
  for (const child of source.children) clone.add(expandInstances(child));
  return clone;
}

const TEXTURE_SLOTS = [
  'map', 'alphaMap', 'aoMap', 'bumpMap', 'clearcoatMap', 'clearcoatNormalMap',
  'clearcoatRoughnessMap', 'displacementMap', 'emissiveMap', 'envMap',
  'iridescenceMap', 'iridescenceThicknessMap', 'lightMap', 'metalnessMap',
  'normalMap', 'roughnessMap', 'sheenColorMap', 'sheenRoughnessMap',
  'specularColorMap', 'specularIntensityMap', 'specularMap', 'thicknessMap',
  'transmissionMap',
];

function exportMaterial(material) {
  if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial || material.isMeshBasicMaterial) {
    return material.clone();
  }
  return new THREE.MeshStandardMaterial({
    color: material.color?.clone() ?? new THREE.Color(0xffffff),
    emissive: material.emissive?.clone() ?? new THREE.Color(0x000000),
    emissiveIntensity: material.emissiveIntensity ?? 1,
    roughness: 0.82,
    metalness: 0.08,
    opacity: material.opacity,
    transparent: material.transparent,
    alphaTest: material.alphaTest,
    side: material.side,
    flatShading: material.flatShading,
    vertexColors: material.vertexColors,
    depthWrite: material.depthWrite,
  });
}

function cleanForExport(source, fallbackName) {
  nameAnimationNodes(source);
  source.traverse((node) => {
    node.userData = {};
  });

  const root = expandInstances(source);
  root.name ||= fallbackName;

  let unnamedGroup = 0;
  let unnamedMesh = 0;
  root.traverse((node) => {
    node.userData = {};
    if (!node.name) {
      if (node.isMesh) node.name = `Mesh_${String(++unnamedMesh).padStart(3, '0')}`;
      else if (node.isGroup) node.name = `Group_${String(++unnamedGroup).padStart(3, '0')}`;
    }
    if (!node.isMesh) return;

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const cleaned = materials.map((material, index) => {
      const clone = exportMaterial(material);
      clone.name ||= `${fallbackName}_Material_${index + 1}`;
      clone.userData = {};
      clone.onBeforeCompile = THREE.Material.prototype.onBeforeCompile;
      for (const slot of TEXTURE_SLOTS) {
        if (slot in clone) clone[slot] = null;
      }
      clone.needsUpdate = true;
      return clone;
    });
    node.material = Array.isArray(node.material) ? cleaned : cleaned[0];
  });

  root.updateMatrixWorld(true);
  return root;
}

function modelStats(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const materialIds = new Set();
  let meshes = 0;
  let vertices = 0;
  let triangles = 0;

  root.traverse((node) => {
    if (!node.isMesh) return;
    meshes += 1;
    const position = node.geometry?.getAttribute?.('position');
    if (position) vertices += position.count;
    const indexCount = node.geometry?.index?.count;
    triangles += indexCount ? indexCount / 3 : (position?.count || 0) / 3;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      if (material) materialIds.add(material.uuid);
    }
  });

  return {
    meshes,
    vertices,
    triangles: Math.round(triangles),
    materials: materialIds.size,
    bounds: {
      size: [size.x, size.y, size.z].map((value) => Number(value.toFixed(6))),
      min: [box.min.x, box.min.y, box.min.z].map((value) => Number(value.toFixed(6))),
      max: [box.max.x, box.max.y, box.max.z].map((value) => Number(value.toFixed(6))),
    },
  };
}

async function exportGlb(root, outputPath) {
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(root, {
    binary: true,
    onlyVisible: true,
    truncateDrawRange: true,
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, Buffer.from(result));
}

function inspectGlb(buffer, label) {
  if (buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error(`${label}: invalid GLB magic`);
  }
  const version = buffer.readUInt32LE(4);
  const declaredLength = buffer.readUInt32LE(8);
  if (version !== 2) throw new Error(`${label}: expected GLB 2, got ${version}`);
  if (declaredLength !== buffer.length) {
    throw new Error(`${label}: header length ${declaredLength} != file length ${buffer.length}`);
  }
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.toString('ascii', 16, 20);
  if (jsonType !== 'JSON') throw new Error(`${label}: missing JSON chunk`);
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).trim());
  if (json.asset?.version !== '2.0') throw new Error(`${label}: invalid glTF asset version`);
  return {
    bytes: buffer.length,
    nodes: json.nodes?.length || 0,
    meshes: json.meshes?.length || 0,
    materials: json.materials?.length || 0,
  };
}

async function findSourceGlbs(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'Exports') continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findSourceGlbs(fullPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.glb')) files.push(fullPath);
  }
  return files.sort();
}

const vite = await createServer({
  root: ROOT,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

const manifest = {
  generatedAt: new Date().toISOString(),
  format: 'glTF Binary 2.0',
  units: '1 Three.js world unit; import at scale 1, then keep project-wide scale consistent',
  axes: 'Y up. Procedural trains and pedestrians face local +Z before Unity importer conversion.',
  textures: 'Procedural GLBs preserve material colors/emission but omit texture images. Rebuild Unity materials from src/assets/Textures.',
  generated: [],
  copiedSourceAssets: [],
};

try {
  const [
    steam,
    diesel,
    electric,
    checker,
    passenger,
    coalCart,
    gas,
    goods,
    container,
    viewdeck,
    vehicles,
    pedestrians,
    props,
    trees,
    tracks,
    crossings,
    roads,
    overhead,
    grass,
  ] = await Promise.all([
    vite.ssrLoadModule('/src/trains/SteamEngineModel.js'),
    vite.ssrLoadModule('/src/trains/DieselEngineModel.js'),
    vite.ssrLoadModule('/src/trains/ElectricEngineModel.js'),
    vite.ssrLoadModule('/src/trains/CheckerEngineModel.js'),
    vite.ssrLoadModule('/src/trains/PassengerCoachModel.js'),
    vite.ssrLoadModule('/src/trains/CoalCartModel.js'),
    vite.ssrLoadModule('/src/trains/GasCoachModel.js'),
    vite.ssrLoadModule('/src/trains/GoodsCoachModel.js'),
    vite.ssrLoadModule('/src/trains/ContainerCoachModel.js'),
    vite.ssrLoadModule('/src/trains/ViewdeckCoachModel.js'),
    vite.ssrLoadModule('/src/environment/vehicleModels.js'),
    vite.ssrLoadModule('/src/ambient/pedestrianModels.js'),
    vite.ssrLoadModule('/src/ambient/propModels.js'),
    vite.ssrLoadModule('/src/environment/treeArchetypes.js'),
    vite.ssrLoadModule('/src/tracks/TrackModels.js'),
    vite.ssrLoadModule('/src/crossings/crossingModels.js'),
    vite.ssrLoadModule('/src/environment/roadNetwork.js'),
    vite.ssrLoadModule('/src/tracks/OverheadLine.jsx'),
    vite.ssrLoadModule('/src/environment/grassMaterials.js'),
  ]);

  const jobs = [];
  const add = (relativePath, source, factory) => jobs.push({ relativePath, source, factory });

  add('Procedural/Trains/steam-engine.glb', 'src/trains/SteamEngineModel.js', steam.createSteamEngine);
  add('Procedural/Trains/diesel-engine.glb', 'src/trains/DieselEngineModel.js', diesel.createDieselEngine);
  add('Procedural/Trains/electric-engine.glb', 'src/trains/ElectricEngineModel.js', electric.createElectricEngine);
  add('Procedural/Trains/checker-engine.glb', 'src/trains/CheckerEngineModel.js', checker.createCheckerEngine);
  add('Procedural/Trains/passenger-coach.glb', 'src/trains/PassengerCoachModel.js', passenger.createPassengerCoach);
  add('Procedural/Trains/coal-cart.glb', 'src/trains/CoalCartModel.js', coalCart.createCoalCart);
  add('Procedural/Trains/gas-coach.glb', 'src/trains/GasCoachModel.js', gas.createGasCoach);
  add('Procedural/Trains/goods-coach.glb', 'src/trains/GoodsCoachModel.js', goods.createGoodsCoach);
  add('Procedural/Trains/container-coach.glb', 'src/trains/ContainerCoachModel.js', container.createContainerCoach);
  add('Procedural/Trains/viewdeck-coach.glb', 'src/trains/ViewdeckCoachModel.js', viewdeck.createViewdeckCoach);

  for (const [type, variants] of Object.entries(vehicles.VEHICLE_VARIANTS)) {
    for (const variant of variants) {
      add(`Procedural/Vehicles/${variant}.glb`, 'src/environment/vehicleModels.js', () => vehicles.createVehicle(type, variant));
    }
  }

  for (const type of pedestrians.PEDESTRIAN_TYPES) {
    add(`Procedural/Pedestrians/${type}.glb`, 'src/ambient/pedestrianModels.js', () => pedestrians.createPedestrian(type));
  }

  for (const [index, type] of ['crate', 'sack', 'coal', 'container', 'tanker'].entries()) {
    add(`Procedural/Cargo/${type}.glb`, 'src/ambient/propModels.js', () => seeded(1000 + index, () => props.createCargo(type)));
  }

  for (let theme = 0; theme < trees.FOLIAGE_THEMES.length; theme += 1) {
    add(`Procedural/Foliage/deciduous-theme-${theme}.glb`, 'src/environment/treeArchetypes.js', () => trees.createDeciduousTreeGroup(1, theme, theme));
  }
  add('Procedural/Foliage/pine.glb', 'src/environment/treeArchetypes.js', () => trees.createPineTreeGroup(1, 0));
  for (let seed = 0; seed < trees.FOLIAGE_THEMES.length; seed += 1) {
    const theme = Math.floor(Math.abs(seed * 3)) % trees.FOLIAGE_THEMES.length;
    add(`Procedural/Foliage/shrub-theme-${theme}.glb`, 'src/environment/treeArchetypes.js', () => trees.createShrubGroup(1, seed));
  }

  add('Procedural/Infrastructure/track-straight.glb', 'src/tracks/TrackModels.js', tracks.createStraightTrack);
  add('Procedural/Infrastructure/track-curved.glb', 'src/tracks/TrackModels.js', tracks.createCurvedTrack);
  add('Procedural/Infrastructure/track-ramp.glb', 'src/tracks/TrackModels.js', tracks.createRampTrack);
  add('Procedural/Infrastructure/bridge-support-straight-1_5m.glb', 'src/tracks/TrackModels.js', () => tracks.createSupportBeams(1.5, 'straight'));
  add('Procedural/Infrastructure/bridge-support-curved-1_5m.glb', 'src/tracks/TrackModels.js', () => tracks.createSupportBeams(1.5, 'curved'));
  add('Procedural/Infrastructure/bridge-support-ramp-0_5-1_0m.glb', 'src/tracks/TrackModels.js', () => tracks.createRampBeams(0.75, 0.5, 1));
  add('Procedural/Infrastructure/overhead-gantry.glb', 'src/tracks/OverheadLine.jsx', overhead.createOverheadGantry);
  add('Procedural/Infrastructure/overhead-wire-span-2_5m.glb', 'src/tracks/OverheadLine.jsx', () => overhead.createOverheadWireSpan(2.5, 0));
  add('Procedural/Infrastructure/road-rail-crossing.glb', 'src/crossings/crossingModels.js', () => crossings.buildCrossingMesh(0.75));

  const road = (type) => roads.createRoadMeshes({
    roads: [{
      id: `${type}-export`,
      type,
      width: type === 'dirt' ? 0.55 : 0.75,
      cells: [[0, 0], [1, 0]],
      userTiles: true,
      waypoints: [{ x: -0.5, y: 0, z: 0 }, { x: 0.5, y: 0, z: 0 }],
    }],
    lamps: [],
    signs: [],
  });
  add('Procedural/Infrastructure/road-asphalt-segment.glb', 'src/environment/roadNetwork.js', () => road('branch'));
  add('Procedural/Infrastructure/road-dirt-segment.glb', 'src/environment/roadNetwork.js', () => road('dirt'));
  add('Procedural/Infrastructure/road-lamp.glb', 'src/environment/roadNetwork.js', () => roads.createRoadMeshes({ roads: [], lamps: [{ x: 0, y: 0, z: 0, rotY: 0 }], signs: [] }));
  add('Procedural/Infrastructure/road-sign.glb', 'src/environment/roadNetwork.js', () => roads.createRoadMeshes({ roads: [], lamps: [], signs: [{ x: 0, y: 0, z: 0, rotY: 0 }] }));
  add('Procedural/Foliage/grass-blade.glb', 'src/environment/grassMaterials.js', () => {
    const material = new THREE.MeshLambertMaterial({ color: 0x5d8f3b, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(grass.makeBladeGeometry(3), material);
    mesh.name = 'GrassBlade';
    return mesh;
  });

  await rm(OUTPUT_ROOT, { recursive: true, force: true });
  await mkdir(OUTPUT_ROOT, { recursive: true });

  for (const job of jobs) {
    const fallbackName = path.basename(job.relativePath, '.glb');
    const source = job.factory();
    if (!source?.isObject3D) throw new Error(`${job.relativePath}: factory did not return Object3D`);
    const model = cleanForExport(source, fallbackName);
    const outputPath = path.join(OUTPUT_ROOT, job.relativePath);
    const stats = modelStats(model);
    await exportGlb(model, outputPath);
    const buffer = await readFile(outputPath);
    const validation = inspectGlb(buffer, job.relativePath);
    manifest.generated.push({
      file: job.relativePath.replaceAll('\\', '/'),
      source: job.source,
      sha256: sha256(buffer),
      ...stats,
      validation,
    });
  }

  for (const sourcePath of await findSourceGlbs(MODELS_ROOT)) {
    const relativeSource = path.relative(MODELS_ROOT, sourcePath);
    const relativeOutput = path.join('SourceAssets', relativeSource);
    const outputPath = path.join(OUTPUT_ROOT, relativeOutput);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await copyFile(sourcePath, outputPath);
    const buffer = await readFile(outputPath);
    manifest.copiedSourceAssets.push({
      file: relativeOutput.replaceAll('\\', '/'),
      source: path.join('src/assets/Models', relativeSource).replaceAll('\\', '/'),
      validation: inspectGlb(buffer, relativeOutput),
      sha256: sha256(buffer),
    });
  }

  const allGlbs = [...manifest.generated, ...manifest.copiedSourceAssets];
  manifest.summary = {
    generatedModels: manifest.generated.length,
    copiedSourceModels: manifest.copiedSourceAssets.length,
    totalGlbs: allGlbs.length,
    totalBytes: allGlbs.reduce((sum, entry) => sum + entry.validation.bytes, 0),
  };

  await writeFile(path.join(OUTPUT_ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const manifestInfo = await stat(path.join(OUTPUT_ROOT, 'manifest.json'));
  console.log(`Exported ${manifest.summary.generatedModels} procedural GLBs.`);
  console.log(`Copied ${manifest.summary.copiedSourceModels} existing GLBs.`);
  console.log(`Validated ${manifest.summary.totalGlbs} GLBs (${manifest.summary.totalBytes} bytes).`);
  console.log(`Manifest: ${manifestInfo.size} bytes at ${path.relative(ROOT, path.join(OUTPUT_ROOT, 'manifest.json'))}`);
} finally {
  await vite.close();
}
