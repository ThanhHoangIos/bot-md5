module.exports = {
    analyze(history) {
        if (history.length < 5) return { score: 0, pred: null };
        const results = history.map(item => item.outcome);
        const last = results[results.length - 1];
        let streak = 1;
        for (let index = results.length - 2; index >= 0 && results[index] === last; index--) streak++;
        if (streak >= 4) return { score: 3 + Math.min(streak, 6), pred: last === 'TAI' ? 'XIU' : 'TAI', reason: `Bệt ${streak}` };
        return { score: 0, pred: null };
    },
};
