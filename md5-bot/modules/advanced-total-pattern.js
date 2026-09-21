'use strict';

/**
 * ADVANCED TOTAL PATTERN ENGINE
 *
 * Tài  = 11 -> 18
 * Xỉu  = 3  -> 10
 *
 * Dữ liệu đầu vào có thể là:
 *   { total: 15 }
 *   { sum: 15 }
 *   { value: 15 }
 *   { dice: [4, 5, 6] }
 *
 * Engine phân tích:
 *  - Tổng điểm 3..18
 *  - Tài/Xỉu
 *  - Chuyển tổng hiện tại -> tổng kế tiếp
 *  - Chuyển Tài/Xỉu
 *  - Chuỗi 2/3/4 tổng
 *  - Tần suất
 *  - Cửa sổ 20/50/100/300/toàn bộ
 *  - Khoảng cách tổng
 *  - Đảo chiều
 *  - Lặp tổng
 *  - Confidence
 */

const TOTAL_MIN = 3;
const TOTAL_MAX = 18;

const WINDOWS = [20, 50, 100, 300];

function classifyTotal(total) {
    total = Number(total);

    if (!Number.isInteger(total)) return null;

    if (total >= 11 && total <= 18) return 'Tài';
    if (total >= 3 && total <= 10) return 'Xỉu';

    return null;
}

function normalizeTotal(value) {
    const n = Number(value);

    if (!Number.isInteger(n)) return null;
    if (n < TOTAL_MIN || n > TOTAL_MAX) return null;

    return n;
}

function getTotal(round) {
    if (round == null) return null;

    if (round.total !== undefined) {
        const total = normalizeTotal(round.total);
        if (total !== null) return total;
    }

    if (round.sum !== undefined) {
        const total = normalizeTotal(round.sum);
        if (total !== null) return total;
    }

    if (round.value !== undefined) {
        const total = normalizeTotal(round.value);
        if (total !== null) return total;
    }

    if (Array.isArray(round.dice) && round.dice.length >= 3) {
        const dice = round.dice
            .slice(0, 3)
            .map(Number);

        if (dice.every(Number.isFinite)) {
            const total = dice.reduce((a, b) => a + b, 0);
            return normalizeTotal(total);
        }
    }

    return null;
}

function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];

    return history
        .map(getTotal)
        .filter(total => total !== null);
}

function resultOf(total) {
    return classifyTotal(total);
}

function countBy(arr) {
    const result = {};

    for (let i = TOTAL_MIN; i <= TOTAL_MAX; i++) {
        result[i] = 0;
    }

    for (const total of arr) {
        if (result[total] !== undefined) {
            result[total]++;
        }
    }

    return result;
}

function percentage(a, b) {
    if (!b) return 0;
    return +(a / b * 100).toFixed(2);
}

function argMax(obj) {
    let best = null;
    let bestValue = -Infinity;

    for (const [key, value] of Object.entries(obj)) {
        if (value > bestValue) {
            best = key;
            bestValue = value;
        }
    }

    return best;
}

function buildTransitionTable(history) {
    const table = {};

    for (let total = TOTAL_MIN; total <= TOTAL_MAX; total++) {
        table[total] = {
            currentTotal: total,
            currentResult: classifyTotal(total),
            sample: 0,
            nextTotals: {},
            nextTai: 0,
            nextXiu: 0,
            taiRate: 0,
            xiuRate: 0,
            topNextTotals: []
        };
    }

    for (let i = 0; i < history.length - 1; i++) {
        const current = history[i];
        const next = history[i + 1];

        const row = table[current];

        if (!row) continue;

        row.sample++;

        row.nextTotals[next] = (row.nextTotals[next] || 0) + 1;

        if (classifyTotal(next) === 'Tài') {
            row.nextTai++;
        } else {
            row.nextXiu++;
        }
    }

    for (const row of Object.values(table)) {
        if (!row.sample) continue;

        row.taiRate = percentage(row.nextTai, row.sample);
        row.xiuRate = percentage(row.nextXiu, row.sample);

        row.topNextTotals = Object.entries(row.nextTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([total, count]) => ({
                total: Number(total),
                count,
                rate: percentage(count, row.sample)
            }));
    }

    return table;
}

function buildSequenceModel(history, order) {
    const map = {};

    if (history.length <= order) return map;

    for (let i = order; i < history.length; i++) {
        const sequence = history
            .slice(i - order, i)
            .join('-');

        const next = history[i];

        if (!map[sequence]) {
            map[sequence] = {
                sequence,
                sample: 0,
                nextTotals: {},
                nextTai: 0,
                nextXiu: 0
            };
        }

        const row = map[sequence];

        row.sample++;

        row.nextTotals[next] = (row.nextTotals[next] || 0) + 1;

        if (classifyTotal(next) === 'Tài') {
            row.nextTai++;
        } else {
            row.nextXiu++;
        }
    }

    for (const row of Object.values(map)) {
        row.taiRate = percentage(row.nextTai, row.sample);
        row.xiuRate = percentage(row.nextXiu, row.sample);

        row.topNextTotals = Object.entries(row.nextTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([total, count]) => ({
                total: Number(total),
                count,
                rate: percentage(count, row.sample)
            }));
    }

    return map;
}

function analyzeMovement(history) {
    const movement = {
        up: 0,
        down: 0,
        same: 0,
        averageChange: 0,
        lastChanges: []
    };

    if (history.length < 2) return movement;

    const changes = [];

    for (let i = 1; i < history.length; i++) {
        const diff = history[i] - history[i - 1];

        changes.push(diff);

        if (diff > 0) movement.up++;
        else if (diff < 0) movement.down++;
        else movement.same++;
    }

    movement.averageChange = +(changes.reduce((a, b) => a + b, 0) / changes.length).toFixed(3);

    movement.lastChanges = changes.slice(-10);

    return movement;
}

function analyzeReversal(history) {
    let reversals = 0;
    let samples = 0;

    for (let i = 2; i < history.length; i++) {
        const d1 = history[i - 1] - history[i - 2];
        const d2 = history[i] - history[i - 1];

        if (d1 === 0 || d2 === 0) continue;

        samples++;

        if ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) {
            reversals++;
        }
    }

    return {
        samples,
        reversals,
        rate: percentage(reversals, samples)
    };
}

function analyzeRepeats(history) {
    let repeat = 0;

    for (let i = 1; i < history.length; i++) {
        if (history[i] === history[i - 1]) {
            repeat++;
        }
    }

    return {
        samples: Math.max(0, history.length - 1),
        repeat,
        rate: percentage(repeat, Math.max(0, history.length - 1))
    };
}

function analyzeWindow(history, size) {
    const data = history.slice(-size);
    const counts = countBy(data);

    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1]);

    const tai = data.filter(x => classifyTotal(x) === 'Tài').length;
    const xiu = data.filter(x => classifyTotal(x) === 'Xỉu').length;

    return {
        size,
        sample: data.length,
        counts,
        hot: sorted.slice(0, 5).map(([total, count]) => ({
            total: Number(total),
            count,
            rate: percentage(count, data.length)
        })),
        cold: sorted
            .slice(-5)
            .reverse()
            .map(([total, count]) => ({
                total: Number(total),
                count,
                rate: percentage(count, data.length)
            })),
        tai,
        xiu,
        taiRate: percentage(tai, data.length),
        xiuRate: percentage(xiu, data.length)
    };
}

function predictFromCurrentTotal(history, minSample = 5) {
    if (!history.length) {
        return {
            prediction: 'Tài',
            predictedTotal: null,
            confidence: 0,
            sample: 0,
            reason: 'Chưa có lịch sử'
        };
    }

    const current = history[history.length - 1];

    const table = buildTransitionTable(history);
    const row = table[current];

    if (!row || row.sample < minSample) {
        return {
            prediction: classifyTotal(current) === 'Tài' ? 'Xỉu' : 'Tài',
            predictedTotal: null,
            confidence: 0,
            sample: row?.sample || 0,
            reason: `Tổng ${current} chưa đủ mẫu`
        };
    }

    const nextTotal = argMax(row.nextTotals);
    const nextCount = row.nextTotals[nextTotal];
    const nextPrediction = classifyTotal(Number(nextTotal));
    const confidence = percentage(nextCount, row.sample);

    return {
        prediction: nextPrediction,
        predictedTotal: Number(nextTotal),
        confidence,
        sample: row.sample,
        reason: `Sau tổng ${current}, tổng ${nextTotal} xuất hiện ${nextCount}/${row.sample} lần`
    };
}

function predictFromSequence(history, order, minSample = 3) {
    if (history.length < order) return null;

    const sequence = history
        .slice(-order)
        .join('-');

    const model = buildSequenceModel(history, order);
    const row = model[sequence];

    if (!row || row.sample < minSample) {
        return null;
    }

    const nextTotal = argMax(row.nextTotals);
    const count = row.nextTotals[nextTotal];

    return {
        order,
        sequence,
        prediction: classifyTotal(Number(nextTotal)),
        predictedTotal: Number(nextTotal),
        confidence: percentage(count, row.sample),
        sample: row.sample,
        reason: `Chuỗi ${sequence} từng xuất hiện ${row.sample} lần`
    };
}

function analyzePredictions(history) {
    const predictions = [];

    const current = predictFromCurrentTotal(history);

    if (current) {
        predictions.push({
            type: 'CURRENT_TOTAL',
            ...current
        });
    }

    for (const order of [2, 3, 4]) {
        const prediction = predictFromSequence(history, order);

        if (prediction) {
            predictions.push({
                type: `SEQUENCE_${order}`,
                ...prediction
            });
        }
    }

    return predictions;
}

function choosePrediction(history) {
    const predictions = analyzePredictions(history);

    if (!predictions.length) {
        const last = history[history.length - 1];

        return {
            prediction: last ? (classifyTotal(last) === 'Tài' ? 'Xỉu' : 'Tài') : 'Tài',
            predictedTotal: null,
            confidence: 0,
            source: 'FALLBACK',
            sample: 0,
            reason: 'Chưa đủ dữ liệu'
        };
    }

    const valid = predictions
        .filter(x => x.sample >= 3)
        .sort((a, b) => {
            if (a.order && b.order && a.order !== b.order) {
                return b.order - a.order;
            }

            if (a.order && !b.order) return -1;
            if (!a.order && b.order) return 1;

            return b.confidence - a.confidence;
        });

    const best = valid[0] || predictions[0];

    return {
        prediction: best.prediction,
        predictedTotal: best.predictedTotal,
        confidence: best.confidence,
        source: best.type,
        sample: best.sample,
        reason: best.reason,
        allSignals: predictions
    };
}

function analyze(history, options = {}) {
    const totals = normalizeHistory(history);

    if (!totals.length) {
        return {
            ok: false,
            prediction: 'Tài',
            predictedTotal: null,
            confidence: 0,
            message: 'Không tìm thấy tổng điểm hợp lệ 3–18'
        };
    }

    const windows = {};

    for (const size of WINDOWS) {
        windows[size] = analyzeWindow(totals, size);
    }

    const transitionTable = buildTransitionTable(totals);

    const sequences = {
        2: buildSequenceModel(totals, 2),
        3: buildSequenceModel(totals, 3),
        4: buildSequenceModel(totals, 4)
    };

    const movement = analyzeMovement(totals);
    const reversal = analyzeReversal(totals);
    const repeats = analyzeRepeats(totals);
    const prediction = choosePrediction(totals);
    const lastTotal = totals[totals.length - 1];

    return {
        ok: true,

        current: {
            total: lastTotal,
            result: classifyTotal(lastTotal)
        },

        prediction,

        movement,
        reversal,
        repeats,

        windows,

        transition: {
            current: transitionTable[lastTotal],
            all: transitionTable
        },

        sequences,

        meta: {
            totalRounds: totals.length,
            validRange: '3-18',
            taiRange: '11-18',
            xiuRange: '3-10'
        }
    };
}

function strategy(history) {
    const result = analyze(history);

    return {
        name: 'CONDITIONAL_TOTAL_PATTERN',

        prediction: result.prediction?.prediction || 'Tài',

        predictedTotal: result.prediction?.predictedTotal ?? null,

        local_confidence: result.prediction?.confidence || 0,

        sample: result.prediction?.sample || 0,

        source: result.prediction?.source || 'FALLBACK',

        reason: result.prediction?.reason || 'Không đủ dữ liệu'
    };
}

module.exports = {
    TOTAL_MIN,
    TOTAL_MAX,
    classifyTotal,
    normalizeTotal,
    getTotal,
    normalizeHistory,
    buildTransitionTable,
    buildSequenceModel,
    analyzeMovement,
    analyzeReversal,
    analyzeRepeats,
    analyzeWindow,
    predictFromCurrentTotal,
    predictFromSequence,
    analyzePredictions,
    choosePrediction,
    analyze,
    strategy
};
