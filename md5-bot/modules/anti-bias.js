function createAntiBias() {
  return {
    filter(text) {
      return String(text || '')
        .replace(/\s+/g, ' ')
        .trim();
    },
  };
}

module.exports = { createAntiBias };
