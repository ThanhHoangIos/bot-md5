const brain = {
  _memory: { patterns: {}, transitions: {}, cycles: {}, longTerm: {} },
  _weights: { pattern: 1, longPattern: 1.5, transition: 0.8, cycle: 0.9, streak: 1, frequency: 0.6 },
  _lastLearn: 0,

  learn(history) {
    if (history.length < 10 || history.length === this._lastLearn) return;
    const results = history.map(item => item.outcome);
    const count = results.length;
    this._lastLearn = count;

    for (let length = 2; length <= 8; length++) {
      for (let index = 0; index + length < count; index++) {
        const key = results.slice(index, index + length).join('|');
        const next = results[index + length];
        const pattern = this._memory.patterns[key] || { T: 0, X: 0, total: 0 };
        pattern[next === 'TAI' ? 'T' : 'X']++;
        pattern.total++;
        this._memory.patterns[key] = pattern;
      }
    }

    for (let length = 8; length <= 15; length++) {
      for (let index = 0; index + length < count; index++) {
        const key = results.slice(index, index + length).join('|');
        const next = results[index + length];
        const pattern = this._memory.longTerm[key] || { T: 0, X: 0, total: 0 };
        pattern[next === 'TAI' ? 'T' : 'X']++;
        pattern.total++;
        this._memory.longTerm[key] = pattern;
      }
    }

    for (let order = 1; order <= 3; order++) {
      const orderKey = `order${order}`;
      const transitions = this._memory.transitions[orderKey] || {};
      for (let index = 0; index + order < count; index++) {
        const key = results.slice(index, index + order).join('|');
        const next = results[index + order];
        const transition = transitions[key] || { T: 0, X: 0 };
        transition[next === 'TAI' ? 'T' : 'X']++;
        transitions[key] = transition;
      }
      this._memory.transitions[orderKey] = transitions;
    }

    for (let length = 3; length <= 6; length++) {
      for (let index = 0; index + length * 2 < count; index++) {
        const first = results.slice(index, index + length).join('|');
        const second = results.slice(index + length, index + length * 2).join('|');
        if (first !== second) continue;
        const cycle = this._memory.cycles[first] || { count: 0, next: {} };
        const next = results[index + length * 2];
        cycle.count++;
        if (next) cycle.next[next] = (cycle.next[next] || 0) + 1;
        this._memory.cycles[first] = cycle;
      }
    }
  },

  analyze(history) {
    if (history.length < 10) return { score: 0, pred: null };
    this.learn(history);
    const results = history.map(item => item.outcome);
    const scores = { TAI: 0, XIU: 0 };
    const reasons = [];

    for (let length = 15; length >= 8; length--) {
      if (results.length < length) continue;
      const pattern = this._memory.longTerm[results.slice(-length).join('|')];
      if (!pattern || pattern.total < 3) continue;
      const ratio = Math.max(pattern.T, pattern.X) / pattern.total;
      if (ratio < 0.7) continue;
      const prediction = pattern.T > pattern.X ? 'TAI' : 'XIU';
      scores[prediction] += this._weights.longPattern * ratio * Math.min(pattern.total / 4, 1) * 3;
      reasons.push(`Long pattern ${length} (${Math.round(ratio * 100)}%)`);
      break;
    }

    for (let order = 3; order >= 1; order--) {
      const key = results.slice(-order).join('|');
      const transition = this._memory.transitions[`order${order}`]?.[key];
      if (!transition) continue;
      const total = transition.T + transition.X;
      if (total < 5) continue;
      const ratio = Math.max(transition.T, transition.X) / total;
      if (ratio < 0.65) continue;
      const prediction = transition.T > transition.X ? 'TAI' : 'XIU';
      scores[prediction] += this._weights.transition * (ratio - 0.5) * order;
      reasons.push(`Transition ${order} (${Math.round(ratio * 100)}%)`);
      break;
    }

    const last = results[results.length - 1];
    let streak = 1;
    for (let index = results.length - 2; index >= 0 && results[index] === last; index--) streak++;
    if (streak >= 3) {
      const prediction = last === 'TAI' ? 'XIU' : 'TAI';
      scores[prediction] += this._weights.streak * Math.min(streak / 6, 1) * 3;
      reasons.push(`Break streak ${streak}`);
    }

    const recent = results.slice(-10);
    const taiCount = recent.filter(result => result === 'TAI').length;
    if (taiCount >= 8) scores.XIU += this._weights.frequency;
    if (taiCount <= 2) scores.TAI += this._weights.frequency;

    const difference = Math.abs(scores.TAI - scores.XIU);
    if (difference < 0.8) return { score: 0, pred: null };
    const pred = scores.TAI > scores.XIU ? 'TAI' : 'XIU';
    return { score: difference * 2, pred, reason: `BrainAI: ${reasons.slice(0, 3).join(' | ')}` };
  },

  getStats() {
    return {
      patterns: Object.keys(this._memory.patterns).length,
      longPatterns: Object.keys(this._memory.longTerm).length,
      transitions: Object.keys(this._memory.transitions.order1 || {}).length,
      cycles: Object.keys(this._memory.cycles).length,
      lastLearn: this._lastLearn,
    };
  },
};

module.exports = brain;
