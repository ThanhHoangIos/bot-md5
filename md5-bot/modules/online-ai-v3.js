module.exports = {
    analyze(history) {
        if (history.length < 25) return { score: 0, pred: null };
        const recent = history.slice(-25).map(item => item.outcome === 'TAI' ? 1 : 0);
        let weights = 0;
        let sum = 0;
        recent.forEach((value, index) => { weights += index + 1; sum += value * (index + 1); });
        const average = sum / weights;
        if (average > 0.65) return { score: 1.5, pred: 'XIU', reason: 'Online AI: đảo' };
        if (average < 0.35) return { score: 1.5, pred: 'TAI', reason: 'Online AI: đảo' };
        return { score: 0, pred: null };
    },
};
