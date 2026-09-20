function createSmartBreakV2() {
  return {
    shouldBreak(text, confidence) {
      const length = String(text || '').length;
      return length > 30 && Number(confidence) > 0.6;
    },
  };
}

module.exports = { createSmartBreakV2 };
