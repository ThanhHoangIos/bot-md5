const model = {
  _memory: { short: {}, long: {} },
  _lastLearn: 0,

  learn(history) {
    if (history.length < 10 || history.length === this._lastLearn) return;
    const results = history.map(item => item.outcome);
    for (let length = 2; length <= 5; length++) {
      for (let index = 0; index + length < results.length; index++) {
        const key = results.slice(index, index + length).join('|');
        const next = results[index + length];
        const pattern = this._memory.short[key] || { T: 0, X: 0, total: 0 };
        pattern[next === 'TAI' ? 'T' : 'X']++;
        pattern.total++;
        this._memory.short[key] = pattern;
      }
    }
    for (let length = 6; length <= 15; length++) {
      for (let index = 0; index + length < results.length; index++) {
        const key = results.slice(index, index + length).join('|');
        const next = results[index + length];
        const pattern = this._memory.long[key] || { T: 0, X: 0, total: 0 };
        pattern[next === 'TAI' ? 'T' : 'X']++;
        pattern.total++;
        this._memory.long[key] = pattern;
      }
    }
    this._lastLearn = results.length;
  },

  analyze(history) {
    if (history.length < 10) return { score: 0, pred: null };
    this.learn(history);
    const results = history.map(item => item.outcome);
    for (let length = 15; length >= 2; length--) {
      const key = results.slice(-length).join('|');
      const pattern = (length >= 6 ? this._memory.long : this._memory.short)[key];
      if (!pattern || pattern.total < 2) continue;
      const ratio = Math.max(pattern.T, pattern.X) / pattern.total;
      if (ratio >= 0.7) return { score: length >= 6 ? 3 : 2, pred: pattern.T > pattern.X ? 'TAI' : 'XIU', reason: `Cầu ${length} ván` };
    }
    return { score: 0, pred: null };
  },

  getStats() {
    return { short: Object.keys(this._memory.short).length, long: Object.keys(this._memory.long).length, lastLearn: this._lastLearn };
  },
};

module.exports = model;
