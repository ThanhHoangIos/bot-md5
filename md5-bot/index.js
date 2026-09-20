const fetch = require('node-fetch');
const http = require('http');
const fs = require('fs');

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
const STORAGE_FILE = 'data.json';

let history = [];
let lastSession = null;
let stats = { total: 0, tai: 0, xiu: 0, correct: 0, wrong: 0 };

// ===== LƯU / TẢI =====
function saveData() {
    try {
        fs.writeFileSync(STORAGE_FILE, JSON.stringify({
            history: history.slice(-2000),
            stats, lastSession,
            brainMemory: brainAI._memory,
            cauMemory: cauNganDai._memory
        }, null, 2));
    } catch (e) {}
}
function loadData() {
    try {
        if (!fs.existsSync(STORAGE_FILE)) return false;
        const d = JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf8'));
        history = d.history || [];
        stats = d.stats || { total: 0, tai: 0, xiu: 0, correct: 0, wrong: 0 };
        lastSession = d.lastSession || null;
        if (d.brainMemory) brainAI._memory = d.brainMemory;
        if (d.cauMemory) cauNganDai._memory = d.cauMemory;
        return true;
    } catch (e) { return false; }
}

// ===== ENSEMBLE =====
const modules = [aiAdaptive, aiLogitV2, antiBias, beCauPro, cau11Master, cauNganDai, brainAI, deepseekAI, hybridFollowBreak, onlineAIV3, patternAtlas, patternRich, skipGram, smartBreakV2];

function ensemblePredict(h) {
    if (h.length < 10) return { pred: null, confidence: 0, reason: 'Chưa đủ 10 phiên' };
    const scores = { TAI: 0, XIU: 0 };
    const reasons = [];
    let active = 0;
    for (const mod of modules) {
        try {
            const res = mod.analyze(h);
            if (res && res.pred) {
                scores[res.pred] += res.score;
                if (res.reason) reasons.push(res.reason);
                active++;
            }
        } catch (e) {}
    }
    const regime = regimeDetector.detect(h);
    const pred = scores.TAI > scores.XIU ? 'TAI' : (scores.XIU > scores.TAI ? 'XIU' : null);
    if (!pred) return { pred: null, confidence: 0, reason: `Không tín hiệu | ${regime} | ${active} modules` };
    const diff = Math.abs(scores.TAI - scores.XIU);
    const confidence = Math.min(50 + diff * 8, 95);
    return { pred, confidence: Math.round(confidence), reason: reasons.slice(0, 3).join(' | ') + ' | ' + regime, scores, active };
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
    for (const v of data) {
        const sid = String(v.GameSessionID);
        if (history.some(h => h.sessionId === sid)) continue;
        const sum = Number(v.Dice1) + Number(v.Dice2) + Number(v.Dice3);
        const outcome = sum > 10 ? 'TAI' : 'XIU';
        history.push({ sessionId: sid, dice: [v.Dice1, v.Dice2, v.Dice3], sum, outcome, pred: null, receivedAt: new Date().toISOString() });
        added++;
    }
    if (history.length > 2000) history = history.slice(-2000);
    lastSession = history.length ? Number(history[history.length - 1].sessionId) : null;
    saveData();
    console.log(`✅ Nạp ${added} ván. Tổng: ${history.length}`);
}

// ===== RUN =====
async function run() {
    try {
        const data = await fetchData();
        if (!data || !data.length) return;
        data.sort((a, b) => (a.GameSessionID || 0) - (b.GameSessionID || 0));
        const latest = data[data.length - 1];
        if (!latest) return;
        const sid = Number(latest.GameSessionID);
        if (sid === lastSession) return;

        const sum = Number(latest.Dice1) + Number(latest.Dice2) + Number(latest.Dice3);
        const outcome = sum > 10 ? 'TAI' : 'XIU';
        stats.total++;
        if (outcome === 'TAI') stats.tai++; else stats.xiu++;

        const pred = ensemblePredict(history);

        // Kiểm tra dự đoán trước
        if (history.length > 0) {
            const prev = history[history.length - 1];
            if (prev.pred) {
                if (prev.pred === outcome) { stats.correct++; console.log(`✅ Dự đoán trước (${prev.pred}) ĐÚNG`); }
                else { stats.wrong++; console.log(`❌ Dự đoán trước (${prev.pred}) SAI`); }
            }
        }

        history.push({ sessionId: String(sid), dice: [latest.Dice1, latest.Dice2, latest.Dice3], sum, outcome, pred: pred.pred, receivedAt: new Date().toISOString() });
        if (history.length > 2000) history.shift();
        lastSession = sid;
        saveData();

        console.log(`🎯 Ván ${sid}: ${latest.Dice1}-${latest.Dice2}-${latest.Dice3} = ${sum} (${outcome})`);
        if (pred.pred) console.log(`🔮 Dự đoán: ${pred.pred} (${pred.confidence}%) | ${pred.reason}`);
        else console.log(`⏳ Chưa đủ dữ liệu (${history.length}/10)`);
    } catch (e) { console.error('❌ Lỗi run:', e.message); }
}

// ===== SERVER =====
http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    const url = req.url;

    if (url === '/api/bot/status') {
        const pred = ensemblePredict(history);
        res.end(JSON.stringify({
            status: 'running', lastSession,
            lastResult: history.length ? { dice: history[history.length - 1].dice, sum: history[history.length - 1].sum, outcome: history[history.length - 1].outcome } : null,
            stats, prediction: pred, historyCount: history.length
        }));
    } else if (url.startsWith('/api/bot/results')) {
        const limit = parseInt(url.split('limit=')[1]) || 20;
        res.end(JSON.stringify({ results: history.slice(-limit), count: history.length }));
    } else if (url === '/api/bot/predict') {
        res.end(JSON.stringify(ensemblePredict(history)));
    } else if (url === '/api/bot/brain') {
        res.end(JSON.stringify(brainAI.getStats()));
    } else if (url === '/api/bot/cau') {
        res.end(JSON.stringify(cauNganDai.getStats()));
    } else {
        res.end(JSON.stringify({ status: 'running', historyCount: history.length }));
    }
}).listen(PORT, () => console.log('✅ Server chạy port ' + PORT));

// ===== KHỞI ĐỘNG =====
(async () => {
    loadData();
    if (history.length === 0) await loadInitialHistory();
    else console.log(`📂 Đã tải ${history.length} ván từ file.`);
    console.log('🚀 BOT 15 MODULE AI ĐANG CHẠY 24/7...');
    run();
    setInterval(run, 1000);
})();
