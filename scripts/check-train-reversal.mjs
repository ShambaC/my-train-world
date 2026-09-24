import assert from 'node:assert/strict';
import { register } from 'node:module';

const extensionLoader = `
export async function resolve(specifier, context, nextResolve) {
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && !/\\.[a-z]+$/i.test(specifier)) return nextResolve(specifier + '.js', context);
    throw error;
  }
}`;
register(`data:text/javascript,${encodeURIComponent(extensionLoader)}`, import.meta.url);

const { TrainManager } = await import('../src/trains/TrainManager.js');
const tracks = new Map();
for (let i = 0; i < 10; i++) tracks.set(`track_${i}`, {
  id: `track_${i}`,
  type: 'straight',
  position: { x: 0, y: 0, z: i * 0.5 },
  rotation: 0,
  connections: { back: i ? `track_${i - 1}` : null, front: i < 9 ? `track_${i + 1}` : null },
});

const manager = new TrainManager({ tracks });
const train = manager.addTrain('track_9');
const coach = manager.addCoach(train.id, 'passenger-coach');
const beforeManualReverse = { ...coach.position };
manager.reverseTrain(train.id);
assert.deepEqual(coach.position, beforeManualReverse, 'manual reversal keeps coach position');

manager.reverseTrain(train.id);
manager.setTrainActive(train.id, true);
let beforeAutoReverse;
for (let i = 0; i < 600 && train.heading.z > 0; i++) {
  beforeAutoReverse = { ...coach.position };
  manager.update(1 / 60);
}
assert.ok(train.heading.z < 0, 'consist auto-reverses at a dead end');
assert.ok(coach.position.z < train.position.z - 0.2, 'coach stays on its original side');
assert.ok(Math.abs(coach.position.z - beforeAutoReverse.z) < 0.1, 'coach does not jump across the engine');

const legacy = manager.restoreTrain({
  id: 'train_legacy', currentTrackId: 'track_5', progress: 0.5, speed: 0, speedMax: 0.5,
  heading: { x: 0, z: -1 }, position: { x: 0, y: 0, z: 2.5 },
  coaches: [{ id: 'old_coach', type: 'passenger-coach', spacing: 1.21 }],
});
assert.equal(legacy.coachDirection, -1, 'legacy saves derive consist direction from engine heading');
console.log('Coach reversal checks passed');
