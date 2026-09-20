const assert = require('assert');
const bank = require('./md5-bot/modules/expanded-cau-bank');

const history = [
  { outcome: 'TAI' }, { outcome: 'TAI' }, { outcome: 'TAI' },
  { outcome: 'TAI' }, { outcome: 'TAI' }, { outcome: 'XIU' },
  { outcome: 'XIU' }, { outcome: 'XIU' }, { outcome: 'XIU' },
  { outcome: 'XIU' }
];

const result = bank.analyze(history);
assert.ok(result && typeof result.pred === 'string', 'should return a prediction');
assert.ok(['TAI', 'XIU'].includes(result.pred), 'prediction must be TAI or XIU');
console.log('expanded-cau-bank ok:', result);
