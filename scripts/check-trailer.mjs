import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { parseTrailerConfig } from '../src/trailer/trailerConfig.js';
import { createTrailerSequences } from '../src/trailer/trailerSequence.js';

const atlasStub = {
  name: 'trailer-check-atlas-stub',
  enforce: 'pre',
  resolveId: (source) => {
    if (source.endsWith('/utils/atlasTextures.js')) return '\0trailer-check-atlas-stub';
    if (source.endsWith('/models/ModelLibrary')) return '\0trailer-check-model-library';
    return null;
  },
  load: (id) => {
    if (id === '\0trailer-check-atlas-stub') {
      return 'import * as THREE from "three"; export const makeAtlasMaterial = () => new THREE.MeshStandardMaterial(); export const getStyleTexture = () => null;';
    }
    if (id === '\0trailer-check-model-library') return 'export default {};';
    return null;
  },
};
const vite = await createServer({
  configFile: false,
  plugins: [atlasStub],
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  const [{ buildTrailerLayout, addRoute, validateTrailerLayout }, { TrackManager }, { generateTerrain }, { getEndpoints }] = await Promise.all([
    vite.ssrLoadModule('/src/trailer/trailerWorld.js'),
    vite.ssrLoadModule('/src/tracks/TrackManager.js'),
    vite.ssrLoadModule('/src/terrain.js'),
    vite.ssrLoadModule('/src/tracks/trackGeometry.js'),
  ]);
  const terrainData = generateTerrain(100, 100, 1337).userData;
  const layout = buildTrailerLayout(terrainData);
  const cells = layout.route.map(({ cell }) => `${cell.x},${cell.z}`);
  assert.equal(new Set(cells).size, cells.length, 'route pieces occupy unique cells at the turn');

  const tracks = new TrackManager();
  const routeTracks = addRoute(layout, tracks);
  assert.equal(routeTracks.length, layout.route.length);
  for (let i = 1; i < routeTracks.length; i += 1) {
    const a = getEndpoints(routeTracks[i - 1].type, routeTracks[i - 1].position, routeTracks[i - 1].rotation);
    const b = getEndpoints(routeTracks[i].type, routeTracks[i].position, routeTracks[i].rotation);
    const gap = Math.min(...Object.values(a).flatMap((pa) => Object.values(b).map((pb) => Math.hypot(pa.x - pb.x, pa.z - pb.z))));
    assert.ok(gap < 1e-6, `route endpoints touch between pieces ${i - 1} and ${i}`);
  }
  const connected = new Set();
  const pending = [routeTracks[0].id];
  while (pending.length) {
    const id = pending.pop();
    if (connected.has(id)) continue;
    connected.add(id);
    const track = tracks.getTrack(id);
    for (const next of [track.connections.front, track.connections.back]) if (next) pending.push(next);
  }
  assert.equal(connected.size, routeTracks.length, 'track manager connects the full trailer route');
  const layoutErrors = validateTrailerLayout(layout, terrainData, tracks, null, false);

  const station = layout.station;
  assert.equal(station.lengthCells, 13, 'station starts three blocks later while preserving its far end');
  assert.equal(station.startCell.x, layout.corridor.startX + 16);
  assert.equal(station.endCell.x, layout.corridor.startX + 4);
  const stationMinX = Math.min(station.startCell.x, station.endCell.x);
  const stationMaxX = Math.max(station.startCell.x, station.endCell.x);
  const stationCells = new Set();
  for (let x = stationMinX; x <= stationMaxX; x += 1) {
    for (let z = station.startCell.z - 1; z <= station.startCell.z + 1; z += 1) stationCells.add(`${x},${z}`);
  }
  for (let z = layout.corridor.startZ - 5; z <= layout.corridor.startZ + 5; z += 1) {
    assert.ok(!stationCells.has(`${layout.corridor.startX + layout.crossingIndex},${z}`), 'station clears road crossing');
  }

  assert.equal(parseTrailerConfig('?trailer=run').fps, 120, 'trailer defaults to 120 FPS');
  assert.equal(parseTrailerConfig('?trailer=run&fps=').fps, 120, 'empty trailer FPS defaults to 120');
  assert.equal(parseTrailerConfig('?trailer=run&fps=invalid').fps, 120, 'invalid trailer FPS defaults to 120');
  assert.equal(parseTrailerConfig('?trailer=run&fps=100').fps, 100, 'explicit trailer FPS stays configurable');
  for (const [shot, sequence] of Object.entries(createTrailerSequences(layout))) {
    for (const change of sequence.events.filter(({ action }) => action === 'environment')) {
      assert.equal(change.value, 'day', `${shot} stays at day`);
    }
  }
  console.log(`Trailer layout, route, station, day, and FPS checks passed${layoutErrors.length ? `; layout warnings: ${layoutErrors.length}` : ''}`);
} finally {
  await vite.close();
}
