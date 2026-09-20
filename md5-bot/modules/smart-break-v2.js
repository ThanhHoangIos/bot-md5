module.exports = {
    analyze(history) {
        if (history.length < 8) return { score: 0, pred: null };
        const results = history.map(item => item.outcome);
        const last = results[results.length - 1];
        let streak = 1;
        for (let index = results.length - 2; index >= 0 && results[index] === last; index--) streak++;
        if (streak >= 3 && streak <= 5) return { score: 2, pred: last === 'TAI' ? 'XIU' : 'TAI', reason: `Smart Break: ${streak}` };
        return { score: 0, pred: null };
    },
};
