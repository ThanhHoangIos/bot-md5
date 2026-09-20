module.exports = {
    analyze(history) {
        if (history.length < 11) return { score: 0, pred: null };
        const results = history.map(item => item.outcome);
        let alternating = true;
        for (let index = results.length - 10; index < results.length - 1; index++) {
            if (results[index] === results[index + 1]) { alternating = false; break; }
        }
        if (!alternating) return { score: 0, pred: null };
        const last = results[results.length - 1];
        return { score: 3, pred: last === 'TAI' ? 'XIU' : 'TAI', reason: 'Cầu 1-1' };
    },
};
