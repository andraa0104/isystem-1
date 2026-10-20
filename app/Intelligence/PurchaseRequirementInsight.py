#!/usr/bin/env python3
"""Data-driven purchase requirement forecasts with chronological backtesting.

Combines statistical time-series forecasting, intermittent demand models,
and Scikit-Learn Machine Learning (Ridge, Random Forest, Gradient Boosting)
with expanding-window validation and ensemble model averaging.
"""
import argparse
import datetime as dt
import json
import math
import statistics
import sys
import time

SCRIPT_START_TIME = time.time()
MAX_EXECUTION_SECONDS = 75.0

# Graceful import: production VPS has numpy, pandas, and scikit-learn.
# If unavailable in other environments, fallback to stdlib.
try:
    import numpy as np
    import pandas as pd
    from sklearn.linear_model import Ridge
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    from sklearn.preprocessing import StandardScaler
    HAS_ML = True
except ImportError:
    HAS_ML = False

HORIZON_DAYS = 30
MAX_BACKTEST_ORIGINS = 4

CONTINUOUS_UNITS = {
    'kg', 'kilogram', 'liter', 'ltr', 'l', 'mtr', 'meter', 'm', 'm2', 'm3',
    'ton', 'gram', 'gr', 'cm', 'mm',
}


def is_time_critical():
    """Return True if execution is approaching the timeout limit."""
    return (time.time() - SCRIPT_START_TIME) > MAX_EXECUTION_SECONDS


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


def is_continuous_unit(unit):
    return key(unit) in CONTINUOUS_UNITS


def smart_round(value, unit):
    val = number(value)
    if val <= 0:
        return 0.0 if is_continuous_unit(unit) else 0
    if is_continuous_unit(unit):
        return round(val, 2)
    return int(math.ceil(val))


def winsorize_series(series):
    """Cap extreme spike outliers using median and MAD of non-zero values."""
    if HAS_ML:
        arr = np.asarray(series, dtype=np.float64)
        nonzero = arr[arr > 0]
        if len(nonzero) < 4:
            return arr
        med = float(np.median(nonzero))
        deviations = np.abs(nonzero - med)
        mad = float(np.median(deviations))
        if mad == 0.0:
            mad = float(np.mean(deviations))
        if mad == 0.0:
            return arr
        upper = med + 6.0 * mad
        return np.clip(arr, 0.0, upper)
    else:
        nonzero = [v for v in series if v > 0]
        if len(nonzero) < 4:
            return list(series)
        med = statistics.median(nonzero)
        deviations = [abs(v - med) for v in nonzero]
        mad = statistics.median(deviations)
        if mad == 0:
            mad = sum(deviations) / len(deviations)
        if mad == 0:
            return list(series)
        cutoff = med + 6.0 * mad
        return [min(v, cutoff) if v > 0 else 0.0 for v in series]


def index_stocks(rows):
    by_code, by_name = {}, {}
    for row in rows or []:
        entry = {
            'material_code': str(row.get('material_code') or '').strip(),
            'material': str(row.get('material') or '').strip(),
            'unit': str(row.get('unit') or '').strip(),
            'current_stock': number(row.get('current_stock')),
            'available_stock': number(row.get('available_stock', row.get('current_stock'))),
            'stock_matched': True,
        }
        for metric in ('mib', 'mis', 'mibs', 'pr_outstanding', 'po_outstanding', 'do_outstanding'):
            entry[metric] = number(row.get(metric))
        if entry['material_code']:
            by_code[key(entry['material_code'])] = entry
        if entry['material']:
            by_name[key(entry['material'])] = entry
    return by_code, by_name


def find_stock(indexes, code, material):
    by_code, by_name = indexes
    if code and key(code) in by_code:
        return by_code[key(code)]
    if material and key(material) in by_name:  # Always try name fallback
        return by_name[key(material)]
    return {
        'material_code': str(code or '').strip(),
        'material': str(material or '').strip(),
        'unit': '',
        'current_stock': 0.0,
        'stock_matched': False,
        'available_stock': 0.0,
    }


# =====================================================================
# Statistical & Intermittent Demand Forecasting Models
# =====================================================================

def croston_sba(values, alpha=0.1):
    """Croston method with Syntetos-Boylan Approximation for intermittent demand."""
    if HAS_ML:
        arr = np.asarray(values, dtype=np.float64)
        nz_indices = np.where(arr > 0)[0]
        if len(nz_indices) == 0:
            return 0.0
        nz_demands = arr[nz_indices]
        size = float(nz_demands[0])
        interval = max(1.0, float(nz_indices[0] + 1))
        previous = nz_indices[0]
        for i, demand in zip(nz_indices[1:], nz_demands[1:]):
            gap = max(1.0, float(i - previous))
            size = alpha * float(demand) + (1.0 - alpha) * size
            interval = alpha * gap + (1.0 - alpha) * interval
            previous = i
        return float(max(0.0, (1.0 - alpha / 2.0) * size / max(interval, 1.0)))
    else:
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
    """Teunter-Syntetos-Babai method with dynamic demand probability."""
    if HAS_ML:
        arr = np.asarray(values, dtype=np.float64)
        nz_indices = np.where(arr > 0)[0]
        if len(nz_indices) == 0:
            return 0.0
        first_demand = float(arr[nz_indices[0]])
        probability = 0.0
        size = first_demand
        for demand in arr:
            occurred = 1.0 if demand > 0 else 0.0
            probability = beta * occurred + (1.0 - beta) * probability
            if occurred > 0:
                size = alpha * float(demand) + (1.0 - alpha) * size
        return float(max(0.0, probability * size))
    else:
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


def simple_exp_smoothing(values, alpha=0.2):
    """Single Exponential Smoothing (SES)."""
    if len(values) == 0:
        return 0.0
    arr = np.asarray(values, dtype=np.float64) if HAS_ML else values
    level = float(arr[0])
    for v in arr[1:]:
        level = alpha * float(v) + (1.0 - alpha) * level
    return float(max(0.0, level))


def holts_double_smoothing(values, alpha=0.2, beta=0.1, phi=0.9):
    """Additive damped trend (Gardner & McKenzie). Suitable for trending demand."""
    if len(values) < 4:
        return 0.0
    arr = np.asarray(values, dtype=np.float64) if HAS_ML else values
    level = float(arr[0])
    trend = float(arr[1] - arr[0])
    for i in range(1, len(arr)):
        prev_level = level
        v = float(arr[i])
        level = alpha * v + (1.0 - alpha) * (level + phi * trend)
        trend = beta * (level - prev_level) + (1.0 - beta) * phi * trend
    damped_sum = phi * (1.0 - phi**HORIZON_DAYS) / (1.0 - phi) if phi < 1.0 else HORIZON_DAYS
    horizon_forecast = HORIZON_DAYS * level + trend * damped_sum
    return float(max(0.0, horizon_forecast / HORIZON_DAYS))


def holt_winters_additive(values, m=7, alpha=0.2, beta=0.05, gamma=0.2):
    """Holt-Winters additive exponential smoothing with weekly seasonality (m=7)."""
    n = len(values)
    if n < 2 * m:
        return 0.0
    arr = np.asarray(values, dtype=np.float64) if HAS_ML else [float(v) for v in values]
    level = float(sum(arr[:m]) / m)
    trend = float(sum((arr[m + i] - arr[i]) for i in range(m)) / (m * m))
    seasonal = [float(arr[i] - level) for i in range(m)]
    seasonal_mean = sum(seasonal) / m
    seasonal = [s - seasonal_mean for s in seasonal]

    for t in range(m, n):
        v = float(arr[t])
        s_prev = seasonal[t % m]
        prev_level = level
        level = alpha * (v - s_prev) + (1.0 - alpha) * (level + trend)
        trend = beta * (level - prev_level) + (1.0 - beta) * trend
        seasonal[t % m] = gamma * (v - level) + (1.0 - gamma) * s_prev

    forecasts = []
    for h in range(1, HORIZON_DAYS + 1):
        s_idx = (n + h - 1) % m
        fc = max(0.0, level + h * trend + seasonal[s_idx])
        forecasts.append(fc)
    return float(max(0.0, sum(forecasts) / HORIZON_DAYS))


def theta_method(values, theta=2.0):
    """Simplified Theta: decompose into linear trend line + smoothed residuals."""
    n = len(values)
    if n < 6:
        return 0.0
    if HAS_ML:
        y = np.asarray(values, dtype=np.float64)
        x = np.arange(n, dtype=np.float64)
        mean_x = (n - 1.0) / 2.0
        mean_y = float(np.mean(y))
        denom = float(np.sum((x - mean_x) ** 2))
        if denom <= 1e-9:
            return float(max(0.0, mean_y))
        slope = float(np.sum((x - mean_x) * (y - mean_y)) / denom)
        intercept = mean_y - slope * mean_x

        trend_line = intercept + slope * x
        theta_line = theta * y - trend_line

        alpha_ses = 0.2
        ses = float(theta_line[0])
        for v in theta_line[1:]:
            ses = alpha_ses * float(v) + (1.0 - alpha_ses) * ses

        trend_forecast = intercept + slope * n
        combined = 0.5 * trend_forecast + 0.5 * ses
        return float(max(0.0, combined))
    else:
        x = list(range(n))
        mean_x = sum(x) / n
        mean_y = sum(values) / n
        denom = sum((xi - mean_x)**2 for xi in x)
        slope = sum((xi - mean_x) * (yi - mean_y) for xi, yi in zip(x, values)) / max(denom, 1e-9)
        intercept = mean_y - slope * mean_x
        theta_line = [theta * v - (intercept + slope * i) for i, v in zip(x, values)]
        alpha_ses = 0.2
        ses = theta_line[0]
        for v in theta_line[1:]:
            ses = alpha_ses * v + (1 - alpha_ses) * ses
        trend_forecast = intercept + slope * n
        combined = 0.5 * trend_forecast + 0.5 * ses
        return max(0.0, combined)


def adaptive_exp_smoothing(values):
    """Auto-tune alpha based on tracking signal (Trigg & Leach)."""
    if len(values) < 3:
        return 0.0
    arr = np.asarray(values, dtype=np.float64) if HAS_ML else values
    forecast = float(arr[0])
    smoothed_error = 0.0
    mad = 0.0
    beta = 0.2
    for v in arr[1:]:
        error = float(v) - forecast
        smoothed_error = beta * error + (1.0 - beta) * smoothed_error
        mad = beta * abs(error) + (1.0 - beta) * mad
        alpha = min(0.99, max(0.05, abs(smoothed_error) / max(mad, 1e-9)))
        forecast = alpha * float(v) + (1.0 - alpha) * forecast
    return float(max(0.0, forecast))


def weekly_seasonal_rate(series_with_dates, start_date=None):
    """Calculate day-of-week seasonal index from last 90 days.

    Only applies day-of-week factors if seasonality CV > 0.15; otherwise returns flat rate.
    """
    if not series_with_dates:
        return 0.0

    if HAS_ML:
        window = series_with_dates[-90:] if len(series_with_dates) >= 90 else series_with_dates
        if len(window) < 14:
            vals = [v for _, v in window]
            return float(np.mean(vals)) if vals else 0.0

        weekdays = np.array([d.weekday() for d, _ in window], dtype=int)
        vals = np.array([v for _, v in window], dtype=np.float64)

        dow_means = np.zeros(7, dtype=np.float64)
        for w in range(7):
            mask = (weekdays == w)
            dow_means[w] = np.mean(vals[mask]) if np.any(mask) else 0.0

        overall_mean = float(np.mean(dow_means))
        if overall_mean <= 1e-9:
            return 0.0

        cv = float(np.std(dow_means) / overall_mean)
        if cv <= 0.15:
            return overall_mean

        last_date = window[-1][0]
        next_dow = np.array([(last_date + dt.timedelta(days=h)).weekday() for h in range(1, HORIZON_DAYS + 1)])
        return float(np.mean(dow_means[next_dow]))
    else:
        cutoff = series_with_dates[-1][0] - dt.timedelta(days=90)
        window = [(d, v) for d, v in series_with_dates if d >= cutoff]
        if len(window) < 14:
            return sum(v for _, v in window) / max(len(window), 1) if window else 0.0
        totals = {w: 0.0 for w in range(7)}
        counts = {w: 0 for w in range(7)}
        for d, v in window:
            w = d.weekday()
            totals[w] += v
            counts[w] += 1
        averages = [totals[w] / max(counts[w], 1) for w in range(7)]
        overall_mean = sum(averages) / 7.0
        if overall_mean <= 0:
            return 0.0
        var = sum((a - overall_mean)**2 for a in averages) / 7.0
        cv = math.sqrt(var) / overall_mean
        if cv <= 0.15:
            return overall_mean
        last_date = window[-1][0]
        next_demands = [averages[(last_date + dt.timedelta(days=h)).weekday()] for h in range(1, HORIZON_DAYS + 1)]
        return max(0.0, sum(next_demands) / HORIZON_DAYS)


# =====================================================================
# Scikit-Learn Machine Learning Models (Ridge, Random Forest, GBDT)
# =====================================================================

def ridge_trend_forecast(values, start_date=None):
    """Linear Regression Trend using sklearn Ridge on last 90 days.

    Features: [day_index, weekday_sin, weekday_cos, month_sin, month_cos].
    Predicts next 30 days and returns the average daily rate.
    """
    if not HAS_ML or len(values) < 14:
        vals = values[-30:] if len(values) >= 30 else values
        return float(np.mean(vals)) if len(vals) > 0 else 0.0

    try:
        n = len(values)
        window_size = min(90, n)
        y_train = np.asarray(values[-window_size:], dtype=np.float64)

        if start_date is not None:
            first_train_date = start_date + dt.timedelta(days=n - window_size)
            train_dates = [first_train_date + dt.timedelta(days=i) for i in range(window_size)]
        else:
            today = dt.date.today()
            first_train_date = today - dt.timedelta(days=window_size)
            train_dates = [first_train_date + dt.timedelta(days=i) for i in range(window_size)]

        day_index = np.arange(window_size, dtype=np.float64)
        weekdays = np.array([d.weekday() for d in train_dates], dtype=np.float64)
        months = np.array([d.month for d in train_dates], dtype=np.float64)

        w_sin = np.sin(2.0 * np.pi * weekdays / 7.0)
        w_cos = np.cos(2.0 * np.pi * weekdays / 7.0)
        m_sin = np.sin(2.0 * np.pi * (months - 1.0) / 12.0)
        m_cos = np.cos(2.0 * np.pi * (months - 1.0) / 12.0)

        X_train = np.column_stack([day_index, w_sin, w_cos, m_sin, m_cos])

        model = Ridge(alpha=1.0)
        model.fit(X_train, y_train)

        last_train_date = train_dates[-1]
        next_dates = [last_train_date + dt.timedelta(days=h) for h in range(1, HORIZON_DAYS + 1)]
        next_day_index = np.arange(window_size, window_size + HORIZON_DAYS, dtype=np.float64)
        next_weekdays = np.array([d.weekday() for d in next_dates], dtype=np.float64)
        next_months = np.array([d.month for d in next_dates], dtype=np.float64)

        X_next = np.column_stack([
            next_day_index,
            np.sin(2.0 * np.pi * next_weekdays / 7.0),
            np.cos(2.0 * np.pi * next_weekdays / 7.0),
            np.sin(2.0 * np.pi * (next_months - 1.0) / 12.0),
            np.cos(2.0 * np.pi * (next_months - 1.0) / 12.0),
        ])

        preds = np.clip(model.predict(X_next), 0.0, None)
        return float(np.mean(preds))
    except Exception:
        vals = values[-30:] if len(values) >= 30 else values
        return float(np.mean(vals)) if len(vals) > 0 else 0.0


def _build_ml_features(values, start_date=None, max_history=365):
    """Build feature matrix for Random Forest & Gradient Boosting.

    Features: [rolling_7d_mean, rolling_30d_mean, rolling_90d_mean,
               weekday_sin, weekday_cos, month_sin, month_cos, lag_1, lag_7, lag_30].
    """
    arr = np.asarray(values, dtype=np.float64)
    if len(arr) > max_history:
        arr = arr[-max_history:]
        if start_date is not None:
            start_date = start_date + dt.timedelta(days=len(values) - max_history)

    n = len(arr)
    s = pd.Series(arr)
    s_shift = s.shift(1)

    r7 = s_shift.rolling(7, min_periods=1).mean().to_numpy()
    r30 = s_shift.rolling(30, min_periods=1).mean().to_numpy()
    r90 = s_shift.rolling(90, min_periods=1).mean().to_numpy()

    lag1 = s.shift(1).to_numpy()
    lag7 = s.shift(7).to_numpy()
    lag30 = s.shift(30).to_numpy()

    if start_date is not None:
        dates = pd.date_range(start=start_date, periods=n, freq='D')
    else:
        today = dt.date.today()
        dates = pd.date_range(end=today, periods=n, freq='D')

    w_sin = np.sin(2.0 * np.pi * dates.weekday / 7.0)
    w_cos = np.cos(2.0 * np.pi * dates.weekday / 7.0)
    m_sin = np.sin(2.0 * np.pi * (dates.month - 1.0) / 12.0)
    m_cos = np.cos(2.0 * np.pi * (dates.month - 1.0) / 12.0)

    X = np.column_stack([r7, r30, r90, w_sin, w_cos, m_sin, m_cos, lag1, lag7, lag30])
    valid = ~np.isnan(X).any(axis=1)
    return X[valid], arr[valid], arr, dates[-1].date()


def _rollout_tree_forecast(model, last_90, last_date):
    """30-day autoregressive forecast rollout for tree regressors."""
    preds = []
    buf = list(last_90)
    for h in range(1, HORIZON_DAYS + 1):
        cur_d = last_date + dt.timedelta(days=h)
        feat = np.array([[
            float(np.mean(buf[-7:])),
            float(np.mean(buf[-30:])),
            float(np.mean(buf[-90:])),
            float(np.sin(2.0 * np.pi * cur_d.weekday() / 7.0)),
            float(np.cos(2.0 * np.pi * cur_d.weekday() / 7.0)),
            float(np.sin(2.0 * np.pi * (cur_d.month - 1.0) / 12.0)),
            float(np.cos(2.0 * np.pi * (cur_d.month - 1.0) / 12.0)),
            float(buf[-1]),
            float(buf[-7]),
            float(buf[-30]),
        ]], dtype=np.float64)
        p = float(max(0.0, model.predict(feat)[0]))
        preds.append(p)
        buf.append(p)
    return float(np.mean(preds))


def random_forest_forecast(values, start_date=None, performance_guard=False):
    """Random Forest Regressor forecasting next 30 days average rate."""
    if not HAS_ML or len(values) < 180 or is_time_critical():
        return None
    try:
        max_hist = 365 if performance_guard else 730
        n_est = 30 if performance_guard else 40
        X_train, y_train, arr_hist, last_d = _build_ml_features(values, start_date, max_hist)
        if len(X_train) < 60:
            return None

        # Train on 80%, validate on 20%
        split = int(len(X_train) * 0.8)
        rf = RandomForestRegressor(
            n_estimators=n_est,
            max_depth=4,
            min_samples_leaf=2,
            n_jobs=1,
            random_state=42,
        )
        rf.fit(X_train[:split], y_train[:split])
        # Refit on all available training observations
        rf.fit(X_train, y_train)

        last_90 = arr_hist[-90:] if len(arr_hist) >= 90 else np.pad(arr_hist, (90 - len(arr_hist), 0), 'constant')
        return _rollout_tree_forecast(rf, last_90, last_d)
    except Exception:
        return None


def gradient_boosting_forecast(values, start_date=None, performance_guard=False):
    """Gradient Boosting Regressor forecasting next 30 days average rate."""
    if not HAS_ML or len(values) < 180 or is_time_critical():
        return None
    try:
        max_hist = 365 if performance_guard else 730
        n_est = 30 if performance_guard else 40
        X_train, y_train, arr_hist, last_d = _build_ml_features(values, start_date, max_hist)
        if len(X_train) < 60:
            return None

        split = int(len(X_train) * 0.8)
        gb = GradientBoostingRegressor(
            n_estimators=n_est,
            max_depth=3,
            learning_rate=0.08,
            random_state=42,
        )
        gb.fit(X_train[:split], y_train[:split])
        gb.fit(X_train, y_train)

        last_90 = arr_hist[-90:] if len(arr_hist) >= 90 else np.pad(arr_hist, (90 - len(arr_hist), 0), 'constant')
        return _rollout_tree_forecast(gb, last_90, last_d)
    except Exception:
        return None


# =====================================================================
# Model Candidates Aggregator & Descriptions
# =====================================================================

def model_rates(values, start_date=None, performance_guard=False, allow_heavy_ml=True):
    """Generate daily demand rate estimates across all active models."""
    n = len(values)
    mean_val = float(np.mean(values)) if HAS_ML else (sum(values) / max(n, 1))

    candidates = {
        'recent_average': float(np.mean(values[-30:])) if HAS_ML and n >= 30 else (sum(values[-30:]) / 30 if n >= 30 else mean_val),
        'recent_60_average': float(np.mean(values[-60:])) if HAS_ML and n >= 60 else (sum(values[-60:]) / 60 if n >= 60 else mean_val),
    }

    recent = candidates['recent_average']
    if n > 30:
        prev_slice = values[-60:-30] if n >= 60 else values[:-30]
        previous = float(np.mean(prev_slice)) if HAS_ML else (sum(prev_slice) / len(prev_slice))
    else:
        previous = recent

    candidates['weighted_average'] = 0.6 * recent + 0.4 * (float(np.mean(values[-90:])) if HAS_ML and n >= 90 else mean_val)
    candidates['damped_trend'] = max(0.0, min(recent * 1.5, recent + 0.5 * (recent - previous)))

    candidates['seasonal_year'] = (
        (float(np.mean(values[-395:-365])) if HAS_ML else (sum(values[-395:-365]) / 30.0))
        if n >= 395 else candidates['weighted_average']
    )

    # Intermittent demand models
    for alpha in (0.1, 0.2):
        candidates[f'croston_sba_a{alpha}'] = croston_sba(values, alpha)
        for beta in (0.1, 0.2):
            candidates[f'tsb_a{alpha}_b{beta}'] = tsb(values, alpha, beta)

    # Exponential smoothing variants
    candidates['simple_exp_smoothing'] = simple_exp_smoothing(values, alpha=0.2)
    candidates['holts_double_smoothing'] = holts_double_smoothing(values)
    if n >= 14:
        candidates['holt_winters_additive'] = holt_winters_additive(values, m=7)

    # Theta and adaptive ES
    candidates['theta_method'] = theta_method(values)
    candidates['adaptive_exp_smoothing'] = adaptive_exp_smoothing(values)

    # Weekly seasonality
    if start_date is not None:
        hist_dates = [(start_date + dt.timedelta(days=i), values[i]) for i in range(n)]
        candidates['weekly_seasonal'] = weekly_seasonal_rate(hist_dates, start_date)

    # Scikit-Learn ML models: Ridge is very fast (analytic closed-form)
    if HAS_ML and n >= 14:
        candidates['ridge_regression'] = ridge_trend_forecast(values, start_date)

    # Tree-based ML models: only run if heavy ML is allowed and not time-critical
    if allow_heavy_ml and HAS_ML and n >= 180 and not is_time_critical():
        rf_rate = random_forest_forecast(values, start_date, performance_guard=performance_guard)
        if rf_rate is not None:
            candidates['random_forest'] = rf_rate

        gb_rate = gradient_boosting_forecast(values, start_date, performance_guard=performance_guard)
        if gb_rate is not None:
            candidates['gradient_boosting'] = gb_rate

    return candidates


def model_description(name, context=None):
    if name.startswith('croston_sba_'):
        return 'Metode Croston-SBA untuk barang dengan permintaan yang jarang atau tidak rutin'
    if name.startswith('tsb_'):
        return 'Metode TSB yang memperhitungkan peluang dan jumlah permintaan tidak rutin'
    if name.startswith('median_recent_'):
        count = name[len('median_recent_'):]
        subject = 'jumlah' if context == 'quantity' else 'jarak antar pembelian'
        return f'Nilai tengah {subject} dari {count} transaksi terakhir'
    if name == 'median_all':
        subject = 'jumlah' if context == 'quantity' else 'jarak antar pembelian'
        return f'Nilai tengah {subject} dari seluruh histori'
    if name == 'exponential_smoothing':
        return (
            'Rata-rata jumlah pembelian dengan bobot lebih besar pada data terbaru'
            if context == 'quantity'
            else 'Perkiraan jarak pembelian dengan bobot lebih besar pada data terbaru'
        )
    if name == 'ewma_span_5':
        subject = 'jumlah' if context == 'quantity' else 'jarak antar pembelian'
        return f'Rata-rata bergerak tertimbang eksponensial adaptif (EWMA span 5) untuk {subject}'
    if name == 'ridge_trend':
        return 'Tren regresi Ridge berbasis indeks kejadian dan selisih waktu'

    descriptions = {
        'recent_average': 'Rata-rata penjualan 30 hari terakhir',
        'recent_60_average': 'Rata-rata penjualan 60 hari terakhir',
        'weighted_average': 'Gabungan penjualan terbaru dengan bobot lebih besar pada data baru',
        'damped_trend': 'Tren penjualan terbaru dengan kenaikan atau penurunan yang dibatasi',
        'seasonal_year': 'Penjualan pada waktu yang sama tahun lalu',
        'simple_exp_smoothing': 'Pelunasan eksponensial tunggal (Single Exponential Smoothing)',
        'holts_double_smoothing': 'Pelunasan eksponensial ganda dengan tren yang diredam (Holt Damped Trend)',
        'holt_winters_additive': 'Pelunasan Holt-Winters aditif dengan pola musiman mingguan (siklus 7 hari)',
        'theta_method': 'Metode Theta: dekomposisi tren linier dan komponen musiman residual',
        'adaptive_exp_smoothing': 'Pelunasan eksponensial adaptif dengan alfa yang menyesuaikan secara otomatis (Trigg & Leach)',
        'weekly_seasonal': 'Pola musiman mingguan berdasarkan hari kerja (Senin-Minggu)',
        'ridge_regression': 'Regresi linier teratur Ridge berbasis hari dan pola musiman kalender',
        'random_forest': 'Machine Learning Random Forest Regressor berbasis fitur lag dan rata-rata bergulir',
        'gradient_boosting': 'Machine Learning Gradient Boosting Regressor berbasis boosting pohon keputusan',
        'insufficient_history': 'Histori penjualan belum cukup untuk memilih metode',
    }
    return descriptions.get(name, 'Metode perkiraan berdasarkan histori')


def percentile(values, fraction):
    values = sorted(values)
    if not values:
        return 0.0
    index = min(len(values) - 1, max(0, math.ceil(fraction * len(values)) - 1))
    return values[index]


# =====================================================================
# Chronological Backtesting & Ensemble Forecasting
# =====================================================================

def forecast_rate(values, start_date=None, performance_guard=False):
    """Select the lowest-error candidates using expanding-window 30-day tests and top-3 ensemble."""
    n = len(values)
    if n <= HORIZON_DAYS:
        mean_rate = float(np.mean(values)) if HAS_ML else (sum(values) / max(n, 1))
        fallback_demand = max(0.0, mean_rate * HORIZON_DAYS)
        model_name = 'recent_average' if fallback_demand > 0 else 'insufficient_history'
        eval_empty = {
            'actual_units': 0.0, 'under_units': 0.0, 'over_units': 0.0,
            'under_periods': 0, 'over_periods': 0,
            'baseline_under_units': 0.0, 'baseline_over_units': 0.0,
            'ensemble_spread_ratio': 0.0, 'top_models': [model_name],
        }
        return fallback_demand, model_name, None, 0, None, 0.0, eval_empty, 0.0, [model_name], False

    possible = list(range(max(30, n - MAX_BACKTEST_ORIGINS * HORIZON_DAYS),
                          n - HORIZON_DAYS + 1, HORIZON_DAYS))
    if len(possible) > MAX_BACKTEST_ORIGINS:
        possible = possible[-MAX_BACKTEST_ORIGINS:]

    errors = {}
    ml_models_seen = False

    for origin in possible:
        actual = float(np.sum(values[origin:origin + HORIZON_DAYS])) if HAS_ML else sum(values[origin:origin + HORIZON_DAYS])
        rates = model_rates(values[:origin], start_date=start_date, performance_guard=performance_guard, allow_heavy_ml=False)
        for name, rate in rates.items():
            if name in ('ridge_regression', 'random_forest', 'gradient_boosting'):
                ml_models_seen = True
            errors.setdefault(name, [])
            errors[name].append((rate * HORIZON_DAYS, actual))

    scores = {}
    for name, pairs in errors.items():
        if pairs:
            absolute = sum(abs(pred - actual) for pred, actual in pairs)
            scale = sum(actual for _, actual in pairs)
            scores[name] = absolute / max(scale, 1.0)

    current_rates = model_rates(values, start_date=start_date, performance_guard=performance_guard, allow_heavy_ml=True)
    if any(k in current_rates for k in ('ridge_regression', 'random_forest', 'gradient_boosting')):
        ml_models_seen = True

    if not scores:
        fallback_demand = max(0.0, current_rates.get('weighted_average', 0.0) * HORIZON_DAYS)
        eval_empty = {
            'actual_units': 0.0, 'under_units': 0.0, 'over_units': 0.0,
            'under_periods': 0, 'over_periods': 0,
            'baseline_under_units': 0.0, 'baseline_over_units': 0.0,
            'ensemble_spread_ratio': 0.0, 'top_models': ['weighted_average'],
        }
        return fallback_demand, 'weighted_average', None, 0, None, 0.0, eval_empty, 0.0, ['weighted_average'], ml_models_seen

    selected = min(scores, key=scores.get)

    # Ensemble: weighted average of top-3 models with weights = 1/(WAPE + 1e-4)
    sorted_models = sorted(scores.items(), key=lambda item: item[1])
    top_models = sorted_models[:min(3, len(sorted_models))]

    top_demands = []
    weights = []
    top_model_names = []
    for model_name, model_wape in top_models:
        top_model_names.append(model_name)
        m_rate = current_rates.get(model_name, 0.0)
        m_demand = max(0.0, m_rate * HORIZON_DAYS)
        top_demands.append(m_demand)
        weights.append(1.0 / (max(0.0, model_wape) + 1e-4))

    total_weight = sum(weights)
    if total_weight > 0:
        demand_30 = sum(d * (w / total_weight) for d, w in zip(top_demands, weights))
    else:
        demand_30 = current_rates.get(selected, 0.0) * HORIZON_DAYS

    # Calculate ensemble spread ratio (std dev of top-3 predictions / mean)
    if len(top_demands) > 1:
        mean_d = sum(top_demands) / len(top_demands)
        if mean_d > 1e-6:
            var_d = sum((d - mean_d) ** 2 for d in top_demands) / (len(top_demands) - 1)
            spread_ratio = math.sqrt(var_d) / mean_d
        else:
            spread_ratio = 0.0
    else:
        spread_ratio = 0.0

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
                    prior_scale = sum(act for _, act in prior_pairs)
                    prior_scores[name] = sum(abs(pred - act) for pred, act in prior_pairs) / max(prior_scale, 1.0)
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

    evaluation = {
        'actual_units': round(sum(actual for _, actual in outer_errors), 2),
        'under_units': round(sum(max(0.0, actual - predicted) for predicted, actual in outer_errors), 2),
        'over_units': round(sum(max(0.0, predicted - actual) for predicted, actual in outer_errors), 2),
        'under_periods': sum(actual > predicted for predicted, actual in outer_errors),
        'over_periods': sum(predicted > actual for predicted, actual in outer_errors),
        'baseline_under_units': round(sum(max(0.0, actual - predicted) for predicted, actual in baseline_errors), 2),
        'baseline_over_units': round(sum(max(0.0, predicted - actual) for predicted, actual in baseline_errors), 2),
        'ensemble_spread_ratio': round(spread_ratio, 4),
        'top_models': top_model_names,
    }

    ml_used = any(m in ('ridge_regression', 'random_forest', 'gradient_boosting') for m in top_model_names) or ml_models_seen

    return (
        max(0.0, demand_30),
        selected,
        nested_wape,
        len(outer_errors),
        nested_baseline_wape,
        percentile(under_forecasts, 0.8),
        evaluation,
        spread_ratio,
        top_model_names,
        ml_used,
    )


def confidence_label(history_days, events, wape):
    if history_days < 180 or events < 4 or wape is None:
        return 'Rendah'
    if history_days >= 365 and events >= 12 and wape <= 0.35:
        return 'Tinggi'
    if events >= 6 and wape <= 0.60:
        return 'Sedang'
    return 'Rendah'


# =====================================================================
# Stock Mode Forecast Engine
# =====================================================================

def stock_forecast(payload):
    today = dt.date.today()
    indexes = index_stocks(payload.get('stocks'))

    # Index historical PRs
    historical_prs = {}
    for row in payload.get('stock_prs', []):
        code = key(row.get('material_code'))
        requested = parse_date(row.get('date'))
        qty = number(row.get('qty'))
        if not code or not requested or requested > today or qty <= 0:
            continue
        pr_key = (str(row.get('no_pr') or '').strip(), requested, key(row.get('unit')))
        events = historical_prs.setdefault(code, {})
        events[pr_key] = events.get(pr_key, 0.0) + qty

    # Index landed costs
    costs = {}
    for row in payload.get('costs', []):
        code = str(row.get('material_code') or '').strip()
        qty, price = number(row.get('qty')), number(row.get('price'))
        if not code or qty <= 0:
            continue
        landed = price + number(row.get('shipping_allocated')) / qty
        costs.setdefault(code, []).append((parse_date(row.get('tgl')) or today, landed))

    # Load and aggregate sales data with pandas if available
    raw_sales = payload.get('sales', [])
    total_sales_rows = len(raw_sales)
    performance_guard = total_sales_rows > 3000

    groups = {}
    if HAS_ML and raw_sales:
        df_sales = pd.DataFrame(raw_sales)
        for col in ('material_code', 'material', 'unit'):
            if col not in df_sales.columns:
                df_sales[col] = ''
            df_sales[col] = df_sales[col].fillna('').astype(str).str.strip()
        if 'qty' not in df_sales.columns:
            df_sales['qty'] = 0.0
        df_sales['qty'] = pd.to_numeric(df_sales['qty'], errors='coerce').fillna(0.0)

        if 'date' not in df_sales.columns:
            df_sales['date'] = None
        df_sales['date'] = pd.to_datetime(df_sales['date'], errors='coerce').dt.date

        # Filter valid rows
        df_sales = df_sales[
            (df_sales['qty'] > 0)
            & (df_sales['date'].notna())
            & (df_sales['date'] <= today)
            & ((df_sales['material_code'] != '') | (df_sales['material'] != ''))
        ]

        df_sales['item_key'] = np.where(
            df_sales['material_code'] != '',
            df_sales['material_code'],
            df_sales['material'].str.lower()
        )

        for item_key_val, grp in df_sales.groupby('item_key'):
            first_row = grp.iloc[0]
            s_by_date = grp.groupby('date')['qty'].sum()
            min_date = s_by_date.index.min()
            idx = pd.date_range(start=min_date, end=today, freq='D').date
            daily_arr = s_by_date.reindex(idx, fill_value=0.0).to_numpy(dtype=np.float64)

            groups[item_key_val] = {
                'material_code': first_row['material_code'],
                'material': first_row['material'],
                'unit': first_row['unit'],
                'min_date': min_date,
                'series': daily_arr,
                'sales_by_date': s_by_date.to_dict(),
            }
    else:
        # Fallback stdlib grouping
        for row in raw_sales:
            code = str(row.get('material_code') or '').strip()
            material = str(row.get('material') or '').strip()
            sold = parse_date(row.get('date'))
            qty = number(row.get('qty'))
            if (not code and not material) or not sold or sold > today or qty <= 0:
                continue
            item_key_val = code or key(material)
            group = groups.setdefault(item_key_val, {
                'material_code': code,
                'material': material,
                'unit': str(row.get('unit') or '').strip(),
                'sales_by_date': {},
            })
            group['sales_by_date'][sold] = group['sales_by_date'].get(sold, 0.0) + qty

        for item_key_val, item in groups.items():
            min_date = min(item['sales_by_date'])
            days = (today - min_date).days + 1
            daily_series = [item['sales_by_date'].get(today - dt.timedelta(days=offset), 0.0)
                            for offset in range(days - 1, -1, -1)]
            item['min_date'] = min_date
            item['series'] = daily_series

    if len(groups) > 30:
        performance_guard = True

    recommendations = []
    for item_key_val, item in groups.items():
        min_date = item['min_date']
        raw_series = item['series']

        # Winsorize extreme spike outliers using median and MAD
        series = winsorize_series(raw_series)

        (
            demand_30,
            model,
            wape,
            folds,
            baseline_wape,
            error_buffer,
            evaluation,
            ensemble_spread,
            top_models_used,
            ml_used,
        ) = forecast_rate(series, start_date=min_date, performance_guard=performance_guard)

        indexes_for_stock = find_stock(indexes, item['material_code'], item['material'])
        current_stock = max(0.0, number(indexes_for_stock['current_stock']))
        available_stock = max(0.0, number(indexes_for_stock.get('available_stock', current_stock)))
        unit = item['unit'] or indexes_for_stock.get('unit') or 'PCS'
        material = indexes_for_stock.get('material') or item['material'] or item_key_val
        code = indexes_for_stock.get('material_code') or item['material_code']

        pr_events = [
            (date, qty) for (_, date, pr_unit), qty in historical_prs.get(key(code), {}).items()
            if pr_unit == key(unit) and min_date <= date <= today - dt.timedelta(days=HORIZON_DAYS)
        ]
        pr_sales = sum(
            sum(qty for sold, qty in item['sales_by_date'].items()
                if requested < sold <= requested + dt.timedelta(days=HORIZON_DAYS))
            for requested, _ in pr_events
        )
        pr_history = {
            'events': len(pr_events),
            'requested_units': round(sum(qty for _, qty in pr_events), 2),
            'sales_next_30d_units': round(pr_sales, 2),
        }

        event_count = int(np.sum(series > 0)) if HAS_ML else sum(1 for qty in series if qty > 0)
        history_days = len(series)
        enough_history = (
            indexes_for_stock['stock_matched']
            and history_days >= 365
            and event_count >= 12
            and folds >= 4
            and wape is not None
            and wape <= 0.40
            and (baseline_wape is None or wape <= baseline_wape * 1.05)
        )

        confidence = confidence_label(history_days, event_count, wape) if enough_history else 'Rendah'

        # Safety buffer adaptive to confidence level:
        # Tinggi: buffer * 0.8, Sedang: buffer * 1.0, Rendah: buffer * 1.2
        if enough_history:
            base_buffer = error_buffer if folds >= 3 else 0.0
            if confidence == 'Tinggi':
                buffer = base_buffer * 0.8
            elif confidence == 'Sedang':
                buffer = base_buffer * 1.0
            else:
                buffer = base_buffer * 1.2
            target = demand_30 + buffer
            suggested = smart_round(target - available_stock, unit)
        else:
            buffer = 0.0
            if demand_30 > 0:
                suggested = smart_round(demand_30 - available_stock, unit)
            else:
                suggested = None

        daily_rate = demand_30 / HORIZON_DAYS
        doi = round(available_stock / daily_rate) if daily_rate > 0 else 999

        # Filter: avoid recommending buy if already covered and no suggested order
        if (suggested == 0 or suggested is None) and doi > 45:
            continue

        urgency = 40 if available_stock <= 0 else 30 if doi <= 7 else 22 if doi <= 15 else 14 if doi <= 30 else 5 if doi <= 45 else 0
        evidence = min(25, event_count * 2) + (15 if confidence == 'Tinggi' else 8 if confidence == 'Sedang' else 0)

        history = sorted(costs.get(item['material_code'], []), key=lambda pair: pair[0])
        latest = history[-1][1] if history else 0.0
        median = statistics.median(p for _, p in history) if history else 0.0
        saving = (median - latest) / median * 100 if median > 0 else 0.0

        # Score enrichment:
        # +5 if saving_percent >= 10
        # +10 if ensemble_spread_ratio < 0.10 (models agree)
        # -5 if wape > 0.60
        # Clamped to [0, 100]
        score_adj = 0
        if saving >= 10:
            score_adj += 5
        if ensemble_spread < 0.10 and demand_30 > 0:
            score_adj += 10
        if wape is not None and wape > 0.60:
            score_adj -= 5

        raw_score = urgency + evidence + (10 if suggested and suggested > 0 else 0) + score_adj
        score = max(0, min(100, raw_score))

        reasons = [
            f"Metode perkiraan terpilih dari uji data: {model_description(model)}",
            f"Perkiraan kebutuhan 30 hari (ensemble): {demand_30:.1f} {unit}",
            f"Selisih prediksi dengan penjualan aktual: {wape * 100:.1f}% ({folds} pengujian)" if wape is not None else 'Histori belum cukup untuk memeriksa ketepatan perkiraan penjualan',
            f"Pembanding sederhana (rata-rata penjualan terbaru) memiliki selisih {baseline_wape * 100:.1f}%" if baseline_wape is not None else 'Histori belum cukup untuk membuat pembanding sederhana',
        ]

        if buffer > 0:
            reasons.append(f"Tambahan stok pengaman disesuaikan tingkat kepercayaan ({confidence}): {buffer:.1f} {unit} (basis galat: {error_buffer:.1f})")
        else:
            reasons.append(f"Tambahan stok pengaman berdasarkan kesalahan prediksi sebelumnya: {error_buffer:.1f} {unit}")

        reasons.extend([
            f"Stok gudang saat ini {current_stock:g} {unit}",
            'Perhitungan saran juga mempertimbangkan PR/PO yang berjalan dan barang yang akan dikirim',
            f"Perkiraan stok mencukupi sekitar {doi} hari (termasuk komitmen)" if doi < 999 else 'Belum ada laju permintaan untuk memperkirakan cakupan stok',
        ])

        if not enough_history:
            if not indexes_for_stock['stock_matched']:
                reasons.append('Kode material tidak cocok dengan tb_barang; stok perlu diperiksa')
            if history_days < 365:
                reasons.append(f'Histori {history_days} hari; perlu minimal 365 hari')
            if event_count < 12:
                reasons.append(f'Hari dengan penjualan {event_count}; perlu minimal 12 hari')
            if folds < 4:
                reasons.append(f'Baru {folds} kali pengujian; perlu minimal 4 kali')
            if wape is not None and wape > 0.40:
                reasons.append(f'Prediksi belum cukup akurat untuk saran otomatis penuh (selisih {wape * 100:.1f}%; batas 40%)')
            if wape is not None and baseline_wape is not None and wape > baseline_wape * 1.05:
                reasons.append('Perkiraan ini belum lebih akurat daripada pembanding rata-rata sederhana')
            if suggested is not None:
                reasons.append('Saran jumlah tetap dihitung tanpa stok pengaman untuk referensi awal (kepercayaan Rendah)')

        if saving >= 5:
            reasons.append(f"Biaya pembelian terbaru {saving:.1f}% lebih rendah daripada nilai tengah historis")
        if ensemble_spread < 0.10 and demand_30 > 0:
            reasons.append("Konsensus antar model peramalan tinggi (variasi antar model < 10%)")
        if wape is not None and wape > 0.60:
            reasons.append(f"Tingkat kesalahan prediksi tinggi ({wape * 100:.1f}%), skor prioritas dikurangi")
        if ml_used:
            reasons.append("Model machine learning (Ridge/Random Forest/GBDT) aktif dan diuji dalam peramalan")

        recommendations.append({
            'material_code': code,
            'material': material,
            'unit': unit,
            'score': score,
            'suggested_qty': suggested,
            'current_stock': round(current_stock, 2),
            'stock_matched': indexes_for_stock['stock_matched'],
            'available_stock': round(available_stock, 2),
            'days_of_inventory': doi,
            'forecast_30d': round(demand_30, 2),
            'forecast_model': model,
            'backtest_wape': round(wape, 4) if wape is not None else None,
            'backtest_periods': folds,
            'backtest_error_buffer': round(buffer, 2),
            'backtest_inventory_proxy': evaluation,
            'historical_stock_pr': pr_history,
            'baseline_wape': round(baseline_wape, 4) if baseline_wape is not None else None,
            'confidence': confidence,
            'history_days': history_days,
            'history_events': event_count,
            'stock_breakdown': {
                'physical': round(current_stock, 2),
                'mib': round(number(indexes_for_stock.get('mib')), 2),
                'mis': round(number(indexes_for_stock.get('mis')), 2),
                'mibs': round(number(indexes_for_stock.get('mibs')), 2),
                'pr_outstanding': round(number(indexes_for_stock.get('pr_outstanding')), 2),
                'po_outstanding': round(number(indexes_for_stock.get('po_outstanding')), 2),
                'do_outstanding': round(number(indexes_for_stock.get('do_outstanding')), 2),
            },
            'latest_landed_cost': round(latest, 2),
            'median_landed_cost': round(median, 2),
            'saving_percent': round(saving, 2),
            'reasons': reasons,
            'ensemble_models_used': top_models_used,
            'ensemble_spread_ratio': round(ensemble_spread, 4),
            'ml_used': ml_used,
        })

    recommendations.sort(key=lambda row: (-row['score'], row['days_of_inventory']))
    return {
        'recommendations': recommendations[:100],
        'engine': 'Per-material backtest selection with ensemble averaging, tuned Croston-SBA, TSB, Holt, Holt-Winters, Theta, and Scikit-Learn ML',
    }


# =====================================================================
# Opex Mode Forecast Engine
# =====================================================================

def recurrence_candidates(values, dates=None, context='interval'):
    """Generate recurrence estimators including EWMA and Ridge trend."""
    if not values:
        return {}

    candidates = {
        'median_recent_3': float(np.median(values[-3:])) if HAS_ML else statistics.median(values[-3:]),
        'median_recent_6': float(np.median(values[-6:])) if HAS_ML else statistics.median(values[-6:]),
        'median_all': float(np.median(values)) if HAS_ML else statistics.median(values),
    }

    # Traditional weighted exponential smoothing
    weighted = float(values[0])
    for val in values[1:]:
        weighted = 0.35 * float(val) + 0.65 * weighted
    candidates['exponential_smoothing'] = weighted

    # EWMA via pandas ewm(span=5)
    if HAS_ML:
        s = pd.Series(values, dtype=np.float64)
        candidates['ewma_span_5'] = float(s.ewm(span=5).mean().iloc[-1])
    else:
        alpha = 2.0 / (5.0 + 1.0)
        ewma = float(values[0])
        for val in values[1:]:
            ewma = alpha * float(val) + (1.0 - alpha) * ewma
        candidates['ewma_span_5'] = ewma

    # Ridge trend for quantity forecasting
    if context == 'quantity' and HAS_ML and len(values) >= 4 and dates is not None and len(dates) == len(values):
        try:
            n = len(values)
            x_idx = np.arange(n, dtype=np.float64)
            d0 = dates[0]
            x_days = np.array([(d - d0).days for d in dates], dtype=np.float64)
            X = np.column_stack([x_idx, x_days])
            y = np.asarray(values, dtype=np.float64)
            ridge = Ridge(alpha=1.0)
            ridge.fit(X, y)
            gap = (dates[-1] - dates[-2]).days if n > 1 else 30
            x_next = np.array([[float(n), float((dates[-1] - d0).days + gap)]], dtype=np.float64)
            candidates['ridge_trend'] = float(max(0.0, ridge.predict(x_next)[0]))
        except Exception:
            pass

    return candidates


def select_recurrence_forecast(values, dates=None, context='interval'):
    """Choose interval/quantity estimator with rolling one-step validation."""
    predictions = {}
    actuals = []
    n = len(values)

    for origin in range(max(2, n - 5), n):
        actual = values[origin]
        actuals.append(actual)
        d_slice = dates[:origin] if dates is not None else None
        cands = recurrence_candidates(values[:origin], dates=d_slice, context=context)
        for name, forecast in cands.items():
            predictions.setdefault(name, []).append(forecast)

    all_cands = recurrence_candidates(values, dates=dates, context=context)
    if not predictions:
        name = 'median_recent_3' if n < 3 else 'median_recent_6'
        val = all_cands.get(name, float(values[-1]) if values else 0.0)
        return val, name, None, 0

    errors = {
        name: [abs(p - a) for p, a in zip(fc_list, actuals)]
        for name, fc_list in predictions.items()
        if len(fc_list) == len(actuals)
    }

    if not errors:
        name = 'median_recent_3' if n < 3 else 'median_recent_6'
        return all_cands.get(name, float(values[-1])), name, None, 0

    scores = {
        name: float(np.median(m_errors)) if HAS_ML else statistics.median(m_errors)
        for name, m_errors in errors.items()
    }
    selected_name = min(scores, key=scores.get)

    nested_errors = []
    for index, actual in enumerate(actuals):
        if index == 0:
            fold_model = 'median_recent_3'
        else:
            prior_scores = {
                model: (float(np.median(m_errors[:index])) if HAS_ML else statistics.median(m_errors[:index]))
                for model, m_errors in errors.items()
                if m_errors[:index]
            }
            fold_model = min(prior_scores, key=prior_scores.get) if prior_scores else 'median_recent_3'
        nested_errors.append(abs(predictions[fold_model][index] - actual))

    err_median = float(np.median(nested_errors)) if HAS_ML else statistics.median(nested_errors)
    return all_cands[selected_name], selected_name, err_median, len(nested_errors)


def opex_forecast(payload):
    today = dt.date.today()
    indexes = index_stocks(payload.get('stocks'))
    groups = {}

    for row in payload.get('opex', []):
        code = str(row.get('material_code') or '').strip()
        material = str(row.get('material') or '').strip()
        purchased = parse_date(row.get('date'))
        qty = number(row.get('qty'))
        raw_price = row.get('price')
        price = number(raw_price) if raw_price is not None and str(raw_price).strip() != '' else None
        if (not code and not material) or not purchased or purchased > today or qty <= 0:
            continue
        unit = str(row.get('unit') or '').strip()
        item_key = (code or key(material), key(unit))
        group = groups.setdefault(item_key, {
            'material_code': code,
            'material': material,
            'unit': unit,
            'events': {},
            'prices': [],
            'pr_references': set(),
            'linked_references': set(),
        })
        event = group['events'].setdefault(purchased, 0.0)
        group['events'][purchased] = event + qty
        if price is not None and price > 0:
            group['prices'].append((purchased, price))

        pr_reference = str(row.get('no_pr') or '').strip()
        if pr_reference:
            group['pr_references'].add(pr_reference)
            if number(row.get('has_po_reference')) > 0:
                group['linked_references'].add(pr_reference)

    recommendations = []
    for item in groups.values():
        dates = sorted(item['events'])
        if len(dates) < 3:
            continue
        intervals = [(dates[i] - dates[i - 1]).days for i in range(1, len(dates))]
        intervals = [gap for gap in intervals if gap > 0]
        if len(intervals) < 2:
            continue

        interval_value, interval_model, error_days, interval_folds = select_recurrence_forecast(
            intervals, dates=None, context='interval'
        )
        interval = max(1, int(round(interval_value)))
        last_date = dates[-1]
        due = last_date + dt.timedelta(days=interval)
        days_until = (due - today).days

        values = [item['events'][day] for day in dates]
        typical_qty, quantity_model, quantity_error, quantity_folds = select_recurrence_forecast(
            values, dates=dates, context='quantity'
        )

        stock = find_stock(indexes, item['material_code'], item['material'])
        current_stock = max(0.0, number(stock['current_stock']))
        available_stock = max(0.0, number(stock.get('available_stock', current_stock)))
        unit = item['unit'] or stock.get('unit') or 'PCS'
        material = stock.get('material') or item['material']
        code = stock.get('material_code') or item['material_code']

        latest_price = None
        if item['prices']:
            sorted_prices = sorted(item['prices'], key=lambda p: p[0])
            latest_price = round(sorted_prices[-1][1], 2)

        if HAS_ML:
            intervals_arr = np.asarray(intervals, dtype=np.float64)
            mean_int = float(np.mean(intervals_arr))
            dispersion = float(np.std(intervals_arr) / mean_int) if mean_int > 0 else 1.0
        else:
            mean_int = statistics.mean(intervals) if intervals else 0.0
            dispersion = (statistics.pstdev(intervals) / mean_int) if len(intervals) > 1 and mean_int > 0 else 1.0

        enough_history = (
            stock['stock_matched']
            and len(dates) >= 6
            and interval_folds >= 3
            and quantity_folds >= 3
            and dispersion <= 0.35
            and error_days is not None
            and error_days <= max(3, interval * 0.25)
            and quantity_error is not None
            and quantity_error <= max(1, typical_qty * 0.5)
        )
        confidence = (
            'Tinggi' if enough_history and len(dates) >= 8 and dispersion <= 0.25
            and error_days <= max(3, interval * 0.2)
            else 'Sedang' if enough_history else 'Rendah'
        )

        if enough_history:
            suggested = smart_round(typical_qty - available_stock, unit)
        else:
            confidence = 'Rendah'
            if typical_qty > 0:
                suggested = smart_round(typical_qty - available_stock, unit)
            else:
                suggested = None

        urgency = 45 if days_until <= 0 else 38 if days_until <= 7 else 30 if days_until <= 14 else 22 if days_until <= 30 else 8
        raw_score = (
            urgency
            + min(25, len(dates) * 3)
            + (15 if confidence == 'Tinggi' else 8 if confidence == 'Sedang' else 0)
            + (8 if suggested and suggested > 0 else 0)
        )
        score = max(0, min(100, raw_score))

        reasons = [
            f"Jarak antar pembelian umumnya {interval} hari, berdasarkan {len(dates)} transaksi",
            f"Dasar perkiraan waktu pembelian: {model_description(interval_model, 'interval')}; jumlah: {model_description(quantity_model, 'quantity')}",
            f"Perkiraan tanggal pembelian berikutnya {due.isoformat()} ({days_until} hari lagi)",
            f"Selisih yang umum pada pengujian: waktu {error_days:.1f} hari; jumlah {quantity_error:.1f} {unit}" if error_days is not None and quantity_error is not None else 'Histori pembelian belum cukup untuk memeriksa ketepatan perkiraan waktu dan jumlah',
            f"Stok gudang saat ini {current_stock:g} {unit}",
            'Perhitungan saran juga mempertimbangkan PR/PO yang berjalan dan barang yang akan dikirim',
            f"{len(item['linked_references'])} dari {len(item['pr_references'])} PR sudah memiliki PO terkait",
        ]

        if latest_price is not None:
            reasons.append(f"Harga beli terakhir tercatat: Rp {latest_price:,.2f}")

        if not enough_history:
            if not stock['stock_matched']:
                reasons.append('Kode material tidak cocok dengan tb_barang; stok perlu diperiksa')
            if len(dates) < 6:
                reasons.append(f'Kejadian PR pada tanggal berbeda {len(dates)}; perlu minimal 6')
            if interval_folds < 3 or quantity_folds < 3:
                reasons.append(f'Periode uji siklus {interval_folds} dan jumlah {quantity_folds}; masing-masing perlu 3')
            if dispersion > 0.35:
                reasons.append(f'Variasi jeda PR {dispersion:.2f}; batas 0.35')
            if error_days is not None and error_days > max(3, interval * 0.25):
                reasons.append(f'Galat jeda {error_days:.1f} hari; batas {max(3, interval * 0.25):.1f} hari')
            if quantity_error is not None and quantity_error > max(1, typical_qty * 0.5):
                reasons.append(f'Galat jumlah {quantity_error:.1f} {unit}; batas {max(1, typical_qty * 0.5):.1f} {unit}')
            if suggested is not None:
                reasons.append('Saran jumlah tetap dihitung berdasarkan histori pembelian untuk referensi awal (kepercayaan Rendah)')

        ml_used = (quantity_model in ('ridge_trend', 'ewma_span_5')) or (interval_model == 'ewma_span_5')
        if ml_used:
            reasons.append("Model machine learning adaptif (Ridge / EWMA) digunakan dalam perkiraan tren kebutuhan")

        recommendations.append({
            'material_code': code,
            'material': material,
            'unit': unit,
            'score': score,
            'suggested_qty': suggested,
            'current_stock': round(current_stock, 2),
            'stock_matched': stock['stock_matched'],
            'available_stock': round(available_stock, 2),
            'latest_price': latest_price,
            'stock_breakdown': {
                'physical': round(current_stock, 2),
                'mib': round(number(stock.get('mib')), 2),
                'mis': round(number(stock.get('mis')), 2),
                'mibs': round(number(stock.get('mibs')), 2),
                'pr_outstanding': round(number(stock.get('pr_outstanding')), 2),
                'po_outstanding': round(number(stock.get('po_outstanding')), 2),
                'do_outstanding': round(number(stock.get('do_outstanding')), 2),
            },
            'median_interval_days': interval,
            'predicted_date': due.isoformat(),
            'days_until': days_until,
            'confidence': confidence,
            'history_events': len(dates),
            'interval_error_days': round(error_days, 1) if error_days is not None else None,
            'quantity_error': round(quantity_error, 2) if quantity_error is not None else None,
            'pr_reference_count': len(item['pr_references']),
            'linked_pr_reference_count': len(item['linked_references']),
            'forecast_model': f'{interval_model} / {quantity_model}',
            'reasons': reasons,
            'ensemble_models_used': [interval_model, quantity_model],
            'ensemble_spread_ratio': 0.0,
            'ml_used': ml_used,
        })

    recommendations.sort(key=lambda row: (-row['score'], row['days_until']))
    return {
        'recommendations': recommendations[:100],
        'engine': 'Rolling backtest selection for Opex interval and quantity forecasts with Ridge and EWMA estimation',
    }


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
