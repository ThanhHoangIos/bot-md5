const fetch = require('node-fetch');
const http = require('http');
const fs = require('fs');
const path = require('path');

// ===== IMPORT 15 MODULES =====
const aiAdaptive = require('./modules/ai-adaptive');
const aiLogitV2 = require('./modules/ai-logit-v2');
const antiBias = require('./modules/anti-bias');
const beCauPro = require('./modules/be-cau-pro');
const cau11Master = require('./modules/cau-11-master');
const cauNganDai = require('./modules/cau-ngan-dai');
const brainAI = require('./modules/brain-ai');
const deepseekAI = require('./modules/deepseek-ai');
const expandedCauBank = require('./modules/expanded-cau-bank');
const hybridFollowBreak = require('./modules/hybrid-follow-break');
const onlineAIV3 = require('./modules/online-ai-v3');
const strategyEngine = require('./modules/strategy-engine');
const patternAtlas = require('./modules/pattern-atlas');
const patternRich = require('./modules/pattern-rich');
const regimeDetector = require('./modules/regime-detector');
const skipGram = require('./modules/skip-gram');
const smartBreakV2 = require('./modules/smart-break-v2');

// ===== CẤU HÌNH =====
const TOKEN = process.env.MD5_API_TOKEN || 'skooN9TKlxJGxgSVRzGShapr6ZBSAyPSdm3g06QugeLZ50dsPLBpQlEj4B+PoU7gBTstsxc74ivQLUaZT8Iam17IkREb7Fn2Br3VwVNQi7qCKtzSMdI4BY3HL9I4VEaWdAVzeZkOxx6qpBbYiNGQbL+32FLTO1yQFoZcgcRwrk7Uerl7XUZ0xA==';
const API_URL = 'https://md5.changdelamgica.xyz/api/GetListSoiCau';
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mkcrlfgpncryalmmixsr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const STORAGE_DIR = process.env.DATA_DIR || (fs.existsSync('/var/data') ? '/var/data' : __dirname);
const STORAGE_FILE = process.env.DATA_FILE || path.join(STORAGE_DIR, 'data.json');
const MAX_HISTORY = 2000;
const PRUNE_COUNT = 200;
const WARMUP_ROUNDS = 10;

let history = [];
let lastSession = null;
let stats = { total: 0, tai: 0, xiu: 0, correct: 0, wrong: 0 };
let strategyState = { champion: null };
let isRunning = false;

// ===== LƯU / TẢI =====
function getState() {
    return {
        history: history.slice(-MAX_HISTORY),
        stats, lastSession,
        brainMemory: brainAI._memory,
        brainPerformance: brainAI._performance,
        brainWeights: brainAI._weights,
        brainLastLearn: brainAI._lastLearn,
        cauMemory: cauNganDai._memory,
        modulePerformance,
        strategyState,
    };
}

function saveLocalData(state) {
    try {
        fs.mkdirSync(path.dirname(STORAGE_FILE), { recursive: true });
        const tempFile = `${STORAGE_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(state, null, 2));
        fs.renameSync(tempFile, STORAGE_FILE);
    } catch (e) { console.error('❌ Lỗi lưu dữ liệu:', e.message); }
}

async function saveData() {
    const state = getState();
    saveLocalData(state);
    if (!SUPABASE_KEY) return;
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/bot_state?on_conflict=id`, {
            method: 'POST',
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify({ id: 1, state, updated_at: new Date().toISOString() }),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (e) { console.error('❌ Lỗi lưu Supabase:', e.message); }
}

function applyState(d) {
    history = (d.history || []).slice(-MAX_HISTORY);
    stats = d.stats || { total: 0, tai: 0, xiu: 0, correct: 0, wrong: 0 };
    lastSession = d.lastSession || null;
    if (d.brainMemory) brainAI._memory = d.brainMemory;
    if (d.brainPerformance) brainAI._performance = d.brainPerformance;
    if (d.brainWeights) brainAI._weights = d.brainWeights;
    if (Number.isInteger(d.brainLastLearn)) brainAI._lastLearn = d.brainLastLearn;
    if (d.cauMemory) cauNganDai._memory = d.cauMemory;
    if (d.modulePerformance) Object.assign(modulePerformance, d.modulePerformance);
    if (d.strategyState && typeof d.strategyState === 'object') strategyState = d.strategyState;
}

async function loadData() {
    if (SUPABASE_KEY) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/bot_state?id=eq.1&select=state`, {
                headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const rows = await response.json();
            if (rows[0] && rows[0].state) {
                applyState(rows[0].state);
                saveLocalData(rows[0].state);
                return true;
            }
        } catch (e) { console.error('❌ Lỗi đọc Supabase:', e.message); }
    }
    try {
        if (!fs.existsSync(STORAGE_FILE)) return false;
        const d = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
        applyState(d);
        return true;
    } catch (e) { return false; }
}

function sendJson(res, statusCode, payload) {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(payload, null, 2));
}

function normalizeOutcome(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (['tai', 'tài', 'big'].includes(normalized)) return 'TAI';
    if (['xiu', 'xỉu', 'xiū', 'small'].includes(normalized)) return 'XIU';
    return null;
}

function getOutcome(result) {
    return normalizeOutcome(result.KetQua || result.ket_qua || result.KETQUA)
        || (Number(result.Dice1) + Number(result.Dice2) + Number(result.Dice3) > 10 ? 'TAI' : 'XIU');
}

function formatPrediction(prediction) {
    const last = history[history.length - 1];
    const nextSession = last ? Number(last.sessionId) + 1 : null;
    const outcome = prediction.pred === 'TAI' ? 'Tai' : prediction.pred === 'XIU' ? 'Xiu' : null;
    const actualOutcome = last ? (last.outcome === 'TAI' ? 'Tai' : 'Xiu') : null;
    const dice = last ? last.dice : [null, null, null];
    const confidence = Number(prediction.confidence || 0);

    return {
        ResponseData: 1,
        success: true,
        data: {
            Phien: last ? Number(last.sessionId) : null,
            Ket_qua: actualOutcome || '',
            Tong: last ? last.sum : null,
            Xuc_xac_1: dice[0],
            Xuc_xac_2: dice[1],
            Xuc_xac_3: dice[2],
            Phien_hien_tai: nextSession,
            Du_doan: outcome || '',
            Do_tin_cay: `${confidence}%`,
            Mode: prediction.mode || 'Forced Prediction',
            Recovery_Mode: Boolean(prediction.recovery_mode),
            Reverse_Mode: Boolean(prediction.reverse_mode),
            Anti_Tai: prediction.anti_tai || 0,
            Anti_Xiu: prediction.anti_xiu || 0,
            Normal_Win_Rate: prediction.normal_win_rate || 0,
            Reverse_Win_Rate: prediction.reverse_win_rate || 0,
        },
    };
}

// ===== ENSEMBLE =====
const modules = [aiAdaptive, aiLogitV2, antiBias, beCauPro, cau11Master, cauNganDai, brainAI, deepseekAI, expandedCauBank, hybridFollowBreak, onlineAIV3, patternAtlas, patternRich, skipGram, smartBreakV2];
const moduleNames = ['adaptive', 'logit', 'antiBias', 'beCau', 'cau11', 'cauNganDai', 'brain', 'deepseek', 'expandedCau', 'hybrid', 'online', 'atlas', 'rich', 'skipGram', 'smartBreak'];
const modulePerformance = {};

function getModuleWeight(name) {
    const performance = modulePerformance[name] || { hits: 0, misses: 0 };
    const total = performance.hits + performance.misses;
    const accuracy = (performance.hits + 5) / (total + 10);
    return Math.max(0.5, Math.min(1.5, 0.5 + accuracy));
}

function recordModuleFeedback(signals, actual) {
    for (const signal of signals || []) {
        if (!signal.pred) continue;
        const performance = modulePerformance[signal.name] || { hits: 0, misses: 0 };
        if (signal.pred === actual) performance.hits++;
        else performance.misses++;
        modulePerformance[signal.name] = performance;
    }
}

function ensemblePredict(h) {
    const prediction = strategyEngine.analyze(h, strategyState);
    strategyState.champion = prediction.champion_strategy;
    return prediction;
}

// ===== FETCH =====
async function fetchData() {
    try {
        const res = await fetch(API_URL, { headers: { 'Authorization': 'Bearer ' + TOKEN } });
        const text = await res.text();
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('Không phải mảng');
        return data;
    } catch (e) { console.error('❌ Lỗi fetch:', e.message); return null; }
}

// ===== NẠP LỊCH SỬ =====
async function loadInitialHistory() {
    console.log('📥 Nạp lịch sử ban đầu...');
    const data = await fetchData();
    if (!data || !data.length) return;
    data.sort((a, b) => (a.GameSessionID || 0) - (b.GameSessionID || 0));
    lastSession = Number(data[data.length - 1].GameSessionID);
    await saveData();
    console.log(`✅ Đã lấy mốc phiên ${lastSession}. Chờ 10 phiên mới trước khi dự đoán.`);
}

// ===== RUN =====
async function run() {
    if (isRunning) return;
    isRunning = true;
    try {
        const data = await fetchData();
        if (!data || !data.length) return;
        data.sort((a, b) => (a.GameSessionID || 0) - (b.GameSessionID || 0));
        const newResults = data.filter(item => Number(item.GameSessionID) > Number(lastSession || 0));
        for (const result of newResults) {
            const sid = Number(result.GameSessionID);
            const sum = Number(result.Dice1) + Number(result.Dice2) + Number(result.Dice3);
            const outcome = getOutcome(result);
            const pred = ensemblePredict(history);
            stats.total++;
            if (outcome === 'TAI') stats.tai++; else stats.xiu++;

            if (history.length > 0) {
                const prev = history[history.length - 1];
                if (prev.pred) {
                    brainAI.recordFeedback(prev.pred, outcome);
                    recordModuleFeedback(prev.signals, outcome);
                    if (prev.pred === outcome) stats.correct++;
                    else stats.wrong++;
                }
            }

            const strategyCorrect = Object.fromEntries(
                Object.entries(pred.strategyPredictions || {}).map(([name, value]) => [name, value === outcome])
            );
            history.push({
                sessionId: String(sid),
                dice: [result.Dice1, result.Dice2, result.Dice3],
                sum,
                outcome,
                pred: pred.pred,
                rawPrediction: pred.raw_prediction,
                normalPrediction: pred.normalPrediction,
                reversePrediction: pred.reversePrediction,
                championStrategy: pred.champion_strategy,
                strategyPredictions: pred.strategyPredictions || {},
                strategyCorrect,
                recovery_mode: pred.recovery_mode,
                reverse_mode: pred.reverse_mode,
                mode: pred.mode,
                anti_tai: pred.anti_tai,
                anti_xiu: pred.anti_xiu,
                receivedAt: new Date().toISOString(),
            });
            if (history.length > MAX_HISTORY) {
                history.splice(0, PRUNE_COUNT);
                console.log(`🧹 Đã xóa ${PRUNE_COUNT} phiên cũ. Còn lại ${history.length} phiên.`);
            }
            lastSession = sid;
            console.log(`🎯 Ván ${sid}: ${result.Dice1}-${result.Dice2}-${result.Dice3} = ${sum} (${outcome})`);
            console.log(`🔮 Dự đoán: ${pred.pred} (${pred.confidence}%) | ${pred.mode} | ${pred.reason}`);
        }
        if (newResults.length) await saveData();
    } catch (e) { console.error('❌ Lỗi run:', e.message); }
    finally { isRunning = false; }
}

// ===== SERVER =====
http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

        if (requestUrl.pathname === '/') {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8'));
        } else if (requestUrl.pathname === '/api/bot/status') {
            const pred = ensemblePredict(history);
            sendJson(res, 200, {
                status: 'running', lastSession,
                lastResult: history.length ? { dice: history[history.length - 1].dice, sum: history[history.length - 1].sum, outcome: history[history.length - 1].outcome } : null,
                stats, prediction: pred, historyCount: history.length
            });
        } else if (requestUrl.pathname === '/api/bot/results') {
            const requestedLimit = Number.parseInt(requestUrl.searchParams.get('limit'), 10);
            const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 20, 2000));
            sendJson(res, 200, { results: history.slice(-limit), count: history.length });
        } else if (requestUrl.pathname === '/api/bot/predict') {
            sendJson(res, 200, formatPrediction(ensemblePredict(history)));
        } else if (requestUrl.pathname === '/api/bot/brain') {
            sendJson(res, 200, brainAI.getStats());
        } else if (requestUrl.pathname === '/api/bot/cau') {
            sendJson(res, 200, cauNganDai.getStats());
        } else {
            sendJson(res, 200, { status: 'running', historyCount: history.length });
        }
    } catch (error) {
        console.error('❌ Lỗi HTTP:', error.message);
        sendJson(res, 500, { status: 'error', error: 'Internal server error' });
    }
}).listen(PORT, () => console.log('✅ Server chạy port ' + PORT));

// ===== KHỞI ĐỘNG =====
(async () => {
    await loadData();
    await loadInitialHistory();
    console.log('🚀 BOT 15 MODULE AI ĐANG CHẠY 24/7...');
    run();
    setInterval(run, 1000);
})();
