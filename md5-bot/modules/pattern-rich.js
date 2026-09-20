module.exports = {
    analyze(history) {
        if (history.length < 20) return { score: 0, pred: null };
        const results = history.map(h => h.outcome);
        let last5 = results.slice(-5).join('');
        let count = 0, tai = 0;
        for (let i = 0; i <= results.length - 6; i++) {
            if (results.slice(i, i + 5).join('') === last5) {
                count++;
                if (results[i + 5] === 'TAI') tai++;
            }
        }
        if (count >= 3) {
            const ratio = tai / count;
            if (ratio > 0.7) return { score: 2, pred: 'TAI', reason: `Pattern-rich TAI ${(ratio*100).toFixed(0)}%` };
            if (ratio < 0.3) return { score: 2, pred: 'XIU', reason: `Pattern-rich XIU ${((1-ratio)*100).toFixed(0)}%` };
        }
        return { score: 0, pred: null };
    }
};
