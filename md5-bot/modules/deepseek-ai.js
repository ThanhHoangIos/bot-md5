module.exports = {
    analyze(history) {
        if (history.length < 30) return { score: 0, pred: null };
        const recent = history.slice(-10).map(item => item.outcome);
        const tai = recent.filter(result => result === 'TAI').length;
        if (tai >= 7) return { score: 1.5, pred: 'XIU', reason: 'DeepSeek: đảo' };
        if (tai <= 3) return { score: 1.5, pred: 'TAI', reason: 'DeepSeek: đảo' };
        return { score: 0, pred: null };
    },
};
