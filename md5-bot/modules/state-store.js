const fs = require('fs');
const path = require('path');

function mergeHistory(...histories) {
  const bySession = new Map();
  for (const history of histories) {
    for (const item of Array.isArray(history) ? history : []) {
      if (!item || item.sessionId == null) continue;
      const key = String(item.sessionId);
      bySession.set(key, { ...(bySession.get(key) || {}), ...item });
    }
  }
  return Array.from(bySession.values()).sort((a, b) => Number(a.sessionId) - Number(b.sessionId));
}

function mergeStates(states, maxHistory) {
  const valid = states.filter(state => state && typeof state === 'object');
  if (!valid.length) return null;
  const newest = valid.reduce((best, state) => {
    const bestTotal = Number(best.stats?.total || 0);
    const stateTotal = Number(state.stats?.total || 0);
    return stateTotal >= bestTotal ? state : best;
  }, valid[0]);
  const history = mergeHistory(...valid.map(state => state.history)).slice(-maxHistory);
  return {
    ...newest,
    history,
    stats: newest.stats || {},
    strategyState: newest.strategyState || {},
  };
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readJsonWithBackup(filePath) {
  return readJson(filePath) || readJson(`${filePath}.bak`);
}

function writeJsonAtomic(filePath, state) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) fs.copyFileSync(filePath, `${filePath}.bak`);
  const tempFile = `${filePath}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(state, null, 2));
  fs.renameSync(tempFile, filePath);
}

module.exports = { mergeHistory, mergeStates, readJson, readJsonWithBackup, writeJsonAtomic };
