#!/usr/bin/env python3
"""
MarketingAnalytics.py
======================
Engine Analitik Data Penjualan B2B berbasis Python (Standard Library Only).
Menghitung metrik statistik presisi:
- Pareto (80/20) & Indeks Konsentrasi Pasar Herfindahl-Hirschman (HHI) & Gini Ratio
- Analisis Dinamika Kohort Pelanggan (New, Expanding, Stable, Contracting, Churn) & NRR
- Deteksi Anomali & Outlier Statistik (Z-Score & IQR)
- Analisis RFM (Recency, Frequency, Monetary) & Volatilitas Pembelian (CV)
- Multi-Factor Weighted Health Score (0-100)
- Ekstraksi Ringkasan Analitik & LLM Context Dossier untuk Qwen 2.5 7B
"""

import sys
import json
import math
import statistics
import datetime
import re

# =====================================================================
# FORMATTING & MATH UTILITIES
# =====================================================================

def format_rupiah(val):
    try:
        num = round(float(val or 0))
        # Format integer with dot thousand separator
        neg = num < 0
        s = f"{abs(num):,}".replace(",", ".")
        return f"-Rp {s}" if neg else f"Rp {s}"
    except Exception:
        return "Rp 0"

def format_percent(val):
    try:
        num = float(val or 0)
        prefix = "+" if num > 0 else ""
        return f"{prefix}{num:.2f}%"
    except Exception:
        return "0.00%"

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

def calc_mean(numbers):
    if not numbers:
        return 0.0
    return sum(numbers) / len(numbers)

def calc_stdev(numbers):
    if len(numbers) < 2:
        return 0.0
    try:
        return statistics.stdev(numbers)
    except Exception:
        m = calc_mean(numbers)
        variance = sum((x - m) ** 2 for x in numbers) / (len(numbers) - 1)
        return math.sqrt(variance)

def calc_median(numbers):
    if not numbers:
        return 0.0
    sorted_nums = sorted(numbers)
    n = len(sorted_nums)
    mid = n // 2
    if n % 2 == 1:
        return float(sorted_nums[mid])
    return (float(sorted_nums[mid - 1]) + float(sorted_nums[mid])) / 2.0

def calc_iqr(numbers):
    if not numbers:
        return 0.0, 0.0, 0.0
    sorted_nums = sorted(numbers)
    n = len(sorted_nums)
    q1_idx = int(0.25 * n)
    q3_idx = int(0.75 * n)
    q1 = float(sorted_nums[q1_idx])
    q3 = float(sorted_nums[q3_idx])
    iqr = q3 - q1
    return q1, q3, iqr

def calc_gini(values):
    """Menghitung koefisien Gini untuk mengukur ketimpangan distribusi penjualan."""
    clean = [max(0.0, float(v)) for v in values if v is not None]
    if not clean or sum(clean) == 0:
        return 0.0
    sorted_v = sorted(clean)
    n = len(sorted_v)
    total = sum(sorted_v)
    numerator = sum((2 * (i + 1) - n - 1) * val for i, val in enumerate(sorted_v))
    gini = numerator / (n * total) if (n * total) > 0 else 0.0
    return max(0.0, min(1.0, round(gini, 4)))

def linear_regression_slope(points):
    """Menghitung slope garis regresi tren time-series (y = mx + b)."""
    if len(points) < 2:
        return 0.0
    n = len(points)
    x = list(range(n))
    y = [float(p) for p in points]
    sum_x = sum(x)
    sum_y = sum(y)
    sum_xx = sum(xi * xi for xi in x)
    sum_xy = sum(xi * yi for xi, yi in zip(x, y))
    denominator = (n * sum_xx) - (sum_x ** 2)
    if denominator == 0:
        return 0.0
    slope = ((n * sum_xy) - (sum_x * sum_y)) / denominator
    return slope

# =====================================================================
# ENRICHMENT: CUSTOMER DIAGNOSTIC MATRIX & RANKINGS
# =====================================================================

def enrich_customer_matrix(all_customers, total_sales, mean_delta, stdev_delta):
    """
    Enrich entire customer dataset with exact statistical rankings, 
    Z-scores, diagnostic matrix, and tactical AI actions.
    """
    sorted_customers = sorted(all_customers, key=lambda x: safe_float(x.get("curr_sales")), reverse=True)

    enriched_list = []
    for rank, c in enumerate(sorted_customers, 1):
        item = dict(c)
        curr_s = safe_float(item.get("curr_sales"))
        prev_s = safe_float(item.get("prev_sales"))
        diff = curr_s - prev_s
        growth = ((curr_s - prev_s) / prev_s * 100.0) if prev_s > 0 else (100.0 if curr_s > 0 else 0.0)
        contrib = (curr_s / total_sales * 100.0) if total_sales > 0 else 0.0
        curr_inv = safe_int(item.get("curr_invoices"))
        prev_inv = safe_int(item.get("prev_invoices"))
        avg_invoice = (curr_s / curr_inv) if curr_inv > 0 else 0.0
        z_score = (diff - mean_delta) / stdev_delta if stdev_delta > 0 else 0.0

        item["rank"] = rank
        item["contribution"] = round(contrib, 2)
        item["growth"] = round(growth, 2)
        item["diff_sales"] = diff
        item["avg_invoice_value"] = round(avg_invoice, 2)
        item["z_score"] = round(z_score, 2)

        # AI Status & Diagnostic Matrix berbasis analisis data statistik
        if curr_s <= 0 and prev_s <= 0:
            ai_status = "Non-Aktif"
            ai_badge = "gray"
            ai_action = "📋 Kirimkan Brosur & Katalog Material Baru"
            ai_reason = "Belum ada riwayat transaksi pada periode berjalan maupun pembanding."
        elif curr_s <= 0 and prev_s > 0:
            ai_status = "Dormant (Macet)"
            ai_badge = "rose"
            ai_action = "🔄 Kunjungan Re-Aktivasi Sales & Audit Akar Masalah Churn"
            ai_reason = f"Customer churn: Sebelumnya belanja {format_rupiah(prev_s)} ({prev_inv} faktur) di periode lalu, kini 0 faktur."
        elif prev_s <= 0 and curr_s > 0:
            ai_status = "Akun Baru (Akuisisi)"
            ai_badge = "cyan"
            ai_action = "🎯 Onboarding Intensif & Kenalkan Portofolio Material"
            ai_reason = f"Pelanggan baru bertransaksi pertama kali {format_rupiah(curr_s)} ({curr_inv} faktur). Kawal pemenuhan pesanan."
        elif rank <= 5 and growth >= 0:
            ai_status = "VIP Growth Leader"
            ai_badge = "emerald"
            ai_action = "🛡️ Kunci Kontrak Tahunan & Proteksi Alokasi Stok VIP"
            ai_reason = f"Penyumbang omset inti ({contrib:.1f}% omset) dengan tren akselerasi (+{growth:.1f}%). Berikan prioritas alokasi barang."
        elif rank <= 5 and growth < 0:
            ai_status = "VIP At-Risk"
            ai_badge = "rose"
            ai_action = "🚨 Intervensi Langsung CCO: Re-Negosiasi & Mitigasi Churn"
            ai_reason = f"Customer VIP mengalami defisit omset {format_rupiah(abs(diff))} ({growth:.1f}%). Prioritas mitigasi darurat tim komersial."
        elif z_score <= -1.8:
            ai_status = "Anomali Drop Kritis (Z-Outlier)"
            ai_badge = "rose"
            ai_action = "⚠️ Investigasi Darurat: Audit Sisa Stok & Tawarkan Harga Penyelamatan"
            ai_reason = f"Penurunan menyimpang tajam secara statistik (Z-score: {z_score:.1f}, defisit {format_rupiah(abs(diff))})."
        elif growth >= 25 and curr_s > 0:
            ai_status = "Akselerasi Tinggi"
            ai_badge = "emerald"
            ai_action = "🚀 Cross-Selling Kategori Baru & Kemitraan Strategis"
            ai_reason = f"Pertumbuhan volume sangat kuat (+{growth:.1f}%). Peluang besar ekspansi kategori material lain."
        elif growth >= 0 and growth < 25 and curr_s > 0:
            ai_status = "Konsisten & Stabil"
            ai_badge = "blue"
            ai_action = "📈 Kunci Jadwal Repeat Order Rutin & Lock Volume"
            ai_reason = f"Pola belanja stabil dan teratur ({curr_inv} faktur). Pertahankan kepuasan dan konsistensi supply."
        elif growth < 0 and growth >= -15:
            ai_status = "Penurunan Ringan"
            ai_badge = "amber"
            ai_action = "🔍 Follow-up Purchasing & Cek Kendala Operasional"
            ai_reason = f"Penurunan omset wajar ({growth:.1f}%), perlu pengingat jadwal order dan penawaran berkala."
        elif growth < -15:
            ai_status = "Menurun Signifikan"
            ai_badge = "orange"
            ai_action = "⚠️ Audit Kebutuhan Purchasing & Berikan Diskon Paket"
            ai_reason = f"Penurunan volume {format_rupiah(abs(diff))} ({growth:.1f}%). Periksa kendala kompetitor atau penundaan proyek."
        else:
            ai_status = "Reguler"
            ai_badge = "blue"
            ai_action = "📦 Monitoring Pemesanan Reguler"
            ai_reason = "Transaksi berjalan sesuai pola reguler."

        # Akun dengan nominal kecil tapi aktif
        if curr_s > 0 and curr_s < 10000000 and rank > 5 and growth >= 0:
            ai_status = "Potensial Penetrasi"
            ai_badge = "cyan"
            ai_action = "📦 Tawarkan Paket Bundle & Diskon Kuantiti (Qty)"
            ai_reason = f"Nominal order masih di bawah Rp 10 Juta namun aktif belanja ({curr_inv} faktur). Potensi upselling volume."

        item["ai_status"] = ai_status
        item["ai_badge"] = ai_badge
        item["ai_action"] = ai_action
        item["ai_reason"] = ai_reason
        item["status"] = ai_status
        enriched_list.append(item)

    # 1. Top 5 Highest Sales
    top_5 = [c for c in enriched_list if safe_float(c.get("curr_sales")) > 0][:5]
    for r, t in enumerate(top_5, 1):
        g = safe_float(t.get("growth"))
        if r == 1:
            m_act = "👑 Kunci Kontrak Tahunan & Akun Prioritas Utama CCO"
        elif g >= 15:
            m_act = "⭐ Loyalitas VIP: Prioritas Alokasi Stok & Jalur Hijau Logistik"
        elif g >= 0:
            m_act = "🤝 Kunjungan Manajemen & Penyelarasan Forecast Pengadaan"
        else:
            m_act = "🚨 Mitigasi Churn Akun Paus: Intervensi CCO Segera"
        t["marketing_action"] = m_act
        t["ai_team_action"] = m_act

    # 2. Top 5 Lowest Sales (> 0)
    positive_custs = [c for c in enriched_list if safe_float(c.get("curr_sales")) > 0]
    lowest_5 = sorted(positive_custs, key=lambda x: safe_float(x.get("curr_sales")))[:5]
    for r, l in enumerate(lowest_5, 1):
        cs = safe_float(l.get("curr_sales"))
        if cs < 5000000:
            m_act = "🎯 Presentasi Material & Paket Sampel Uji Coba Lapangan"
        else:
            m_act = "📦 Tawarkan Skema Diskon Qty & Bundling Pembelian Minimum"
        l["marketing_action"] = m_act
        l["ai_team_action"] = m_act

    # 3. Top 5 Declining Customers (Drop Sales)
    declining_custs = [c for c in enriched_list if safe_float(c.get("diff_sales")) < 0 and safe_float(c.get("prev_sales")) > 0]
    declining_5 = sorted(declining_custs, key=lambda x: safe_float(x.get("diff_sales")))[:5]
    for r, d in enumerate(declining_5, 1):
        g = safe_float(d.get("growth"))
        if g < -40:
            m_act = "🔍 Audit Purchasing: Cek Stok Sisa, Spesifikasi, & Alasan Penurunan"
        else:
            m_act = "📞 Follow-up Procurement & Ajukan Penawaran Harga Penyelamatan"
        d["marketing_action"] = m_act
        d["ai_team_action"] = m_act

    return {
        "allCustomers": enriched_list,
        "topCustomers": top_5,
        "lowestCustomers": lowest_5,
        "decliningCustomers": declining_5
    }

# =====================================================================
# MODULE 1: OVERALL MARKETING PERFORMANCE ANALYTICS
# =====================================================================

def analyze_overall(data):
    kpi = data.get("kpi", {})
    period_info = data.get("periodInfo", {})
    all_customers = data.get("allCustomers", [])
    top_materials = data.get("topMaterials", [])
    chart_data = data.get("chartData", {})

    total_sales = safe_float(kpi.get("total_sales"))
    prev_total_sales = safe_float(kpi.get("prev_total_sales"))
    growth_percent = safe_float(kpi.get("growth_percent"))
    growth_nominal = safe_float(kpi.get("growth_nominal"))
    total_customers = safe_int(kpi.get("total_customers"))
    prev_total_customers = safe_int(kpi.get("prev_total_customers"))
    total_invoices = safe_int(kpi.get("total_invoices"))
    prev_total_invoices = safe_int(kpi.get("prev_total_invoices"))

    curr_period_label = period_info.get("currentLabel", "Periode Berjalan")
    prev_period_label = period_info.get("previousLabel", "Periode Pembanding")

    # -------------------------------------------------------------
    # 1. ANALISIS PARETO (80/20) & KONSENTRASI RISIKO (HHI & GINI)
    # -------------------------------------------------------------
    active_customers = [c for c in all_customers if safe_float(c.get("curr_sales")) > 0]
    active_customers.sort(key=lambda x: safe_float(x.get("curr_sales")), reverse=True)

    sales_values = [safe_float(c.get("curr_sales")) for c in active_customers]
    cum_sales = 0.0
    pareto_80_count = 0
    top5_sales = sum(sales_values[:5])
    top5_share_pct = round((top5_sales / total_sales * 100.0), 2) if total_sales > 0 else 0.0

    top10_sales = sum(sales_values[:10])
    top10_share_pct = round((top10_sales / total_sales * 100.0), 2) if total_sales > 0 else 0.0

    # Menghitung berapa customer yang menyumbang 80% omset
    for idx, s in enumerate(sales_values):
        cum_sales += s
        if (cum_sales / total_sales) >= 0.80 and pareto_80_count == 0:
            pareto_80_count = idx + 1
            break
    if pareto_80_count == 0 and active_customers:
        pareto_80_count = len(active_customers)

    # Indeks Konsentrasi Herfindahl-Hirschman (HHI)
    # HHI = sum((market_share_percentage)^2)
    hhi = 0.0
    if total_sales > 0:
        for s in sales_values:
            share = (s / total_sales) * 100.0
            hhi += (share ** 2)
    hhi = round(hhi, 1)

    if hhi > 2500 or top5_share_pct > 75:
        risk_level = "Tinggi"
        hhi_label = "Risiko Konsentrasi Sangat Tinggi"
        pareto_eval = (
            f"Tingkat ketergantungan pendapatan tergolong tinggi. Top 5 akun menguasai {top5_share_pct}% omset "
            f"(HHI: {hhi:,.0f}). Hanya butuh {pareto_80_count} dari {len(active_customers)} customer untuk mencapai 80% omset. "
            f"Mitigasi mendesak: lakukan diversifikasi dengan membesarkan akun-akun tier-2 agar tidak rentan saat akun paus berfluktuasi."
        )
    elif hhi >= 1500 or top5_share_pct >= 50:
        risk_level = "Sedang"
        hhi_label = "Konsentrasi Moderat"
        pareto_eval = (
            f"Distribusi penjualan berada pada kategori moderat. Top 5 akun menyumbang {top5_share_pct}% omset "
            f"(HHI: {hhi:,.0f}). Sebanyak {pareto_80_count} akun mencakup 80% pendapatan. "
            f"Strategi taktis: pertahankan loyalitas akun utama sembari mempercepat siklus re-order akun menengah."
        )
    else:
        risk_level = "Rendah"
        hhi_label = "Sehat & Terdiversifikasi"
        pareto_eval = (
            f"Portofolio pelanggan sangat sehat dan terdistribusi merata (Top 5 akun: {top5_share_pct}%, HHI: {hhi:,.0f}). "
            f"Sebanyak {pareto_80_count} customer menopang 80% omset perusahaan, memberikan bantalan risiko yang kokoh terhadap gejolak pasar."
        )

    gini_score = calc_gini(sales_values)

    # -------------------------------------------------------------
    # 2. DINAMIKA KOHORT & ANALISIS CHURN / RETENSI PELANGGAN
    # -------------------------------------------------------------
    cohort_new = []
    cohort_expanding = []
    cohort_stable = []
    cohort_contracting = []
    cohort_churned = []

    for c in all_customers:
        curr_s = safe_float(c.get("curr_sales"))
        prev_s = safe_float(c.get("prev_sales"))

        if prev_s <= 0 and curr_s > 0:
            cohort_new.append(c)
        elif prev_s > 0 and curr_s <= 0:
            cohort_churned.append(c)
        elif prev_s > 0 and curr_s >= (prev_s * 1.10):
            cohort_expanding.append(c)
        elif prev_s > 0 and curr_s <= (prev_s * 0.90):
            cohort_contracting.append(c)
        elif prev_s > 0 and curr_s > 0:
            cohort_stable.append(c)

    prev_active_count = len(cohort_expanding) + len(cohort_stable) + len(cohort_contracting) + len(cohort_churned)
    churn_rate = (len(cohort_churned) / prev_active_count * 100.0) if prev_active_count > 0 else 0.0

    # Net Revenue Retention (NRR): (Revenue from retained customers in curr / Revenue from retained customers in prev) * 100
    retained_curr_rev = sum(safe_float(c.get("curr_sales")) for c in (cohort_expanding + cohort_stable + cohort_contracting))
    retained_prev_rev = sum(safe_float(c.get("prev_sales")) for c in (cohort_expanding + cohort_stable + cohort_contracting))
    nrr = (retained_curr_rev / retained_prev_rev * 100.0) if retained_prev_rev > 0 else 100.0

    # Value at Risk (Total nominal drop dari akun macet + akun menurun)
    nominal_lost_churn = sum(safe_float(c.get("prev_sales")) for c in cohort_churned)
    nominal_lost_drop = sum(abs(safe_float(c.get("diff_sales"))) for c in cohort_contracting if safe_float(c.get("diff_sales")) < 0)
    total_value_at_risk = nominal_lost_churn + nominal_lost_drop

    # -------------------------------------------------------------
    # 3. DETEKSI ANOMALI & OUTLIER STATISTIK (Z-SCORE & IQR)
    # -------------------------------------------------------------
    deltas = [safe_float(c.get("diff_sales")) for c in all_customers if safe_float(c.get("curr_sales")) > 0 or safe_float(c.get("prev_sales")) > 0]
    mean_delta = calc_mean(deltas)
    stdev_delta = calc_stdev(deltas)
    q1_delta, q3_delta, iqr_delta = calc_iqr(deltas)
    iqr_lower_bound = q1_delta - (1.5 * iqr_delta)

    critical_areas = []

    # Deteksi akun dengan penurunan paling tajam secara statistik (Z-Score <= -1.5 atau di bawah IQR lower bound)
    declining_accounts = [c for c in all_customers if safe_float(c.get("diff_sales")) < 0]
    declining_accounts.sort(key=lambda x: safe_float(x.get("diff_sales")))

    for c in declining_accounts[:4]:
        diff = abs(safe_float(c.get("diff_sales")))
        curr_s = safe_float(c.get("curr_sales"))
        prev_s = safe_float(c.get("prev_sales"))
        growth = safe_float(c.get("growth"))
        curr_inv = safe_int(c.get("curr_invoices"))
        prev_inv = safe_int(c.get("prev_invoices"))
        nm = c.get("nm_cs") or c.get("kd_cs")

        # Hitung z-score anomali
        z_score = (safe_float(c.get("diff_sales")) - mean_delta) / stdev_delta if stdev_delta > 0 else 0.0

        # Diagnosis akar masalah berbasis data:
        if curr_s == 0 and prev_s > 0:
            root_cause = f"Akun terhenti total (Churn/Macet). Pada periode lalu belanja {format_rupiah(prev_s)} ({prev_inv} faktur), periode ini 0 faktur."
            action = f"Lakukan visit langsung oleh Senior Sales/CCO untuk audit penyebab pemberhentian order dan berikan penawaran re-entry kompetitif."
        elif prev_inv > 0 and curr_inv < (prev_inv * 0.6):
            root_cause = f"Frekuensi transaksi anjlok dari {prev_inv} faktur menjadi {curr_inv} faktur (penurunan order cadence {(1 - curr_inv/prev_inv)*100:.0f}%)."
            action = f"Review siklus pengadaan pelanggan, cek ketersediaan stok material di gudang mereka, dan ajukan skema supply berkala (blanket PO)."
        else:
            prev_aov = prev_s / prev_inv if prev_inv > 0 else 0
            curr_aov = curr_s / curr_inv if curr_inv > 0 else 0
            root_cause = f"Penurunan ukuran keranjang order (AOV turun dari {format_rupiah(prev_aov)} menjadi {format_rupiah(curr_aov)} per transaksi)."
            action = f"Tawarkan insentif volume tiering atau diskon bundling material untuk menaikkan kembali kuantiti pembelian per order."

        critical_areas.append({
            "issue": f"Penurunan Omset Signifikan (Z: {z_score:.1f})",
            "customer_affected": nm,
            "nominal_impact": f"Turun {format_rupiah(diff)} ({growth:.1f}%)",
            "root_cause": root_cause,
            "action_to_fix": action
        })

    # Jika ada akun churn massal yang belum tercover
    if len(cohort_churned) > len(critical_areas) and len(cohort_churned) > 0:
        churn_sample = ", ".join([c.get("nm_cs", "") for c in cohort_churned[:3]])
        critical_areas.append({
            "issue": f"Atrisi {len(cohort_churned)} Akun Churn / Tidur",
            "customer_affected": f"{len(cohort_churned)} Akun (misal: {churn_sample})",
            "nominal_impact": f"Potensi pendapatan hilang {format_rupiah(nominal_lost_churn)}",
            "root_cause": f"Akun sebelumnya aktif di {prev_period_label} namun tidak menghasilkan 1 pun faktur di {curr_period_label}.",
            "action_to_fix": "Jalankan program win-back telemarketing dan verifikasi apakah customer beralih ke kompetitor atau proyek tertunda."
        })

    # -------------------------------------------------------------
    # 4. MOMENTUM DERET WAKTU (CHART TIME-SERIES REGRESSION)
    # -------------------------------------------------------------
    chart_items = chart_data.get("items", [])
    revenue_points = [safe_float(item.get("curr_sales")) for item in chart_items if item.get("curr_sales") is not None]
    trend_slope = linear_regression_slope(revenue_points)
    trend_direction = "Akselerasi Positif" if trend_slope > 0 else ("Kontraksi / Deselerasi" if trend_slope < 0 else "Stabil Datar")

    # -------------------------------------------------------------
    # 5. MULTI-FACTOR WEIGHTED HEALTH SCORING (0 - 100)
    # -------------------------------------------------------------
    # Bobot Komponen:
    # A. Pertumbuhan Penjualan (Bobot 35%)
    growth_score = 70.0
    if growth_percent >= 25.0:
        growth_score = 100.0
    elif growth_percent >= 10.0:
        growth_score = 88.0
    elif growth_percent >= 0.0:
        growth_score = 75.0
    elif growth_percent >= -10.0:
        growth_score = 55.0
    elif growth_percent >= -25.0:
        growth_score = 40.0
    else:
        growth_score = 25.0

    # B. Dinamika Retensi & Churn Pelanggan (Bobot 25%)
    retention_score = 75.0
    if churn_rate == 0 and len(cohort_new) > 0:
        retention_score = 98.0
    elif churn_rate <= 5.0:
        retention_score = 88.0
    elif churn_rate <= 15.0:
        retention_score = 70.0
    elif churn_rate <= 30.0:
        retention_score = 50.0
    else:
        retention_score = 30.0

    # Penyesuaian NRR
    if nrr >= 110.0:
        retention_score = min(100.0, retention_score + 8.0)
    elif nrr < 90.0:
        retention_score = max(20.0, retention_score - 10.0)

    # C. Konsentrasi & Diversifikasi HHI (Bobot 20%)
    if hhi < 1500:
        hhi_score = 95.0
    elif hhi <= 2200:
        hhi_score = 78.0
    elif hhi <= 3000:
        hhi_score = 60.0
    else:
        hhi_score = 40.0

    # D. Momentum Transaksi & Invoice (Bobot 20%)
    invoice_growth = ((total_invoices - prev_total_invoices) / prev_total_invoices * 100.0) if prev_total_invoices > 0 else 0.0
    if invoice_growth >= 15.0:
        inv_score = 95.0
    elif invoice_growth >= 0.0:
        inv_score = 78.0
    elif invoice_growth >= -15.0:
        inv_score = 58.0
    else:
        inv_score = 38.0

    final_health_score = round(
        (0.35 * growth_score) +
        (0.25 * retention_score) +
        (0.20 * hhi_score) +
        (0.20 * inv_score)
    )
    final_health_score = max(15, min(99, final_health_score))

    if final_health_score >= 80:
        status_label = "Sangat Baik"
    elif final_health_score >= 65:
        status_label = "Baik"
    elif final_health_score >= 50:
        status_label = "Waspada"
    else:
        status_label = "Kritis"

    # -------------------------------------------------------------
    # 6. SINTESIS REKOMENDASI TAKTIS & QUICK WINS
    # -------------------------------------------------------------
    tactical_recommendations = []

    # Kategori VIP
    if top5_share_pct > 60:
        tactical_recommendations.append({
            "category": "Customer VIP / Top Performers",
            "focus": f"Proteksi Akun Paus & Kemitraan Strategis (Pangsa {top5_share_pct}%)",
            "action": f"Lakukan review kontrak berkala dengan CCO, jamin ketersediaan kuota stok barang utama, dan berikan SLA pengiriman ekspres untuk 5 akun teratas."
        })
    else:
        tactical_recommendations.append({
            "category": "Customer VIP / Top Performers",
            "focus": "Ekspansi Wallet Share Akun Inti",
            "action": "Eksplorasi cross-selling material komplementer dari transaksi DO yang sedang berjalan untuk meningkatkan frekuensi order mingguan."
        })

    # Kategori Akun Menurun / At-Risk
    if cohort_contracting or cohort_churned:
        worst_name = declining_accounts[0].get("nm_cs", "Akun Terbesar") if declining_accounts else "Pelanggan Terkait"
        worst_loss = format_rupiah(abs(safe_float(declining_accounts[0].get("diff_sales")))) if declining_accounts else "signifikan"
        tactical_recommendations.append({
            "category": "Customer Menurun / At-Risk",
            "focus": f"Mitigasi Revenue Leakage ({format_rupiah(total_value_at_risk)} Berisiko)",
            "action": f"Prioritaskan penyelamatan akun {worst_name} (defisit {worst_loss}). Berikan penawaran harga kompetitif atau fleksibilitas termin pembayaran."
        })
    else:
        tactical_recommendations.append({
            "category": "Customer Menurun / At-Risk",
            "focus": "Monitoring Preventif Churn",
            "action": "Pantau akun dengan tren flat untuk memastikan tidak ada penurunan tiba-tiba pada siklus tender proyek berikutnya."
        })

    # Kategori Penetrasi & Upselling
    if cohort_expanding:
        star_name = cohort_expanding[0].get("nm_cs", "Akun Berakselerasi")
        tactical_recommendations.append({
            "category": "Penetrasi & Upselling",
            "focus": f"Kapitalisasi Akun Tumbuh ({len(cohort_expanding)} Akun Akselerasi)",
            "action": f"Tingkatkan plafon kredit dan kunci komitmen volume lebih besar pada akun berakselerasi tinggi seperti {star_name}."
        })
    else:
        tactical_recommendations.append({
            "category": "Penetrasi & Upselling",
            "focus": "Aktivasi Akun Baru & Tier-2",
            "action": "Akselerasi kampanye pengenalan material unggulan untuk mengonversi prospek menjadi customer bertransaksi reguler."
        })

    # 3 Quick Wins 7 Hari
    quick_wins = []
    if declining_accounts:
        quick_wins.append(
            f"Adakan pertemuan komersial darurat dengan manajemen {declining_accounts[0].get('nm_cs', 'akun defisit')} guna menegosiasikan paket order ulang dalam 7 hari."
        )
    if cohort_churned:
        quick_wins.append(
            f"Hubungi {min(5, len(cohort_churned))} customer yang terhenti di periode ini untuk audit kepuasan layanan dan tawarkan skema re-aktivasi khusus."
        )
    else:
        quick_wins.append(
            f"Kirimkan penawaran katalog material baru kepada 10 pelanggan tier-2 untuk mengerek nilai transaksi menuju Top 10."
        )
    quick_wins.append(
        f"Kunci kepastian PO untuk {len(active_customers[:3])} customer teratas agar target omset periode berikutnya aman dari fluktuasi pasar."
    )

    # Executive Summary Ringkas & Padat
    growth_str = f"pertumbuhan {format_percent(growth_percent)} (naik {format_rupiah(growth_nominal)})" if growth_nominal >= 0 else f"kontraksi {format_percent(growth_percent)} (turun {format_rupiah(abs(growth_nominal))})"
    exec_summary = (
        f"Pada {curr_period_label}, perusahaan mencatat realisasi penjualan sebesar {format_rupiah(total_sales)}, mencerminkan {growth_str} dibanding {prev_period_label} ({format_rupiah(prev_total_sales)}). "
        f"Kinerja didukung oleh {total_customers} pelanggan aktif ({len(cohort_expanding)} akun berekspansi, {len(cohort_new)} akun baru, dan {len(cohort_churned)} akun dorman) dengan Net Revenue Retention (NRR) berada di {nrr:.1f}%. "
        f"Konsentrasi pendapatan terukur pada HHI {hhi:,.0f} ({risk_level}), di mana {top5_share_pct}% omset bertumpu pada Top 5 customer."
    )

    # -------------------------------------------------------------
    # 7. METRIK ANALITIK & DOSSIER UNTUK QWEN 2.5 7B
    # -------------------------------------------------------------
    analytics_payload = {
        "hhi": hhi,
        "hhi_label": hhi_label,
        "gini": gini_score,
        "pareto_80_cutoff_customers": pareto_80_count,
        "top5_share_percent": top5_share_pct,
        "top10_share_percent": top10_share_pct,
        "risk_level": risk_level,
        "churn_rate_percent": round(churn_rate, 2),
        "nrr_percent": round(nrr, 2),
        "total_value_at_risk": total_value_at_risk,
        "total_value_at_risk_fmt": format_rupiah(total_value_at_risk),
        "cohort_counts": {
            "new": len(cohort_new),
            "expanding": len(cohort_expanding),
            "stable": len(cohort_stable),
            "contracting": len(cohort_contracting),
            "churned": len(cohort_churned)
        },
        "trend_direction": trend_direction,
        "trend_slope": round(trend_slope, 2),
        "health_score": final_health_score,
        "status_label": status_label
    }

    # LLM Briefing Context untuk dimasukkan ke dalam prompt Qwen
    llm_context = f"""
FAKTA ANALITIK DATA MATEMATIS HASIL PERHITUNGAN PYTHON (GROUND TRUTH):
- Skor Kesehatan KPI (Health Score): {final_health_score}/100 [Status: {status_label}]
- Realisasi Penjualan: {format_rupiah(total_sales)} vs Periode Lalu {format_rupiah(prev_total_sales)} (Pertumbuhan: {format_percent(growth_percent)}, Nominal: {format_rupiah(growth_nominal)})
- Indeks Konsentrasi Pasar (Herfindahl-Hirschman Index / HHI): {hhi:,.0f} ({risk_level} Concentration Risk)
- Koefisien Ketimpangan Gini: {gini_score:.3f}
- Konsentrasi Pareto: Top 5 akun menguasai {top5_share_pct}% omset; Hanya {pareto_80_count} dari {len(active_customers)} akun menyumbang 80% total omset
- Dinamika Kohort: {len(cohort_new)} Akun Baru, {len(cohort_expanding)} Akun Tumbuh (>10%), {len(cohort_contracting)} Akun Menurun, {len(cohort_churned)} Akun Churn/Macet
- Churn Rate: {churn_rate:.1f}%, Net Revenue Retention (NRR): {nrr:.1f}%
- Total Nilai Risiko Penurunan (Value at Risk): {format_rupiah(total_value_at_risk)}
- Anomali Penurunan Kritis Terbesar (Z-Score Outlier): {critical_areas[0]['customer_affected'] if critical_areas else 'N/A'} ({critical_areas[0]['nominal_impact'] if critical_areas else 'N/A'})
- Momentum Deret Waktu: {trend_direction} (Slope: {trend_slope:,.0f})
"""

    enriched_custs = enrich_customer_matrix(all_customers, total_sales, mean_delta, stdev_delta)

    result = {
        "health_score": final_health_score,
        "status_label": status_label,
        "executive_summary": exec_summary,
        "pareto_risk_analysis": {
            "top5_share_percent": top5_share_pct,
            "risk_level": risk_level,
            "evaluation": pareto_eval
        },
        "critical_areas_to_fix": critical_areas[:4],
        "tactical_recommendations": tactical_recommendations,
        "quick_wins": quick_wins,
        "analytics_metrics": analytics_payload,
        "enriched_customers": enriched_custs
    }

    return {
        "result": result,
        "analytics": analytics_payload,
        "enriched_customers": enriched_custs,
        "llm_context": llm_context.strip()
    }

# =====================================================================
# MODULE 2: CUSTOMER PERFORMANCE ANALYTICS
# =====================================================================

def analyze_customer(data):
    customer = data.get("customer", {})
    kpi = data.get("kpi", {})
    period_info = data.get("periodInfo", {})
    top_materials = data.get("topMaterials", [])
    recent_invoices = data.get("recentInvoices", [])
    chart_data = data.get("chartData", {})

    kd_cs = customer.get("kd_cs", "")
    nm_cs = customer.get("nm_cs", kd_cs)

    total_sales = safe_float(kpi.get("total_sales"))
    prev_total_sales = safe_float(kpi.get("prev_total_sales"))
    growth_percent = safe_float(kpi.get("growth_percent"))
    growth_nominal = safe_float(kpi.get("growth_nominal"))
    total_invoices = safe_int(kpi.get("total_invoices"))
    prev_total_invoices = safe_int(kpi.get("prev_total_invoices"))
    avg_order_value = safe_float(kpi.get("avg_order_value"))
    max_order_value = safe_float(kpi.get("max_order_value"))
    company_share_percent = safe_float(kpi.get("company_share_percent"))

    curr_period_label = period_info.get("currentLabel", "Periode Berjalan")
    prev_period_label = period_info.get("previousLabel", "Periode Pembanding")

    # -------------------------------------------------------------
    # 1. ANALISIS RFM (RECENCY, FREQUENCY, MONETARY)
    # -------------------------------------------------------------
    dates = []
    amounts = []
    for inv in recent_invoices:
        tgl = inv.get("tgl_doc")
        if tgl:
            try:
                dt = datetime.datetime.strptime(str(tgl)[:10], "%Y-%m-%d").date()
                dates.append(dt)
            except Exception:
                pass
        amt = safe_float(inv.get("total_amount"))
        if amt > 0:
            amounts.append(amt)

    # Penentuan Recency
    if dates:
        dates.sort(reverse=True)
        latest_date = dates[0]
        ref_end_str = period_info.get("currEnd")
        try:
            ref_date = datetime.datetime.strptime(ref_end_str[:10], "%Y-%m-%d").date() if ref_end_str else datetime.date.today()
        except Exception:
            ref_date = datetime.date.today()
        recency_days = max(0, (ref_date - latest_date).days)
    else:
        recency_days = 999  # Tidak ada transaksi

    # Recency Score (1 - 5)
    if recency_days <= 14:
        r_score = 5
    elif recency_days <= 30:
        r_score = 4
    elif recency_days <= 60:
        r_score = 3
    elif recency_days <= 90:
        r_score = 2
    else:
        r_score = 1

    # Frequency Score (1 - 5)
    if total_invoices >= 12:
        f_score = 5
    elif total_invoices >= 6:
        f_score = 4
    elif total_invoices >= 3:
        f_score = 3
    elif total_invoices >= 1:
        f_score = 2
    else:
        f_score = 1

    # Monetary Score (1 - 5)
    if total_sales >= 1_000_000_000:
        m_score = 5
    elif total_sales >= 250_000_000:
        m_score = 4
    elif total_sales >= 50_000_000:
        m_score = 3
    elif total_sales > 0:
        m_score = 2
    else:
        m_score = 1

    # RFM Segment Mapping
    if r_score >= 4 and f_score >= 4 and m_score >= 4:
        rfm_segment = "Champion / VIP"
        loyalty_status = "VIP / Sangat Loyal"
    elif r_score >= 3 and f_score >= 3:
        rfm_segment = "Pelanggan Loyal Reguler"
        loyalty_status = "Aktif Reguler"
    elif r_score >= 4 and f_score <= 2:
        rfm_segment = "Pelanggan Baru / Potensial"
        loyalty_status = "Aktif Reguler"
    elif r_score <= 2 and (f_score >= 3 or m_score >= 4):
        rfm_segment = "At-Risk / Perlu Perhatian"
        loyalty_status = "At-Risk / Menurun"
    elif total_sales <= 0:
        rfm_segment = "Dormant / Churned"
        loyalty_status = "Dormant / Pasif"
    else:
        rfm_segment = "Reguler Fluktuatif"
        loyalty_status = "Aktif Reguler" if growth_percent >= 0 else "At-Risk / Menurun"

    # -------------------------------------------------------------
    # 2. VOLATILITAS & KARAKTERISTIK ORDER (CV: COEFFICIENT OF VARIATION)
    # -------------------------------------------------------------
    order_amounts = amounts if amounts else [total_sales] if total_sales > 0 else [0.0]
    mean_order = calc_mean(order_amounts)
    stdev_order = calc_stdev(order_amounts)
    cv = (stdev_order / mean_order) if mean_order > 0 else 0.0

    # Rata-rata interval antar order (hari)
    if len(dates) >= 2:
        dates_asc = sorted(dates)
        diffs = [(dates_asc[i+1] - dates_asc[i]).days for i in range(len(dates_asc)-1)]
        avg_order_cycle_days = round(calc_mean(diffs), 1)
    else:
        avg_order_cycle_days = 0.0

    if cv < 0.35:
        buying_pattern = f"Pola Pembelian Sangat Terjadwal & Konsisten (CV: {cv:.2f}). Order rutin setiap ±{avg_order_cycle_days:.0f} hari dengan nilai faktur stabil."
    elif cv <= 0.75:
        buying_pattern = f"Pola Pembelian Reguler Campuran (CV: {cv:.2f}). Frekuensi belanja teratur namun ukuran kuantiti bervariasi sesuai siklus proyek."
    else:
        buying_pattern = f"Pola Pembelian Sporadis / Berbasis Proyek (CV: {cv:.2f}). Transaksi bersifat ad-hoc dengan lonjakan nominal pesanan pada proyek tertentu."

    # Karakteristik order
    order_characteristics = (
        f"Rata-rata nilai order (AOV) {format_rupiah(avg_order_value)} dengan transaksi puncak {format_rupiah(max_order_value)}. "
        f"Total volume transaksi {total_invoices} faktur pada periode ini (sebelumnya {prev_total_invoices} faktur)."
    )

    # -------------------------------------------------------------
    # 3. ANALISIS PORTOFOLIO MATERIAL / PRODUK
    # -------------------------------------------------------------
    mat_names = []
    top_mat_share = 0.0
    favorite_categories = "Material B2B Standar"

    if top_materials:
        total_mat_val = sum(safe_float(m.get("total_val")) for m in top_materials)
        mat_names = [m.get("material", "") for m in top_materials if m.get("material")]
        if total_mat_val > 0 and top_materials[0].get("total_val"):
            top_mat_share = (safe_float(top_materials[0].get("total_val")) / total_mat_val) * 100.0
        favorite_categories = ", ".join(mat_names[:3]) if mat_names else "Material Industri"

    # -------------------------------------------------------------
    # 4. DIAGNOSTIK RISIKO & PENURUNAN
    # -------------------------------------------------------------
    risk_alerts = []
    if growth_nominal < 0:
        inv_drop = prev_total_invoices - total_invoices
        diff_fmt = format_rupiah(abs(growth_nominal))

        if total_sales == 0 and prev_total_sales > 0:
            risk_alerts.append({
                "alert": "Akun Berhenti Berbelanja (Zero Transaction)",
                "impact": f"Kehilangan pendapatan {diff_fmt} (-100%)",
                "mitigation": "Eskalasi ke Branch Manager/CCO untuk kunjungan tatap muka dan evaluasi kendala di pihak customer."
            })
        elif inv_drop > 0:
            risk_alerts.append({
                "alert": f"Penurunan Frekuensi Order (-{inv_drop} Faktur)",
                "impact": f"Realisasi pembelian turun {diff_fmt} ({growth_percent:.1f}%)",
                "mitigation": "Jadwalkan kontak mingguan oleh Sales Executive untuk memonitor sisa inventori material customer."
            })
        else:
            risk_alerts.append({
                "alert": "Penyusutan Rata-Rata Nilai Faktur (AOV Drop)",
                "impact": f"Nilai order rata-rata tertekan {diff_fmt} ({growth_percent:.1f}%)",
                "mitigation": "Tawarkan skema kuantiti diskon berjenjang untuk mendorong pembelian dalam batch yang lebih besar."
            })

    if recency_days > 45 and total_sales > 0:
        risk_alerts.append({
            "alert": f"Jeda Transaksi Melampaui Batas Wajar ({recency_days} Hari)",
            "impact": "Risiko pergeseran alokasi pengadaan ke vendor pesaing",
            "mitigation": "Kirimkan surat penawaran harga spesial dan konfirmasi kebutuhan supply proyek bulan depan."
        })

    if top_mat_share > 80.0 and len(top_materials) > 0:
        risk_alerts.append({
            "alert": f"Ketergantungan Ekstrem pada 1 Jenis Produk ({top_mat_share:.1f}%)",
            "impact": f"Rentan terdampak jika kebutuhan customer terhadap {mat_names[0] if mat_names else 'produk utama'} berkurang",
            "mitigation": "Jalankan inisiatif cross-selling untuk memperkenalkan produk pendukung atau kategori material lainnya."
        })

    # Default fallback risk alert if none
    if not risk_alerts:
        risk_alerts.append({
            "alert": "Stabilitas Pasokan & Fluktuasi Harga Bahan Baku",
            "impact": "Potensi hambatan jika ada perubahan spesifikasi kebutuhan pabrik customer",
            "mitigation": "Pertahankan komunikasi intensif terkait perkiraan kebutuhan (forecast) 3 bulan ke depan."
        })

    # -------------------------------------------------------------
    # 5. PELUANG PERTUMBUHAN (SALES GROWTH OPPORTUNITIES)
    # -------------------------------------------------------------
    opportunities = []

    if mat_names:
        primary_mat = mat_names[0]
        opportunities.append({
            "category": "Cross-Selling / Produk Komplementer",
            "suggested_product": f"Varian & Aksesori Pendukung {primary_mat}",
            "rationale": f"Customer telah memiliki rekam jejak loyal pada {primary_mat}. Menawarkan produk komplementer dapat memperluas keranjang belanja tanpa biaya akuisisi baru.",
            "pitching_strategy": "Sertakan sample produk pendukung pada pengiriman Delivery Order berikutnya bersama brosur teknis."
        })

    opportunities.append({
        "category": "Upselling Volume / Kontrak Jangka Menengah",
        "suggested_product": f"Paket Pasokan Berkala ({favorite_categories})",
        "rationale": f"Pola order customer menunjukkan konsistensi (AOV: {format_rupiah(avg_order_value)}). Pengikatan kontrak kuota akan menstabilkan margin kedua pihak.",
        "pitching_strategy": "Tawarkan diskon volume 2-3% dengan syarat komitmen minimum pemesanan 3 bulan ke depan."
    })

    # -------------------------------------------------------------
    # 6. ACCOUNT HEALTH SCORE (0 - 100)
    # -------------------------------------------------------------
    rfm_score_norm = ((r_score + f_score + m_score) / 15.0) * 100.0

    growth_score = 70.0
    if growth_percent >= 20.0:
        growth_score = 98.0
    elif growth_percent >= 5.0:
        growth_score = 85.0
    elif growth_percent >= -5.0:
        growth_score = 72.0
    elif growth_percent >= -20.0:
        growth_score = 50.0
    else:
        growth_score = 30.0

    if cv < 0.35 and total_invoices >= 3:
        stability_score = 95.0
    elif cv <= 0.75:
        stability_score = 75.0
    else:
        stability_score = 55.0

    account_health_score = round(
        (0.40 * rfm_score_norm) +
        (0.35 * growth_score) +
        (0.25 * stability_score)
    )
    account_health_score = max(15, min(99, account_health_score))

    quick_wins = [
        f"Lakukan follow-up langsung via telepon ke PIC Procurement {nm_cs} untuk mengonfirmasi rencana jadwal pengiriman minggu ini.",
        f"Kirimkan penawaran harga terikat untuk material {mat_names[0] if mat_names else 'unggulan'} guna mengunci alokasi bulan depan.",
        f"Tinjau status invoice yang telah jatuh tempo dan koordinasikan kelancaran pembayaran faktur berjalan."
    ]

    growth_desc = f"pertumbuhan +{growth_percent:.1f}% ({format_rupiah(growth_nominal)})" if growth_nominal >= 0 else f"penurunan {growth_percent:.1f}% ({format_rupiah(abs(growth_nominal))})"
    exec_summary = (
        f"Akun {nm_cs} ({kd_cs}) tergolong dalam segmen '{rfm_segment}' dengan kontribusi {company_share_percent:.2f}% terhadap total omset perusahaan. "
        f"Pada {curr_period_label}, realisasi belanja mencapai {format_rupiah(total_sales)} ({growth_desc} vs {prev_period_label}) "
        f"melalui {total_invoices} faktur dengan rata-rata nilai order {format_rupiah(avg_order_value)}. "
        f"{buying_pattern}"
    )

    analytics_payload = {
        "rfm_scores": {"r": r_score, "f": f_score, "m": m_score},
        "rfm_segment": rfm_segment,
        "recency_days": recency_days,
        "avg_order_cycle_days": avg_order_cycle_days,
        "coefficient_of_variation": round(cv, 3),
        "account_health_score": account_health_score,
        "loyalty_status": loyalty_status,
        "top_material_share_percent": round(top_mat_share, 1)
    }

    llm_context = f"""
FAKTA ANALITIK DATA AKUN CUSTOMER HASIL PERHITUNGAN PYTHON (GROUND TRUTH):
- Nama Customer: {nm_cs} ({kd_cs})
- Skor Kesehatan Akun (Account Health Score): {account_health_score}/100 [Status: {loyalty_status}]
- Segmen RFM: {rfm_segment} (R: {r_score}/5, F: {f_score}/5, M: {m_score}/5)
- Hari Sejak Transaksi Terakhir (Recency): {recency_days} hari
- Realisasi Pembelian: {format_rupiah(total_sales)} vs Periode Lalu {format_rupiah(prev_total_sales)} (Pertumbuhan: {format_percent(growth_percent)}, Nominal: {format_rupiah(growth_nominal)})
- Jumlah Faktur: {total_invoices} faktur (Sebelumnya: {prev_total_invoices} faktur)
- Rata-rata Nilai Transaksi (AOV): {format_rupiah(avg_order_value)}, Nilai Maksimum: {format_rupiah(max_order_value)}
- Volatilitas Order (CV): {cv:.2f} (Pola: {buying_pattern})
- Pangsa terhadap Omset Perusahaan: {company_share_percent:.2f}%
- Kategori Material Utama: {favorite_categories} (Konsentrasi item teratas: {top_mat_share:.1f}%)
"""

    enriched_kpi = {
        "status": loyalty_status,
        "account_health_score": account_health_score,
        "rfm_segment": rfm_segment,
        "rfm_scores": {"r": r_score, "f": f_score, "m": m_score},
        "recency_days": recency_days,
        "avg_order_cycle_days": avg_order_cycle_days,
        "coefficient_of_variation": round(cv, 3),
        "buying_pattern": buying_pattern,
        "order_characteristics": order_characteristics
    }

    result = {
        "account_health_score": account_health_score,
        "loyalty_status": loyalty_status,
        "executive_summary": exec_summary,
        "buying_habits": {
            "pattern": buying_pattern,
            "favorite_categories": favorite_categories,
            "order_characteristics": order_characteristics
        },
        "sales_growth_opportunities": opportunities,
        "risk_and_drop_alerts": risk_alerts,
        "quick_wins": quick_wins,
        "analytics_metrics": analytics_payload,
        "enriched_kpi": enriched_kpi
    }

    return {
        "result": result,
        "analytics": analytics_payload,
        "enriched_kpi": enriched_kpi,
        "llm_context": llm_context.strip()
    }

# =====================================================================
# MAIN ENTRYPOINT (STDIN / ARGS JSON INTERFACE)
# =====================================================================

def main():
    mode = "overall"
    for arg in sys.argv[1:]:
        if arg.startswith("--mode="):
            mode = arg.split("=", 1)[1].strip()

    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({"error": "Empty input provided to MarketingAnalytics.py"}))
            sys.exit(1)

        payload = json.loads(raw_input)

        if mode == "customer":
            output = analyze_customer(payload)
        else:
            output = analyze_overall(payload)

        print(json.dumps(output, ensure_ascii=False))
        sys.exit(0)
    except Exception as e:
        error_output = {
            "error": f"Exception in MarketingAnalytics.py: {str(e)}",
            "result": None
        }
        print(json.dumps(error_output))
        sys.exit(1)

if __name__ == "__main__":
    main()
