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
MAX_BACKTEST_ORIGINS = 6


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
            'category': str(row.get('category') or '').strip(),
            'current_stock': number(row.get('current_stock')),
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
        'unit': '', 'category': '', 'current_stock': 0.0,
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
    probability, size = (1.0 if first else 0.0), first
    for demand in values[1:]:
        occurred = 1.0 if demand > 0 else 0.0
        probability = beta * occurred + (1 - beta) * probability
        if occurred:
            size = alpha * demand + (1 - alpha) * size
    return max(0.0, probability * size)


def model_rates(values):
    def mean(seq):
        return sum(seq) / len(seq) if seq else 0.0
    rates = {
        'recent_average': mean(values[-30:]),
        'weighted_average': 0.6 * mean(values[-30:]) + 0.4 * mean(values[-90:]),
        'croston_sba': croston_sba(values),
        'tsb': tsb(values),
    }
    return rates


def forecast_rate(values):
    """Select the lowest-error candidate using expanding-window 30-day tests."""
    if len(values) <= HORIZON_DAYS:
        return 0.0, 'insufficient_history', None, 0
    possible = list(range(max(30, len(values) - MAX_BACKTEST_ORIGINS * HORIZON_DAYS),
                          len(values) - HORIZON_DAYS + 1, HORIZON_DAYS))
    if len(possible) > MAX_BACKTEST_ORIGINS:
        possible = possible[-MAX_BACKTEST_ORIGINS:]
    errors = {name: [] for name in ('recent_average', 'weighted_average', 'croston_sba', 'tsb')}
    for origin in possible:
        actual = sum(values[origin:origin + HORIZON_DAYS])
        rates = model_rates(values[:origin])
        for name, rate in rates.items():
            errors[name].append((rate * HORIZON_DAYS, actual))
    scores = {}
    for name, pairs in errors.items():
        if pairs:
            absolute = sum(abs(pred - actual) for pred, actual in pairs)
            scale = sum(actual for _, actual in pairs)
            scores[name] = absolute / max(scale, 1.0)
    if not scores:
        return max(0.0, model_rates(values)['weighted_average'] * HORIZON_DAYS), 'weighted_average', None, 0
    selected = min(scores, key=scores.get)
    return max(0.0, model_rates(values)[selected] * HORIZON_DAYS), selected, scores[selected], len(errors[selected])


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
        demand_30, model, wape, folds = forecast_rate(series)
        indexes_for_stock = find_stock(indexes, item['material_code'], item['material'])
        current_stock = max(0.0, number(indexes_for_stock['current_stock']))
        unit = item['unit'] or indexes_for_stock.get('unit') or 'PCS'
        material = indexes_for_stock.get('material') or item['material'] or item_key
        code = indexes_for_stock.get('material_code') or item['material_code']
        event_count = sum(1 for qty in series if qty > 0)
        history_days = len(series)
        confidence = confidence_label(history_days, event_count, wape)

        # Forecast-period demand plus a conservative, data-derived buffer from
        # backtest error. With no validation folds, use a 25% provisional buffer.
        buffer = demand_30 * (min(1.0, max(0.15, wape)) if wape is not None else 0.25)
        target = demand_30 + buffer
        suggested = max(0, math.ceil(target - current_stock))
        daily_rate = demand_30 / HORIZON_DAYS
        doi = round(current_stock / daily_rate) if daily_rate > 0 else 999
        # Keep attention on urgent/understocked items; do not recommend a buy
        # just because a material had sales or a temporary price reduction.
        if suggested <= 0 and doi > 45:
            continue

        urgency = 40 if current_stock <= 0 else 30 if doi <= 7 else 22 if doi <= 15 else 14 if doi <= 30 else 5 if doi <= 45 else 0
        evidence = min(25, event_count * 2) + (15 if confidence == 'Tinggi' else 8 if confidence == 'Sedang' else 0)
        score = max(0, min(100, urgency + evidence + (10 if suggested > 0 else 0)))
        history = sorted(costs.get(item['material_code'], []), key=lambda pair: pair[0])
        latest = history[-1][1] if history else 0.0
        median = statistics.median(price for _, price in history) if history else 0.0
        saving = (median - latest) / median * 100 if median > 0 else 0.0
        reasons = [
            f"Model terpilih dari uji historis: {model}",
            f"Perkiraan kebutuhan 30 hari: {demand_30:.1f} {unit}",
            f"Akurasi validasi WAPE: {wape * 100:.1f}% ({folds} periode uji)" if wape is not None else 'Histori belum cukup untuk validasi akurasi',
            f"Stok saat ini {current_stock:g} {unit}; cakupan sekitar {doi} hari" if doi < 999 else f"Stok saat ini {current_stock:g} {unit}",
        ]
        if saving >= 5:
            reasons.append(f"Landed cost terbaru {saving:.1f}% di bawah median historis")
        recommendations.append({
            'material_code': code, 'material': material, 'unit': unit, 'score': score,
            'suggested_qty': suggested, 'current_stock': round(current_stock, 2),
            'days_of_inventory': doi, 'forecast_30d': round(demand_30, 2),
            'forecast_model': model, 'backtest_wape': round(wape, 4) if wape is not None else None,
            'confidence': confidence, 'history_days': history_days, 'history_events': event_count,
            'latest_landed_cost': round(latest, 2), 'median_landed_cost': round(median, 2),
            'saving_percent': round(saving, 2), 'reasons': reasons,
        })
    recommendations.sort(key=lambda row: (-row['score'], row['days_of_inventory']))
    return {'recommendations': recommendations[:100], 'engine': 'Backtested statistical demand forecasting (Croston-SBA, TSB, rolling averages)'}


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
        # Validate recurrence by forecasting each of the last intervals using
        # only prior intervals; this is chronological leave-future-out testing.
        validation_errors = []
        for idx in range(max(1, len(intervals) - 5), len(intervals)):
            training = intervals[:idx]
            if training:
                validation_errors.append(abs(statistics.median(training) - intervals[idx]))
        interval = max(1, int(round(statistics.median(intervals[-6:]))))
        error_days = statistics.median(validation_errors) if validation_errors else None
        last_date = dates[-1]
        due = last_date + dt.timedelta(days=interval)
        days_until = (due - today).days
        values = [item['events'][day] for day in dates]
        typical_qty = statistics.median(values[-6:])
        stock = find_stock(indexes, item['material_code'], item['material'])
        current_stock = max(0.0, number(stock['current_stock']))
        unit = item['unit'] or stock.get('unit') or 'PCS'
        material = stock.get('material') or item['material']
        code = stock.get('material_code') or item['material_code']
        dispersion = statistics.pstdev(intervals) / statistics.mean(intervals) if len(intervals) > 1 and statistics.mean(intervals) > 0 else 1.0
        confidence = 'Tinggi' if len(dates) >= 8 and dispersion <= 0.25 and error_days is not None and error_days <= max(3, interval * 0.2) else 'Sedang' if len(dates) >= 5 and dispersion <= 0.5 else 'Rendah'
        suggested = max(0, math.ceil(typical_qty - current_stock))
        urgency = 45 if days_until <= 0 else 38 if days_until <= 7 else 30 if days_until <= 14 else 22 if days_until <= 30 else 8
        score = min(100, urgency + min(25, len(dates) * 3) + (15 if confidence == 'Tinggi' else 8 if confidence == 'Sedang' else 0) + (8 if suggested > 0 else 0))
        reasons = [
            f"Median siklus pengadaan {interval} hari dari {len(dates)} kejadian",
            f"Prediksi tanggal berikutnya {due.isoformat()} ({days_until} hari)",
            f"Galat median validasi siklus: {error_days:.1f} hari" if error_days is not None else 'Histori belum cukup untuk validasi siklus',
            f"Stok saat ini {current_stock:g} {unit}",
        ]
        recommendations.append({
            'material_code': code, 'material': material, 'unit': unit, 'score': score,
            'suggested_qty': suggested, 'current_stock': round(current_stock, 2),
            'median_interval_days': interval, 'predicted_date': due.isoformat(),
            'days_until': days_until, 'confidence': confidence,
            'history_events': len(dates), 'interval_error_days': round(error_days, 1) if error_days is not None else None,
            'forecast_model': 'rolling_median_recurrence', 'reasons': reasons,
        })
    recommendations.sort(key=lambda row: (-row['score'], row['days_until']))
    return {'recommendations': recommendations[:100], 'engine': 'Chronological backtested Opex recurrence forecasting'}


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
