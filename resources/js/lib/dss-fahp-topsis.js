import {
    DSS_FAHP_LINGUISTIC_SCALE,
    getDssFahpTopsisReportConfig,
} from '@/config/dss-fahp-topsis';

const clamp01 = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    if (number >= 1) return 1;
    return number;
};

const reciprocalTfn = ([l, m, u]) => {
    const low = Number(l);
    const mid = Number(m);
    const high = Number(u);
    if (low <= 0 || mid <= 0 || high <= 0) return [1, 1, 1];
    return [1 / high, 1 / mid, 1 / low];
};

const resolveTfn = (value, scale = DSS_FAHP_LINGUISTIC_SCALE) => {
    if (Array.isArray(value) && value.length === 3) {
        const parsed = value.map((n) => {
            const num = Number(n);
            return Number.isFinite(num) && num > 0 ? num : 1;
        });
        return [parsed[0], parsed[1], parsed[2]];
    }

    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        return [value, value, value];
    }

    const token = String(value ?? 'equal').trim().toLowerCase();
    if (token.startsWith('inv:')) {
        const next = token.slice(4);
        return reciprocalTfn(resolveTfn(next, scale));
    }

    return scale[token] ?? scale.equal;
};

const computeFuzzyAhpWeights = ({ criteria, pairwise, scale }) => {
    const count = Array.isArray(criteria) ? criteria.length : 0;
    if (count <= 0) return [];

    const matrix = Array.from({ length: count }, (_, row) =>
        Array.from({ length: count }, (_, col) => {
            const source = pairwise?.[row]?.[col] ?? (row === col ? 'equal' : null);
            if (source !== null && source !== undefined) return resolveTfn(source, scale);
            const mirrored = pairwise?.[col]?.[row];
            if (mirrored !== null && mirrored !== undefined) {
                return reciprocalTfn(resolveTfn(mirrored, scale));
            }
            return resolveTfn('equal', scale);
        }),
    );

    const geometricMeans = matrix.map((row) => {
        const product = row.reduce(
            (carry, cell) => [
                carry[0] * Math.max(0.000001, Number(cell[0] ?? 1)),
                carry[1] * Math.max(0.000001, Number(cell[1] ?? 1)),
                carry[2] * Math.max(0.000001, Number(cell[2] ?? 1)),
            ],
            [1, 1, 1],
        );

        return [
            product[0] ** (1 / count),
            product[1] ** (1 / count),
            product[2] ** (1 / count),
        ];
    });

    const sumL = geometricMeans.reduce((sum, item) => sum + item[0], 0);
    const sumM = geometricMeans.reduce((sum, item) => sum + item[1], 0);
    const sumU = geometricMeans.reduce((sum, item) => sum + item[2], 0);

    const fuzzyWeights = geometricMeans.map(([l, m, u]) => [
        l / Math.max(0.000001, sumU),
        m / Math.max(0.000001, sumM),
        u / Math.max(0.000001, sumL),
    ]);

    const crisp = fuzzyWeights.map(([l, m, u]) => (l + m + u) / 3);
    const total = crisp.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return Array.from({ length: count }, () => 1 / count);

    return crisp.map((value) => value / total);
};

const buildAlternatives = ({ criteria, values }) => {
    const current = values.map((value) => clamp01(value));
    const alternatives = [{ key: '__current__', label: 'Current', vector: current }];

    criteria.forEach((criterion, index) => {
        const improved = [...current];
        improved[index] = criterion?.type === 'cost' ? 0 : 1;
        alternatives.push({
            key: criterion?.key ?? `criterion_${index}`,
            label: criterion?.label ?? `Criterion ${index + 1}`,
            vector: improved,
            criterionKey: criterion?.key ?? '',
        });
    });

    return alternatives;
};

const computeTopsis = ({ criteria, values, weights }) => {
    const alternatives = buildAlternatives({ criteria, values });
    const matrix = alternatives.map((item) => item.vector);
    const criteriaCount = criteria.length;

    const denominator = Array.from({ length: criteriaCount }, (_, col) => {
        const root = Math.sqrt(
            matrix.reduce((sum, row) => sum + Number(row[col] ?? 0) ** 2, 0),
        );
        return root > 0 ? root : 1;
    });

    const normalized = matrix.map((row) =>
        row.map((value, col) => Number(value ?? 0) / denominator[col]),
    );

    const weighted = normalized.map((row) =>
        row.map((value, col) => value * Number(weights[col] ?? 0)),
    );

    const idealPlus = Array.from({ length: criteriaCount }, (_, col) => {
        const columnValues = weighted.map((row) => row[col]);
        return criteria[col]?.type === 'cost'
            ? Math.min(...columnValues)
            : Math.max(...columnValues);
    });

    const idealMinus = Array.from({ length: criteriaCount }, (_, col) => {
        const columnValues = weighted.map((row) => row[col]);
        return criteria[col]?.type === 'cost'
            ? Math.max(...columnValues)
            : Math.min(...columnValues);
    });

    const closeness = weighted.map((row) => {
        const dPlus = Math.sqrt(
            row.reduce((sum, value, col) => sum + (value - idealPlus[col]) ** 2, 0),
        );
        const dMinus = Math.sqrt(
            row.reduce((sum, value, col) => sum + (value - idealMinus[col]) ** 2, 0),
        );
        const den = dPlus + dMinus;
        return den > 0 ? dMinus / den : 0;
    });

    return { alternatives, closeness };
};

const buildDiagnostics = ({ reportKey, criteria, values, weights, topsis }) => {
    const currentCloseness = Number(topsis?.closeness?.[0] ?? 0);
    const criteriaDiagnostics = criteria.map((criterion, index) => {
        const raw = clamp01(values[index]);
        const oriented = criterion?.type === 'cost' ? 1 - raw : raw;
        const weakness = 1 - oriented;
        const gain = Math.max(0, Number(topsis?.closeness?.[index + 1] ?? 0) - currentCloseness);
        const weight = Number(weights[index] ?? 0);
        const priority = weight * (weakness * 0.65 + gain * 0.35);

        return {
            key: criterion?.key ?? `criterion_${index}`,
            label: criterion?.label ?? `Criterion ${index + 1}`,
            type: criterion?.type === 'cost' ? 'cost' : 'benefit',
            rawValue: raw,
            orientedValue: oriented,
            weakness,
            gain,
            weight,
            priority,
            recommendations: Array.isArray(criterion?.recommendations)
                ? criterion.recommendations.filter(Boolean)
                : [],
        };
    });

    return {
        reportKey,
        currentCloseness,
        criteria: criteriaDiagnostics,
    };
};

export function buildRecommendations(result, limit = 3) {
    const diagnostics = result?.diagnostics ?? result;
    const maxItems = Math.max(1, Number(limit) || 3);
    if (!diagnostics || !Array.isArray(diagnostics?.criteria)) return [];

    const ranked = diagnostics.criteria
        .map((criterion) => {
            const recommendations = Array.isArray(criterion?.recommendations)
                ? criterion.recommendations
                : [];
            const severity = Number(criterion?.weakness ?? 0);
            const primary = severity >= 0.5 ? recommendations[0] : recommendations[1] || recommendations[0];
            return {
                text: String(primary ?? '').trim(),
                priority: Number(criterion?.priority ?? 0),
            };
        })
        .filter((item) => item.text)
        .sort((a, b) => b.priority - a.priority);

    const unique = [];
    for (const item of ranked) {
        if (unique.find((picked) => picked.text === item.text)) continue;
        unique.push(item);
        if (unique.length >= maxItems) break;
    }

    return unique.map((item) => item.text);
}

export function contextualizeRecommendations(recommendations = [], options = {}) {
    const periodLabel = String(options?.periodLabel ?? '').trim();
    const sourceLabel = String(options?.sourceLabel ?? '').trim();

    return (Array.isArray(recommendations) ? recommendations : [])
        .map((rec) => String(rec ?? '').trim())
        .filter(Boolean)
        .map((text) => {
            let next = text;
            if (periodLabel) {
                next = next.replace(/\bperiode aktif\b/gi, `periode ${periodLabel}`);
                next = next.replace(/\bperiode ini\b/gi, `periode ${periodLabel}`);
            }

            if (sourceLabel) {
                next = next.replace(/\bdata sumber\b/gi, `sumber ${sourceLabel}`);
            }

            return next;
        });
}

export function runFuzzyAhpTopsis(reportKey, context = {}) {
    const config = getDssFahpTopsisReportConfig(reportKey);
    if (!config) {
        return {
            recommendations: [],
            diagnostics: {
                reportKey,
                currentCloseness: 0,
                criteria: [],
            },
        };
    }

    const criteria = Array.isArray(config.criteria) ? config.criteria : [];
    if (!criteria.length) {
        return {
            recommendations: [],
            diagnostics: {
                reportKey,
                currentCloseness: 0,
                criteria: [],
            },
        };
    }

    const values = criteria.map((criterion) => {
        if (typeof criterion?.normalize !== 'function') return 0;
        try {
            return clamp01(criterion.normalize(context));
        } catch {
            return 0;
        }
    });

    const weights = computeFuzzyAhpWeights({
        criteria,
        pairwise: config?.pairwise,
        scale: config?.linguisticScale || DSS_FAHP_LINGUISTIC_SCALE,
    });

    const topsis = computeTopsis({ criteria, values, weights });
    const diagnostics = buildDiagnostics({ reportKey, criteria, values, weights, topsis });
    const recommendations = buildRecommendations({ diagnostics }, 3);

    return { recommendations, diagnostics };
}
