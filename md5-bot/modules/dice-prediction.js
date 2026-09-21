'use strict';

const MIN = 1;
const MAX = 6;

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function getDice(round) {
    if (!round) return null;

    if (Array.isArray(round.dice) && round.dice.length >= 3) {
        const dice = round.dice
            .slice(0, 3)
            .map(Number);

        if (
            dice.length === 3 &&
            dice.every(d => d >= MIN && d <= MAX)
        ) {
            return dice;
        }
    }

    return null;
}

function normalizeHistory(history) {
    if (!Array.isArray(history)) return [];

    return history
        .map(getDice)
        .filter(Boolean);
}

/**
 * Tìm các bộ 3 xúc xắc đã từng xuất hiện
 */
function countCombinations(history) {
    const map = new Map();

    for (const dice of history) {
        const key = dice.join(',');

        map.set(
            key,
            (map.get(key) || 0) + 1
        );
    }

    return map;
}

/**
 * Phân tích từng vị trí xúc xắc
 */
function positionFrequency(history) {
    const freq = [
        Array(7).fill(0),
        Array(7).fill(0),
        Array(7).fill(0)
    ];

    for (const dice of history) {
        for (let i = 0; i < 3; i++) {
            freq[i][dice[i]]++;
        }
    }

    return freq;
}

/**
 * Tần suất có điều kiện:
 * xúc xắc ván trước -> xúc xắc ván sau
 */
function transitionDice(history) {
    const result = [
        {},
        {},
        {}
    ];

    for (let i = 0; i < history.length - 1; i++) {
        const current = history[i];
        const next = history[i + 1];

        for (let pos = 0; pos < 3; pos++) {
            const currentValue = current[pos];
            const nextValue = next[pos];

            if (!result[pos][currentValue]) {
                result[pos][currentValue] =
                    Array(7).fill(0);
            }

            result[pos][currentValue][nextValue]++;
        }
    }

    return result;
}

/**
 * Dự đoán 3 viên xúc xắc
 */
function predict(history) {
    const data = normalizeHistory(history);

    if (data.length < 10) {
        return {
            dice: null,
            total: null,
            result: null,
            confidence: 0,
            ready: false,
            reason: 'Chưa đủ dữ liệu'
        };
    }

    const recent = data.slice(-50);

    const freq =
        positionFrequency(recent);

    const transition =
        transitionDice(data);

    const current =
        data[data.length - 1];

    const predictedDice = [];

    const positionConfidence = [];

    for (let pos = 0; pos < 3; pos++) {
        const score = Array(7).fill(0);

        // ------------------------------------
        // Tần suất vị trí
        // ------------------------------------

        for (let face = MIN; face <= MAX; face++) {
            score[face] +=
                freq[pos][face] * 1.0;
        }

        // ------------------------------------
        // Transition
        // ------------------------------------

        const currentFace =
            current[pos];

        const trans =
            transition[pos][currentFace];

        if (trans) {
            for (let face = MIN; face <= MAX; face++) {
                score[face] +=
                    trans[face] * 2.0;
            }
        }

        // ------------------------------------
        // Chọn mặt
        // ------------------------------------

        let bestFace = MIN;

        for (let face = MIN + 1; face <= MAX; face++) {
            if (score[face] > score[bestFace]) {
                bestFace = face;
            }
        }

        const sorted =
            score
                .slice(MIN, MAX + 1)
                .sort((a, b) => b - a);

        const best =
            sorted[0] || 0;

        const second =
            sorted[1] || 0;

        const conf =
            best > 0
                ? 50 +
                  ((best - second) / best) * 25
                : 50;

        predictedDice.push(bestFace);

        positionConfidence.push(
            clamp(conf, 50, 75)
        );
    }

    const total =
        predictedDice.reduce(
            (a, b) => a + b,
            0
        );

    const result =
        total >= 11
            ? 'TAI'
            : 'XIU';

    const confidence =
        Math.round(
            positionConfidence.reduce(
                (a, b) => a + b,
                0
            ) / 3
        );

    return {
        dice: predictedDice,

        total,

        result,

        confidence,

        positionConfidence,

        currentDice: current,

        ready: true,

        reason:
            'Phân tích tần suất từng vị trí + transition xúc xắc'
    };
}

module.exports = {
    predict,
    getDice,
    normalizeHistory,
    countCombinations,
    positionFrequency,
    transitionDice
};
