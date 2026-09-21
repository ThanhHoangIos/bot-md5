function runLengthEncode(results) {
    const runs = [];
    for (const result of results) {
        const previous = runs[runs.length - 1];
        if (previous && previous.value === result) previous.length++;
        else runs.push({ value: result, length: 1 });
    }
    return runs;
}

function findPeriod(values) {
    for (let period = 1; period <= Math.floor(values.length / 2); period++) {
        let matches = true;
        for (let index = period; index < values.length; index++) {
            if (values[index] !== values[index - period]) {
                matches = false;
                break;
            }
        }
        if (matches) return period;
    }
    return null;
}

function entropy(results) {
    const tai = results.filter(result => result === 'TAI').length;
    const probability = tai / results.length;
    if (probability === 0 || probability === 1) return 0;
    return -probability * Math.log2(probability) - (1 - probability) * Math.log2(1 - probability);
}

function markovPrediction(results) {
    const transitions = { TAI: { TAI: 0, XIU: 0 }, XIU: { TAI: 0, XIU: 0 } };
    for (let index = 0; index < results.length - 1; index++) {
        transitions[results[index]][results[index + 1]]++;
    }
    const last = results[results.length - 1];
    const row = transitions[last];
    const total = row.TAI + row.XIU;
    if (total < 8) return null;
    const prediction = row.TAI > row.XIU ? 'TAI' : 'XIU';
    const ratio = Math.max(row.TAI, row.XIU) / total;
    if (ratio < 0.62) return null;
    return { prediction, ratio, total };
}

module.exports = {
    analyze(history) {
        if (history.length < 20) return { score: 0, pred: null };
        const results = history.slice(-80).map(item => item.outcome);
        const runs = runLengthEncode(results);
        const lengths = runs.map(run => run.length);
        const period = findPeriod(lengths.slice(-12));
        const current = runs[runs.length - 1];
        const recentEntropy = entropy(results.slice(-20));
        if (recentEntropy > 0.98) return { score: 0, pred: null, reason: 'Pattern Engine: nhiễu cao' };

        if (period && period <= 4 && lengths.length >= period * 3) {
            const nextLength = lengths[lengths.length - period];
            const prediction = current.value === 'TAI' ? 'XIU' : 'TAI';
            if (current.length >= nextLength) {
                return { score: 2.5, pred: prediction, reason: `Pattern Engine: nhịp ${lengths.slice(-period).join('-')}` };
            }
        }

        const markov = markovPrediction(results);
        if (markov) {
            return { score: 1.5 * markov.ratio, pred: markov.prediction, reason: `Pattern Engine: Markov ${Math.round(markov.ratio * 100)}%` };
        }
        return { score: 0, pred: null };
    },

    inspect(history) {
        const results = history.slice(-80).map(item => item.outcome);
        const runs = runLengthEncode(results);
        return {
            runLengths: runs.map(run => run.length),
            pattern: runs.length ? runs.slice(-6).map(run => `${run.value}:${run.length}`).join(' ') : '',
            entropy: results.length ? Number(entropy(results).toFixed(3)) : null,
            period: findPeriod(runs.map(run => run.length).slice(-12)),
        };
    },
};
