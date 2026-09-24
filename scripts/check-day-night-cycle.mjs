import assert from 'node:assert/strict';
import { createServer } from 'vite';

const atlasStub = {
  name: 'atlas-test-stub',
  enforce: 'pre',
  resolveId: (source) => source.endsWith('/utils/atlasTextures.js') ? '\0atlas-test-stub' : null,
  load: (id) => id === '\0atlas-test-stub' ? 'export const getStyleTexture = () => null;' : null,
};
const vite = await createServer({
  configFile: false,
  plugins: [atlasStub],
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
});
try {
  const { default: LightingState } = await vite.ssrLoadModule('/src/environment/LightingState.js');
  const lighting = new LightingState('dawn');
  const dawnColor = lighting.sun.color.clone();
  const dawnPosition = lighting.sun.position.clone();
  lighting.updateCycle('dawn', 0.25);
  assert.ok(lighting.sun.color.equals(dawnColor), 'first half keeps light color');
  assert.ok(!lighting.sun.position.equals(dawnPosition), 'sun moves during first half');
  assert.equal(lighting.cycleBlend, 0);
  lighting.updateCycle('dawn', 0.75);
  assert.ok(!lighting.sun.color.equals(dawnColor), 'second half blends light color');
  assert.equal(lighting.cycleBlend, 0.5);
  lighting.updateCycle('dawn', 1);
  const day = new LightingState('day');
  assert.ok(lighting.sun.color.equals(day.sun.color), 'segment ends at next preset');
  assert.ok(lighting.sun.position.equals(day.sun.position), 'sun reaches next position');
  console.log('Day-night cycle check passed');
} finally {
  await vite.close();
}
