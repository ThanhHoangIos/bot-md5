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
const hybridFollowBreak = require('./modules/hybrid-follow-break');
const onlineAIV3 = require('./modules/online-ai-v3');
const patternAtlas = require('./modules/pattern-atlas');
const patternRich = require('./modules/pattern-rich');
const regimeDetector = require('./modules/regime-detector');
const skipGram = require('./modules/skip-gram');
const smartBreakV2 = require('./modules/smart-break-v2');

// ===== CẤU HÌNH =====
const TOKEN = process.env.MD5_API_TOKEN || 'skooN9TKlxJGxgSVRzGShapr6ZBSAyPSdm3g06QugeLZ50dsPLBpQlEj4B+PoU7gBTstsxc74ivQLUaZT8Iam17IkREb7Fn2Br3VwVNQi7qCKtzSMdI4BY3HL9I4VEaWdAVzeZkOxx6qpBbYiNGQbL+32FLTO1yQFoZcgcRwrk7Uerl7XUZ0xA==';
const API_URL = 'https://md5.changdelamgica.xyz/api/GetListSoiCau';
const PORT = process.env.PORT || 3000;
const STORAGE_DIR = process.env.DATA_DIR || (fs.existsSync('/var/data') ? '/var/data' : __dirname);
const STORAGE_FILE = process.env.DATA_FILE || path.join(STORAGE_DIR, 'data.json');

let history = [];
let lastSession = null;
let stats = { total: 0, tai: 0, xiu: 0, correct: 0, wrong: 0 };
let isRunning = false;

// ===== LƯU / TẢI =====
function saveData() {
    try {
        fs.mkdirSync(path.dirname(STORAGE_FILE), { recursive: true });
        const tempFile = `${STORAGE_FILE}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify({
            history: history.slice(-2000),
            stats, lastSession,
            brainMemory: brainAI._memory,
            brainPerformance: brainAI._performance,
            brainWeights: brainAI._weights,
            brainLastLearn: brainAI._lastLearn,
            cauMemory: cauNganDai._memory
        }, null, 2));
        fs.renameSync(tempFile, STORAGE_FILE);
    } catch (e) { console.error('❌ Lỗi lưu dữ liệu:', e.message); }
}

function loadData() {
    try {
        if (!fs.existsSync(STORAGE_FILE)) return false;
        const d = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
        history = d.history || [];
        stats = d.stats || { total: 0, tai: 0, xiu: 0, correct: 0, wrong: 0 };
        lastSession = d.lastSession || null;
        if (d.brainMemory) brainAI._memory = d.brainMemory;
        if (d.brainPerformance) brainAI._performance = d.brainPerformance;
        if (d.brainWeights) brainAI._weights = d.brainWeights;
        if (Number.isInteger(d.brainLastLearn)) brainAI._lastLearn = d.brainLastLearn;
        if (d.cauMemory) cauNganDai._memory = d.cauMemory;
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
        },
    };
}

// ===== ENSEMBLE =====
const modules = [aiAdaptive, aiLogitV2, antiBias, beCauPro, cau11Master, cauNganDai, brainAI, deepseekAI, hybridFollowBreak, onlineAIV3, patternAtlas, patternRich, skipGram, smartBreakV2];

function ensemblePredict(h) {
    if (h.length < 10) return { pred: null, confidence: 0, reason: 'Chưa đủ 10 phiên' };
    const scores = { TAI: 0, XIU: 0 };
    const reasons = [];
    let active = 0;
    const votes = { TAI: 0, XIU: 0 };
    for (const mod of modules) {
        try {
            const res = mod.analyze(h);
            if (res && res.pred) {
                scores[res.pred] += res.score;
                votes[res.pred]++;
                if (res.reason) reasons.push(res.reason);
                active++;
            }
        } catch (e) {}
    }
    const regime = regimeDetector.detect(h);
    const pred = scores.TAI > scores.XIU ? 'TAI' : (scores.XIU > scores.TAI ? 'XIU' : null);
    if (!pred) {
        const recent = h.slice(-10).map(item => item.outcome);
        const tai = recent.filter(outcome => outcome === 'TAI').length;
        const xiu = recent.length - tai;
        const fallback = tai === xiu
            ? (recent[recent.length - 1] === 'TAI' ? 'XIU' : 'TAI')
            : (tai < xiu ? 'TAI' : 'XIU');
        return {
            pred: fallback,
            confidence: 50,
            reason: `Fallback cân bằng | ${regime} | ${active} modules`,
            scores,
            active,
            votes,
        };
    }
    const diff = Math.abs(scores.TAI - scores.XIU);
    const dominantVotes = votes[pred];
    const agreement = active ? dominantVotes / active : 0;
    const confidence = Math.min(50 + diff * 6 + Math.max(0, agreement - 0.5) * 30, 95);
    const strength = active >= 4 && agreement >= 0.65 && confidence >= 70 ? 'strong' : agreement >= 0.5 ? 'medium' : 'weak';
    return { pred, confidence: Math.round(confidence), strength, agreement: Math.round(agreement * 100), reason: reasons.slice(0, 3).join(' | ') + ` | ${regime} | ${strength} (${dominantVotes}/${active})`, scores, active, votes };
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
    let added = 0;
    let corrected = 0;
    for (const v of data) {
        const sid = String(v.GameSessionID);
        const sum = Number(v.Dice1) + Number(v.Dice2) + Number(v.Dice3);
        const outcome = getOutcome(v);
        const existing = history.find(item => item.sessionId === sid);
        if (existing) {
            if (existing.outcome !== outcome || existing.sum !== sum) {
                existing.dice = [v.Dice1, v.Dice2, v.Dice3];
                existing.sum = sum;
                existing.outcome = outcome;
                corrected++;
            }
            continue;
        }
        const pred = ensemblePredict(history);
        history.push({ sessionId: sid, dice: [v.Dice1, v.Dice2, v.Dice3], sum, outcome, pred: pred.pred, receivedAt: new Date().toISOString() });
        added++;
    }
    if (history.length > 2000) history = history.slice(-2000);
    lastSession = history.length ? Number(history[history.length - 1].sessionId) : null;
    saveData();
    console.log(`✅ Nạp ${added} ván, sửa ${corrected} kết quả. Tổng: ${history.length}`);
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
                    if (prev.pred === outcome) stats.correct++;
                    else stats.wrong++;
                }
            }

            history.push({ sessionId: String(sid), dice: [result.Dice1, result.Dice2, result.Dice3], sum, outcome, pred: pred.pred, receivedAt: new Date().toISOString() });
            if (history.length > 2000) history.shift();
            lastSession = sid;
            console.log(`🎯 Ván ${sid}: ${result.Dice1}-${result.Dice2}-${result.Dice3} = ${sum} (${outcome})`);
            if (pred.pred) console.log(`🔮 Dự đoán: ${pred.pred} (${pred.confidence}%) | ${pred.reason}`);
            else console.log(`⏳ Chưa đủ dữ liệu (${history.length}/10)`);
        }
        if (newResults.length) saveData();
    } catch (e) { console.error('❌ Lỗi run:', e.message); }
    finally { isRunning = false; }
}

// ===== SERVER =====
http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    try {
        const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

        if (requestUrl.pathname === '/api/bot/status') {
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
    loadData();
    await loadInitialHistory();
    console.log('🚀 BOT 15 MODULE AI ĐANG CHẠY 24/7...');
    run();
    setInterval(run, 1000);
})();
