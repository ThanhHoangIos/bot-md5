module.exports = {
    analyze(history) {
        if (history.length < 20) return { score: 0, pred: null };
        const recent = history.slice(-20).map(item => item.outcome === 'TAI' ? 1 : 0);
        const mean = recent.reduce((total, value) => total + value, 0) / recent.length;
        if (mean > 0.65) return { score: 2, pred: 'XIU', reason: `Logit: Tài ${(mean * 100).toFixed(0)}%` };
        if (mean < 0.35) return { score: 2, pred: 'TAI', reason: `Logit: Xỉu ${((1 - mean) * 100).toFixed(0)}%` };
        return { score: 0, pred: null };
    },
};
