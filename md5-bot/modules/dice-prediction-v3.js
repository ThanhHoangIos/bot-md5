'use strict';

/*
 * DICE PREDICTION V3
 * -------------------
 * Phan tich Tai/Xiu, tong, tung vien xuc xac, parity,
 * transition, bit va cau truc cho toan bo 216 bo xuc xac.
 */

const CONFIG = {
  minHistory: 10,
  windows: { short: 20, medium: 50, long: 100 },
  topK: 5,
  weights: {
    dicePosition: 0.15,
    diceTransition: 0.12,
    exactDice: 0.08,
    totalTransition: 0.15,
    totalPattern: 0.12,
    parity: 0.15,
    bit: 0.13,
    structure: 0.10
  },
  smoothing: 1
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeDice(dice) {
  if (!Array.isArray(dice) || dice.length < 3) return null;
  const values = dice.slice(0, 3).map(value => safeNumber(value, NaN));
  if (values.some(value => !Number.isInteger(value) || value < 1 || value > 6)) return null;
  return values;
}

function normalizeRound(round) {
  if (!round || typeof round !== 'object') return null;

  const dice = normalizeDice(round.dice) || normalizeDice(round.Dice);
  let sum = safeNumber(
    round.sum ?? round.Sum ?? round.total ?? round.Total,
    NaN
  );

  if (dice) sum = dice[0] + dice[1] + dice[2];
  if (!dice && (!Number.isFinite(sum) || sum < 3 || sum > 18)) return null;

  const outcome = String(round.outcome ?? round.KetQua ?? round.result ?? '').toUpperCase();
  const finalOutcome = outcome === 'TAI' || outcome === 'TÀI'
    ? 'TAI'
    : outcome === 'XIU' || outcome === 'XỈU'
      ? 'XIU'
      : classifyTotal(sum);

  return { dice, sum, outcome: finalOutcome };
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.map(normalizeRound).filter(Boolean);
}

function classifyTotal(total) {
  return total >= 11 ? 'TAI' : 'XIU';
}

function parity(value) {
  return value % 2 === 0 ? 'C' : 'L';
}

function parityPattern(dice) {
  return dice.map(parity).join('');
}

function countEven(dice) {
  return dice.filter(value => value % 2 === 0).length;
}

function parityTransitions(history) {
  const map = { CC: 0, CL: 0, LC: 0, LL: 0 };
  for (let index = 1; index < history.length; index++) {
    const key = parity(history[index - 1].sum) + parity(history[index].sum);
    map[key]++;
  }
  return map;
}

function parityPatternFrequency(history) {
  const map = {};
  for (const round of history) {
    if (!round.dice) continue;
    const pattern = parityPattern(round.dice);
    map[pattern] = (map[pattern] || 0) + 1;
  }
  return map;
}

function parityScore(candidate, history, config = CONFIG) {
  if (!history.length) return 0.5;
  let score = 0;
  let totalWeight = 0;
  const patternFreq = parityPatternFrequency(history);
  const maxPattern = Math.max(...Object.values(patternFreq), 1);
  score += ((patternFreq[parityPattern(candidate)] || 0) / maxPattern) * 0.45;
  totalWeight += 0.45;

  const last = history[history.length - 1];
  if (last) {
    const lastParity = parity(last.sum);
    const transitions = parityTransitions(history);
    const key = lastParity + parity(candidate[0] + candidate[1] + candidate[2]);
    const sameFrom = Object.entries(transitions)
      .filter(([transition]) => transition.startsWith(lastParity))
      .reduce((sum, [, value]) => sum + value, 0);
    score += (sameFrom ? (transitions[key] || 0) / sameFrom : 0.5) * 0.35;
    totalWeight += 0.35;
  }

  const evenCounts = {};
  for (const round of history) {
    if (!round.dice) continue;
    const count = countEven(round.dice);
    evenCounts[count] = (evenCounts[count] || 0) + 1;
  }
  const maxEven = Math.max(...Object.values(evenCounts), 1);
  score += ((evenCounts[countEven(candidate)] || 0) / maxEven) * 0.20;
  totalWeight += 0.20;
  return clamp(score / totalWeight, 0, 1);
}

function dicePositionScore(candidate, history, config = CONFIG) {
  if (!history.length) return 0.5;
  let total = 0;
  let count = 0;
  for (let position = 0; position < 3; position++) {
    const frequency = Array(7).fill(0);
    for (const round of history) if (round.dice) frequency[round.dice[position]]++;
    const sum = frequency.slice(1).reduce((a, b) => a + b, 0);
    if (sum > 0) {
      total += (frequency[candidate[position]] + config.smoothing) / (sum + 6 * config.smoothing);
      count++;
    }
  }
  return count ? clamp(total / count, 0, 1) : 0.5;
}

function diceTransitionScore(candidate, history, config = CONFIG) {
  if (history.length < 2 || !history[history.length - 1].dice) return 0.5;
  const last = history[history.length - 1];
  let total = 0;
  for (let position = 0; position < 3; position++) {
    const counts = Array(7).fill(0);
    let denominator = 0;
    for (let index = 1; index < history.length; index++) {
      const previous = history[index - 1];
      const current = history[index];
      if (!previous.dice || !current.dice || previous.dice[position] !== last.dice[position]) continue;
      counts[current.dice[position]]++;
      denominator++;
    }
    total += denominator
      ? (counts[candidate[position]] + config.smoothing) / (denominator + 6 * config.smoothing)
      : 1 / 6;
  }
  return clamp(total / 3, 0, 1);
}

function diceKey(dice) {
  return dice.join('-');
}

function exactDiceScore(candidate, history) {
  if (!history.length) return 0.5;
  const frequency = {};
  let total = 0;
  for (const round of history) {
    if (!round.dice) continue;
    const key = diceKey(round.dice);
    frequency[key] = (frequency[key] || 0) + 1;
    total++;
  }
  if (!total) return 0.5;
  return clamp(((frequency[diceKey(candidate)] || 0) / total) * 6 + 0.15, 0, 1);
}

function totalTransitionScore(candidateTotal, history, config = CONFIG) {
  if (history.length < 2) return 0.5;
  const lastTotal = history[history.length - 1].sum;
  const counts = {};
  let denominator = 0;
  for (let index = 1; index < history.length; index++) {
    if (history[index - 1].sum !== lastTotal) continue;
    counts[history[index].sum] = (counts[history[index].sum] || 0) + 1;
    denominator++;
  }
  if (!denominator) return 0.5;
  return clamp(
    ((counts[candidateTotal] || 0) + config.smoothing) / (denominator + 16 * config.smoothing),
    0,
    1
  );
}

function totalPatternScore(candidateTotal, history) {
  if (!history.length) return 0.5;
  const recent = history.slice(-20);
  const frequency = {};
  for (const round of recent) frequency[round.sum] = (frequency[round.sum] || 0) + 1;
  const maxFrequency = Math.max(...Object.values(frequency), 1);
  const frequencyScore = (frequency[candidateTotal] || 0) / maxFrequency;
  const sameSide = recent.filter(round => round.outcome === classifyTotal(candidateTotal)).length;
  return clamp(frequencyScore * 0.65 + (sameSide / recent.length) * 0.35, 0, 1);
}

function structureType(dice) {
  const [first, second, third] = dice;
  if (first === second && second === third) return 'TRIPLE';
  if (first === second || first === third || second === third) return 'PAIR';
  return 'ALL_DIFFERENT';
}

function sortedShape(dice) {
  return [...dice].sort((a, b) => a - b).join('-');
}

function structureScore(candidate, history) {
  if (!history.length) return 0.5;
  const structureFrequency = {};
  const shapeFrequency = {};
  for (const round of history) {
    if (!round.dice) continue;
    const type = structureType(round.dice);
    const shape = sortedShape(round.dice);
    structureFrequency[type] = (structureFrequency[type] || 0) + 1;
    shapeFrequency[shape] = (shapeFrequency[shape] || 0) + 1;
  }
  const maxStructure = Math.max(...Object.values(structureFrequency), 1);
  const maxShape = Math.max(...Object.values(shapeFrequency), 1);
  return clamp(
    ((structureFrequency[structureType(candidate)] || 0) / maxStructure) * 0.65
      + ((shapeFrequency[sortedShape(candidate)] || 0) / maxShape) * 0.35,
    0,
    1
  );
}

function numberToBits(value, width = 3) {
  return value.toString(2).padStart(width, '0');
}

function diceBits(dice) {
  return dice.map(value => numberToBits(value, 3)).join('');
}

function totalBits(total) {
  return numberToBits(total, 5);
}

function calculateBitStats(bitString) {
  if (!bitString) {
    return { bit1: 0, bit0: 0, balance: 0.5, transitions: { '00': 0, '01': 0, '10': 0, '11': 0 }, entropy: 0, longestRun: 0 };
  }
  let bit1 = 0;
  let bit0 = 0;
  for (const bit of bitString) bit === '1' ? bit1++ : bit0++;
  const transitions = { '00': 0, '01': 0, '10': 0, '11': 0 };
  for (let index = 1; index < bitString.length; index++) transitions[bitString[index - 1] + bitString[index]]++;
  const total = bitString.length;
  const p1 = bit1 / total;
  const p0 = bit0 / total;
  const entropy = (p0 ? -p0 * Math.log2(p0) : 0) + (p1 ? -p1 * Math.log2(p1) : 0);
  let longestRun = 1;
  let currentRun = 1;
  for (let index = 1; index < bitString.length; index++) {
    currentRun = bitString[index] === bitString[index - 1] ? currentRun + 1 : 1;
    longestRun = Math.max(longestRun, currentRun);
  }
  return { bit1, bit0, balance: p1, transitions, entropy, longestRun };
}

function historyBitString(history) {
  return history.filter(round => round.dice).map(round => diceBits(round.dice)).join('');
}

function bitScore(candidate, history) {
  if (!history.length) return 0.5;
  const historicalBits = historyBitString(history);
  const candidateBits = diceBits(candidate);
  const historicalStats = calculateBitStats(historicalBits);
  const candidateStats = calculateBitStats(candidateBits);
  const balanceScore = 1 - clamp(Math.abs(historicalStats.balance - candidateStats.balance) * 2, 0, 1);
  const entropyScore = 1 - clamp(Math.abs(historicalStats.entropy - candidateStats.entropy), 0, 1);
  let transitionDifference = 0;
  for (const key of Object.keys(historicalStats.transitions)) {
    const historicalRate = historicalStats.transitions[key] / Math.max(historicalBits.length - 1, 1);
    const candidateRate = candidateStats.transitions[key] / Math.max(candidateBits.length - 1, 1);
    transitionDifference += Math.abs(historicalRate - candidateRate);
  }
  const transitionScore = 1 - clamp(transitionDifference / 2, 0, 1);
  return clamp(balanceScore * 0.35 + entropyScore * 0.25 + transitionScore * 0.40, 0, 1);
}

function generateCandidates() {
  const candidates = [];
  for (let first = 1; first <= 6; first++) {
    for (let second = 1; second <= 6; second++) {
      for (let third = 1; third <= 6; third++) {
        const dice = [first, second, third];
        const total = first + second + third;
        candidates.push({ dice, total, outcome: classifyTotal(total) });
      }
    }
  }
  return candidates;
}

function scoreCandidate(candidate, history, config = CONFIG) {
  const signals = {
    dicePosition: dicePositionScore(candidate.dice, history, config),
    diceTransition: diceTransitionScore(candidate.dice, history, config),
    exactDice: exactDiceScore(candidate.dice, history),
    totalTransition: totalTransitionScore(candidate.total, history, config),
    totalPattern: totalPatternScore(candidate.total, history),
    parity: parityScore(candidate.dice, history, config),
    bit: bitScore(candidate.dice, history),
    structure: structureScore(candidate.dice, history)
  };
  let score = 0;
  for (const [key, weight] of Object.entries(config.weights)) score += signals[key] * weight;
  return { ...candidate, score: Number((score * 100).toFixed(4)), signals };
}

function calculateConfidence(ranked) {
  if (!ranked.length) return 45;
  const best = ranked[0].score;
  const second = ranked[1]?.score ?? best;
  const margin = Math.max(0, best - second);
  return Math.round(clamp(48 + margin * 1.5 + Math.min(best, 100) * 0.12, 45, 78));
}

function buildBitReport(history, prediction) {
  const historyBits = historyBitString(history);
  const candidateBits = diceBits(prediction.dice);
  const totalBitString = totalBits(prediction.total);
  return {
    history: calculateBitStats(historyBits),
    predictedDiceBits: candidateBits,
    predictedTotalBits: totalBitString,
    predictedDiceBitStats: calculateBitStats(candidateBits),
    predictedTotalBitStats: calculateBitStats(totalBitString)
  };
}

function predict(history, options = {}) {
  const config = {
    ...CONFIG,
    ...options,
    windows: { ...CONFIG.windows, ...(options.windows || {}) },
    weights: { ...CONFIG.weights, ...(options.weights || {}) }
  };
  const normalized = normalizeHistory(history);
  if (normalized.length < config.minHistory) {
    return {
      name: 'DICE_PREDICTION_V3',
      ready: false,
      reason: `Can toi thieu ${config.minHistory} phien`,
      samples: normalized.length,
      prediction: null
    };
  }

  const shortHistory = normalized.slice(-config.windows.short);
  const mediumHistory = normalized.slice(-config.windows.medium);
  const scored = generateCandidates().map(candidate => {
    const shortScore = scoreCandidate(candidate, shortHistory, config);
    const mediumScore = scoreCandidate(candidate, mediumHistory, config);
    return {
      ...candidate,
      score: Number((shortScore.score * 0.60 + mediumScore.score * 0.40).toFixed(4)),
      signals: { short: shortScore.signals, medium: mediumScore.signals }
    };
  }).sort((a, b) => b.score - a.score);

  const ranked = scored.slice(0, config.topK);
  const best = ranked[0];
  return {
    name: 'DICE_PREDICTION_V3',
    ready: true,
    samples: normalized.length,
    prediction: best.outcome,
    predictedTotal: best.total,
    predictedDice: best.dice,
    parity: {
      dicePattern: parityPattern(best.dice),
      even: countEven(best.dice),
      odd: 3 - countEven(best.dice),
      totalParity: parity(best.total),
      structure: structureType(best.dice)
    },
    confidence: calculateConfidence(scored),
    bitAnalysis: buildBitReport(normalized, best),
    topCandidates: ranked.map((candidate, index) => ({
      rank: index + 1,
      dice: candidate.dice,
      total: candidate.total,
      outcome: candidate.outcome,
      parity: parityPattern(candidate.dice),
      score: candidate.score,
      signals: Object.fromEntries(
        ['dicePosition', 'diceTransition', 'totalTransition', 'totalPattern', 'parity', 'bit', 'structure']
          .map(key => [key, Number((candidate.signals.short[key] * 0.6 + candidate.signals.medium[key] * 0.4).toFixed(4))])
      )
    }))
  };
}

function feedback(prediction, actualRound) {
  if (!prediction || !prediction.ready) return null;
  const actual = normalizeRound(actualRound);
  if (!actual) return null;
  const predictedDice = prediction.predictedDice;
  const actualDice = actual.dice;
  const hasDice = Array.isArray(predictedDice) && Array.isArray(actualDice);
  const exactDice = hasDice && predictedDice.every((value, index) => value === actualDice[index]);
  const correctFaces = hasDice ? predictedDice.reduce((count, value, index) => count + (value === actualDice[index] ? 1 : 0), 0) : 0;
  const diceDistance = hasDice ? predictedDice.reduce((sum, value, index) => sum + Math.abs(value - actualDice[index]), 0) : null;
  return {
    prediction: prediction.prediction,
    actual: actual.outcome,
    resultCorrect: prediction.prediction === actual.outcome,
    predictedTotal: prediction.predictedTotal,
    actualTotal: actual.sum,
    totalCorrect: prediction.predictedTotal === actual.sum,
    totalDistance: Math.abs(prediction.predictedTotal - actual.sum),
    predictedDice,
    actualDice,
    exactDice,
    correctFaces,
    diceDistance,
    predictedParity: prediction.parity?.dicePattern,
    actualParity: actual.dice ? parityPattern(actual.dice) : null,
    predictedTotalParity: prediction.parity?.totalParity,
    actualTotalParity: parity(actual.sum)
  };
}

module.exports = {
  CONFIG,
  predict,
  feedback,
  normalizeHistory,
  generateCandidates,
  calculateBitStats
};
