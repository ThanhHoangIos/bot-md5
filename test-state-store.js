const assert = require('assert');
const store = require('./md5-bot/modules/state-store');

const merged = store.mergeHistory(
  [{ sessionId: '1', outcome: 'TAI', pred: 'XIU' }],
  [{ sessionId: '1', outcome: 'TAI', strategyPredictions: { FOLLOW_LAST: 'TAI' } }, { sessionId: '2', outcome: 'XIU' }]
);

assert.strictEqual(merged.length, 2);
assert.strictEqual(merged[0].pred, 'XIU');
assert.deepStrictEqual(merged[0].strategyPredictions, { FOLLOW_LAST: 'TAI' });

const state = store.mergeStates([
  { history: [{ sessionId: '1' }], stats: { total: 1 } },
  { history: [{ sessionId: '2' }], stats: { total: 2 }, strategyState: { champion: 'MARKOV_TRANSITION' } },
], 2000);
assert.strictEqual(state.history.length, 2);
assert.strictEqual(state.stats.total, 2);
assert.strictEqual(state.strategyState.champion, 'MARKOV_TRANSITION');

console.log('state-store ok');
