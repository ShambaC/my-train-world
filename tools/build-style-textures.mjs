import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { encodeToKTX2 } from 'ktx2-encoder';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
Usage: node tools/build-style-textures.mjs [options]

Options:
  --manifest <path>  Path to manifest file (default: tools/style-textures.manifest.json)
  --check            Validate that all declared source textures exist and are accessible
  --build            Pack atlases, encode KTX2 textures/atlases, and emit styleTextureManifest.js
  --clean            Remove generated runtime files
  --help             Show this help message
`);
}

if (args.includes('--help') || args.length === 0) {
  printHelp();
  process.exit(0);
}

let manifestPath = path.resolve(rootDir, 'tools/style-textures.manifest.json');
const manifestIdx = args.indexOf('--manifest');
if (manifestIdx !== -1 && args[manifestIdx + 1]) {
  manifestPath = path.resolve(process.cwd(), args[manifestIdx + 1]);
}

if (!fs.existsSync(manifestPath)) {
  console.error(`Error: Manifest not found at ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const croppedDir = path.resolve(rootDir, manifest.croppedDir);
const runtimeDir = path.resolve(rootDir, manifest.runtimeDir);
const manifestOutPath = path.resolve(rootDir, manifest.manifestOut);
const reportOutPath = path.resolve(croppedDir, 'build-report.json');

if (args.includes('--clean')) {
  console.log(`Cleaning runtime style textures in ${runtimeDir}...`);
  if (fs.existsSync(runtimeDir)) {
    fs.rmSync(runtimeDir, { recursive: true, force: true });
  }
  if (fs.existsSync(manifestOutPath)) {
    fs.unlinkSync(manifestOutPath);
  }
  if (fs.existsSync(reportOutPath)) {
    fs.unlinkSync(reportOutPath);
  }
  console.log('Clean complete.');
  process.exit(0);
}

if (args.includes('--check')) {
  console.log(`Checking ${manifest.textures.length} textures declared in manifest...`);
  let missing = 0;
  for (const item of manifest.textures) {
    const srcPath = path.resolve(croppedDir, item.file);
    if (!fs.existsSync(srcPath)) {
      console.error(`[MISSING] ${item.name} -> ${srcPath}`);
      missing++;
    }
  }
  if (missing > 0) {
    console.error(`Check failed: ${missing} missing source files.`);
    process.exit(1);
  } else {
    console.log(`Check passed: All ${manifest.textures.length} source textures verified.`);
  }
  if (!args.includes('--build')) {
    process.exit(0);
  }
}

async function imageDecoder(buffer) {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function encodeBufferToKTX2(pngBuffer, isUASTC = true) {
  return await encodeToKTX2(pngBuffer, {
    isUASTC,
    generateMipmap: true,
    imageDecoder,
  });
}

if (args.includes('--build')) {
  console.log(`Building runtime style textures and KTX2 atlases...`);
  if (!fs.existsSync(runtimeDir)) {
    fs.mkdirSync(runtimeDir, { recursive: true });
  }

  // 1. Group textures by atlas
  const atlasGroups = new Map();
  for (const item of manifest.textures) {
    const atlasName = item.atlas || 'general';
    if (!atlasGroups.has(atlasName)) {
      atlasGroups.set(atlasName, []);
    }
    atlasGroups.get(atlasName).push(item);
  }

  const manifestEntries = {};
  const atlasEntries = {};
  const report = {
    timestamp: new Date().toISOString(),
    texturesCount: manifest.textures.length,
    atlases: {},
    textures: {},
  };

  const TILE_SIZE = 512; // Standardize tile dimension for atlas packing

  // 2. Process and encode each atlas group
  for (const [atlasName, items] of atlasGroups.entries()) {
    console.log(`\nPacking atlas [${atlasName}] (${items.length} items)...`);

    // Calculate grid size
    const cols = Math.ceil(Math.sqrt(items.length));
    const rows = Math.ceil(items.length / cols);
    const atlasWidth = cols * TILE_SIZE;
    const atlasHeight = rows * TILE_SIZE;

    const composites = [];
    const uvRectangles = {};

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const srcPath = path.resolve(croppedDir, item.file);
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const left = col * TILE_SIZE;
      const top = row * TILE_SIZE;

      // Resize and process tile
      const resizedBuffer = await sharp(srcPath)
        .resize(TILE_SIZE, TILE_SIZE, { fit: 'fill' })
        .toBuffer();

      composites.push({
        input: resizedBuffer,
        left,
        top,
      });

      // Semantic UV coordinates: [uMin, vMin, uMax, vMax] (Three.js UV origin is bottom-left)
      const uMin = left / atlasWidth;
      const uMax = (left + TILE_SIZE) / atlasWidth;
      const vMin = 1.0 - (top + TILE_SIZE) / atlasHeight;
      const vMax = 1.0 - top / atlasHeight;

      uvRectangles[item.name] = {
        name: item.name,
        file: item.file,
        kind: item.kind,
        family: item.family,
        colorSpace: item.colorSpace,
        tileable: item.tileable,
        atlas: atlasName,
        uv: [uMin, vMin, uMax, vMax],
      };

      // Also copy / encode individual KTX2 texture and PNG texture
      const destPng = path.resolve(runtimeDir, item.file);
      const destKtx2 = path.resolve(runtimeDir, item.file.replace(/\.png$/, '.ktx2'));

      fs.copyFileSync(srcPath, destPng);

      // Encode individual KTX2
      const isCutoutOrData = item.kind !== 'color';
      const ktx2Buf = await encodeBufferToKTX2(resizedBuffer, isCutoutOrData);
      fs.writeFileSync(destKtx2, Buffer.from(ktx2Buf));

      manifestEntries[item.name] = {
        ...uvRectangles[item.name],
        pngUrl: `./${item.file}`,
        ktx2Url: `./${item.file.replace(/\.png$/, '.ktx2')}`,
      };

      report.textures[item.name] = {
        atlas: atlasName,
        ktx2Bytes: ktx2Buf.byteLength,
        uv: [uMin, vMin, uMax, vMax],
      };
    }

    // Assemble and encode full atlas PNG and KTX2
    const atlasPngBuffer = await sharp({
      create: {
        width: atlasWidth,
        height: atlasHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();

    const atlasPngPath = path.resolve(runtimeDir, `atlas_${atlasName}.png`);
    const atlasKtx2Path = path.resolve(runtimeDir, `atlas_${atlasName}.ktx2`);

    fs.writeFileSync(atlasPngPath, atlasPngBuffer);

    const isCutoutOrDataAtlas = atlasName === 'cutouts' || atlasName === 'masks' || atlasName === 'water';
    const atlasKtx2Buf = await encodeBufferToKTX2(atlasPngBuffer, isCutoutOrDataAtlas);
    fs.writeFileSync(atlasKtx2Path, Buffer.from(atlasKtx2Buf));

    atlasEntries[atlasName] = {
      name: atlasName,
      pngUrl: `./atlas_${atlasName}.png`,
      ktx2Url: `./atlas_${atlasName}.ktx2`,
      width: atlasWidth,
      height: atlasHeight,
      tiles: uvRectangles,
    };

    report.atlases[atlasName] = {
      width: atlasWidth,
      height: atlasHeight,
      items: items.length,
      pngBytes: atlasPngBuffer.byteLength,
      ktx2Bytes: atlasKtx2Buf.byteLength,
    };

    console.log(`  -> Generated atlas_${atlasName}.ktx2 (${(atlasKtx2Buf.byteLength / 1024).toFixed(1)} KB)`);
  }

  // 3. Write JS Manifest for Vite
  const jsLines = [
    '/**',
    ' * Generated Style Texture Manifest',
    ' * Auto-generated by tools/build-style-textures.mjs',
    ' * Includes individual KTX2/PNG references and packed Atlases with semantic UVs',
    ' */',
    '',
  ];

  // Imports for all individual texture files
  manifest.textures.forEach((item) => {
    jsLines.push(`import tex_${item.name} from './${item.file}';`);
    jsLines.push(`import ktx_${item.name} from './${item.file.replace(/\.png$/, '.ktx2')}';`);
  });

  // Imports for all atlas files
  for (const atlasName of atlasGroups.keys()) {
    jsLines.push(`import atlas_png_${atlasName} from './atlas_${atlasName}.png';`);
    jsLines.push(`import atlas_ktx_${atlasName} from './atlas_${atlasName}.ktx2';`);
  }

  jsLines.push('');
  jsLines.push('export const STYLE_TEXTURES = {');
  manifest.textures.forEach((item) => {
    const entry = manifestEntries[item.name];
    jsLines.push(`  ${JSON.stringify(item.name)}: {`);
    jsLines.push(`    url: tex_${item.name},`);
    jsLines.push(`    ktx2Url: ktx_${item.name},`);
    jsLines.push(`    name: ${JSON.stringify(item.name)},`);
    jsLines.push(`    kind: ${JSON.stringify(item.kind)},`);
    jsLines.push(`    family: ${JSON.stringify(item.family)},`);
    jsLines.push(`    colorSpace: ${JSON.stringify(item.colorSpace)},`);
    jsLines.push(`    tileable: ${JSON.stringify(item.tileable)},`);
    jsLines.push(`    atlas: ${JSON.stringify(item.atlas)},`);
    jsLines.push(`    uv: ${JSON.stringify(entry.uv)},`);
    jsLines.push(`  },`);
  });
  jsLines.push('};');
  jsLines.push('');

  jsLines.push('export const STYLE_ATLASES = {');
  for (const [atlasName, atlasData] of Object.entries(atlasEntries)) {
    jsLines.push(`  ${JSON.stringify(atlasName)}: {`);
    jsLines.push(`    pngUrl: atlas_png_${atlasName},`);
    jsLines.push(`    ktx2Url: atlas_ktx_${atlasName},`);
    jsLines.push(`    width: ${atlasData.width},`);
    jsLines.push(`    height: ${atlasData.height},`);
    jsLines.push(`  },`);
  }
  jsLines.push('};');
  jsLines.push('');
  jsLines.push('export const STYLE_TEXTURE_COUNT = Object.keys(STYLE_TEXTURES).length;');
  jsLines.push('export const STYLE_ATLAS_COUNT = Object.keys(STYLE_ATLASES).length;');
  jsLines.push('');

  fs.writeFileSync(manifestOutPath, jsLines.join('\n'), 'utf8');
  fs.writeFileSync(reportOutPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`\nBuild Complete: Generated 90 individual KTX2s, ${atlasGroups.size} KTX2 Atlases, manifest, and report.`);
}
