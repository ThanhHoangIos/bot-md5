const assert = require('assert');
const engine = require('./md5-bot/modules/strategy-engine');

function historyFrom(outcomes, prediction = 'TAI') {
  return outcomes.map((outcome, index) => ({
    outcome,
    pred: prediction,
    rawPrediction: prediction,
    normalPrediction: prediction,
    reversePrediction: prediction === 'TAI' ? 'XIU' : 'TAI',
    strategyPredictions: Object.fromEntries(engine.STRATEGY_NAMES.map(name => [name, prediction])),
    sessionId: String(index + 1),
  }));
}

const warmup = engine.analyze([], {});
assert.ok(warmup.pred === 'TAI' || warmup.pred === 'XIU');
assert.strictEqual(warmup.mode, 'Forced Prediction');

const alternating = engine.analyze(historyFrom(['TAI', 'XIU', 'TAI', 'XIU', 'TAI', 'XIU'], 'TAI'), {});
assert.ok(alternating.strategyPredictions.MARKOV_TRANSITION);
assert.ok(alternating.strategyPredictions.CONDITIONAL_SUM);
assert.ok(alternating.pred === 'TAI' || alternating.pred === 'XIU');

const conditionalHistory = [];
for (let index = 0; index < 12; index++) {
  conditionalHistory.push({ sum: 7, outcome: 'TAI' });
  conditionalHistory.push({ sum: 12, outcome: 'XIU' });
}
const conditional = engine.analyze(conditionalHistory, {});
assert.strictEqual(conditional.strategyPredictions.CONDITIONAL_SUM, 'TAI');

const losses = historyFrom(Array.from({ length: 20 }, () => 'TAI'), 'XIU');
const recovery = engine.analyze(losses, {});
assert.strictEqual(recovery.recovery_mode, true);
assert.ok(recovery.display_confidence <= 58);
assert.ok(recovery.anti_tai >= 0 && recovery.anti_xiu >= 0);

const stats = engine.getStrategyStats(losses, 'FOLLOW_LAST', 20);
assert.strictEqual(stats.total, 20);
assert.strictEqual(stats.win_rate, 0);

console.log('strategy-engine ok');
