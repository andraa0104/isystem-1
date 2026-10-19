#!/usr/bin/env python3
"""Data-driven purchase requirement forecasts with chronological backtesting.

No LLM is used for numeric forecasts. The engine compares simple demand models
on each material's own past and reports validation error and confidence.
"""
import argparse
import datetime as dt
import json
import math
import statistics
import sys

HORIZON_DAYS = 30
MAX_BACKTEST_ORIGINS = 4


def number(value):
    try:
        result = float(value or 0)
        return result if math.isfinite(result) else 0.0
    except (TypeError, ValueError):
        return 0.0


def parse_date(value):
    text = str(value or '').strip()
    for pattern in ('%Y-%m-%d', '%d.%m.%Y', '%d/%m/%Y', '%Y/%m/%d'):
        try:
            return dt.datetime.strptime(text[:10], pattern).date()
        except ValueError:
            continue
    return None


def key(value):
    return str(value or '').strip().lower()


def index_stocks(rows):
    by_code, by_name = {}, {}
    for row in rows or []:
        entry = {
            'material_code': str(row.get('material_code') or '').strip(),
            'material': str(row.get('material') or '').strip(),
            'unit': str(row.get('unit') or '').strip(),
            'current_stock': number(row.get('current_stock')),
            'available_stock': number(row.get('available_stock', row.get('current_stock'))),
        }
        if entry['material_code']:
            by_code[key(entry['material_code'])] = entry
        if entry['material']:
            by_name[key(entry['material'])] = entry
    return by_code, by_name


def find_stock(indexes, code, material):
    by_code, by_name = indexes
    return (by_code.get(key(code)) or by_name.get(key(material)) or {
        'material_code': str(code or '').strip(), 'material': str(material or '').strip(),
        'unit': '', 'current_stock': 0.0,
        'available_stock': 0.0,
    })


def croston_sba(values, alpha=0.1):
    nonzero = [(i, v) for i, v in enumerate(values) if v > 0]
    if not nonzero:
        return 0.0
    size = nonzero[0][1]
    interval = max(1.0, float(nonzero[0][0] + 1))
    previous = nonzero[0][0]
    for i, demand in nonzero[1:]:
        gap = max(1, i - previous)
        size = alpha * demand + (1 - alpha) * size
        interval = alpha * gap + (1 - alpha) * interval
        previous = i
    return max(0.0, (1 - alpha / 2) * size / max(interval, 1.0))


def tsb(values, alpha=0.1, beta=0.1):
    if not values:
        return 0.0
    first = next((v for v in values if v > 0), 0.0)
    if not first:
        return 0.0
    probability, size = 0.0, first
    for demand in values:
        occurred = 1.0 if demand > 0 else 0.0
        probability = beta * occurred + (1 - beta) * probability
        if occurred:
            size = alpha * demand + (1 - alpha) * size
    return max(0.0, probability * size)


def model_rates(values):
    def mean(seq):
        return sum(seq) / len(seq) if seq else 0.0
    candidates = {
        'recent_average': mean(values[-30:]),
        'weighted_average': 0.6 * mean(values[-30:]) + 0.4 * mean(values[-90:]),
    }
    for alpha in (0.1, 0.2):
        candidates[f'croston_sba_a{alpha}'] = croston_sba(values, alpha)
        for beta in (0.1, 0.2):
            candidates[f'tsb_a{alpha}_b{beta}'] = tsb(values, alpha, beta)
    return candidates


def percentile(values, fraction):
    values = sorted(values)
    if not values:
        return 0.0
    index = min(len(values) - 1, max(0, math.ceil(fraction * len(values)) - 1))
    return values[index]


def recurrence_candidates(values):
    if not values:
        return {}
    weighted = values[0]
    for value in values[1:]:
        weighted = 0.35 * value + 0.65 * weighted
    return {
        'median_recent_3': statistics.median(values[-3:]),
        'median_recent_6': statistics.median(values[-6:]),
        'median_all': statistics.median(values),
        'exponential_smoothing': weighted,
    }


def select_recurrence_forecast(values):
    """Choose interval/quantity estimator with rolling one-step validation."""
    predictions = {}
    actuals = []
    for origin in range(max(2, len(values) - 5), len(values)):
        actual = values[origin]
        actuals.append(actual)
        for name, forecast in recurrence_candidates(values[:origin]).items():
            predictions.setdefault(name, []).append(forecast)
    if not predictions:
        candidates = recurrence_candidates(values)
        name = 'median_recent_3' if len(values) < 3 else 'median_recent_6'
        return candidates[name], name, None, 0
    errors = {
        name: [abs(prediction - actual) for prediction, actual in zip(forecasts, actuals)]
        for name, forecasts in predictions.items()
    }
    scores = {name: statistics.median(model_errors) for name, model_errors in errors.items()}
    name = min(scores, key=scores.get)
    nested_errors = []
    for index, actual in enumerate(actuals):
        if index == 0:
            fold_model = 'median_recent_3'
        else:
            prior_scores = {
                model: statistics.median(model_errors[:index])
                for model, model_errors in errors.items()
                if model_errors[:index]
            }
            fold_model = min(prior_scores, key=prior_scores.get) if prior_scores else 'median_recent_3'
        nested_errors.append(abs(predictions[fold_model][index] - actual))
    return recurrence_candidates(values)[name], name, statistics.median(nested_errors), len(nested_errors)


def forecast_rate(values):
    """Select the lowest-error candidate using expanding-window 30-day tests."""
    if len(values) <= HORIZON_DAYS:
        return 0.0, 'insufficient_history', None, 0, None, 0.0
    possible = list(range(max(30, len(values) - MAX_BACKTEST_ORIGINS * HORIZON_DAYS),
                          len(values) - HORIZON_DAYS + 1, HORIZON_DAYS))
    if len(possible) > MAX_BACKTEST_ORIGINS:
        possible = possible[-MAX_BACKTEST_ORIGINS:]
    errors = {}
    for origin in possible:
        actual = sum(values[origin:origin + HORIZON_DAYS])
        rates = model_rates(values[:origin])
        for name, rate in rates.items():
            errors.setdefault(name, [])
            errors[name].append((rate * HORIZON_DAYS, actual))
    scores = {}
    for name, pairs in errors.items():
        if pairs:
            absolute = sum(abs(pred - actual) for pred, actual in pairs)
            scale = sum(actual for _, actual in pairs)
            scores[name] = absolute / max(scale, 1.0)
    if not scores:
        return max(0.0, model_rates(values)['weighted_average'] * HORIZON_DAYS), 'weighted_average', None, 0, None, 0.0
    selected = min(scores, key=scores.get)

    # Nested chronological validation: each held-out window is predicted by
    # the model that would have been selected using earlier windows only.
    outer_errors = []
    baseline_errors = []
    for index, origin in enumerate(possible):
        if index == 0:
            fold_model = 'recent_average'
        else:
            prior_scores = {}
            for name, pairs in errors.items():
                prior_pairs = pairs[:index]
                if prior_pairs:
                    prior_scale = sum(actual for _, actual in prior_pairs)
                    prior_scores[name] = sum(abs(predicted - actual) for predicted, actual in prior_pairs) / max(prior_scale, 1.0)
            fold_model = min(prior_scores, key=prior_scores.get) if prior_scores else 'recent_average'
        predicted = errors[fold_model][index][0]
        actual = errors[fold_model][index][1]
        outer_errors.append((predicted, actual))
        baseline_errors.append(errors['recent_average'][index])
    outer_scale = sum(actual for _, actual in outer_errors)
    nested_wape = sum(abs(predicted - actual) for predicted, actual in outer_errors) / max(outer_scale, 1.0)
    baseline_scale = sum(actual for _, actual in baseline_errors)
    nested_baseline_wape = sum(abs(predicted - actual) for predicted, actual in baseline_errors) / max(baseline_scale, 1.0)
    under_forecasts = [max(0.0, actual - predicted) for predicted, actual in outer_errors]
    return (
        max(0.0, model_rates(values)[selected] * HORIZON_DAYS),
        selected,
        nested_wape,
        len(outer_errors),
        nested_baseline_wape,
        percentile(under_forecasts, 0.8),
    )


def confidence_label(history_days, events, wape):
    if history_days < 180 or events < 4 or wape is None:
        return 'Rendah'
    if history_days >= 365 and events >= 12 and wape <= 0.35:
        return 'Tinggi'
    if events >= 6 and wape <= 0.60:
        return 'Sedang'
    return 'Rendah'


def stock_forecast(payload):
    today = dt.date.today()
    indexes = index_stocks(payload.get('stocks'))
    groups = {}
    for row in payload.get('sales', []):
        code = str(row.get('material_code') or '').strip()
        material = str(row.get('material') or '').strip()
        sold = parse_date(row.get('date'))
        qty = number(row.get('qty'))
        if (not code and not material) or not sold or sold > today or qty <= 0:
            continue
        item_key = code or key(material)
        group = groups.setdefault(item_key, {
            'material_code': code, 'material': material, 'unit': str(row.get('unit') or '').strip(),
            'sales': {}, 'invoices': set(),
        })
        group['sales'][sold] = group['sales'].get(sold, 0.0) + qty
        if row.get('invoice_no'):
            group['invoices'].add(str(row['invoice_no']))

    costs = {}
    for row in payload.get('costs', []):
        code = str(row.get('material_code') or '').strip()
        qty, price = number(row.get('qty')), number(row.get('price'))
        if not code or qty <= 0:
            continue
        landed = price + number(row.get('shipping_allocated')) / qty
        costs.setdefault(code, []).append((parse_date(row.get('tgl')) or today, landed))

    recommendations = []
    for item_key, item in groups.items():
        days = (today - min(item['sales'])).days + 1
        # Daily zeros are essential for identifying intermittent demand.
        series = [item['sales'].get(today - dt.timedelta(days=offset), 0.0)
                  for offset in range(days - 1, -1, -1)]
        demand_30, model, wape, folds, baseline_wape, error_buffer = forecast_rate(series)
        indexes_for_stock = find_stock(indexes, item['material_code'], item['material'])
        current_stock = max(0.0, number(indexes_for_stock['current_stock']))
        available_stock = max(0.0, number(indexes_for_stock.get('available_stock', current_stock)))
        unit = item['unit'] or indexes_for_stock.get('unit') or 'PCS'
        material = indexes_for_stock.get('material') or item['material'] or item_key
        code = indexes_for_stock.get('material_code') or item['material_code']
        event_count = sum(1 for qty in series if qty > 0)
        history_days = len(series)
        enough_history = (
            history_days >= 365
            and event_count >= 12
            and folds >= 4
            and wape is not None
            and wape <= 0.40
            and (baseline_wape is None or wape <= baseline_wape * 1.05)
        )
        confidence = confidence_label(history_days, event_count, wape) if enough_history else 'Rendah'

        # Use the 80th percentile of observed under-forecast errors as an
        # empirical safety buffer instead of multiplying demand by a fixed rate.
        buffer = error_buffer if folds >= 3 else 0.0
        target = demand_30 + buffer
        suggested = max(0, math.ceil(target - available_stock)) if enough_history else None
        daily_rate = demand_30 / HORIZON_DAYS
        doi = round(available_stock / daily_rate) if daily_rate > 0 else 999
        # Keep attention on urgent/understocked items; do not recommend a buy
        # just because a material had sales or a temporary price reduction.
        if suggested == 0 and doi > 45:
            continue

        urgency = 40 if available_stock <= 0 else 30 if doi <= 7 else 22 if doi <= 15 else 14 if doi <= 30 else 5 if doi <= 45 else 0
        evidence = min(25, event_count * 2) + (15 if confidence == 'Tinggi' else 8 if confidence == 'Sedang' else 0)
        score = max(0, min(100, urgency + evidence + (10 if suggested and suggested > 0 else 0)))
        history = sorted(costs.get(item['material_code'], []), key=lambda pair: pair[0])
        latest = history[-1][1] if history else 0.0
        median = statistics.median(price for _, price in history) if history else 0.0
        saving = (median - latest) / median * 100 if median > 0 else 0.0
        reasons = [
            f"Model terpilih dari uji historis: {model}",
            f"Perkiraan kebutuhan 30 hari: {demand_30:.1f} {unit}",
            f"Galat forecast permintaan WAPE: {wape * 100:.1f}% ({folds} periode uji)" if wape is not None else 'Histori belum cukup untuk memvalidasi galat forecast permintaan',
            f"Baseline rata-rata terbaru WAPE: {baseline_wape * 100:.1f}%" if baseline_wape is not None else 'Baseline belum dapat divalidasi dengan histori ini',
            f"Buffer stok dari persentil ke-80 kesalahan prediksi: {error_buffer:.1f} {unit}",
            f"Stok fisik {current_stock:g} {unit}; stok tersedia setelah komitmen {available_stock:g} {unit}",
            f"Cakupan stok tersedia sekitar {doi} hari" if doi < 999 else 'Belum ada laju permintaan untuk menghitung cakupan stok',
        ]
        if not enough_history:
            if history_days < 365 or event_count < 12 or folds < 4:
                reasons.append('Histori belum cukup panjang atau kejadian penjualannya terlalu sedikit untuk saran otomatis')
            if wape is not None and wape > 0.40:
                reasons.append('Galat validasi di atas ambang kelayakan saran otomatis')
            if wape is not None and baseline_wape is not None and wape > baseline_wape * 1.05:
                reasons.append('Hasil model belum konsisten lebih baik daripada baseline rata-rata')
        if saving >= 5:
            reasons.append(f"Landed cost terbaru {saving:.1f}% di bawah median historis")
        recommendations.append({
            'material_code': code, 'material': material, 'unit': unit, 'score': score,
            'suggested_qty': suggested, 'current_stock': round(current_stock, 2),
            'available_stock': round(available_stock, 2),
            'days_of_inventory': doi, 'forecast_30d': round(demand_30, 2),
            'forecast_model': model, 'backtest_wape': round(wape, 4) if wape is not None else None,
            'backtest_error_buffer': round(error_buffer, 2),
            'baseline_wape': round(baseline_wape, 4) if baseline_wape is not None else None,
            'confidence': confidence, 'history_days': history_days, 'history_events': event_count,
            'stock_breakdown': {
                'physical': round(current_stock, 2),
                'mib': round(number(indexes_for_stock.get('mib')), 2),
                'mis': round(number(indexes_for_stock.get('mis')), 2),
                'mibs': round(number(indexes_for_stock.get('mibs')), 2),
                'pr_outstanding': round(number(indexes_for_stock.get('pr_outstanding')), 2),
                'po_outstanding': round(number(indexes_for_stock.get('po_outstanding')), 2),
                'do_outstanding': round(number(indexes_for_stock.get('do_outstanding')), 2),
            },
            'latest_landed_cost': round(latest, 2), 'median_landed_cost': round(median, 2),
            'saving_percent': round(saving, 2), 'reasons': reasons,
        })
    recommendations.sort(key=lambda row: (-row['score'], row['days_of_inventory']))
    return {'recommendations': recommendations[:100], 'engine': 'Per-material backtest selection with tuned Croston-SBA, TSB and empirical safety buffer'}


def opex_forecast(payload):
    today = dt.date.today()
    indexes = index_stocks(payload.get('stocks'))
    groups = {}
    for row in payload.get('opex', []):
        code = str(row.get('material_code') or '').strip()
        material = str(row.get('material') or '').strip()
        purchased = parse_date(row.get('date'))
        qty = number(row.get('qty'))
        if (not code and not material) or not purchased or purchased > today or qty <= 0:
            continue
        # Use material and unit to avoid mixing unrelated quantities under a code.
        unit = str(row.get('unit') or '').strip()
        item_key = (code or key(material), key(unit))
        group = groups.setdefault(item_key, {
            'material_code': code, 'material': material, 'unit': unit, 'events': {},
        })
        event = group['events'].setdefault(purchased, 0.0)
        group['events'][purchased] = event + qty

    recommendations = []
    for item in groups.values():
        dates = sorted(item['events'])
        if len(dates) < 3:
            continue
        intervals = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
        intervals = [gap for gap in intervals if gap > 0]
        if len(intervals) < 2:
            continue
        interval_value, interval_model, error_days, interval_folds = select_recurrence_forecast(intervals)
        interval = max(1, int(round(interval_value)))
        last_date = dates[-1]
        due = last_date + dt.timedelta(days=interval)
        days_until = (due - today).days
        values = [item['events'][day] for day in dates]
        typical_qty, quantity_model, quantity_error, quantity_folds = select_recurrence_forecast(values)
        stock = find_stock(indexes, item['material_code'], item['material'])
        current_stock = max(0.0, number(stock['current_stock']))
        available_stock = max(0.0, number(stock.get('available_stock', current_stock)))
        unit = item['unit'] or stock.get('unit') or 'PCS'
        material = stock.get('material') or item['material']
        code = stock.get('material_code') or item['material_code']
        dispersion = statistics.pstdev(intervals) / statistics.mean(intervals) if len(intervals) > 1 and statistics.mean(intervals) > 0 else 1.0
        confidence = 'Tinggi' if len(dates) >= 8 and dispersion <= 0.25 and error_days is not None and error_days <= max(3, interval * 0.2) else 'Sedang' if len(dates) >= 5 and dispersion <= 0.5 and error_days is not None else 'Rendah'
        enough_history = (
            len(dates) >= 6
            and interval_folds >= 3
            and quantity_folds >= 3
            and dispersion <= 0.35
            and error_days is not None
            and error_days <= max(3, interval * 0.25)
            and quantity_error is not None
            and quantity_error <= max(1, typical_qty * 0.5)
        )
        suggested = max(0, math.ceil(typical_qty - available_stock)) if enough_history else None
        urgency = 45 if days_until <= 0 else 38 if days_until <= 7 else 30 if days_until <= 14 else 22 if days_until <= 30 else 8
        score = min(100, urgency + min(25, len(dates) * 3) + (15 if confidence == 'Tinggi' else 8 if confidence == 'Sedang' else 0) + (8 if suggested and suggested > 0 else 0))
        reasons = [
            f"Median siklus pengadaan {interval} hari dari {len(dates)} kejadian",
            f"Model siklus: {interval_model}; model kuantitas: {quantity_model}",
            f"Prediksi tanggal berikutnya {due.isoformat()} ({days_until} hari)",
            f"Galat validasi siklus: {error_days:.1f} hari; kuantitas: {quantity_error:.1f} {unit}" if error_days is not None and quantity_error is not None else 'Histori belum cukup untuk validasi siklus dan jumlah',
            f"Stok fisik {current_stock:g} {unit}; stok tersedia setelah komitmen {available_stock:g} {unit}",
        ]
        if not enough_history:
            reasons.append('Histori siklus tipis atau tidak teratur; jumlah pembelian perlu ditinjau manual')
        recommendations.append({
            'material_code': code, 'material': material, 'unit': unit, 'score': score,
            'suggested_qty': suggested, 'current_stock': round(current_stock, 2),
            'available_stock': round(available_stock, 2),
            'stock_breakdown': {
                'physical': round(current_stock, 2),
                'mib': round(number(stock.get('mib')), 2),
                'mis': round(number(stock.get('mis')), 2),
                'mibs': round(number(stock.get('mibs')), 2),
                'pr_outstanding': round(number(stock.get('pr_outstanding')), 2),
                'po_outstanding': round(number(stock.get('po_outstanding')), 2),
                'do_outstanding': round(number(stock.get('do_outstanding')), 2),
            },
            'median_interval_days': interval, 'predicted_date': due.isoformat(),
            'days_until': days_until, 'confidence': confidence,
            'history_events': len(dates), 'interval_error_days': round(error_days, 1) if error_days is not None else None,
            'quantity_error': round(quantity_error, 2) if quantity_error is not None else None,
            'forecast_model': f'{interval_model} / {quantity_model}', 'reasons': reasons,
        })
    recommendations.sort(key=lambda row: (-row['score'], row['days_until']))
    return {'recommendations': recommendations[:100], 'engine': 'Rolling backtest selection for Opex interval and quantity forecasts'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=('stock', 'opex'), required=True)
    args = parser.parse_args()
    try:
        payload = json.load(sys.stdin)
        result = stock_forecast(payload) if args.mode == 'stock' else opex_forecast(payload)
        print(json.dumps({'success': True, **result}, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({'success': False, 'message': str(exc), 'recommendations': []}, ensure_ascii=False))


if __name__ == '__main__':
    main()
