import assert from 'node:assert/strict';
import * as THREE from 'three';
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
  const { buildOverheadLine } = await vite.ssrLoadModule('/src/tracks/OverheadLine.jsx');
  const tracks = [
    {
      id: 'curve', type: 'curved', position: { x: 0, y: 0, z: 0 }, rotation: Math.PI / 2,
      connections: { front: 'straight', back: null },
    },
    {
      id: 'straight', type: 'straight', position: { x: 0.25, y: 0, z: -0.25 }, rotation: 0,
      connections: { front: 'curve', back: null },
    },
  ];
  const group = buildOverheadLine(tracks);
  const [curveGantry, straightGantry] = group.children;
  const curveSide = new THREE.Vector3(1, 0, 0).applyEuler(curveGantry.rotation);
  const straightSide = new THREE.Vector3(1, 0, 0).applyEuler(straightGantry.rotation);

  assert.ok(Math.abs(curveGantry.rotation.y - Math.PI / 4) < 1e-6, 'curve gantry follows chain toward its front');
  assert.ok(Math.abs(Math.abs(straightGantry.rotation.y) - Math.PI) < 1e-6, 'front-to-front straight gantry faces back along chain');
  assert.ok(Math.abs(curveSide.x - Math.SQRT1_2) < 1e-6 && Math.abs(curveSide.z + Math.SQRT1_2) < 1e-6,
    'curve contact-wire sides follow its rotated chain direction');
  assert.ok(straightSide.x < -0.99, 'straight contact-wire sides reverse with its chain direction');
  console.log('Overhead wire alignment check passed');
} finally {
  await vite.close();
}
