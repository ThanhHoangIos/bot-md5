module.exports = {
  detect(text) {
    return text.toLowerCase().includes('ngủ') ? 'sleep' : 'normal';
  },
};
