module.exports = {
    analyze(history) {
        if (history.length < 20) return { score: 0, pred: null };
        const results = history.map(item => item.outcome);
        const patterns = {};
        for (let length = 3; length <= 5; length++) {
            for (let index = 0; index + length < results.length; index++) {
                const key = results.slice(index, index + length).join('|');
                const next = results[index + length];
                const pattern = patterns[key] || { T: 0, X: 0 };
                pattern[next === 'TAI' ? 'T' : 'X']++;
                patterns[key] = pattern;
            }
        }
        const pattern = patterns[results.slice(-3).join('|')];
        if (!pattern) return { score: 0, pred: null };
        const total = pattern.T + pattern.X;
        const ratio = Math.max(pattern.T, pattern.X) / total;
        if (total >= 3 && ratio > 0.7) return { score: 2 + ratio * 2, pred: pattern.T > pattern.X ? 'TAI' : 'XIU', reason: 'Pattern Atlas' };
        return { score: 0, pred: null };
    },
};
