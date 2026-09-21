const STRATEGY_NAMES = [
  'FOLLOW_LAST',
  'REVERSE_LAST',
  'ALTERNATING_PATTERN',
  'RUN_BREAK',
  'RUN_FOLLOW',
  'BIAS_MEAN_REVERSION',
  'BIAS_MOMENTUM',
  'HOT_COLD',
  'MARKOV_TRANSITION',
  'ANTI_RAW',
  'RANDOM_BALANCED_FALLBACK',
  'ANTI_PHASE',
];

const WINDOWS = { short: 20, mid: 50, long: 100 };

function opposite(outcome) {
  return outcome === 'TAI' ? 'XIU' : 'TAI';
}

function fallback(history) {
  return history.length % 2 === 0 ? 'TAI' : 'XIU';
}

function lastOutcome(history) {
  return history.length ? history[history.length - 1].outcome : fallback(history);
}

function makeStrategy(name, prediction, localConfidence, reason) {
  return {
    name,
    prediction: prediction === 'TAI' ? 'TAI' : 'XIU',
    local_confidence: Math.max(0, Math.min(100, Math.round(localConfidence))),
    reason,
  };
}

function getOutcomes(history, limit) {
  return history.slice(-limit).map(item => item.outcome).filter(Boolean);
}

function getRunLength(history) {
  if (!history.length) return 0;
  const target = lastOutcome(history);
  let length = 0;
  for (let i = history.length - 1; i >= 0 && history[i].outcome === target; i--) length++;
  return length;
}

function getTransitionPrediction(history) {
  const outcomes = getOutcomes(history, 80);
  if (outcomes.length < 2) return fallback(history);
  const counts = { TT: 1, TX: 1, XT: 1, XX: 1 };
  for (let i = 1; i < outcomes.length; i++) {
    const key = `${outcomes[i - 1] === 'TAI' ? 'T' : 'X'}${outcomes[i] === 'TAI' ? 'T' : 'X'}`;
    counts[key]++;
  }
  const last = lastOutcome(history) === 'TAI' ? 'T' : 'X';
  const tai = last === 'T' ? counts.TT : counts.XT;
  const xiu = last === 'T' ? counts.TX : counts.XX;
  return tai >= xiu ? 'TAI' : 'XIU';
}

function getAlternationRate(history) {
  const outcomes = getOutcomes(history, 6);
  if (outcomes.length < 2) return 0;
  let switches = 0;
  for (let i = 1; i < outcomes.length; i++) {
    if (outcomes[i] !== outcomes[i - 1]) switches++;
  }
  return switches / (outcomes.length - 1);
}

function getRawStats(history, window = 20) {
  const logs = history.slice(-window).filter(item => item.rawPrediction && item.outcome);
  let wrong = 0;
  let antiTai = 0;
  let antiXiu = 0;
  for (const item of logs) {
    if (item.rawPrediction === item.outcome) continue;
    wrong++;
    if (item.rawPrediction === 'TAI') antiXiu++;
    else antiTai++;
  }
  return {
    total: logs.length,
    wrong,
    wrongRate: logs.length ? wrong / logs.length : 0,
    anti_tai: antiTai,
    anti_xiu: antiXiu,
  };
}

function buildStrategies(history) {
  const last = lastOutcome(history);
  const outcomes20 = getOutcomes(history, 20);
  const outcomes12 = getOutcomes(history, 12);
  const tai20 = outcomes20.filter(item => item === 'TAI').length;
  const tai12 = outcomes12.filter(item => item === 'TAI').length;
  const pTai20 = outcomes20.length ? tai20 / outcomes20.length : 0.5;
  const pTai12 = outcomes12.length ? tai12 / outcomes12.length : 0.5;
  const runLength = getRunLength(history);
  const markov = getTransitionPrediction(history);
  const altRate = getAlternationRate(history);
  const rawStats = getRawStats(history);
  const antiPhasePrediction = rawStats.anti_tai >= rawStats.anti_xiu ? 'TAI' : 'XIU';

  const strategies = [
    makeStrategy('FOLLOW_LAST', last, 50 + Math.abs(pTai12 - 0.5) * 20, 'Theo ket qua gan nhat'),
    makeStrategy('REVERSE_LAST', opposite(last), 50 + Math.abs(pTai12 - 0.5) * 20, 'Dao ket qua gan nhat'),
    makeStrategy(
      'ALTERNATING_PATTERN',
      altRate >= 0.6 ? opposite(last) : markov,
      50 + altRate * 30,
      altRate >= 0.6 ? `Xen ke ro (${Math.round(altRate * 100)}%)` : 'Khong ro, dung Markov'
    ),
    makeStrategy(
      'RUN_BREAK',
      runLength >= 3 ? opposite(last) : markov,
      50 + Math.min(runLength, 6) * 5,
      runLength >= 3 ? `Be cau bet ${runLength}` : 'Nhip bet ngan, dung Markov'
    ),
    makeStrategy(
      'RUN_FOLLOW',
      runLength >= 2 && runLength < 5 ? last : runLength >= 5 ? opposite(last) : markov,
      50 + Math.min(runLength, 5) * 5,
      runLength >= 5 ? 'Bet dai, chuyen dao cau' : 'Theo cau ngan'
    ),
    makeStrategy(
      'BIAS_MEAN_REVERSION',
      pTai20 >= 0.6 ? 'XIU' : pTai20 <= 0.4 ? 'TAI' : opposite(last),
      50 + Math.abs(pTai20 - 0.5) * 40,
      `Ty le TAI 20: ${Math.round(pTai20 * 100)}%`
    ),
    makeStrategy(
      'BIAS_MOMENTUM',
      pTai12 >= 0.58 ? 'TAI' : pTai12 <= 0.42 ? 'XIU' : last,
      50 + Math.abs(pTai12 - 0.5) * 40,
      `Dong luc 12: ${Math.round(pTai12 * 100)}% TAI`
    ),
    makeStrategy(
      'HOT_COLD',
      pTai12 >= 0.58 ? 'TAI' : pTai12 <= 0.42 ? 'XIU' : last,
      50 + Math.abs(pTai12 - 0.5) * 30,
      `Hot/Cold 12: ${Math.round(pTai12 * 100)}% TAI`
    ),
    makeStrategy('MARKOV_TRANSITION', markov, 52, `Markov ${markov}`),
    makeStrategy(
      'ANTI_RAW',
      rawStats.wrongRate >= 0.5 && history.length ? opposite(history[history.length - 1].rawPrediction) : opposite(last),
      50 + rawStats.wrongRate * 20,
      rawStats.wrongRate >= 0.5 ? `Dao raw sai ${Math.round(rawStats.wrongRate * 100)}%` : 'Chua du raw sai, dao last'
    ),
    makeStrategy('RANDOM_BALANCED_FALLBACK', fallback(history), 50, 'Fallback parity, khong random that'),
    makeStrategy(
      'ANTI_PHASE',
      rawStats.wrongRate >= 0.55 ? antiPhasePrediction : opposite(last),
      rawStats.wrongRate >= 0.55 ? 50 + rawStats.wrongRate * 30 : 50,
      rawStats.wrongRate >= 0.55 ? `Anti phase ${rawStats.wrong}/${rawStats.total}` : 'Chua kich hoat anti phase'
    ),
  ];

  return { strategies, rawStats };
}

function getStrategyStats(logs, strategyName, window) {
  const entries = logs.slice(-window).filter(item => item.outcome && item.strategyPredictions && item.strategyPredictions[strategyName]);
  const win = entries.filter(item => item.strategyPredictions[strategyName] === item.outcome).length;
  return {
    strategy: strategyName,
    total: entries.length,
    win,
    loss: entries.length - win,
    win_rate: entries.length ? win / entries.length : 0,
  };
}

function getLossStreak(logs, strategyName) {
  let streak = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    const item = logs[i];
    if (!item.outcome || !item.strategyPredictions || !item.strategyPredictions[strategyName]) continue;
    if (item.strategyPredictions[strategyName] === item.outcome) break;
    streak++;
  }
  return streak;
}

function getFinalStats(logs, window) {
  const entries = logs.slice(-window).filter(item => item.outcome && item.pred);
  const win = entries.filter(item => item.pred === item.outcome).length;
  return { total: entries.length, win, loss: entries.length - win, win_rate: entries.length ? win / entries.length : 0 };
}

function getPredictionStats(logs, field, window) {
  const entries = logs.slice(-window).filter(item => item.outcome && item[field]);
  const win = entries.filter(item => item[field] === item.outcome).length;
  return { total: entries.length, win, loss: entries.length - win, win_rate: entries.length ? win / entries.length : 0 };
}

function getRecoveryMode(logs) {
  const recent50 = getFinalStats(logs, 50);
  const recent20 = getFinalStats(logs, 20);
  let lossStreak = 0;
  for (let i = logs.length - 1; i >= 0; i--) {
    if (!logs[i].outcome || !logs[i].pred) continue;
    if (logs[i].pred === logs[i].outcome) break;
    lossStreak++;
  }
  return {
    enabled: (recent50.total >= 50 && recent50.win_rate < 0.45)
      || (recent20.total >= 20 && recent20.win_rate < 0.40)
      || lossStreak >= 5,
    recent50,
    recent20,
    lossStreak,
  };
}

function getReverseMode(logs) {
  const normal = getPredictionStats(logs, 'normalPrediction', 50);
  const reverse = getPredictionStats(logs, 'reversePrediction', 50);
  const recent20 = getPredictionStats(logs, 'normalPrediction', 20);
  const enabled = (recent20.total >= 20 && recent20.win_rate < 0.45)
    || (reverse.total >= 20 && reverse.win_rate - normal.win_rate >= 0.15);
  return { enabled, normal, reverse, recent20 };
}

function strategyWeight(name, recoveryMode) {
  if (!recoveryMode) return 1;
  if (name === 'RUN_BREAK' || name === 'RUN_FOLLOW') return 0.5;
  if (name === 'ALTERNATING_PATTERN') return 0.4;
  if (name === 'BIAS_MOMENTUM') return 0.7;
  if (name === 'BIAS_MEAN_REVERSION') return 1.0;
  if (name === 'HOT_COLD') return 0.9;
  if (name === 'ANTI_PHASE') return 1.5;
  return 1;
}

function scoreStrategy(logs, strategyName, recoveryMode) {
  const short = getStrategyStats(logs, strategyName, WINDOWS.short);
  const mid = getStrategyStats(logs, strategyName, WINDOWS.mid);
  const long = getStrategyStats(logs, strategyName, WINDOWS.long);
  const lossStreak = getLossStreak(logs, strategyName);
  let score = 0.5 * short.win_rate + 0.35 * mid.win_rate + 0.15 * long.win_rate;
  if (short.total < 10) score -= 0.05;
  if (mid.total < 25) score -= 0.05;
  if (lossStreak >= 3) score -= 0.07;
  if (short.total >= 10 && short.win_rate < 0.45) score -= 0.10;
  if (mid.total >= 25 && mid.win_rate < 0.48) score -= 0.05;
  if (short.total >= 10 && short.win_rate >= 0.55) score += 0.05;
  if (mid.total >= 25 && mid.win_rate >= 0.53) score += 0.05;
  return {
    strategy: strategyName,
    short,
    mid,
    long,
    loss_streak: lossStreak,
    performance_score: score,
    weighted_score: score * strategyWeight(strategyName, recoveryMode),
  };
}

function selectChampionStrategy(logs, currentChampion, recoveryMode) {
  const rankings = STRATEGY_NAMES.map(name => scoreStrategy(logs, name, recoveryMode))
    .sort((a, b) => b.weighted_score - a.weighted_score);
  const best = rankings[0];
  const fallbackNames = ['MARKOV_TRANSITION', 'REVERSE_LAST'];
  const valid = item => (item.short.total >= 10 || item.mid.total >= 25) && item.weighted_score >= 0.5;
  let selected = valid(best) ? best : rankings.find(item => fallbackNames.includes(item.strategy));

  if (!selected) selected = rankings.find(item => item.strategy === 'RANDOM_BALANCED_FALLBACK') || best;
  if (currentChampion) {
    const current = rankings.find(item => item.strategy === currentChampion);
    if (current && valid(current)) {
      const shouldSwitch = !valid(best)
        || best.strategy === current.strategy
        || best.weighted_score - current.weighted_score >= 0.08
        || current.loss_streak >= 3
        || (current.short.total >= 10 && current.short.win_rate < 0.45);
      if (!shouldSwitch) selected = current;
    }
  }

  return { champion: selected.strategy, rankings, championStats: selected };
}

function getConfidence(championStats, recovery, reverse) {
  const short = championStats.short;
  const mid = championStats.mid;
  let model = 50 + Math.max(0, short.win_rate - 0.5) * 100 + Math.max(0, mid.win_rate - 0.5) * 50;
  if (short.total < 10) model -= 5;
  if (championStats.loss_streak >= 3) model -= 8;
  if (short.total >= 10 && short.win_rate < 0.48) model -= 8;
  if (mid.total >= 25 && mid.win_rate < 0.5) model -= 5;
  model = Math.max(45, Math.min(75, model));

  let display;
  if (recovery.recent20.total >= 10 && recovery.recent20.win_rate < 0.45) display = Math.min(58, model + 2);
  else if (model < 55) display = Math.min(58, model + 3);
  else if (model < 65) display = Math.min(68, model + 5);
  else display = Math.min(78, model + 6);
  if (recovery.enabled) display = Math.min(display, 58);
  if (reverse.enabled) display = Math.min(display, 58);

  let status = model >= 65 && short.win_rate >= 0.55 ? 'MẠNH'
    : model >= 58 ? 'TRUNG BÌNH'
      : model >= 50 ? 'YẾU' : 'NGUY HIỂM';
  if (short.total < 10 && status === 'MẠNH') status = 'YẾU';
  if (short.total < 10 && status === 'TRUNG BÌNH') status = 'YẾU';

  return { model_confidence: Math.round(model), display_confidence: Math.round(display), status };
}

function analyze(history, state = {}) {
  const { strategies, rawStats } = buildStrategies(history);
  const recovery = getRecoveryMode(history);
  const reverse = getReverseMode(history);
  const champion = selectChampionStrategy(history, state.champion, recovery.enabled);
  const byName = Object.fromEntries(strategies.map(item => [item.name, item]));
  const selected = byName[champion.champion] || byName.MARKOV_TRANSITION;
  const normalPrediction = selected.prediction;
  const reversePrediction = opposite(normalPrediction);
  const finalPrediction = reverse.enabled ? reversePrediction : normalPrediction;
  const forcedPrediction = champion.championStats.short.total < 10 && champion.championStats.mid.total < 25;
  const mode = recovery.enabled && reverse.enabled ? 'Recovery + Reverse Mode'
    : recovery.enabled ? 'Recovery Mode'
      : reverse.enabled ? 'Reverse Mode'
        : forcedPrediction ? 'Forced Prediction' : 'Normal Mode';
  const confidence = getConfidence(champion.championStats, recovery, reverse);

  return {
    pred: finalPrediction,
    confidence: confidence.display_confidence,
    model_confidence: confidence.model_confidence,
    display_confidence: confidence.display_confidence,
    status: confidence.status,
    mode,
    reason: `${champion.champion}: ${selected.reason}`,
    champion_strategy: champion.champion,
    strategyPredictions: Object.fromEntries(strategies.map(item => [item.name, item.prediction])),
    strategy_details: strategies,
    strategy_rankings: champion.rankings,
    normalPrediction,
    reversePrediction,
    recovery_mode: recovery.enabled,
    reverse_mode: reverse.enabled,
    anti_tai: rawStats.anti_tai,
    anti_xiu: rawStats.anti_xiu,
    normal_win_rate: reverse.normal.win_rate,
    reverse_win_rate: reverse.reverse.win_rate,
    loss_streak: recovery.lossStreak,
    raw_prediction: normalPrediction,
  };
}

module.exports = {
  STRATEGY_NAMES,
  analyze,
  getStrategyStats,
  selectChampionStrategy,
};
