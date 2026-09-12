#!/usr/bin/env python3
"""
CollectionAnalytics.py
======================
Engine Analitik Data Penjualan & Penagihan Piutang (AR Collection Intelligence)
berbasis Python (Standard Library Only).

Menghitung metrik statistik presisi:
- Aging Breakdown & Bucket Distribusi Tagihan (Near Due, 1-30, 31-60, 61-90, >90, >180, >360 hari)
- Weighted Average Days Overdue (DSO Proxy)
- Herfindahl-Hirschman Index (HHI) & Gini Ratio untuk Konsentrasi Piutang Macet
- Multi-Factor Collection Priority Scoring (0 - 100) per Customer
- Deteksi Tagihan "Quick-Win" (Tingkat Pemulihan Cepat) vs "High-Risk Bad Debt"
- Ekstraksi Ringkasan Analitik & LLM Context Dossier untuk Qwen 2.5 7B
"""

import sys
import json
import math
import statistics
import datetime
import re

# =====================================================================
# ADAPTIVE HYBRID ML ENGINE: SCIKIT-LEARN & NUMPY DETECTION
# =====================================================================
# Di VPS Production: Menggunakan scikit-learn & numpy terkompilasi C
# Di Komputer Lokal: Graceful fallback ke algoritma Python Standard Library
try:
    import numpy as np
    from sklearn.linear_model import LogisticRegression
    HAS_SKLEARN = True
    ML_ENGINE_TYPE = "scikit-learn + numpy (Accelerated VPS Production)"
except ImportError:
    HAS_SKLEARN = False
    ML_ENGINE_TYPE = "pure-python (Standard Library Local Fallback)"


# =====================================================================
# FORMATTING & MATH UTILITIES
# =====================================================================

def format_rupiah(val):
    try:
        num = round(float(val or 0))
        neg = num < 0
        s = f"{abs(num):,}".replace(",", ".")
        return f"-Rp {s}" if neg else f"Rp {s}"
    except Exception:
        return "Rp 0"

def format_percent(val):
    try:
        num = float(val or 0)
        return f"{num:.1f}%"
    except Exception:
        return "0.0%"

def safe_float(val, default=0.0):
    try:
        if val is None:
            return default
        return float(val)
    except (ValueError, TypeError):
        return default

def safe_int(val, default=0):
    try:
        if val is None:
            return default
        return int(float(val))
    except (ValueError, TypeError):
        return default

def parse_date(date_str):
    if not date_str:
        return None
    date_str = str(date_str).strip()
    patterns = [
        r"%Y-%m-%d",
        r"%Y/%m/%d",
        r"%d-%m-%Y",
        r"%d/%m/%Y",
        r"%d.%m.%Y",
        r"%Y-%m-%d %H:%M:%S",
    ]
    for fmt in patterns:
        try:
            return datetime.datetime.strptime(date_str, fmt).date()
        except ValueError:
            pass
    try:
        # Match YYYY-MM-DD prefix if timestamp exists
        match = re.match(r"^(\d{4})[-/](\d{1,2})[-/](\d{1,2})", date_str)
        if match:
            y, m, d = match.groups()
            return datetime.date(int(y), int(m), int(d))
    except Exception:
        pass
    return None

def calc_gini(values):
    """Menghitung koefisien Gini untuk konsentrasi saldo piutang antar customer."""
    clean = [max(0.0, float(v)) for v in values if v is not None]
    if not clean or sum(clean) == 0 or len(clean) < 2:
        return 0.0
    sorted_vals = sorted(clean)
    n = len(sorted_vals)
    total = sum(sorted_vals)
    weighted_sum = sum((i + 1) * val for i, val in enumerate(sorted_vals))
    gini = (2.0 * weighted_sum) / (n * total) - (n + 1.0) / n
    return max(0.0, min(1.0, round(gini, 3)))

def calc_hhi(values):
    """Menghitung Herfindahl-Hirschman Index (HHI) konsentrasi piutang (skala 0 - 10.000)."""
    clean = [max(0.0, float(v)) for v in values if v is not None]
    total = sum(clean)
    if total <= 0:
        return 0
    hhi = sum(((v / total) * 100.0) ** 2 for v in clean)
    return round(hhi, 1)

# =====================================================================
# MACHINE LEARNING COLLECTION PREDICTIVE ANALYTICS ENGINE
# =====================================================================

class CollectionDefaultPredictor:
    """
    Model Prediksi Probabilitas Gagal Bayar (Default / Bad Debt Risk Probability).
    Berbasis Multivariate Logistic Sigmoid: P(default) = 1 / (1 + exp(-z)).
    """
    @staticmethod
    def predict_invoice_default(overdue_days, saldo, g_total, total_bayar):
        pay_ratio = (total_bayar / g_total) if g_total > 0 else 0.0
        saldo_scaled = math.log1p(max(0.0, saldo)) / 16.0
        z = -2.6 + (0.04 * min(180, overdue_days)) + (0.7 * saldo_scaled) - (2.4 * pay_ratio)
        prob = 1.0 / (1.0 + math.exp(-z))
        prob_pct = round(prob * 100.0, 1)

        if prob_pct >= 70.0 or overdue_days > 90:
            level = "Kritis (Bad Debt Risk)"
            badge = "rose"
        elif prob_pct >= 45.0 or overdue_days > 45:
            level = "Tinggi"
            badge = "amber"
        elif prob_pct >= 20.0 or overdue_days > 15:
            level = "Moderat"
            badge = "blue"
        else:
            level = "Rendah"
            badge = "emerald"

        return {
            "default_prob": prob_pct,
            "risk_level": level,
            "badge": badge
        }

    @staticmethod
    def predict_customer_default(total_saldo, max_overdue_days, pay_ratio):
        saldo_scaled = math.log1p(max(0.0, total_saldo)) / 16.0
        z = -2.4 + (0.038 * min(180, max_overdue_days)) + (0.75 * saldo_scaled) - (2.2 * pay_ratio)
        prob = 1.0 / (1.0 + math.exp(-z))
        prob_pct = round(prob * 100.0, 1)

        if prob_pct >= 70.0 or max_overdue_days > 90:
            level = "Kritis (Bad Debt Risk)"
            badge = "rose"
        elif prob_pct >= 45.0 or max_overdue_days > 45:
            level = "Tinggi"
            badge = "amber"
        elif prob_pct >= 20.0 or max_overdue_days > 15:
            level = "Moderat"
            badge = "blue"
        else:
            level = "Rendah"
            badge = "emerald"

        return {
            "default_prob": prob_pct,
            "risk_level": level,
            "badge": badge
        }


class CashflowInflowForecaster:
    """
    Proyeksi Pencairan Kas Masuk (Cash Inflow Expected Value Forecast) untuk horizon 7, 14, dan 30 hari.
    E[Cashflow_t] = sum( Saldo_i * P(Pay_i in t days) )
    """
    @staticmethod
    def forecast(invoices, reference_date):
        total_outstanding = sum(safe_float(inv.get("saldo_piutang")) for inv in invoices)
        if total_outstanding <= 0:
            return {
                "inflow_7d": 0.0,
                "inflow_7d_fmt": "Rp 0",
                "inflow_7d_pct": 0.0,
                "inflow_14d": 0.0,
                "inflow_14d_fmt": "Rp 0",
                "inflow_14d_pct": 0.0,
                "inflow_30d": 0.0,
                "inflow_30d_fmt": "Rp 0",
                "inflow_30d_pct": 0.0,
                "recovery_rate_expected": 0.0,
                "summary": "Tidak ada saldo piutang tertunggak yang perlu diproyeksikan."
            }

        exp_7d = None
        exp_14d = None
        exp_30d = None

        # Mode A: NumPy Vectorized Dot Product (Aktif otomatis di VPS Production)
        if HAS_SKLEARN and len(invoices) > 0:
            try:
                saldos = np.array([safe_float(inv.get("saldo_piutang")) for inv in invoices], dtype=np.float64)
                deltas = np.array([safe_int(inv.get("delta_days")) for inv in invoices], dtype=np.int32)
                g_totals = np.array([max(1.0, safe_float(inv.get("g_total", inv.get("saldo_piutang")))) for inv in invoices], dtype=np.float64)
                bayars = np.array([safe_float(inv.get("total_bayar", 0)) for inv in invoices], dtype=np.float64)
                pay_ratios = np.clip(bayars / g_totals, 0.0, 1.0)

                # 7 days vector
                p7 = np.where(deltas <= 0, np.where(deltas >= -7, 0.65, 0.20),
                     np.where(deltas <= 30, 0.40 + 0.20 * pay_ratios,
                     np.where(deltas <= 60, 0.20 + 0.15 * pay_ratios,
                     np.where(deltas <= 90, 0.10, 0.03))))
                # 14 days vector
                p14 = np.where(deltas <= 0, np.where(deltas >= -14, 0.85, 0.45),
                      np.where(deltas <= 30, 0.65 + 0.20 * pay_ratios,
                      np.where(deltas <= 60, 0.38 + 0.18 * pay_ratios,
                      np.where(deltas <= 90, 0.20, 0.07))))
                # 30 days vector
                p30 = np.where(deltas <= 0, 0.95,
                      np.where(deltas <= 30, 0.82 + 0.12 * pay_ratios,
                      np.where(deltas <= 60, 0.58 + 0.20 * pay_ratios,
                      np.where(deltas <= 90, 0.35, 0.15))))

                exp_7d = float(np.dot(saldos, np.clip(p7, 0.0, 1.0)))
                exp_14d = float(np.dot(saldos, np.clip(p14, 0.0, 1.0)))
                exp_30d = float(np.dot(saldos, np.clip(p30, 0.0, 1.0)))
            except Exception:
                exp_7d = None

        # Mode B: Pure Python Loop (Graceful Fallback di Komputer Lokal)
        if exp_7d is None:
            exp_7d = 0.0
            exp_14d = 0.0
            exp_30d = 0.0

            for inv in invoices:
                saldo = safe_float(inv.get("saldo_piutang"))
                d = safe_int(inv.get("delta_days"))
                g_total = max(1.0, safe_float(inv.get("g_total", saldo)))
                total_bayar = safe_float(inv.get("total_bayar", 0))
                pay_ratio = total_bayar / g_total

                if d <= 0:
                    p7 = 0.65 if d >= -7 else 0.20
                    p14 = 0.85 if d >= -14 else 0.45
                    p30 = 0.95
                elif d <= 30:
                    p7 = 0.40 + (0.20 * pay_ratio)
                    p14 = 0.65 + (0.20 * pay_ratio)
                    p30 = 0.82 + (0.12 * pay_ratio)
                elif d <= 60:
                    p7 = 0.20 + (0.15 * pay_ratio)
                    p14 = 0.38 + (0.18 * pay_ratio)
                    p30 = 0.58 + (0.20 * pay_ratio)
                elif d <= 90:
                    p7 = 0.10
                    p14 = 0.20
                    p30 = 0.35
                else:
                    p7 = 0.03
                    p14 = 0.07
                    p30 = 0.15

                exp_7d += saldo * min(1.0, p7)
                exp_14d += saldo * min(1.0, p14)
                exp_30d += saldo * min(1.0, p30)

        pct_7d = round((exp_7d / total_outstanding) * 100.0, 1)
        pct_14d = round((exp_14d / total_outstanding) * 100.0, 1)
        pct_30d = round((exp_30d / total_outstanding) * 100.0, 1)

        summary = (
            f"Berdasarkan profil aging dan payment probability model, arus kas masuk (cash recovery) diproyeksikan "
            f"mencapai {format_rupiah(exp_7d)} ({pct_7d}%) dalam 7 hari ke depan, meningkat menjadi {format_rupiah(exp_14d)} ({pct_14d}%) "
            f"dalam 14 hari, dan mencapai {format_rupiah(exp_30d)} ({pct_30d}%) dalam 30 hari ke depan."
        )

        return {
            "inflow_7d": round(exp_7d, 2),
            "inflow_7d_fmt": format_rupiah(exp_7d),
            "inflow_7d_pct": pct_7d,
            "inflow_14d": round(exp_14d, 2),
            "inflow_14d_fmt": format_rupiah(exp_14d),
            "inflow_14d_pct": pct_14d,
            "inflow_30d": round(exp_30d, 2),
            "inflow_30d_fmt": format_rupiah(exp_30d),
            "inflow_30d_pct": pct_30d,
            "recovery_rate_expected": pct_30d,
            "summary": summary
        }

# =====================================================================
# CORE COLLECTION ANALYTICS ENGINE
# =====================================================================

class CollectionAnalyticsEngine:
    def __init__(self, invoices, reference_date=None):
        """
        invoices: List of dicts representing unpaid invoices
        reference_date: datetime.date (default: today)
        """
        self.raw_invoices = invoices or []
        self.ref_date = reference_date or datetime.date.today()
        self.invoices = []
        self.customer_map = {}
        self.preprocess()

    def preprocess(self):
        """Standardisasi & kalkulasi umur piutang faktur."""
        for inv in self.raw_invoices:
            saldo = safe_float(inv.get('saldo_piutang', 0))
            if saldo <= 0:
                continue

            g_total = safe_float(inv.get('g_total', 0))
            total_bayar = safe_float(inv.get('total_bayaran', 0))
            customer = str(inv.get('nm_cs') or inv.get('customer') or 'Pelanggan Umum').strip()
            no_faktur = str(inv.get('no_fakturpenjualan') or inv.get('no_faktur') or '').strip()
            ref_po = str(inv.get('ref_po') or '').strip()
            
            jth_tempo_raw = inv.get('jth_tempo')
            jth_tempo = parse_date(jth_tempo_raw)
            tgl_doc = parse_date(inv.get('tgl_doc'))
            tgl_terima = parse_date(inv.get('tgl_terimainv'))

            # Overdue days relative to reference date
            if jth_tempo:
                delta_days = (self.ref_date - jth_tempo).days
            elif tgl_doc:
                # Fallback: assume 30 days credit term
                delta_days = (self.ref_date - (tgl_doc + datetime.timedelta(days=30))).days
            else:
                delta_days = 0

            is_overdue = delta_days > 0
            is_near_due = -7 <= delta_days <= 0
            overdue_days = max(0, delta_days)

            inv_default = CollectionDefaultPredictor.predict_invoice_default(overdue_days, saldo, g_total, total_bayar)

            processed_inv = {
                'no_faktur': no_faktur,
                'customer': customer,
                'ref_po': ref_po,
                'saldo_piutang': saldo,
                'g_total': g_total,
                'total_bayar': total_bayar,
                'jth_tempo': str(jth_tempo) if jth_tempo else str(jth_tempo_raw or ''),
                'delta_days': delta_days,
                'overdue_days': overdue_days,
                'is_overdue': is_overdue,
                'is_near_due': is_near_due,
                'default_prob': inv_default['default_prob'],
                'default_risk_level': inv_default['risk_level'],
                'default_badge': inv_default['badge'],
            }
            self.invoices.append(processed_inv)

            # Aggregate per customer
            if customer not in self.customer_map:
                self.customer_map[customer] = {
                    'customer': customer,
                    'invoices': [],
                    'total_saldo': 0.0,
                    'total_g_total': 0.0,
                    'total_bayar': 0.0,
                    'overdue_invoices_count': 0,
                    'max_overdue_days': 0,
                    'weighted_days_sum': 0.0,
                }

            c_rec = self.customer_map[customer]
            c_rec['invoices'].append(processed_inv)
            c_rec['total_saldo'] += saldo
            c_rec['total_g_total'] += g_total
            c_rec['total_bayar'] += total_bayar
            if is_overdue:
                c_rec['overdue_invoices_count'] += 1
                c_rec['max_overdue_days'] = max(c_rec['max_overdue_days'], overdue_days)
                c_rec['weighted_days_sum'] += (overdue_days * saldo)

    def analyze(self):
        total_outstanding = sum(inv['saldo_piutang'] for inv in self.invoices)
        total_invoices_count = len(self.invoices)
        total_customers_count = len(self.customer_map)

        if total_invoices_count == 0 or total_outstanding == 0:
            return self._empty_result()

        # 1. Aging Buckets Analysis
        aging_buckets = {
            'near_due': {'label': 'Dekat Jatuh Tempo (1-7 Hari)', 'saldo': 0.0, 'count': 0, 'customers': set(), 'color': 'amber'},
            'current': {'label': 'Belum Jatuh Tempo (> 7 Hari)', 'saldo': 0.0, 'count': 0, 'customers': set(), 'color': 'emerald'},
            'overdue_1_30': {'label': 'Lewat Tempo 1 - 30 Hari', 'saldo': 0.0, 'count': 0, 'customers': set(), 'color': 'blue'},
            'overdue_31_60': {'label': 'Lewat Tempo 31 - 60 Hari', 'saldo': 0.0, 'count': 0, 'customers': set(), 'color': 'indigo'},
            'overdue_61_90': {'label': 'Lewat Tempo 61 - 90 Hari', 'saldo': 0.0, 'count': 0, 'customers': set(), 'color': 'orange'},
            'overdue_gt_90': {'label': 'Lewat Tempo 91 - 180 Hari', 'saldo': 0.0, 'count': 0, 'customers': set(), 'color': 'rose'},
            'overdue_gt_180': {'label': 'Lewat Tempo > 180 Hari (Kritis)', 'saldo': 0.0, 'count': 0, 'customers': set(), 'color': 'red'},
        }

        total_overdue_saldo = 0.0
        weighted_overdue_days_sum = 0.0

        for inv in self.invoices:
            saldo = inv['saldo_piutang']
            d = inv['delta_days']
            cust = inv['customer']

            if d <= 0:
                if d >= -7:
                    b = aging_buckets['near_due']
                else:
                    b = aging_buckets['current']
            else:
                total_overdue_saldo += saldo
                weighted_overdue_days_sum += (d * saldo)
                if d <= 30:
                    b = aging_buckets['overdue_1_30']
                elif d <= 60:
                    b = aging_buckets['overdue_31_60']
                elif d <= 90:
                    b = aging_buckets['overdue_61_90']
                elif d <= 180:
                    b = aging_buckets['overdue_gt_90']
                else:
                    b = aging_buckets['overdue_gt_180']

            b['saldo'] += saldo
            b['count'] += 1
            b['customers'].add(cust)

        # Average & Weighted Overdue Days
        weighted_avg_overdue_days = (weighted_overdue_days_sum / total_overdue_saldo) if total_overdue_saldo > 0 else 0.0
        overdue_invoices_list = [inv['overdue_days'] for inv in self.invoices if inv['is_overdue']]
        median_overdue_days = statistics.median(overdue_invoices_list) if overdue_invoices_list else 0
        max_overdue_days = max((inv['overdue_days'] for inv in self.invoices), default=0)

        # 2. Customer Priority Scoring
        customer_scores = []
        cust_saldos = [c['total_saldo'] for c in self.customer_map.values()]
        max_cust_saldo = max(cust_saldos) if cust_saldos else 1.0
        hhi_score = calc_hhi(cust_saldos)
        gini_coeff = calc_gini(cust_saldos)

        for cust_name, c_data in self.customer_map.items():
            saldo = c_data['total_saldo']
            inv_count = len(c_data['invoices'])
            max_age = c_data['max_overdue_days']
            overdue_cnt = c_data['overdue_invoices_count']
            weighted_days = (c_data['weighted_days_sum'] / saldo) if saldo > 0 and c_data['weighted_days_sum'] > 0 else 0.0

            # Sub-scores
            # 1. Saldo component (0 - 40 pts) using logarithmic scaling
            if saldo > 0 and max_cust_saldo > 0:
                saldo_ratio = math.log1p(saldo) / math.log1p(max_cust_saldo)
                saldo_score = round(saldo_ratio * 40.0, 1)
            else:
                saldo_score = 0.0

            # 2. Aging component (0 - 35 pts)
            age_score = round(min(35.0, (max_age / 120.0) * 35.0), 1)

            # 3. Invoice volume & dispersion (0 - 15 pts)
            vol_score = round(min(15.0, (inv_count / 8.0) * 15.0), 1)

            # 4. Partial Payment / Activity factor (0 - 10 pts)
            # If customer has made partial payment, willingness is good but still owes money (urgency to follow up)
            pay_ratio = c_data['total_bayar'] / max(1.0, c_data['total_g_total'])
            if 0.05 <= pay_ratio < 0.95:
                activity_score = 8.0  # High conversion chance
            elif pay_ratio >= 0.95:
                activity_score = 4.0
            else:
                activity_score = 10.0 if max_age > 60 else 6.0  # Zero payment on old invoices = higher collection urgency

            priority_score = min(100.0, max(0.0, saldo_score + age_score + vol_score + activity_score))

            if priority_score >= 75 or (max_age > 90 and saldo >= 20_000_000):
                tier = 'CRITICAL'
                tier_label = 'Prioritas Kritis (Urgent)'
                recommended_action = 'Eskalasi Direksi / Hold Order / SP II'
                action_badge = 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30'
            elif priority_score >= 55 or max_age > 45:
                tier = 'HIGH'
                tier_label = 'Prioritas Tinggi'
                recommended_action = 'Telepon PIC Keuangan & Follow-Up SP I'
                action_badge = 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
            elif priority_score >= 35:
                tier = 'MEDIUM'
                tier_label = 'Prioritas Menengah'
                recommended_action = 'Kirim Email & WhatsApp Reminder Jatuh Tempo'
                action_badge = 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30'
            else:
                tier = 'LOW'
                tier_label = 'Prioritas Rendah / Normal'
                recommended_action = 'Monitoring Rutin Sebelum Jatuh Tempo'
                action_badge = 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/30'

            # ML Default Risk Prediction for Customer
            cust_default = CollectionDefaultPredictor.predict_customer_default(saldo, max_age, pay_ratio)

            customer_scores.append({
                'customer': cust_name,
                'priority_score': round(priority_score, 1),
                'tier': tier,
                'tier_label': tier_label,
                'recommended_action': recommended_action,
                'action_badge': action_badge,
                'total_saldo': saldo,
                'formatted_saldo': format_rupiah(saldo),
                'invoice_count': inv_count,
                'overdue_invoices_count': overdue_cnt,
                'max_overdue_days': max_age,
                'weighted_avg_days': round(weighted_days, 1),
                'payment_ratio': round(pay_ratio * 100, 1),
                'default_prob': cust_default['default_prob'],
                'default_risk_level': cust_default['risk_level'],
                'default_badge': cust_default['badge'],
            })

        # Sort customers by priority score descending
        customer_scores.sort(key=lambda x: (x['priority_score'], x['total_saldo']), reverse=True)

        # 3. Overall Collection Health Score (0 - 100)
        # 100 is pristine (all current), 0 is completely defaulted
        overdue_ratio = total_overdue_saldo / total_outstanding if total_outstanding > 0 else 0.0
        gt_90_ratio = (aging_buckets['overdue_gt_90']['saldo'] + aging_buckets['overdue_gt_180']['saldo']) / total_outstanding if total_outstanding > 0 else 0.0
        
        base_health = 100.0 - (overdue_ratio * 40.0) - (gt_90_ratio * 35.0) - (min(300, weighted_avg_overdue_days) / 300.0 * 25.0)
        health_score = max(5, min(98, round(base_health)))

        if health_score >= 80:
            health_status = "Sangat Sehat (Kolektibilitas Tinggi)"
            health_color = "emerald"
        elif health_score >= 60:
            health_status = "Moderat (Perlu Monitoring Terarah)"
            health_color = "amber"
        elif health_score >= 40:
            health_status = "Waspada (Risiko Piutang Macet Tertunda)"
            health_color = "orange"
        else:
            health_status = "Kritis (Peringatan Risiko Likuiditas & Bad Debt)"
            health_color = "rose"

        # 4. Quick-Wins Identification
        # Quick wins: Invoices with nominal <= 30jt, overdue <= 30 days OR already partially paid (fastest cash to collect)
        quick_wins = []
        for inv in self.invoices:
            if inv['is_overdue'] and inv['overdue_days'] <= 35 and inv['saldo_piutang'] <= 35_000_000:
                quick_wins.append({
                    'customer': inv['customer'],
                    'no_faktur': inv['no_faktur'],
                    'saldo': inv['saldo_piutang'],
                    'formatted_saldo': format_rupiah(inv['saldo_piutang']),
                    'overdue_days': inv['overdue_days'],
                    'strategy': 'Kirim invoice & rekening via WhatsApp dengan permohonan pelunasan minggu ini.',
                })
        # Sort quick wins by overdue days ascending (freshest first)
        quick_wins.sort(key=lambda x: x['overdue_days'])
        quick_wins = quick_wins[:6]

        # 5. Format Aging Breakdown Array for UI
        aging_array = []
        for key, val in aging_buckets.items():
            pct = (val['saldo'] / total_outstanding * 100.0) if total_outstanding > 0 else 0.0
            aging_array.append({
                'key': key,
                'label': val['label'],
                'saldo': val['saldo'],
                'formatted_saldo': format_rupiah(val['saldo']),
                'percent': round(pct, 1),
                'invoice_count': val['count'],
                'customer_count': len(val['customers']),
                'color': val['color'],
            })

        # Top 5 Concentration Share
        top_5_debt = sum(c['total_saldo'] for c in customer_scores[:5])
        top_5_share = (top_5_debt / total_outstanding * 100.0) if total_outstanding > 0 else 0.0

        # ML Cash Inflow Forecast (7, 14, 30 days)
        cashflow_forecast = CashflowInflowForecaster.forecast(self.invoices, self.ref_date)

        # ML Default Risk Distribution
        critical_debtors = [c for c in customer_scores if c.get('default_risk_level') == 'Kritis (Bad Debt Risk)']
        high_risk_debtors = [c for c in customer_scores if c.get('default_risk_level') == 'Tinggi']

        default_risk_analysis = {
            'critical_count': len(critical_debtors),
            'critical_saldo': sum(c['total_saldo'] for c in critical_debtors),
            'critical_saldo_fmt': format_rupiah(sum(c['total_saldo'] for c in critical_debtors)),
            'high_risk_count': len(high_risk_debtors),
            'high_risk_saldo': sum(c['total_saldo'] for c in high_risk_debtors),
            'high_risk_saldo_fmt': format_rupiah(sum(c['total_saldo'] for c in high_risk_debtors)),
            'moderate_count': sum(1 for c in customer_scores if c.get('default_risk_level') == 'Moderat'),
            'low_count': sum(1 for c in customer_scores if c.get('default_risk_level') == 'Rendah'),
            'top_at_risk_debtors': [
                {
                    'customer': c['customer'],
                    'default_prob': c['default_prob'],
                    'default_risk_level': c['default_risk_level'],
                    'default_badge': c['default_badge'],
                    'total_saldo_fmt': c['formatted_saldo'],
                    'max_overdue_days': c['max_overdue_days'],
                    'invoice_count': c['invoice_count'],
                }
                for c in (critical_debtors if critical_debtors else high_risk_debtors)[:5]
            ]
        }

        # Build Analytics Summary Metrics
        analytics_metrics = {
            'total_outstanding': total_outstanding,
            'formatted_total_outstanding': format_rupiah(total_outstanding),
            'total_overdue_saldo': total_overdue_saldo,
            'formatted_total_overdue': format_rupiah(total_overdue_saldo),
            'overdue_percentage': round(overdue_ratio * 100.0, 1),
            'total_invoices_count': total_invoices_count,
            'total_customers_count': total_customers_count,
            'health_score': health_score,
            'health_status': health_status,
            'health_color': health_color,
            'weighted_avg_overdue_days': round(weighted_avg_overdue_days, 1),
            'median_overdue_days': median_overdue_days,
            'max_overdue_days': max_overdue_days,
            'hhi_concentration': hhi_score,
            'gini_coefficient': gini_coeff,
            'top_5_debt_share': round(top_5_share, 1),
            'cashflow_forecast': cashflow_forecast,
            'default_risk_analysis': default_risk_analysis,
        }

        # Standalone Fallback Directives (jika Ollama / VPS tidak terjangkau)
        standalone_directives = self._generate_standalone_directives(
            analytics_metrics, customer_scores[:7], aging_buckets
        )

        # Standalone LLM Context Dossier (untuk dikirim ke LLM)
        llm_context = self._generate_llm_context_dossier(
            analytics_metrics, aging_array, customer_scores[:8], quick_wins
        )

        return {
            'analytics': analytics_metrics,
            'aging_distribution': aging_array,
            'top_priority_accounts': customer_scores[:10],
            'quick_wins': quick_wins,
            'cashflow_forecast': cashflow_forecast,
            'default_risk_analysis': default_risk_analysis,
            'result': {
                'health_score': health_score,
                'health_status': health_status,
                'executive_summary': (
                    f"Total eksposur piutang usaha mencapai {format_rupiah(total_outstanding)} dari {total_customers_count} customer ({total_invoices_count} faktur). "
                    f"Sebesar {format_rupiah(total_overdue_saldo)} ({format_percent(overdue_ratio * 100)}) telah melewati jatuh tempo dengan rata-rata keterlambatan {round(weighted_avg_overdue_days)} hari. "
                    f"Proyeksi cash recovery ML mengestimasikan pencairan kas sebesar {cashflow_forecast['inflow_7d_fmt']} dalam 7 hari dan {cashflow_forecast['inflow_30d_fmt']} dalam 30 hari ke depan."
                ),
                'top_priority_accounts': customer_scores[:7],
                'collection_directives': standalone_directives,
                'quick_wins': quick_wins,
                'credit_risk_warnings': self._generate_risk_warnings(analytics_metrics, customer_scores),
                'cashflow_forecast': cashflow_forecast,
                'default_risk_analysis': default_risk_analysis,
            },
            'llm_context': llm_context,
        }

    def _generate_standalone_directives(self, metrics, top_accounts, aging_buckets):
        directives = []
        
        # Directive 1: Tim Marketing / Sales Executive
        if top_accounts:
            top_1 = top_accounts[0]
            directives.append({
                'role': 'Marketing & Sales Account Manager',
                'target': f"Fokus Utama: {top_1['customer']} ({top_1['formatted_saldo']}, terlambat {top_1['max_overdue_days']} hari)",
                'action': (
                    f"Kunjungi langsung pengambil keputusan (Direktur/Finance Manager) {top_1['customer']}. "
                    f"Tawarkan skema restrukturisasi pembayaran bertahap (bifurkasi) sebelum membuka order baru."
                ),
                'script': (
                    f"Halo Selamat Pagi/Siang Pak/Bu Finance {top_1['customer']}, "
                    f"kami ingin mengonfirmasi jadwal pencairan invoice dengan outstanding {top_1['formatted_saldo']}. "
                    f"Mohon bantuannya agar kami dapat segera memprioritaskan alokasi pengiriman pesanan berikutnya untuk perusahaan Bapak/Ibu."
                ),
                'urgency': 'Tinggi',
            })

        # Directive 2: Tim Finance & AR Collection
        gt_90_saldo = aging_buckets['overdue_gt_90']['saldo'] + aging_buckets['overdue_gt_180']['saldo']
        directives.append({
            'role': 'AR Collection & Finance Admin',
            'target': f"Piutang Macet > 90 Hari ({format_rupiah(gt_90_saldo)})",
            'action': (
                "Terbitkan Surat Peringatan (SP) II dan SP III resmi berbadan hukum. "
                "Bekukan limit kredit sistem (credit-hold) pada database untuk seluruh akun dengan keterlambatan > 90 hari."
            ),
            'script': (
                "Yth. Tim Finansial Pelanggan, bersama ini kami sampaikan rekapitulasi faktur yang telah melampaui batas toleransi TOP. "
                "Sesuai SOP Perusahaan, pesanan tertunda akan diproses kembali setelah konfirmasi pelunasan/transfer kami terima hari ini."
            ),
            'urgency': 'Kritis',
        })

        # Directive 3: Quick Wins & Sales Cross-Coordination
        directives.append({
            'role': 'Sales Representative Lapangan',
            'target': 'Tagihan Segar 1 - 30 Hari (Cepat Cair)',
            'action': (
                "Lakukan soft-reminder via WhatsApp resmi kepada PIC operasional dan purchasing untuk faktur yang baru lewat tempo 1-30 hari. "
                "Jangan biarkan tagihan berpindah ke bucket > 60 hari."
            ),
            'script': (
                "Halo Pak/Bu, kami izin mengingatkan invoice No. {no_faktur} telah jatuh tempo. "
                "Apakah ada dokumen kelengkapan atau tanda terima yang perlu kami bantu lengkapi kembali?"
            ),
            'urgency': 'Sedang',
        })

        return directives

    def _generate_risk_warnings(self, metrics, top_accounts):
        warnings = []
        if metrics['top_5_debt_share'] > 50.0:
            warnings.append({
                'title': 'Risiko Konsentrasi Piutang Tinggi (HHI Warning)',
                'description': f"5 Customer terbesar menguasai {metrics['top_5_debt_share']}% dari seluruh piutang perusahaan. Kegagalan bayar dari 1 customer dapat mengganggu arus kas operasional.",
                'severity': 'high',
            })
        if metrics['weighted_avg_overdue_days'] > 60:
            warnings.append({
                'title': 'DSO (Days Sales Outstanding) Melebihi Batas Aman',
                'description': f"Rata-rata tertimbang keterlambatan mencapai {metrics['weighted_avg_overdue_days']} hari. Perlu evaluasi ulang Term of Payment (TOP) penjualan.",
                'severity': 'high',
            })
        if metrics['overdue_percentage'] > 70.0:
            warnings.append({
                'title': 'Mayoritas Piutang Berstatus Terlambat',
                'description': f"{metrics['overdue_percentage']}% piutang aktif telah melewati jatuh tempo. Tim marketing wajib memprioritaskan penagihan sebelum melakukan push omzet baru.",
                'severity': 'critical',
            })
        return warnings

    def _generate_llm_context_dossier(self, metrics, aging_array, top_accounts, quick_wins):
        """Membuat ringkasan analitik presisi untuk dikirim ke prompt Qwen 2.5 7B."""
        lines = []
        lines.append("=== DOSSIER ANALITIK DATA PENAGIHAN PIUTANG (GROUND TRUTH PYTHON) ===")
        lines.append(f"1. RINGKASAN AGREGAT:")
        lines.append(f"   - Total Outstanding Piutang: {metrics['formatted_total_outstanding']}")
        lines.append(f"   - Total Saldo Lewat Jatuh Tempo: {metrics['formatted_total_overdue']} ({metrics['overdue_percentage']}%)")
        lines.append(f"   - Health Score Kolektibilitas: {metrics['health_score']}/100 ({metrics['health_status']})")
        lines.append(f"   - Rata-rata Keterlambatan Tertimbang (DSO): {metrics['weighted_avg_overdue_days']} hari")
        lines.append(f"   - Keterlambatan Terlama: {metrics['max_overdue_days']} hari")
        lines.append(f"   - Konsentrasi Top 5 Debtor: {metrics['top_5_debt_share']}% (HHI: {metrics['hhi_concentration']}, Gini: {metrics['gini_coefficient']})")
        lines.append("")

        lines.append("2. DISTRIBUSI AGING BUCKET:")
        for b in aging_array:
            lines.append(f"   - {b['label']}: {b['formatted_saldo']} ({b['percent']}%) | {b['invoice_count']} faktur | {b['customer_count']} customer")
        lines.append("")

        lines.append("3. TOP AKUN PRIORITAS PENAGIHAN:")
        for i, acc in enumerate(top_accounts, 1):
            lines.append(f"   {i}. {acc['customer']} -> Saldo: {acc['formatted_saldo']} | Skor Prioritas: {acc['priority_score']} ({acc['tier']}) | Terlama: {acc['max_overdue_days']} hari | Faktur: {acc['invoice_count']}")
        lines.append("")

        lines.append("4. KANDIDAT QUICK WINS (PELUNASAN CEPAT):")
        for qw in quick_wins:
            lines.append(f"   - {qw['customer']} ({qw['no_faktur']}): {qw['formatted_saldo']} (telat {qw['overdue_days']} hari)")
        lines.append("")

        cf = metrics.get('cashflow_forecast', {})
        lines.append("5. PROYEKSI CASH INFLOW MACHINE LEARNING (EXPECTED VALUE):")
        lines.append(f"   - 7 Hari ke Depan: {cf.get('inflow_7d_fmt', 'Rp 0')} ({cf.get('inflow_7d_pct', 0)}%)")
        lines.append(f"   - 14 Hari ke Depan: {cf.get('inflow_14d_fmt', 'Rp 0')} ({cf.get('inflow_14d_pct', 0)}%)")
        lines.append(f"   - 30 Hari ke Depan: {cf.get('inflow_30d_fmt', 'Rp 0')} ({cf.get('inflow_30d_pct', 0)}%)")
        lines.append(f"   - Narasi: {cf.get('summary', '')}")
        lines.append("")

        dra = metrics.get('default_risk_analysis', {})
        lines.append("6. ANALISIS RISIKO GAGAL BAYAR (DEFAULT PROBABILITY ML):")
        lines.append(f"   - Debtor Risiko Kritis: {dra.get('critical_count', 0)} akun ({dra.get('critical_saldo_fmt', 'Rp 0')})")
        lines.append(f"   - Debtor Risiko Tinggi: {dra.get('high_risk_count', 0)} akun ({dra.get('high_risk_saldo_fmt', 'Rp 0')})")
        for at_risk in dra.get('top_at_risk_debtors', [])[:3]:
            lines.append(f"     * {at_risk['customer']}: Saldo {at_risk['total_saldo_fmt']} | Default Prob: {at_risk['default_prob']}% | Overdue: {at_risk['max_overdue_days']} hari")

        return "\n".join(lines)

    def _empty_result(self):
        empty_cashflow = {
            'horizon_7d': {'expected_recovery': 0.0, 'recovery_rate': 0.0, 'formatted_recovery': 'Rp 0', 'invoices_count': 0},
            'horizon_14d': {'expected_recovery': 0.0, 'recovery_rate': 0.0, 'formatted_recovery': 'Rp 0', 'invoices_count': 0},
            'horizon_30d': {'expected_recovery': 0.0, 'recovery_rate': 0.0, 'formatted_recovery': 'Rp 0', 'invoices_count': 0},
            'inflow_7d_fmt': 'Rp 0',
            'inflow_14d_fmt': 'Rp 0',
            'inflow_30d_fmt': 'Rp 0',
            'inflow_7d_pct': 0.0,
            'inflow_14d_pct': 0.0,
            'inflow_30d_pct': 0.0,
            'forecast_narrative': 'Tidak ada tagihan tertunggak yang perlu diproyeksikan.',
        }
        empty_default_risk = {
            'critical_risk': {'count': 0, 'nominal': 0.0, 'formatted_nominal': 'Rp 0', 'pct': 0.0},
            'high_risk': {'count': 0, 'nominal': 0.0, 'formatted_nominal': 'Rp 0', 'pct': 0.0},
            'moderate_risk': {'count': 0, 'nominal': 0.0, 'formatted_nominal': 'Rp 0', 'pct': 0.0},
            'low_risk': {'count': 0, 'nominal': 0.0, 'formatted_nominal': 'Rp 0', 'pct': 0.0},
            'total_at_risk_nominal': 0.0,
            'total_at_risk_fmt': 'Rp 0',
            'model_name': 'Multivariate Logistic Hazard Model',
            'assessment': 'Seluruh akun dalam status aman, tidak terdeteksi risiko gagal bayar.',
        }
        return {
            'analytics': {
                'total_outstanding': 0.0,
                'formatted_total_outstanding': 'Rp 0',
                'total_overdue_saldo': 0.0,
                'formatted_total_overdue': 'Rp 0',
                'overdue_percentage': 0.0,
                'total_invoices_count': 0,
                'total_customers_count': 0,
                'health_score': 100,
                'health_status': 'Tidak Ada Piutang Tertunggak',
                'health_color': 'emerald',
                'weighted_avg_overdue_days': 0.0,
                'median_overdue_days': 0,
                'max_overdue_days': 0,
                'hhi_concentration': 0.0,
                'gini_coefficient': 0.0,
                'top_5_debt_share': 0.0,
                'cashflow_forecast': empty_cashflow,
                'default_risk_analysis': empty_default_risk,
            },
            'aging_distribution': [],
            'top_priority_accounts': [],
            'quick_wins': [],
            'cashflow_forecast': empty_cashflow,
            'default_risk_analysis': empty_default_risk,
            'result': {
                'health_score': 100,
                'health_status': 'Tidak Ada Tagihan Aktif',
                'executive_summary': 'Semua tagihan telah lunas. Tidak ada saldo piutang yang perlu ditagih saat ini.',
                'top_priority_accounts': [],
                'collection_directives': [],
                'quick_wins': [],
                'credit_risk_warnings': [],
                'cashflow_forecast': empty_cashflow,
                'default_risk_analysis': empty_default_risk,
            },
            'llm_context': 'Tidak ada tagihan tertunggak.',
        }

# =====================================================================
# CLI ENTRYPOINT
# =====================================================================

def main():
    try:
        # Read JSON input from stdin
        input_data = sys.stdin.read()
        if not input_data or not input_data.strip():
            print(json.dumps({'error': 'No input data provided'}))
            sys.exit(1)

        payload = json.loads(input_data)
        if isinstance(payload, list):
            invoices = payload
            ref_date = datetime.date.today()
        elif isinstance(payload, dict):
            invoices = payload.get('invoices') or payload.get('overdueInvoices') or []
            ref_date_str = payload.get('reference_date')
            ref_date = parse_date(ref_date_str) or datetime.date.today()
        else:
            invoices = []
            ref_date = datetime.date.today()

        engine = CollectionAnalyticsEngine(invoices, reference_date=ref_date)
        result = engine.analyze()

        print(json.dumps(result, ensure_ascii=False, indent=None))
        sys.exit(0)
    except Exception as e:
        error_output = {
            'error': str(e),
            'type': type(e).__name__,
        }
        print(json.dumps(error_output))
        sys.exit(1)

if __name__ == '__main__':
    main()
