const brain = {
  _memory: { patterns: {}, transitions: {}, cycles: {}, longTerm: {} },
    _performance: { total: 0, hits: 0, misses: 0, recent: [] },
    _weights: { pattern: 1.0, longPattern: 1.5, transition: 0.9, cycle: 0.8, streak: 1.1, frequency: 0.7 },
    _lastLearn: 0,

    updateWeights() {
        const total = this._performance.total || 1;
        const hitRate = this._performance.hits / total;
        const missRate = this._performance.misses / total;

        if (hitRate > 0.6) {
            this._weights.pattern *= 1.05;
            this._weights.longPattern *= 1.05;
            this._weights.transition *= 1.04;
        }
        if (missRate > 0.45) {
            this._weights.pattern *= 0.95;
            this._weights.streak *= 0.96;
            this._weights.frequency *= 0.97;
        }
        this._weights.pattern = Math.max(0.6, Math.min(1.8, this._weights.pattern));
        this._weights.longPattern = Math.max(0.9, Math.min(2.4, this._weights.longPattern));
        this._weights.transition = Math.max(0.5, Math.min(1.6, this._weights.transition));
        this._weights.streak = Math.max(0.7, Math.min(1.8, this._weights.streak));
        this._weights.frequency = Math.max(0.4, Math.min(1.2, this._weights.frequency));
    },

    recordFeedback(prediction, actual) {
        if (!prediction || !actual) return;
        this._performance.total += 1;
        if (prediction === actual) this._performance.hits += 1;
        else this._performance.misses += 1;
        this._performance.recent.push({ prediction, actual, ok: prediction === actual });
        if (this._performance.recent.length > 40) this._performance.recent.shift();
        this.updateWeights();
    },

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
        const reliability = this._performance.total > 0 ? Math.max(0.6, this._performance.hits / (this._performance.total || 1)) : 0.7;

        for (let length = 15; length >= 8; length--) {
            if (results.length < length) continue;
            const key = results.slice(-length).join('|');
            const pattern = this._memory.longTerm[key];
            if (!pattern || pattern.total < 3) continue;
            const ratio = Math.max(pattern.T, pattern.X) / pattern.total;
            if (ratio < 0.7) continue;
            const prediction = pattern.T > pattern.X ? 'TAI' : 'XIU';
            scores[prediction] += this._weights.longPattern * ratio * Math.min(pattern.total / 4, 1) * 3 * reliability;
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
            scores[prediction] += this._weights.transition * (ratio - 0.5) * order * reliability;
            reasons.push(`Transition ${order} (${Math.round(ratio * 100)}%)`);
            break;
        }

        const last = results[results.length - 1];
        let streak = 1;
        for (let index = results.length - 2; index >= 0 && results[index] === last; index--) streak++;
        if (streak >= 3) {
            const prediction = last === 'TAI' ? 'XIU' : 'TAI';
            scores[prediction] += this._weights.streak * Math.min(streak / 6, 1) * 3 * reliability;
            reasons.push(`Break streak ${streak}`);
        }

        const recent = results.slice(-10);
        const taiCount = recent.filter(result => result === 'TAI').length;
        if (taiCount >= 8) scores.XIU += this._weights.frequency * reliability;
        if (taiCount <= 2) scores.TAI += this._weights.frequency * reliability;

        const difference = Math.abs(scores.TAI - scores.XIU);
        if (difference < 1.2) return { score: 0, pred: null };
        const pred = scores.TAI > scores.XIU ? 'TAI' : 'XIU';
        return {
            score: Number((difference * 2).toFixed(2)),
            pred,
            reason: `BrainAI: ${reasons.slice(0, 3).join(' | ') || 'data confidence'}`,
        };
    },

    getStats() {
        return {
            patterns: Object.keys(this._memory.patterns).length,
            longPatterns: Object.keys(this._memory.longTerm).length,
            transitions: Object.keys(this._memory.transitions.order1 || {}).length,
            cycles: Object.keys(this._memory.cycles).length,
            lastLearn: this._lastLearn,
            reliability: this._performance.total > 0 ? (this._performance.hits / this._performance.total) : 0,
        };
    },

    generateBrainReply(text) {
        return `Brain AI reply for: ${text}`;
    },
};

module.exports = brain;
