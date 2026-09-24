import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true },
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  const { TrainManager } = await vite.ssrLoadModule('/src/trains/TrainManager.js');
  const tracks = new Map();
  for (let i = -7; i <= 7; i++) {
    tracks.set(`track_${i}`, {
      id: `track_${i}`,
      type: 'straight',
      position: { x: 0, y: 0, z: i * 0.5 },
      rotation: 0,
      connections: {
        back: i > -7 ? `track_${i - 1}` : null,
        front: i < 7 ? `track_${i + 1}` : null,
      },
    });
  }

  const manager = new TrainManager({ tracks });
  const train = manager.addTrain('track_0', 1);
  manager.addCoach(train.id, 'passenger-coach');
  manager.addCoach(train.id, 'goods-coach');
  const oldEngineZ = train.position.z;
  const oldTailZ = train.coaches.at(-1).position.z;
  manager.reverseTrain(train.id);

  assert.ok(Math.abs(train.position.z - oldTailZ) < 0.03, 'engine shifts to old tail');
  assert.ok(train.heading.z < -0.99, 'engine faces reverse direction');
  assert.equal(train.coachDirection, -1);
  assert.ok(Math.abs(train.coaches.at(-1).position.z - oldEngineZ) < 0.03, 'last coach reaches old engine position');
  assert.ok(Math.abs(train.coaches[0].position.z - train.position.z - train.coaches[0].spacing) < 0.03, 'first coach stays coupled');

  for (const direction of [1, -1]) {
    const autoManager = new TrainManager({ tracks });
    const endId = direction > 0 ? 'track_7' : 'track_-7';
    const automatic = autoManager.addTrain(endId, direction);
    autoManager.addCoach(automatic.id, 'passenger-coach');
    automatic.active = true;
    for (let frame = 0; frame < 100 && automatic.currentTrackId === endId; frame++) autoManager.update(0.1);
    assert.notEqual(automatic.currentTrackId, endId, 'train moves away from dead end');
    assert.equal(Math.sign(automatic.heading.z), -direction, 'whole consist auto-reverses at either end');
    assert.ok(direction * (automatic.coaches[0].position.z - automatic.position.z) > 0,
      'coach stays behind reversed engine');
  }

  console.log('Train reversal check passed');
} finally {
  await vite.close();
}
