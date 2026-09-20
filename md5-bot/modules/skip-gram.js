module.exports = {
    analyze(history) {
        if (history.length < 15) return { score: 0, pred: null };
        const results = history.map(h => h.outcome);
        const n = results.length;
        const last = results[n - 1];
        let same = 0, diff = 0;
        for (let i = 0; i < n - 2; i++) {
            if (results[i] === last) {
                if (results[i + 1] === last) same++;
                else diff++;
            }
        }
        if (same + diff >= 4) {
            if (diff > same * 1.5) return { score: 1.5, pred: last === 'TAI' ? 'XIU' : 'TAI', reason: 'Skip-gram: đảo' };
            if (same > diff * 1.5) return { score: 1.5, pred: last, reason: 'Skip-gram: follow' };
        }
        return { score: 0, pred: null };
    }
};
