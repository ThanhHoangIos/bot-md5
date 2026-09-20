const BANK = {
  bệt: [
    'TTTTTT', 'XXXXXX',
    'TTT', 'XXX',
    'TT', 'XX',
    'T', 'X',
  ],
  nhịp: {
    '1-1': 'TXTXTX',
    '2-2': 'TTXXTTXX',
    '3-3': 'TTTXXXTTTXXX',
    '4-4': 'TTTTXXXX',
    '1-2': 'TXXTXX',
    '2-1': 'TTXTTX',
    '1-3': 'TXXXTXXX',
    '3-1': 'TTTXTTTX',
    '2-3': 'TTXXXTTXXX',
    '3-2': 'TTTXXXTTTXXX',
  },
  special: [
    'TXXT', 'TXTX', 'TTXX', 'XXTT',
    'TXXXT', 'XTTTX', 'TTTXX', 'XXTTT',
    'TXXXTXXX', 'XXXTXXXT', 'TTTXXTXX'
  ],
};

function toBinary(history) {
  return history.map(item => item && item.outcome ? (item.outcome === 'TAI' ? 1 : 0) : 0);
}

function encodeRunLength(bits) {
  const out = [];
  if (!bits.length) return out;
  let cur = bits[0];
  let count = 1;
  for (let i = 1; i < bits.length; i++) {
    if (bits[i] === cur) count++;
    else {
      out.push(count);
      cur = bits[i];
      count = 1;
    }
  }
  out.push(count);
  return out;
}

function createPatternFromRuns(runs) {
  if (!runs.length) return null;
  const units = [];
  for (const run of runs) {
    units.push(run > 1 ? String(run) : '1');
  }
  return units.join('-');
}

function scoreStreak(bits) {
  let longest = 1;
  let current = 1;
  for (let i = 1; i < bits.length; i++) {
    if (bits[i] === bits[i - 1]) current++;
    else current = 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

function detectAlternation(bits) {
  if (bits.length < 4) return null;
  const first = bits[0];
  let ok = true;
  for (let i = 1; i < bits.length; i++) {
    if (bits[i] === bits[i - 1]) {
      ok = false;
      break;
    }
  }
  return ok ? { pred: first === 1 ? 'TAI' : 'XIU', score: 2.2, reason: '1-1 / xen kẽ' } : null;
}

function detectLongRun(bits) {
  const longest = scoreStreak(bits);
  if (longest >= 4) {
    const head = bits[0] || 0;
    return {
      pred: head === 1 ? 'TAI' : 'XIU',
      score: Math.min(3.5, 2 + longest * 0.35),
      reason: `bệt ${longest}`,
    };
  }
  return null;
}

function detectPatternByRuns(bits) {
  const runs = encodeRunLength(bits);
  const pattern = createPatternFromRuns(runs);
  if (!pattern) return null;

  const lookup = {
    '1-1': { pred: bits[0] === 1 ? 'TAI' : 'XIU', score: 2.4, reason: 'mẫu 1-1' },
    '2-2': { pred: bits[0] === 1 ? 'TAI' : 'XIU', score: 2.5, reason: 'mẫu 2-2' },
    '3-3': { pred: bits[0] === 1 ? 'TAI' : 'XIU', score: 2.6, reason: 'mẫu 3-3' },
    '4-4': { pred: bits[0] === 1 ? 'TAI' : 'XIU', score: 2.7, reason: 'mẫu 4-4' },
    '1-2': { pred: bits[0] === 1 ? 'TAI' : 'XIU', score: 2.3, reason: 'mẫu 1-2' },
    '2-1': { pred: bits[0] === 1 ? 'TAI' : 'XIU', score: 2.3, reason: 'mẫu 2-1' },
    '1-3': { pred: bits[0] === 1 ? 'TAI' : 'XIU', score: 2.3, reason: 'mẫu 1-3' },
    '3-1': { pred: bits[0] === 1 ? 'TAI' : 'XIU', score: 2.3, reason: 'mẫu 3-1' },
    '2-3': { pred: bits[0] === 1 ? 'TAI' : 'XIU', score: 2.3, reason: 'mẫu 2-3' },
    '3-2': { pred: bits[0] === 1 ? 'TAI' : 'XIU', score: 2.3, reason: 'mẫu 3-2' },
  };

  if (lookup[pattern]) return lookup[pattern];

  if (runs.length >= 3 && runs[0] === runs[2] && runs[1] === runs[3]) {
    return { pred: bits[0] === 1 ? 'TAI' : 'XIU', score: 2.1, reason: 'đối xứng nhịp' };
  }
  return null;
}

function detectTrend(bits) {
  if (bits.length < 5) return null;
  const recent = bits.slice(-5);
  const taixiu = recent.reduce((sum, bit) => sum + bit, 0);
  if (recent.every(v => v === 1)) return { pred: 'TAI', score: 2.0, reason: 'xu hướng TAI' };
  if (recent.every(v => v === 0)) return { pred: 'XIU', score: 2.0, reason: 'xu hướng XIU' };
  if (taixiu >= 3) return { pred: 'TAI', score: 1.7, reason: 'dốc TAI' };
  if (taixiu <= 2) return { pred: 'XIU', score: 1.7, reason: 'dốc XIU' };
  return null;
}

module.exports = {
  BANK,
  analyze(history) {
    if (!Array.isArray(history) || history.length < 4) {
      return { score: 0, pred: null, reason: 'chưa đủ dữ liệu cho bank mẫu cầu' };
    }

    const bits = toBinary(history);
    const cue = detectAlternation(bits)
      || detectLongRun(bits)
      || detectPatternByRuns(bits)
      || detectTrend(bits);

    if (!cue) {
      return { score: 0, pred: null, reason: 'không khớp mẫu cầu mở rộng' };
    }

    return {
      score: cue.score,
      pred: cue.pred,
      reason: `${cue.reason} | bank mở rộng`,
      bank: BANK,
      sample: bits.slice(-12),
    };
  },

  getBank() {
    return BANK;
  },

  getStats() {
    return {
      groups: Object.keys(BANK).length,
      totalPatterns: Object.values(BANK).reduce((sum, item) => sum + (Array.isArray(item) ? item.length : Object.keys(item).length), 0),
    };
  },
};
