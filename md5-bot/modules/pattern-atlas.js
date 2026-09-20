function createPatternAtlas() {
  return {
    match(text) {
      const lower = String(text || '').toLowerCase();
      let intent = 'general';
      let score = 0.42;

      if (lower.includes('xin chào') || lower.includes('hello') || lower.includes('hi')) {
        intent = 'greeting';
        score = 0.74;
      } else if (lower.includes('md5') || lower.includes('bot')) {
        intent = 'identity';
        score = 0.82;
      } else if (lower.includes('hỗ trợ') || lower.includes('help')) {
        intent = 'support';
        score = 0.77;
      }

      return { intent, score };
    },
  };
}

module.exports = { createPatternAtlas };
