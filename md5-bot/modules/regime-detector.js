module.exports = {
  detect(history) {
    if (!Array.isArray(history) || history.length < 20) return 'unknown';

    const results = history.map(item => item.outcome);
    const last = results[results.length - 1];
    let streak = 1;
    for (let index = results.length - 2; index >= 0 && results[index] === last; index--) streak++;
    if (streak >= 4) return 'bệt';

    const recent = results.slice(-10);
    const alternating = recent.every((result, index) => index === 0 || result !== recent[index - 1]);
    if (alternating) return 'đan xen';
    return 'hỗn loạn';
  },
};
