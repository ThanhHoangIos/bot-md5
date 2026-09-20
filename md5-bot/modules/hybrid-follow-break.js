module.exports = {
    analyze(history) {
        if (history.length < 15) return { score: 0, pred: null };
        const results = history.map(item => item.outcome);
        const last = results[results.length - 1];
        let streak = 1;
        for (let index = results.length - 2; index >= 0 && results[index] === last; index--) streak++;
        if (streak === 2 || streak === 3) return { score: 2, pred: last, reason: 'Hybrid: follow' };
        if (streak >= 5) return { score: 3, pred: last === 'TAI' ? 'XIU' : 'TAI', reason: 'Hybrid: break' };
        return { score: 0, pred: null };
    },
};
