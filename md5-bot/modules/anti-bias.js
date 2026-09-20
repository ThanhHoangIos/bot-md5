module.exports = {
    analyze(history) {
        if (history.length < 20) return { score: 0, pred: null };
        const recent = history.slice(-20).map(item => item.outcome);
        const tai = recent.filter(result => result === 'TAI').length;
        const xiu = recent.length - tai;
        if (tai >= 14) return { score: 2, pred: 'XIU', reason: 'Anti-bias: Tài đông' };
        if (xiu >= 14) return { score: 2, pred: 'TAI', reason: 'Anti-bias: Xỉu đông' };
        return { score: 0, pred: null };
    },
};
