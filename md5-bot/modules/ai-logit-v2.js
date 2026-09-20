function createLogitV2AI() {
  return {
    generate({ text, intent, confidence, shouldBreak }) {
      const summary = intent || 'general';
      const status = shouldBreak ? 'tối ưu hóa độ dài / nhịp' : 'giữ phản hồi tự nhiên';
      return `MD5 Bot: intent=${summary}, confidence=${confidence}, mode=${status}. Context: ${text}`;
    },
  };
}

module.exports = { createLogitV2AI };
