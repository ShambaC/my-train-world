#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = '1.0.0';

function help() {
  console.log(`Build painterly style atlases from individually approved PNG sources.

Usage:
  node tools/build-style-textures.mjs --manifest tools/style-textures.manifest.json --check
  node tools/build-style-textures.mjs --manifest tools/style-textures.manifest.json --build
  node tools/build-style-textures.mjs --manifest tools/style-textures.manifest.json --clean

--check validates source files and manifest without writing runtime assets.
--build derives atlases, writes KTX2 files, semantic manifest, previews, and report.
--clean removes only outputs declared by this tool.`);
}

function parseArgs(argv) {
  const args = { mode: null, manifest: null };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--help' || value === '-h') args.mode = 'help';
    else if (value === '--check' || value === '--build' || value === '--clean') args.mode = value.slice(2);
    else if (value === '--manifest') args.manifest = argv[++i];
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!args.mode) throw new Error('One of --check, --build, --clean, or --help is required.');
  if (args.mode !== 'help' && !args.manifest) throw new Error('--manifest is required.');
  return args;
}

function loadManifest(manifestArg) {
  const manifestPath = resolve(ROOT, manifestArg);
  if (!manifestPath.startsWith(ROOT)) throw new Error('Manifest path escapes repository root.');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const defaults = manifest.defaults || {};
  const dimensions = manifest.dimensions || {};
  const entries = (manifest.assetNames || []).map((name) => ({
    name,
    generated: defaults.generated.replace('{name}', name),
    cropped: defaults.cropped.replace('{name}', name),
    width: dimensions[name]?.[0] ?? defaults.width,
    height: dimensions[name]?.[1] ?? defaults.height,
    kind: inferKind(name, defaults.kind),
    colorSpace: inferColorSpace(name, defaults.colorSpace),
    tileable: inferTileable(name, defaults.tileable),
    alpha: inferAlpha(name, defaults.alpha),
    materialFamily: inferFamily(name, defaults.materialFamily),
    atlas: inferAtlas(name, defaults.atlas),
    gutter: defaults.gutter,
    compression: inferCompression(name, defaults.compression),
  }));
  return { ...manifest, manifestPath, entries };
}

function inferKind(name, fallback) {
  if (/deciduous-breakup|cloud-(?!opacity)|clump|flower|grass-cluster|reed|shrub/i.test(name)) return 'cutout';
  if (/mask|opacity|caustic|ripple|rings|mottle|variation|wear|accumulation|damp|soot|breakup/i.test(name)) return 'mask';
  return fallback;
}
function inferColorSpace(name, fallback) {
  return inferKind(name, fallback) === 'mask' ? 'linear' : fallback;
}
function inferTileable(name, fallback) {
  return inferKind(name, fallback) === 'color';
}
function inferAlpha(name, fallback) {
  return inferKind(name, fallback) === 'cutout' ? 'required' : fallback;
}
function inferFamily(name, fallback) {
  if (/cloud/i.test(name)) return 'cloud';
  if (/flower|grass|reed|clump|shrub|pine|deciduous/i.test(name)) return 'foliage';
  if (/water|ripple|caustic|pond/i.test(name)) return 'water';
  if (/road/i.test(name)) return 'road';
  if (/rail|sleeper|ballast|beam|bridge|platform/i.test(name)) return 'infrastructure';
  if (/enamel|brass|wheel|boiler|carriage/i.test(name)) return 'rolling-stock';
  return fallback;
}
function inferAtlas(name, fallback) {
  const kind = inferKind(name, fallback);
  if (kind === 'cutout') return /cloud/i.test(name) ? 'cloudCutout' : 'foliageCutout';
  if (/water|ripple|caustic|pond/i.test(name)) return 'waterData';
  if (/wear|mask|variation|mottle|damp|soot|accumulation/i.test(name)) return 'weatheringMask';
  if (/road/i.test(name)) return 'roadColor';
  if (/rail|sleeper|ballast|beam|bridge|platform/i.test(name)) return 'infrastructureColor';
  if (/enamel|brass|wheel|boiler|carriage/i.test(name)) return 'rollingStockColor';
  return fallback;
}
function inferCompression(name, fallback) {
  return inferKind(name, fallback) === 'color' ? fallback : 'uastc';
}

function readPngInfo(filePath) {
  const data = readFileSync(filePath);
  if (data.readUInt32BE(0) !== 0x89504e47 || data.toString('ascii', 12, 16) !== 'IHDR') throw new Error(`Unsupported image (expected PNG): ${filePath}`);
  const colorType = data[25];
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20), hasAlpha: colorType === 4 || colorType === 6 };
}
function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}
function inside(root, child) {
  const rel = relative(root, child);
  return rel && !rel.startsWith('..') && !isAbsolute(rel);
}

function validate(manifest) {
  const errors = [];
  const warnings = [];
  const seenNames = new Set();
  const seenAtlases = new Map();
  for (const entry of manifest.entries) {
    if (seenNames.has(entry.name)) errors.push(`duplicate source name: ${entry.name}`);
    seenNames.add(entry.name);
    if (!['color', 'cutout', 'height', 'mask'].includes(entry.kind)) errors.push(`${entry.name}: unsupported source kind ${entry.kind}`);
    if (!['srgb', 'linear'].includes(entry.colorSpace)) errors.push(`${entry.name}: unsupported color space ${entry.colorSpace}`);
    if (!['none', 'required'].includes(entry.alpha)) errors.push(`${entry.name}: unsupported alpha mode ${entry.alpha}`);
    const cropped = resolve(ROOT, manifest.sourceRoot, entry.cropped);
    const generated = resolve(ROOT, manifest.sourceRoot, entry.generated);
    const runtime = resolve(ROOT, manifest.runtimeRoot, `${entry.atlas}.ktx2`);
    if (!inside(ROOT, cropped) || !inside(ROOT, generated) || !inside(ROOT, runtime)) errors.push(`${entry.name}: path escapes declared root`);
    if (!existsSync(cropped)) {
      errors.push(`${entry.name}: missing approved/cropped image ${entry.cropped}`);
      continue;
    }
    if (manifest.generatedRequired && !existsSync(generated)) errors.push(`${entry.name}: missing generated image ${entry.generated}`);
    try {
      const info = readPngInfo(cropped);
      if (info.width !== entry.width || info.height !== entry.height) errors.push(`${entry.name}: dimensions ${info.width}x${info.height}, expected ${entry.width}x${entry.height}`);
      if ((entry.alpha === 'required') !== info.hasAlpha) errors.push(`${entry.name}: alpha ${info.hasAlpha ? 'present' : 'missing'}, expected ${entry.alpha}`);
    } catch (error) {
      errors.push(error.message);
    }
    const list = seenAtlases.get(entry.atlas) || [];
    list.push(entry);
    seenAtlases.set(entry.atlas, list);
  }
  if (!manifest.entries.length) errors.push('manifest has no asset entries');
  if (new Set(manifest.entries.map((entry) => entry.atlas)).size !== seenAtlases.size) errors.push('invalid atlas declarations');
  return { errors, warnings, atlasEntries: seenAtlases };
}

function reportCheck(manifest, validation) {
  for (const entry of manifest.entries) console.log(`[check] ${entry.name}`);
  console.log(`sources=${manifest.entries.length} atlases=${validation.atlasEntries.size} warnings=${validation.warnings.length} errors=${validation.errors.length}`);
  validation.warnings.forEach((warning) => console.warn(`warning: ${warning}`));
  validation.errors.forEach((error) => console.error(`error: ${error}`));
}

function findEncoder(manifest) {
  const configured = process.env.KTX2_ENCODER || manifest.ktx2Encoder;
  if (!configured) return null;
  try {
    execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', [configured], { stdio: 'ignore' });
    return configured;
  } catch {
    return null;
  }
}

async function build(manifest, validation) {
  const encoder = findEncoder(manifest);
  if (!encoder) throw new Error('KTX2 encoder missing. Set KTX2_ENCODER to a pinned basisu/toktx executable before --build. No PNG fallback is emitted.');
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    throw new Error('sharp missing. Install pinned repository dependency before --build.');
  }
  const runtimeRoot = resolve(ROOT, manifest.runtimeRoot);
  const previewRoot = resolve(ROOT, manifest.sourceRoot, 'cropped/previews');
  mkdirSync(runtimeRoot, { recursive: true });
  mkdirSync(previewRoot, { recursive: true });
  const semantic = {};
  const outputs = [];
  let atlasTiles = 0;
  let bytes = 0;
  for (const [atlas, entries] of validation.atlasEntries) {
    const columns = Math.ceil(Math.sqrt(entries.length));
    const tileSize = manifest.tileSize || 256;
    const gutter = manifest.defaults.gutter || 8;
    const stride = tileSize + gutter * 2;
    const rows = Math.ceil(entries.length / columns);
    const composites = [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const input = resolve(ROOT, manifest.sourceRoot, entry.cropped);
      const resized = await sharp(input).resize(tileSize, tileSize, { fit: 'cover' }).png().toBuffer();
      const x = (index % columns) * stride + gutter;
      const y = Math.floor(index / columns) * stride + gutter;
      composites.push({ input: resized, left: x, top: y });
      semantic[entry.name] = { atlas: `${atlas}.ktx2`, uv: { x: x / (columns * stride), y: 1 - (y + tileSize) / (rows * stride), width: tileSize / (columns * stride), height: tileSize / (rows * stride) }, kind: entry.kind, colorSpace: entry.colorSpace };
      atlasTiles += 1;
    }
    const tempPng = join(runtimeRoot, `.${atlas}.png`);
    await sharp({ create: { width: columns * stride, height: rows * stride, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(composites).png().toFile(tempPng);
    const output = join(runtimeRoot, `${atlas}.ktx2`);
    const args = manifest.encoderArgs || ['-ktx2', '-output_file', output, tempPng];
    execFileSync(encoder, args.map((arg) => arg.replace('{input}', tempPng).replace('{output}', output)), { stdio: 'inherit' });
    rmSync(tempPng, { force: true });
    outputs.push(relative(ROOT, output));
    bytes += readFileSync(output).byteLength;
    const preview = join(previewRoot, `${atlas}.png`);
    await sharp(output).png().toFile(preview).catch(() => {});
  }
  const semanticPath = join(runtimeRoot, 'styleTextureManifest.js');
  writeFileSync(semanticPath, `export const STYLE_TEXTURE_MANIFEST = ${JSON.stringify(semantic, null, 2)};\n`);
  outputs.push(relative(ROOT, semanticPath));
  const reportPath = join(previewRoot, '..', 'build-report.json');
  const report = { toolVersion: VERSION, manifestHash: sha256(manifest.manifestPath), sourceHashes: Object.fromEntries(manifest.entries.map((entry) => [entry.name, sha256(resolve(ROOT, manifest.sourceRoot, entry.cropped))])), outputs, atlasTiles, generatedAtlases: validation.atlasEntries.size, bytes, settings: { tileSize: manifest.tileSize || 256, gutters: manifest.defaults.gutter || 8, encoder } };
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`sources=${manifest.entries.length} atlasTiles=${atlasTiles} generatedAtlases=${validation.atlasEntries.size} bytes=${bytes} warnings=0 errors=0`);
}

function clean(manifest) {
  const runtimeRoot = resolve(ROOT, manifest.runtimeRoot);
  if (existsSync(runtimeRoot)) {
    for (const file of readdirSync(runtimeRoot)) if (file.endsWith('.ktx2') || file === 'styleTextureManifest.js') rmSync(join(runtimeRoot, file), { force: true });
  }
  rmSync(resolve(ROOT, manifest.sourceRoot, 'cropped/previews'), { recursive: true, force: true });
  rmSync(resolve(ROOT, manifest.sourceRoot, 'cropped/build-report.json'), { force: true });
  console.log('cleaned declared style texture outputs');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === 'help') return help();
  const manifest = loadManifest(args.manifest);
  const validation = validate(manifest);
  if (args.mode === 'check') {
    reportCheck(manifest, validation);
    if (validation.errors.length) process.exitCode = 1;
    return;
  }
  if (args.mode === 'clean') return clean(manifest);
  if (validation.errors.length) {
    reportCheck(manifest, validation);
    process.exitCode = 1;
    return;
  }
  await build(manifest, validation);
}

main().catch((error) => { console.error(`error: ${error.message}`); process.exitCode = 1; });
