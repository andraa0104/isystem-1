#!/usr/bin/env python3
"""Purchase Requirement recommendation engine (enhanced with tb_barang stock)."""
import argparse
import datetime as dt
import json
import math
import statistics
import sys


def number(value):
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0


def date(value):
    text = str(value or '').strip()
    for pattern in ('%Y-%m-%d', '%d.%m.%Y', '%d/%m/%Y', '%Y/%m/%d'):
        try:
            return dt.datetime.strptime(text[:10], pattern).date()
        except ValueError:
            continue
    return None


def clean_key(val):
    return str(val or '').strip().lower()


def build_stock_indexes(stocks_payload):
    by_code = {}
    by_name = {}
    for row in stocks_payload or []:
        code = str(row.get('material_code') or '').strip()
        mat = str(row.get('material') or '').strip()
        unit_val = str(row.get('unit') or '').strip()
        cat = str(row.get('category') or '').strip()
        stock_val = number(row.get('current_stock'))

        entry = {
            'material_code': code,
            'material': mat,
            'unit': unit_val,
            'category': cat,
            'current_stock': stock_val,
        }
        if code:
            by_code[clean_key(code)] = entry
        if mat:
            by_name[clean_key(mat)] = entry
    return by_code, by_name


def lookup_stock(by_code, by_name, code, mat):
    k_code = clean_key(code)
    k_name = clean_key(mat)
    if k_code and k_code in by_code:
        return by_code[k_code]
    if k_name and k_name in by_name:
        return by_name[k_name]
    return {
        'material_code': str(code or '').strip(),
        'material': str(mat or '').strip(),
        'unit': '',
        'category': '',
        'current_stock': 0.0,
    }


def stock(payload):
    today = dt.date.today()
    stocks_payload = payload.get('stocks', [])
    stock_by_code, stock_by_name = build_stock_indexes(stocks_payload)

    # 1. Group sales history (demand)
    groups = {}
    for row in payload.get('sales', []):
        mat_code = str(row.get('material_code') or '').strip()
        mat_name = str(row.get('material') or '').strip()
        sold_at = date(row.get('date'))
        qty_val = number(row.get('qty'))
        if (not mat_code and not mat_name) or not sold_at:
            continue

        item_key = mat_code or mat_name
        group = groups.setdefault(item_key, {
            'material_code': mat_code,
            'material': mat_name,
            'unit': str(row.get('unit') or '').strip(),
            'total_qty': 0.0,
            'invoices': set(),
            'dates': [],
            'qtys': [],
        })
        group['total_qty'] += qty_val
        group['invoices'].add(str(row.get('invoice_no') or sold_at))
        group['dates'].append(sold_at)
        group['qtys'].append(qty_val)

    # 2. Group landed costs
    costs = {}
    for row in payload.get('costs', []):
        mat_code = str(row.get('material_code') or '').strip()
        mat_name = str(row.get('material') or '').strip()
        item_key = mat_code or mat_name
        qty, price = number(row.get('qty')), number(row.get('price'))
        if not item_key or qty <= 0:
            continue
        landed = price + number(row.get('shipping_allocated')) / qty
        cost_date = date(row.get('tgl')) or today
        costs.setdefault(item_key, []).append((cost_date, landed, qty))

    # 3. Include fast moving items from tb_barang even if no recent sales in 180 days
    all_keys = set(groups.keys())
    for s_row in stocks_payload:
        cat = str(s_row.get('category') or '').upper()
        cur_stock = number(s_row.get('current_stock'))
        s_code = str(s_row.get('material_code') or '').strip()
        s_mat = str(s_row.get('material') or '').strip()
        s_key = s_code or s_mat
        if s_key and 'FAST' in cat and cur_stock <= 2:
            all_keys.add(s_key)

    result = []
    for item_key in all_keys:
        item = groups.get(item_key, {
            'material_code': item_key if item_key.isdigit() else '',
            'material': item_key,
            'unit': '',
            'total_qty': 0.0,
            'invoices': set(),
            'dates': [],
            'qtys': [],
        })

        # Match with tb_barang stock
        stock_info = lookup_stock(stock_by_code, stock_by_name, item.get('material_code'), item.get('material'))
        current_stock = stock_info['current_stock']
        category = stock_info.get('category', '').strip()
        unit_label = item.get('unit') or stock_info.get('unit') or 'PCS'
        mat_name = stock_info.get('material') or item.get('material') or item_key
        mat_code = stock_info.get('material_code') or item.get('material_code') or ''

        # Calculate sales demand
        dates = item.get('dates', [])
        invoice_count = len(item.get('invoices', []))

        # Recent sales window
        qty_30 = sum(q for d, q in zip(dates, item.get('qtys', [])) if (today - d).days <= 30)
        qty_90 = sum(q for d, q in zip(dates, item.get('qtys', [])) if (today - d).days <= 90)
        qty_180 = item.get('total_qty', 0.0)

        # Cost history & savings
        history = sorted(costs.get(item_key, costs.get(mat_code, costs.get(mat_name, []))), key=lambda row: row[0])
        latest_landed = history[-1][1] if history else 0.0
        median_landed = statistics.median([row[1] for row in history]) if history else 0.0
        saving = ((median_landed - latest_landed) / median_landed * 100) if median_landed > 0 else 0.0

        # Estimated 30-day demand (D30)
        if qty_180 > 0:
            if qty_30 > 0:
                demand_30 = max(qty_30, round(0.6 * (qty_90 / 3.0) + 0.4 * (qty_180 / 6.0)))
            else:
                demand_30 = max(1.0, round(qty_180 / 6.0))
        elif 'FAST' in category.upper():
            po_qtys = [row[2] for row in history if row[2] > 0]
            demand_30 = max(1.0, round(statistics.median(po_qtys))) if po_qtys else 2.0
        else:
            continue

        # Days of Inventory (DOI) based on tb_barang current_stock
        daily_burn = demand_30 / 30.0
        if current_stock <= 0:
            days_of_inventory = 0
        elif daily_burn > 0:
            days_of_inventory = max(0, round(current_stock / daily_burn))
        else:
            days_of_inventory = 999

        # Target stock = 30-day demand + 25% safety stock
        safety_stock = max(1.0, math.ceil(demand_30 * 0.25))
        target_stock = demand_30 + safety_stock
        net_needed = max(0.0, target_stock - current_stock)

        # Suggested purchase quantity
        if net_needed > 0:
            suggested_qty = max(1, math.ceil(net_needed))
        elif current_stock <= demand_30:
            suggested_qty = max(1, math.ceil(demand_30 * 0.5))
        else:
            suggested_qty = 0

        # Filter: If stock in tb_barang is already abundant (DOI > 60 days) and no huge saving, skip
        if current_stock > target_stock * 1.5 and days_of_inventory > 60 and saving < 15:
            continue

        # Multi-factor score (0 - 100)
        # 1. Stock Urgency from tb_barang (max 45 pts)
        if current_stock <= 0:
            urgency_score = 45
        elif days_of_inventory <= 7:
            urgency_score = 40
        elif days_of_inventory <= 15:
            urgency_score = 32
        elif days_of_inventory <= 30:
            urgency_score = 22
        elif days_of_inventory <= 45:
            urgency_score = 12
        else:
            urgency_score = 0

        # 2. Demand Velocity & Regularity (max 35 pts)
        velocity_score = min(20, invoice_count * 4) + min(10, round(demand_30 / 2))
        if 'FAST' in category.upper():
            velocity_score += 5

        # 3. Cost Saving / Arbitrage (max 20 pts)
        cost_score = min(20, round(saving * 0.6)) if saving >= 5 else 0

        total_score = urgency_score + velocity_score + cost_score
        if days_of_inventory > 45:
            total_score -= 25
        score = min(100, max(5, round(total_score)))

        # Build transparent explanation reasons
        reasons = []
        if current_stock <= 0:
            reasons.append(f"Stok Gudang: HABIS (0 {unit_label})")
        elif days_of_inventory <= 30:
            reasons.append(f"Stok Gudang: {current_stock:g} {unit_label} (kritis, cukup ±{days_of_inventory} hari)")
        else:
            reasons.append(f"Stok Gudang: {current_stock:g} {unit_label} (cukup ±{days_of_inventory} hari)")

        if invoice_count > 0:
            reasons.append(f"{invoice_count} invoice (180 hr), proyeksi kebutuhan 30 hr: {demand_30:.0f} {unit_label}")
        elif 'FAST' in category.upper():
            reasons.append(f"Kategori FAST MOVING (estimasi siklus: {demand_30:.0f} {unit_label})")

        if category:
            reasons.append(f"Kategori: {category}")

        if saving >= 5:
            reasons.append(f"Landed cost terbaru {saving:.1f}% di bawah median historis")

        result.append({
            'material_code': mat_code,
            'material': mat_name,
            'unit': unit_label,
            'score': score,
            'suggested_qty': max(1, suggested_qty if suggested_qty > 0 else 1),
            'current_stock': round(current_stock, 2),
            'days_of_inventory': days_of_inventory,
            'latest_landed_cost': round(latest_landed, 2),
            'median_landed_cost': round(median_landed, 2),
            'saving_percent': round(saving, 2),
            'reasons': reasons,
        })

    result.sort(key=lambda row: row['score'], reverse=True)
    return {'recommendations': result[:100], 'engine': 'Python demand, inventory & landed-cost scoring'}


def opex(payload):
    today = dt.date.today()
    stocks_payload = payload.get('stocks', [])
    stock_by_code, stock_by_name = build_stock_indexes(stocks_payload)

    groups = {}
    for row in payload.get('opex', []):
        mat_code = str(row.get('material_code') or '').strip()
        mat_name = str(row.get('material') or '').strip()
        purchased_at = date(row.get('date'))
        qty_val = number(row.get('qty'))
        if (not mat_code and not mat_name) or not purchased_at:
            continue

        item_key = mat_code or mat_name
        group = groups.setdefault(item_key, {
            'material_code': mat_code,
            'material': mat_name,
            'unit': str(row.get('unit') or '').strip(),
            'dates': [],
            'quantities': [],
            'for_customer': str(row.get('for_customer') or '').strip(),
        })
        group['dates'].append(purchased_at)
        group['quantities'].append(qty_val)

    result = []
    for item_key, item in groups.items():
        dates = sorted(set(item['dates']))
        if len(dates) < 2:
            continue

        intervals = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates)) if (dates[i] - dates[i - 1]).days > 0]
        if not intervals:
            continue

        median_interval = max(3, round(statistics.median(intervals)))
        last_date = dates[-1]

        # Calculate projected next cycle
        days_from_last = (today - last_date).days
        if days_from_last <= median_interval + 60:
            due = last_date + dt.timedelta(days=median_interval)
        else:
            # Multi-cycle projection forward to current timeline
            cycles = max(1, math.ceil(days_from_last / median_interval))
            due = last_date + dt.timedelta(days=cycles * median_interval)

        days_until = (due - today).days

        # Check stock in tb_barang
        stock_info = lookup_stock(stock_by_code, stock_by_name, item.get('material_code'), item.get('material'))
        current_stock = stock_info['current_stock']
        unit_label = item.get('unit') or stock_info.get('unit') or 'PCS'
        mat_name = stock_info.get('material') or item.get('material') or item_key
        mat_code = stock_info.get('material_code') or item.get('material_code') or ''

        # Suggested quantity
        typical_qty = max(1, round(statistics.median(item['quantities'])))
        if current_stock > 0 and current_stock < typical_qty:
            suggested_qty = max(1, round(typical_qty - current_stock))
        else:
            suggested_qty = typical_qty

        # Urgency scoring (0 - 100)
        # 1. Timeline urgency (max 50 pts)
        if days_until == 0:
            time_score = 50
        elif 0 < days_until <= 7:
            time_score = 45
        elif 7 < days_until <= 14:
            time_score = 35
        elif 14 < days_until <= 30:
            time_score = 25
        elif -14 <= days_until < 0:
            time_score = 42
        elif -30 <= days_until < -14:
            time_score = 30
        else:
            time_score = 15

        # 2. History depth (max 25 pts)
        history_score = min(25, len(dates) * 7)

        # 3. Stock factor from tb_barang (max 25 pts)
        if current_stock <= 0:
            stock_score = 25
        elif current_stock < typical_qty:
            stock_score = 15
        else:
            stock_score = 0

        score = min(100, max(10, round(time_score + history_score + stock_score)))

        # Build clear Indonesian business reasons
        reasons = [
            f"Pola pengadaan rutin setiap ±{median_interval} hari ({len(dates)} kali riwayat)",
        ]
        if days_until == 0:
            reasons.append(f"Jatuh tempo HARI INI ({due.isoformat()})")
        elif 0 < days_until <= 30:
            reasons.append(f"Jatuh tempo dalam {days_until} hari lagi ({due.isoformat()})")
        elif days_until < 0:
            reasons.append(f"Terlewat {abs(days_until)} hari dari siklus ({due.isoformat()})")
        else:
            reasons.append(f"Prediksi kebutuhan: {due.isoformat()} ({days_until} hari lagi)")

        if current_stock <= 0:
            reasons.append(f"Stok Gudang: HABIS (0 {unit_label})")
        else:
            reasons.append(f"Stok Gudang: {current_stock:g} {unit_label}")

        result.append({
            'material_code': mat_code,
            'material': mat_name,
            'unit': unit_label,
            'score': score,
            'suggested_qty': suggested_qty,
            'current_stock': round(current_stock, 2),
            'median_interval_days': median_interval,
            'predicted_date': due.isoformat(),
            'days_until': days_until,
            'reasons': reasons,
        })

    # Sort: highest score first, then earliest days_until
    result.sort(key=lambda row: (-row['score'], row['days_until']))
    return {'recommendations': result[:100], 'engine': 'Python Opex recurrence forecast & inventory stock'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=('stock', 'opex'), required=True)
    args = parser.parse_args()
    try:
        payload = json.load(sys.stdin)
        out = stock(payload) if args.mode == 'stock' else opex(payload)
        print(json.dumps(out, ensure_ascii=False))
    except Exception as exc:
        print(json.dumps({'success': False, 'message': str(exc), 'recommendations': []}))


if __name__ == '__main__':
    main()
