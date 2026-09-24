import assert from 'node:assert/strict';
import { createServer } from 'vite';

const atlasStub = {
  name: 'atlas-test-stub',
  enforce: 'pre',
  resolveId: (source) => source.endsWith('/utils/atlasTextures.js') ? '\0atlas-test-stub' : null,
  load: (id) => id === '\0atlas-test-stub'
    ? 'import * as THREE from "three"; export const makeAtlasMaterial = () => new THREE.MeshBasicMaterial();'
    : null,
};
const vite = await createServer({
  configFile: false,
  plugins: [atlasStub],
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  const { RoadManager } = await vite.ssrLoadModule('/src/environment/roadNetwork.js');
  const makeRoads = () => {
    const roads = new RoadManager();
    roads.length = roads.breadth = 20;
    roads.addRoad({ x: 0, y: 0.25, z: -0.5 }, 0);
    roads.addRoad({ x: 0, y: 0.25, z: 0 }, 0);
    return roads;
  };
  const inner = makeRoads();
  inner.addRoad({ x: -0.5, y: 0.25, z: 0 }, 0);
  const middle = inner.findRoadAtPosition({ x: 0, y: 0.25, z: 0 }, 0.1);
  assert.equal(middle.id, inner.userRoads[1].id, 'middle tile targets its own id');
  assert.equal(middle.center.z, 0, 'delete ghost uses placed tile center');
  assert.equal(inner.layout.lamps.length, 0, 'adjacent tile at lamp segment removes inner lamp');
  const outer = makeRoads();
  outer.addRoad({ x: 0.5, y: 0.25, z: 0 }, 0);
  assert.equal(outer.layout.lamps.length, 1, 'outer lamp remains beside paired tiles');
  assert.ok(outer.layout.lamps[0].x < 0, 'remaining lamp faces away from neighboring tile');

  const { SignalManager } = await vite.ssrLoadModule('/src/signals/SignalManager.js');
  const trackManager = { tracks: new Map() };
  const signals = new SignalManager(trackManager);
  const terrainData = {
    length: 20,
    breadth: 20,
    heightMap: Array.from({ length: 20 }, () => Array(20).fill(0)),
  };
  trackManager.tracks.set('ground', {
    id: 'ground', type: 'straight', position: { x: 0, y: 0.27, z: 0 }, rotation: 0,
    heightOffset: 0, connections: { front: null, back: null },
  });
  trackManager.tracks.set('bridge', {
    id: 'bridge', type: 'straight', position: { x: 1, y: 0.77, z: 0 }, rotation: 0,
    heightOffset: 0.5, connections: { front: null, back: null },
  });
  assert.ok(signals._create('ground', 0.5, 1, 'two', true, terrainData), 'ground track keeps auto signal');
  assert.equal(signals._create('bridge', 0.5, 1, 'two', true, terrainData), null, 'bridge skips auto signal');
  console.log('Road lamp and signal checks passed');
} finally {
  await vite.close();
}
