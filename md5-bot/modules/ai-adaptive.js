function createAdaptiveAI() {
  return {
    score(text, pattern) {
      const base = Math.max(0.35, Math.min(0.98, (String(text).length / 80) * 0.5 + (pattern && pattern.score ? pattern.score : 0.25)));
      return Number(base.toFixed(2));
    },
  };
}

module.exports = { createAdaptiveAI };
