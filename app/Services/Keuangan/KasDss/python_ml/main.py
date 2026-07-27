from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
import os
import re
from pathlib import Path
import pandas as pd
import mysql.connector
from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.pipeline import make_pipeline
from sklearn.metrics.pairwise import cosine_similarity
import requests
import json
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

# Load Laravel .env from the active project path. The app may run from
# /var/www/html in Docker or /root/isystem-1 locally.
PROJECT_ROOT = Path(__file__).resolve().parents[5]
load_dotenv(PROJECT_ROOT / '.env')

app = FastAPI()

class SuggestRequest(BaseModel):
    mode: str = "out"
    keterangan: str = ""
    nominal: float = 0.0
    hasPpn: bool = False
    ppnNominal: float = 0.0
    seedAkun: str = ""

class PurchaseSuggestRequest(BaseModel):
    no_doc: str = ""
    vendor: str = ""
    ref_po: str = ""
    total: float = 0.0
    tax: float = 0.0
    cashNominal: float = 0.0
    dppTarget: float = 0.0
    hasPpn: bool = False

class SalesSuggestRequest(BaseModel):
    no_faktur: str = ""
    customer: str = ""
    ref_po: str = ""
    total: float = 0.0
    tax: float = 0.0
    cashNominal: float = 0.0
    dppTarget: float = 0.0
    hpp: float = 0.0
    trx_jurnal: str = ""
    saldo_piutang: float = 0.0
    total_bayaran: float = 0.0
    hasPpn: bool = False

class AdjustmentSuggestRequest(BaseModel):
    remark: str = ""
    seedAkun: str = ""
    nominal: float = 0.0
    seedJenis: str = ""

def get_db_connection():
    dn = os.getenv('DB_DATABASE', 'dbsja')
    return mysql.connector.connect(
        host=os.getenv('DB_HOST', '127.0.0.1'),
        port=int(os.getenv('DB_PORT', 3306)),
        user=os.getenv('DB_USERNAME', 'root'),
        password=os.getenv('DB_PASSWORD', ''),
        database=dn
    )

models = {}

def clean_text(t):
    t = str(t).lower()
    t = re.sub(r'[^a-zA-Z0-9]+', ' ', t)
    return ' '.join([w for w in t.split() if len(w)>2])

def is_valid_account_seed(account):
    a = str(account or "").strip().upper()
    return bool(a) and "XX" not in a and a not in ["1100AD", "1200AD"]

def safe_float(value, default=0.0):
    try:
        if pd.isna(value):
            return default
        n = float(value)
        if pd.isna(n):
            return default
        if n == float("inf") or n == float("-inf"):
            return default
        return n
    except Exception:
        return default

def account_name(account):
    return str(models.get("account_names", {}).get(str(account or "").strip(), "")).lower()

def has_any(text, words):
    return any(w in text for w in words)

def preferred_accounts(cleaned_input):
    prefs = []
    if has_any(cleaned_input, ["telp", "telepon", "telephone", "internet", "wifi", "indihome", "biznet"]):
        prefs.append("5103AD")
    if has_any(cleaned_input, ["kue", "snack", "makan", "minum", "konsumsi", "nasi", "kopi", "teh"]):
        prefs.append("5122AD")
    if has_any(cleaned_input, ["cleaning", "bersih", "dapur", "sabun", "sapu", "pel", "pembersih"]):
        prefs.append("5121AD")
    if has_any(cleaned_input, ["kirim", "pengiriman", "dokumen", "document", "dokument", "kurir", "pos", "jne", "jnt", "tiki", "gojek", "grab"]):
        prefs.append("5125AD")
    if has_any(cleaned_input, ["laptop", "komputer", "computer", "printer", "monitor", "keyboard", "mouse", "server", "it"]):
        prefs.append("5117AD")
    return prefs

def account_allowed_for_text(account, cleaned_input, allow_liability=False):
    a = str(account or "").strip().upper()
    name = account_name(a)
    if not is_valid_account_seed(a):
        return False

    if a.startswith("2") and not allow_liability:
        return False
    if a.startswith("11") or "kas " in name or "bank " in name:
        return False

    bank_charge = a == "5114AD" or "biaya bank" in name
    vehicle_account = "kendaraan" in name or a in ["5118AD", "5119AD", "5106AD", "5107AD"]
    liability_account = a.startswith("2") or "hutang" in name

    food = ["kue", "snack", "makan", "minum", "konsumsi", "nasi", "kopi", "teh"]
    if has_any(cleaned_input, food):
        if a != "5122AD" and (bank_charge or vehicle_account or liability_account):
            return False

    cleaning = ["cleaning", "bersih", "dapur", "sabun", "sapu", "pel", "pembersih"]
    if has_any(cleaned_input, cleaning):
        if a != "5121AD" and (bank_charge or vehicle_account or liability_account):
            return False

    shipping = ["kirim", "pengiriman", "dokumen", "document", "dokument", "kurir", "pos", "jne", "jnt", "tiki", "gojek", "grab"]
    if has_any(cleaned_input, shipping):
        if a != "5125AD" and (bank_charge or vehicle_account or liability_account):
            return False

    electronics = ["laptop", "komputer", "computer", "printer", "monitor", "keyboard", "mouse", "server", "it"]
    vehicle = ["mobil", "motor", "truck", "truk", "kendaraan", "angkut", "ban", "oli", "solar", "bengkel"]
    if has_any(cleaned_input, electronics) and not has_any(cleaned_input, vehicle):
        if vehicle_account:
            return False

    utilities = ["telp", "telepon", "telephone", "internet", "wifi", "indihome", "biznet", "listrik", "air"]
    if has_any(cleaned_input, utilities):
        if liability_account:
            return False

    return True

def build_preferred_lines(cleaned_input, dpp, max_lines, mode):
    lines = []
    for akun in preferred_accounts(cleaned_input):
        if len(lines) >= max_lines:
            break
        if account_allowed_for_text(akun, cleaned_input):
            lines.append({
                "akun": akun,
                "jenis": "Debit" if mode == "out" else "Kredit",
                "nominal": 0.0
            })

    if lines:
        lines[0]["nominal"] = dpp
    return lines

def build_history_lines(row, dpp, max_lines, mode, cleaned_input):
    candidates = []
    for slot in [1, 3]:
        akun = str(row.get(f"Kode_Akun{slot}") or "").strip()
        nominal = safe_float(row.get(f"Nominal{slot}"), 0.0)
        if nominal <= 0 or not account_allowed_for_text(akun, cleaned_input):
            continue
        candidates.append({"akun": akun, "hist_nominal": nominal})

    if not candidates:
        return []

    total = sum(item["hist_nominal"] for item in candidates)
    if total <= 0:
        return []

    selected = candidates[:max_lines]
    running = 0.0
    lines = []
    for idx, item in enumerate(selected):
        if idx == len(selected) - 1:
            nominal = max(0.0, round(dpp - running, 2))
        else:
            nominal = round(dpp * (item["hist_nominal"] / total), 2)
            running += nominal
        nominal = safe_float(nominal, 0.0)
        lines.append({
            "akun": item["akun"],
            "jenis": "Debit" if mode == "out" else "Kredit",
            "nominal": nominal
        })
    return lines

def build_purchase_query(req):
    return clean_text(" ".join([
        str(req.no_doc or ""),
        str(req.vendor or ""),
        str(req.ref_po or ""),
        "pembelian fi"
    ]))

def fetch_purchase_history(vendor, ref_po, limit=500):
    conn = get_db_connection()
    try:
        filters = []
        params = []
        if str(vendor or "").strip():
            filters.append("LOWER(COALESCE(k.Keterangan,'')) LIKE %s")
            params.append(f"%{str(vendor or '').strip().lower()}%")
        if str(ref_po or "").strip():
            filters.append("LOWER(COALESCE(k.Keterangan,'')) LIKE %s")
            params.append(f"%{str(ref_po or '').strip().lower()}%")

        where = """(
            UPPER(COALESCE(k.Keterangan,'')) LIKE '%PEMBELIAN%'
            OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%HUTANG KREDIT%'
            OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%NO.FI%'
            OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%NO. FI%'
        )"""
        if filters:
            where += " AND (" + " OR ".join(filters) + ")"

        query = f"""
        SELECT '' AS no_doc, '' AS nm_vdr, '' AS ref_po, 0 AS total, 0 AS tax, '' AS jurnal,
               k.Kode_Voucher, k.Kode_Akun, k.Keterangan,
               k.Kode_Akun1, k.Nominal1, k.Jenis_Beban1,
               k.Kode_Akun2, k.Nominal2, k.Jenis_Beban2,
               k.Kode_Akun3, k.Nominal3, k.Jenis_Beban3
        FROM tb_kas k
        WHERE {where}
        ORDER BY k.Tgl_Voucher DESC, k.Kode_Voucher DESC
        LIMIT {int(limit)}
        """
        df = pd.read_sql(query, conn, params=params)
        if len(df) < 5:
            df = pd.read_sql("""
            SELECT '' AS no_doc, '' AS nm_vdr, '' AS ref_po, 0 AS total, 0 AS tax, '' AS jurnal,
                   k.Kode_Voucher, k.Kode_Akun, k.Keterangan,
                   k.Kode_Akun1, k.Nominal1, k.Jenis_Beban1,
                   k.Kode_Akun2, k.Nominal2, k.Jenis_Beban2,
                   k.Kode_Akun3, k.Nominal3, k.Jenis_Beban3
            FROM tb_kas k
            WHERE (
                UPPER(COALESCE(k.Keterangan,'')) LIKE '%PEMBELIAN%'
                OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%HUTANG KREDIT%'
                OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%NO.FI%'
                OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%NO. FI%'
            )
            ORDER BY k.Tgl_Voucher DESC, k.Kode_Voucher DESC
            LIMIT 800
            """, conn)
        return df
    finally:
        conn.close()

def build_purchase_lines(row, dpp, has_ppn):
    slots = [1, 3] if has_ppn else [1, 2, 3]
    candidates = []
    query_text = clean_text(" ".join([
        str(row.get("Keterangan") or ""),
        str(row.get("nm_vdr") or ""),
        str(row.get("ref_po") or ""),
    ]))
    for slot in slots:
        akun = str(row.get(f"Kode_Akun{slot}") or "").strip()
        nominal = safe_float(row.get(f"Nominal{slot}"), 0.0)
        jenis = str(row.get(f"Jenis_Beban{slot}") or "Debit").strip() or "Debit"
        if nominal <= 0 or not account_allowed_for_text(akun, query_text, allow_liability=True):
            continue
        candidates.append({"akun": akun, "jenis": jenis, "hist_nominal": nominal})

    if not candidates:
        return []

    total = sum(item["hist_nominal"] for item in candidates)
    if total <= 0:
        return []

    lines = []
    running = 0.0
    for idx, item in enumerate(candidates):
        nominal = max(0.0, round(dpp - running, 2)) if idx == len(candidates) - 1 else round(dpp * item["hist_nominal"] / total, 2)
        running += nominal
        lines.append({
            "akun": item["akun"],
            "jenis": "Debit" if str(item["jenis"]).lower() != "kredit" else "Kredit",
            "nominal": safe_float(nominal, 0.0)
        })
    return lines

def voucher_type_for_account(account):
    a = str(account or "").strip()
    if a.startswith("1101"): return "CV"
    if a.startswith("1102"): return "GV"
    if a.startswith("1103"): return "BV"
    if a.startswith("1104"): return "SC"
    return "BV"

def fetch_purchase_ppn_account():
    conn = get_db_connection()
    try:
        df = pd.read_sql("""
        SELECT TRIM(k.Kode_Akun2) AS akun,
               COALESCE(n.Nama_Akun,'') AS nama,
               COUNT(*) AS cnt,
               SUM(COALESCE(k.Nominal2,0)) AS total
        FROM tb_kas k
        LEFT JOIN tb_nabb n ON n.Kode_Akun = k.Kode_Akun2
        WHERE TRIM(COALESCE(k.Kode_Akun2,'')) <> ''
          AND COALESCE(k.Nominal2,0) > 0
          AND (
              UPPER(COALESCE(k.Keterangan,'')) LIKE '%PEMBELIAN%'
              OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%HUTANG KREDIT%'
              OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%NO.FI%'
              OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%NO. FI%'
          )
        GROUP BY akun, nama
        ORDER BY cnt DESC, total DESC
        LIMIT 20
        """, conn)
        if len(df) == 0:
            df = pd.read_sql("""
            SELECT TRIM(k.Kode_Akun2) AS akun,
                   COALESCE(n.Nama_Akun,'') AS nama,
                   COUNT(*) AS cnt,
                   SUM(COALESCE(k.Nominal2,0)) AS total
            FROM tb_kas k
            LEFT JOIN tb_nabb n ON n.Kode_Akun = k.Kode_Akun2
            WHERE TRIM(COALESCE(k.Kode_Akun2,'')) <> ''
              AND COALESCE(k.Nominal2,0) > 0
            GROUP BY akun, nama
            ORDER BY cnt DESC, total DESC
            LIMIT 20
            """, conn)

        best = ""
        best_score = -1.0
        for _, row in df.iterrows():
            akun = str(row.get("akun") or "").strip()
            nama = str(row.get("nama") or "").lower()
            if not akun:
                continue
            if "ppn" not in nama:
                continue
            if "keluaran" in nama or "hutang" in nama or "persediaan" in nama:
                continue
            score = safe_float(row.get("cnt"), 0.0)
            score += 1000.0
            # PPN masukan pembelian dicatat sebagai aset/piutang, bukan hutang PPN keluaran.
            if akun.startswith("11"):
                score += 100.0
            if "hutang" in nama or akun.startswith("2"):
                score -= 100.0
            if score > best_score:
                best = akun
                best_score = score

        if best:
            return best

        fallback = pd.read_sql("""
        SELECT Kode_Akun
        FROM tb_nabb
        WHERE UPPER(COALESCE(Nama_Akun,'')) LIKE '%PPN%'
          AND UPPER(COALESCE(Nama_Akun,'')) NOT LIKE '%KELUARAN%'
          AND UPPER(COALESCE(Nama_Akun,'')) NOT LIKE '%HUTANG%'
          AND UPPER(COALESCE(Nama_Akun,'')) NOT LIKE '%PERSEDIAAN%'
          AND TRIM(COALESCE(Kode_Akun,'')) LIKE '11%'
        ORDER BY CASE
            WHEN UPPER(COALESCE(Nama_Akun,'')) LIKE '%MASUKAN%' THEN 0
            ELSE 1
        END, Kode_Akun
        LIMIT 1
        """, conn)
        if len(fallback) > 0:
            return str(fallback.iloc[0].get("Kode_Akun") or "").strip()
        return ""
    finally:
        conn.close()

def build_sales_query(req):
    return clean_text(" ".join([
        str(req.no_faktur or ""),
        str(req.customer or ""),
        str(req.ref_po or ""),
        "terima bayar faktur penjualan"
    ]))

def fetch_sales_history(customer, ref_po, limit=500):
    conn = get_db_connection()
    try:
        filters = []
        params = []
        if str(customer or "").strip():
            filters.append("LOWER(COALESCE(k.Keterangan,'')) LIKE %s")
            params.append(f"%{str(customer or '').strip().lower()}%")
        if str(ref_po or "").strip():
            filters.append("LOWER(COALESCE(k.Keterangan,'')) LIKE %s")
            params.append(f"%{str(ref_po or '').strip().lower()}%")

        where = """(
            UPPER(COALESCE(k.Keterangan,'')) LIKE '%TERIMA BAYAR%'
            OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%PENJUALAN%'
            OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%INV-%'
            OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%/INV/%'
        )"""
        if filters:
            where += " AND (" + " OR ".join(filters) + ")"

        query = f"""
        SELECT '' AS no_faktur, '' AS customer, '' AS ref_po, 0 AS total, 0 AS tax, '' AS trx_jurnal,
               k.Kode_Voucher, k.Kode_Akun, k.Keterangan,
               k.Kode_Akun1, k.Nominal1, k.Jenis_Beban1,
               k.Kode_Akun2, k.Nominal2, k.Jenis_Beban2,
               k.Kode_Akun3, k.Nominal3, k.Jenis_Beban3
        FROM tb_kas k
        WHERE {where}
        ORDER BY k.Tgl_Voucher DESC, k.Kode_Voucher DESC
        LIMIT {int(limit)}
        """
        df = pd.read_sql(query, conn, params=params)
        if len(df) < 5:
            df = pd.read_sql("""
            SELECT '' AS no_faktur, '' AS customer, '' AS ref_po, 0 AS total, 0 AS tax, '' AS trx_jurnal,
                   k.Kode_Voucher, k.Kode_Akun, k.Keterangan,
                   k.Kode_Akun1, k.Nominal1, k.Jenis_Beban1,
                   k.Kode_Akun2, k.Nominal2, k.Jenis_Beban2,
                   k.Kode_Akun3, k.Nominal3, k.Jenis_Beban3
            FROM tb_kas k
            WHERE (
                UPPER(COALESCE(k.Keterangan,'')) LIKE '%TERIMA BAYAR%'
                OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%PENJUALAN%'
                OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%INV-%'
                OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%/INV/%'
            )
            ORDER BY k.Tgl_Voucher DESC, k.Kode_Voucher DESC
            LIMIT 800
            """, conn)
        return df
    finally:
        conn.close()

def fetch_sales_ppn_account():
    conn = get_db_connection()
    try:
        df = pd.read_sql("""
        SELECT TRIM(k.Kode_Akun2) AS akun,
               COALESCE(n.Nama_Akun,'') AS nama,
               COUNT(*) AS cnt,
               SUM(COALESCE(k.Nominal2,0)) AS total
        FROM tb_kas k
        LEFT JOIN tb_nabb n ON n.Kode_Akun = k.Kode_Akun2
        WHERE TRIM(COALESCE(k.Kode_Akun2,'')) <> ''
          AND COALESCE(k.Nominal2,0) > 0
          AND (
              UPPER(COALESCE(k.Keterangan,'')) LIKE '%PENJUALAN%'
              OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%TERIMA BAYAR%'
              OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%INV-%'
              OR UPPER(COALESCE(k.Keterangan,'')) LIKE '%/INV/%'
          )
        GROUP BY akun, nama
        ORDER BY cnt DESC, total DESC
        LIMIT 20
        """, conn)

        best = ""
        best_score = -1.0
        for _, row in df.iterrows():
            akun = str(row.get("akun") or "").strip()
            nama = str(row.get("nama") or "").lower()
            if not akun:
                continue
            score = safe_float(row.get("cnt"), 0.0)
            if "ppn" in nama:
                score += 1000.0
            # PPN keluaran penjualan lazimnya hutang PPN, bukan piutang PPN.
            if akun.startswith("2") or "hutang" in nama:
                score += 100.0
            if akun.startswith("11") or "piutang" in nama:
                score -= 100.0
            if score > best_score:
                best = akun
                best_score = score

        if best:
            return best

        fallback = pd.read_sql("""
        SELECT Kode_Akun
        FROM tb_nabb
        WHERE UPPER(COALESCE(Nama_Akun,'')) LIKE '%PPN%'
          AND (TRIM(COALESCE(Kode_Akun,'')) LIKE '2%' OR UPPER(COALESCE(Nama_Akun,'')) LIKE '%HUTANG%')
        ORDER BY Kode_Akun
        LIMIT 1
        """, conn)
        if len(fallback) > 0:
            return str(fallback.iloc[0].get("Kode_Akun") or "").strip()
        return ""
    finally:
        conn.close()

def build_sales_lines(row, dpp, has_ppn):
    slots = [1, 3] if has_ppn else [1, 2, 3]
    candidates = []
    for slot in slots:
        akun = str(row.get(f"Kode_Akun{slot}") or "").strip()
        nominal = safe_float(row.get(f"Nominal{slot}"), 0.0)
        jenis = str(row.get(f"Jenis_Beban{slot}") or "Kredit").strip() or "Kredit"
        if nominal <= 0 or not is_valid_account_seed(akun):
            continue
        # For receipt of an already-journaled invoice, VB6 credits piutang usaha.
        # For cash sale history, revenue account can also appear here.
        candidates.append({"akun": akun, "jenis": jenis, "hist_nominal": nominal})

    if not candidates:
        return []

    total = sum(item["hist_nominal"] for item in candidates)
    if total <= 0:
        return []

    lines = []
    running = 0.0
    for idx, item in enumerate(candidates[:2 if has_ppn else 3]):
        nominal = max(0.0, round(dpp - running, 2)) if idx == min(len(candidates), 2 if has_ppn else 3) - 1 else round(dpp * item["hist_nominal"] / total, 2)
        running += nominal
        lines.append({
            "akun": item["akun"],
            "jenis": "Debit" if str(item["jenis"]).lower() == "debit" else "Kredit",
            "nominal": safe_float(nominal, 0.0)
        })
    return lines

def fetch_adjustment_history(limit=3000):
    conn = get_db_connection()
    try:
        df = pd.read_sql(f"""
        SELECT Kode_Jurnal, Periode, Posting_Date, Remark, Kode_Akun, Nama_Akun, Debit, Kredit
        FROM tb_jurnalpenyesuaian
        WHERE TRIM(COALESCE(Remark,'')) <> ''
          AND TRIM(COALESCE(Kode_Akun,'')) <> ''
        ORDER BY Posting_Date DESC, Kode_Jurnal DESC
        LIMIT {int(limit)}
        """, conn)
        return df
    finally:
        conn.close()

def build_adjustment_lines(group, req):
    seed_akun = str(req.seedAkun or "").strip()
    seed_jenis = str(req.seedJenis or "").strip().lower()
    seed_jenis = "Kredit" if seed_jenis == "kredit" else ("Debit" if seed_jenis == "debit" else "")
    target = safe_float(req.nominal, 0.0)

    hist_lines = []
    for _, row in group.iterrows():
        akun = str(row.get("Kode_Akun") or "").strip()
        if not is_valid_account_seed(akun):
            continue
        debit = safe_float(row.get("Debit"), 0.0)
        kredit = safe_float(row.get("Kredit"), 0.0)
        if debit <= 0 and kredit <= 0:
            continue
        hist_lines.append({
            "akun": akun,
            "jenis": "Debit" if debit > 0 else "Kredit",
            "nominal": debit if debit > 0 else kredit,
        })

    if not hist_lines:
        return []

    if seed_akun and seed_jenis and target > 0:
        opposite = "Kredit" if seed_jenis == "Debit" else "Debit"
        candidates = [l for l in hist_lines if l["akun"] != seed_akun and l["jenis"] == opposite]
        if not candidates:
            candidates = [l for l in hist_lines if l["akun"] != seed_akun]
        candidates = candidates[:3]
        total = sum(safe_float(l["nominal"], 0.0) for l in candidates)
        if total <= 0:
            return [{"akun": seed_akun, "jenis": seed_jenis, "nominal": target}]

        lines = [{"akun": seed_akun, "jenis": seed_jenis, "nominal": target}]
        running = 0.0
        for idx, item in enumerate(candidates):
            if idx == len(candidates) - 1:
                nominal = max(0.0, round(target - running, 2))
            else:
                nominal = round(target * safe_float(item["nominal"], 0.0) / total, 2)
                running += nominal
            lines.append({"akun": item["akun"], "jenis": opposite, "nominal": safe_float(nominal, 0.0)})
        return lines[:4]

    total_debit = sum(l["nominal"] for l in hist_lines if l["jenis"] == "Debit")
    scale = (target / total_debit) if target > 0 and total_debit > 0 else 1.0
    out = []
    for item in hist_lines[:4]:
        out.append({
            "akun": item["akun"],
            "jenis": item["jenis"],
            "nominal": safe_float(round(item["nominal"] * scale, 2), 0.0)
        })
    return out

def smart_local_match(query: str, choices: list):
    """
    A globally semantic local matcher that combines Word TF-IDF and Character N-Gram TF-IDF.
    It inherently understands dataset-specific term weights (e.g. rare accessories like 'cover' 
    will carry high variance penalty if missing) without needing hardcoded rules.
    """
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.pipeline import FeatureUnion
    import numpy as np

    if not choices or not query.strip():
        return [0.0] * len(choices)
        
    try:
        # 1. Word n-grams for exact matching / compounding
        word_vec = TfidfVectorizer(analyzer='word', ngram_range=(1, 2))
        # 2. Char n-grams for typo resilience and morphological variants
        char_vec = TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5))
        
        union = FeatureUnion([("word", word_vec), ("char", char_vec)])
        
        matrix = union.fit_transform(choices)
        query_vec = union.transform([query])
        
        sims = cosine_similarity(query_vec, matrix)[0]
        return sims.tolist()
    except Exception:
        # Safe fallback if TF-IDF fails (e.g. choices too small/empty)
        return [0.0] * len(choices)

def get_st_model():
    """Return (and cache) the shared Sentence Transformers model."""
    if "st_model" not in models:
        from sentence_transformers import SentenceTransformer
        models["st_model"] = SentenceTransformer(
            "paraphrase-multilingual-MiniLM-L12-v2", device="cpu"
        )
    return models["st_model"]


def st_rank_indices(query: str, corpus: list, top_k: int = 30):
    """Return (sorted indices, scores array) for corpus ranked by ST similarity."""
    try:
        from sentence_transformers import util
        st = get_st_model()
        q_emb  = st.encode(query, convert_to_tensor=True)
        c_embs = st.encode(corpus, convert_to_tensor=True, batch_size=64, show_progress_bar=False)
        scores = util.cos_sim(q_emb, c_embs)[0].cpu().numpy()
        ranked = scores.argsort()[::-1][:top_k]
        return ranked, scores
    except Exception:
        import numpy as np
        scores = np.zeros(len(corpus))
        return list(range(min(top_k, len(corpus)))), scores


def suggest_from_history(mode, cleaned_input, dpp, max_lines):
    hist = models.get(f"history_{mode}")
    if not hist or cleaned_input == "":
        return None

    try:
        df     = hist["df"]
        corpus = hist["corpus"]
        ranked, scores = st_rank_indices(cleaned_input, corpus, top_k=25)

        for idx in ranked:
            idx   = int(idx)
            score = float(scores[idx])
            if score < 0.12:
                break
            row   = df.iloc[idx]
            lines = build_history_lines(row, dpp, max_lines, mode, cleaned_input)
            if not lines:
                continue
            return {
                "lines": lines,
                "score": score,
                "evidence": {
                    "Kode_Voucher": str(row.get("Kode_Voucher") or ""),
                    "Tgl_Voucher":  str(row.get("Tgl_Voucher")  or ""),
                    "Keterangan":   str(row.get("Keterangan")   or ""),
                    "score": round(score, 4)
                }
            }
        return None
    except Exception:
        return None

def train_models():
    try:
        conn_names = get_db_connection()
        names = pd.read_sql("SELECT Kode_Akun, Nama_Akun FROM tb_nabb", conn_names)
        conn_names.close()
        models["account_names"] = {
            str(r["Kode_Akun"]).strip(): str(r["Nama_Akun"] or "").strip()
            for _, r in names.iterrows()
            if str(r["Kode_Akun"] or "").strip()
        }
    except Exception:
        models["account_names"] = {}

    for mode in ["out", "in"]:
        conn = get_db_connection()
        op = ">" if mode == "in" else "<"
        query = f"""
        SELECT Kode_Voucher, Tgl_Voucher, Keterangan, Kode_Akun,
               Kode_Akun1, Nominal1, Kode_Akun3, Nominal3, Mutasi_Kas
        FROM tb_kas 
        WHERE Keterangan IS NOT NULL AND Kode_Akun IS NOT NULL AND Kode_Akun != ''
        AND Mutasi_Kas {op} 0
        ORDER BY Tgl_Voucher DESC LIMIT 20000
        """
        df = pd.read_sql(query, conn)
        conn.close()
        
        if len(df) < 10:
            continue
            
        df['X'] = df['Keterangan'].apply(clean_text)
        df = df[df['X'].str.len() > 0].copy()
        if len(df) < 10:
            continue

        models[f"history_{mode}"] = {
            "corpus": df['X'].tolist(),
            "df": df.reset_index(drop=True)
        }
        
        df_cash = df[df['Kode_Akun'].str.strip() != '']
        if len(df_cash) > 5:
            pipe_cash = make_pipeline(TfidfVectorizer(ngram_range=(1,2), max_features=5000), SGDClassifier(loss='log_loss', class_weight='balanced'))
            pipe_cash.fit(df_cash['X'], df_cash['Kode_Akun'])
            models[f"cash_{mode}"] = pipe_cash
            
        lawan_data = []
        for _, row in df.iterrows():
            ket = row['X']
            a1 = str(row['Kode_Akun1']).strip() if pd.notna(row['Kode_Akun1']) else ""
            a3 = str(row['Kode_Akun3']).strip() if pd.notna(row['Kode_Akun3']) else ""
            
            for a in [a1, a3]:
                if account_allowed_for_text(a, ket):
                    lawan_data.append({'X': ket, 'y': a})
                    
        if len(lawan_data) > 5:
            df_lawan = pd.DataFrame(lawan_data)
            pipe_lawan = make_pipeline(TfidfVectorizer(ngram_range=(1,2), max_features=5000), SGDClassifier(loss='log_loss', class_weight='balanced'))
            pipe_lawan.fit(df_lawan['X'], df_lawan['y'])
            models[f"lawan_{mode}"] = pipe_lawan

@app.on_event("startup")
def startup_event():
    try:
        print("Training ML Models from tb_kas...")
        train_models()
        print("Training complete.")
    except Exception as e:
        print("Initial training failed:", e)

@app.post("/predict")
def predict(req: SuggestRequest):
    req_nominal = safe_float(req.nominal, 0.0)
    req_ppn_nominal = safe_float(req.ppnNominal, 0.0)
    resp = {
        "kode_akun": "",
        "voucher_type": "BV",
        "ppn_akun": "",
        "ppn_jenis": "Debit" if req.mode == "out" else "Kredit",
        "keterangan": req.keterangan if req.keterangan else ("Mutasi Kas Masuk" if req.mode=="in" else "Mutasi Kas Keluar"),
        "lines": [],
        "confidence": {"overall": 0.0, "cash": 0.0, "lawan": 0.0, "ppn": 0.0},
        "evidence": []
    }
    
    mode = req.mode if req.mode in ["in", "out"] else "out"
    cleaned_input = clean_text(req.keterangan)
    
    # Predict Cash
    model_cash = models.get(f"cash_{mode}")
    if model_cash:
        try:
            probs = model_cash.predict_proba([cleaned_input])[0]
            classes = model_cash.classes_
            top_c = probs.argsort()[-1]
            resp["kode_akun"] = str(classes[top_c])
            resp["confidence"]["cash"] = float(probs[top_c])
        except:
            pass
        
    # Predict Lawan
    model_lawan = models.get(f"lawan_{mode}")
    best_lawan = []
    if model_lawan:
        try:
            probs = model_lawan.predict_proba([cleaned_input])[0]
            classes = model_lawan.classes_
            top_indices = probs.argsort()[-3:][::-1]
            best_lawan = [(classes[i], probs[i]) for i in top_indices]
            if best_lawan:
                resp["confidence"]["lawan"] = float(best_lawan[0][1])
        except:
            pass
            
    max_lines = 2 if (req.hasPpn and req.ppnNominal > 0) else 3
    lines = []
    
    if is_valid_account_seed(req.seedAkun):
        lines.append({"akun": req.seedAkun, "jenis": "Debit" if req.mode == "out" else "Kredit", "nominal": 0.0})
        
    for a, p in best_lawan:
        if len(lines) >= max_lines: break
        if a not in [l['akun'] for l in lines] and account_allowed_for_text(a, cleaned_input, allow_liability=is_valid_account_seed(req.seedAkun)):
            lines.append({"akun": a, "jenis": "Debit" if req.mode == "out" else "Kredit", "nominal": 0.0})
            
    if not lines and best_lawan:
        for a, p in best_lawan:
            if account_allowed_for_text(a, cleaned_input, allow_liability=is_valid_account_seed(req.seedAkun)):
                lines.append({"akun": a, "jenis": "Debit" if req.mode == "out" else "Kredit", "nominal": 0.0})
                break
            
    dpp = req_nominal - (req_ppn_nominal if req.hasPpn else 0.0)
    dpp = max(0.0, dpp)

    history_suggest = suggest_from_history(mode, cleaned_input, dpp, max_lines)
    if history_suggest:
        resp["lines"] = history_suggest["lines"]
        resp["confidence"]["lawan"] = max(
            float(resp["confidence"]["lawan"]),
            float(history_suggest["score"])
        )
        resp["confidence"]["overall"] = (
            float(resp["confidence"]["cash"]) + float(resp["confidence"]["lawan"])
        ) / 2.0
        resp["evidence"] = [history_suggest["evidence"]]

        ka = resp["kode_akun"]
        if ka.startswith("1101"): resp["voucher_type"] = "CV"
        elif ka.startswith("1102"): resp["voucher_type"] = "GV"
        elif ka.startswith("1103"): resp["voucher_type"] = "BV"
        elif ka.startswith("1104"): resp["voucher_type"] = "SC"

        return resp

    preferred_lines = build_preferred_lines(cleaned_input, dpp, max_lines, mode)
    if preferred_lines:
        resp["lines"] = preferred_lines
        resp["confidence"]["lawan"] = max(float(resp["confidence"]["lawan"]), 0.65)
        resp["confidence"]["overall"] = (
            float(resp["confidence"]["cash"]) + float(resp["confidence"]["lawan"])
        ) / 2.0
        resp["evidence"] = [{
            "source": "rule",
            "Keterangan": "keyword guard",
            "score": 0.65
        }]
        return resp
    
    if len(lines) > 0:
        # Give all nominal to the first matched line for simplicity, just like KasDss often does
        lines[0]['nominal'] = dpp
        for i in range(1, len(lines)):
            lines[i]['nominal'] = 0.0
            
    resp["lines"] = lines
    resp["confidence"]["overall"] = (resp["confidence"]["cash"] + resp["confidence"]["lawan"]) / 2.0
    
    ka = resp["kode_akun"]
    if ka.startswith("1101"): resp["voucher_type"] = "CV"
    elif ka.startswith("1102"): resp["voucher_type"] = "GV"
    elif ka.startswith("1103"): resp["voucher_type"] = "BV"
    elif ka.startswith("1104"): resp["voucher_type"] = "SC"

    return resp

@app.post("/predict-input-pembelian")
def predict_input_pembelian(req: PurchaseSuggestRequest):
    dpp = safe_float(req.dppTarget, 0.0)
    tax = max(0.0, safe_float(req.tax, 0.0))
    has_ppn = bool(req.hasPpn and tax > 0)
    if dpp <= 0:
        total = safe_float(req.total, 0.0)
        dpp = max(0.0, total - tax)

    resp = {
        "kode_akun": "",
        "voucher_type": "",
        "ppn_akun": "",
        "beban_lines": [],
        "confidence": {"overall": 0.0, "purchase": 0.0},
        "evidence": []
    }

    df = fetch_purchase_history(req.vendor, req.ref_po)
    if len(df) == 0:
        return resp

    query = build_purchase_query(req)
    df = df.copy()
    df["X"] = (
        df["no_doc"].fillna("").astype(str) + " " +
        df["nm_vdr"].fillna("").astype(str) + " " +
        df["ref_po"].fillna("").astype(str) + " " +
        df["Keterangan"].fillna("").astype(str)
    ).apply(clean_text)
    df = df[df["X"].str.len() > 0].reset_index(drop=True)
    if len(df) == 0:
        return resp

    corpus = df["X"].tolist()
    ranked, scores = st_rank_indices(query, corpus, top_k=30)

    best = None
    for idx in ranked:
        idx = int(idx)
        score = float(scores[idx])
        row = df.iloc[idx]
        lines = build_purchase_lines(row, dpp, has_ppn)
        if not lines:
            continue
        best = (row, lines, score)
        break

    if not best:
        for idx, row in df.head(200).iterrows():
            lines = build_purchase_lines(row, dpp, has_ppn)
            if not lines:
                continue
            score = float(scores[int(idx)]) if int(idx) < len(scores) else 0.0
            best = (row, lines, max(score, 0.01))
            break

    if not best:
        return resp

    row, lines, score = best
    cash_account = str(row.get("Kode_Akun") or "").strip()
    ppn_akun = ""
    if has_ppn and safe_float(row.get("Nominal2"), 0.0) > 0:
        ppn_akun = str(row.get("Kode_Akun2") or "").strip()
    if has_ppn and not ppn_akun:
        ppn_akun = fetch_purchase_ppn_account()

    resp["kode_akun"] = cash_account
    resp["voucher_type"] = voucher_type_for_account(cash_account)
    resp["ppn_akun"] = ppn_akun
    resp["beban_lines"] = lines
    resp["confidence"] = {"overall": score, "purchase": score}
    resp["evidence"] = [{
        "source": "purchase_history",
        "no_doc": str(row.get("no_doc") or ""),
        "Kode_Voucher": str(row.get("Kode_Voucher") or ""),
        "Keterangan": str(row.get("Keterangan") or ""),
        "score": round(score, 4)
    }]
    return resp

@app.post("/predict-input-penjualan")
def predict_input_penjualan(req: SalesSuggestRequest):
    tax = max(0.0, safe_float(req.tax, 0.0))
    total_bayaran = max(0.0, safe_float(req.total_bayaran, 0.0))
    already_journaled = bool(str(req.trx_jurnal or "").strip()) and total_bayaran > 0
    has_ppn = bool(req.hasPpn and tax > 0 and not already_journaled)
    dpp = safe_float(req.dppTarget, 0.0)
    if already_journaled:
        dpp = safe_float(req.cashNominal, 0.0)
    if dpp <= 0:
        total = safe_float(req.total, 0.0)
        dpp = max(0.0, total - tax)

    resp = {
        "kode_akun": "",
        "voucher_type": "",
        "ppn_akun": "",
        "beban_lines": [],
        "keterangan": "",
        "confidence": {"overall": 0.0, "sales": 0.0},
        "evidence": []
    }

    def sales_default_response(score=0.35):
        ppn_akun = ""
        if has_ppn:
            ppn_akun = fetch_sales_ppn_account() or "2107AK"

        ket = "TERIMA BAYAR FAKTUR No. " + str(req.no_faktur or "").strip() if already_journaled else "PENJUALAN TUNAI No. " + str(req.no_faktur or "").strip()
        if str(req.customer or "").strip():
            ket += " - " + str(req.customer or "").strip()
        if str(req.ref_po or "").strip():
            ket += (" - Ref. PO " if already_journaled else " - Ref PO. ") + str(req.ref_po or "").strip()

        return {
            "kode_akun": "",
            "voucher_type": "",
            "ppn_akun": "" if already_journaled else ppn_akun,
            "beban_lines": (
                [{"akun": "1109AD", "jenis": "Kredit", "nominal": safe_float(req.cashNominal, dpp)}]
                if already_journaled
                else [{"akun": "4101AK", "jenis": "Kredit", "nominal": dpp}]
            ),
            "keterangan": ket,
            "confidence": {"overall": score, "sales": score},
            "evidence": [{"source": "sales_default", "score": score}]
        }

    df = fetch_sales_history(req.customer, req.ref_po)
    if len(df) == 0:
        return sales_default_response(0.25)

    query = build_sales_query(req)
    df = df.copy()
    df["X"] = (
        df["no_faktur"].fillna("").astype(str) + " " +
        df["customer"].fillna("").astype(str) + " " +
        df["ref_po"].fillna("").astype(str) + " " +
        df["Keterangan"].fillna("").astype(str)
    ).apply(clean_text)
    df = df[df["X"].str.len() > 0].reset_index(drop=True)
    if len(df) == 0:
        return sales_default_response(0.25)

    corpus = df["X"].tolist()
    ranked, scores = st_rank_indices(query, corpus, top_k=30)

    best = None
    for idx in ranked:
        idx = int(idx)
        row = df.iloc[idx]
        lines = build_sales_lines(row, dpp, has_ppn)
        if not lines:
            continue
        best = (row, lines, float(scores[idx]))
        break

    if not best:
        for idx, row in df.head(200).iterrows():
            lines = build_sales_lines(row, dpp, has_ppn)
            if not lines:
                continue
            score = float(scores[int(idx)]) if int(idx) < len(scores) else 0.0
            best = (row, lines, max(score, 0.01))
            break

    if not best:
        return sales_default_response(0.25)

    row, lines, score = best
    cash_account = str(row.get("Kode_Akun") or "").strip()
    ppn_akun = ""
    if has_ppn and safe_float(row.get("Nominal2"), 0.0) > 0:
        ppn_akun = str(row.get("Kode_Akun2") or "").strip()
    if has_ppn and not ppn_akun:
        ppn_akun = fetch_sales_ppn_account()

    if already_journaled:
        lines = [{"akun": "1109AD", "jenis": "Kredit", "nominal": safe_float(req.cashNominal, dpp)}]
        ppn_akun = ""
    else:
        lines = [{"akun": "4101AK", "jenis": "Kredit", "nominal": dpp}]
        if has_ppn and not ppn_akun:
            ppn_akun = "2107AK"

    ket = str(row.get("Keterangan") or "").strip()
    if already_journaled:
        ket = "TERIMA BAYAR FAKTUR No. " + str(req.no_faktur or "").strip()
        if str(req.customer or "").strip():
            ket += " - " + str(req.customer or "").strip()
        if str(req.ref_po or "").strip():
            ket += " - Ref. PO " + str(req.ref_po or "").strip()
    elif not ket or "koreksi" in ket.lower():
        ket = "PENJUALAN TUNAI No. " + str(req.no_faktur or "").strip()
        if str(req.customer or "").strip():
            ket += " - " + str(req.customer or "").strip()
        if str(req.ref_po or "").strip():
            ket += " - Ref PO. " + str(req.ref_po or "").strip()
    if not ket:
        ket = "TERIMA BAYAR FAKTUR No. " + str(req.no_faktur or "").strip()
        if str(req.customer or "").strip():
            ket += " - " + str(req.customer or "").strip()
        if str(req.ref_po or "").strip():
            ket += " - Ref. PO " + str(req.ref_po or "").strip()

    resp["kode_akun"] = cash_account
    resp["voucher_type"] = voucher_type_for_account(cash_account)
    resp["ppn_akun"] = ppn_akun
    resp["beban_lines"] = lines
    resp["keterangan"] = ket
    resp["confidence"] = {"overall": score, "sales": score}
    resp["evidence"] = [{
        "source": "sales_history",
        "Kode_Voucher": str(row.get("Kode_Voucher") or ""),
        "Keterangan": ket,
        "score": round(score, 4)
    }]
    return resp

@app.post("/predict-jurnal-penyesuaian")
def predict_jurnal_penyesuaian(req: AdjustmentSuggestRequest):
    resp = {
        "lines": [],
        "remark_suggest": "",
        "confidence": {"overall": 0.0, "adjustment": 0.0},
        "evidence": []
    }

    remark = str(req.remark or "").strip()
    if not remark:
        return resp

    df = fetch_adjustment_history()
    if len(df) == 0:
        return resp

    grouped = []
    for kode, group in df.groupby("Kode_Jurnal", sort=False):
        first = group.iloc[0]
        text = clean_text(str(first.get("Remark") or ""))
        if not text:
            continue
        grouped.append({
            "kode": str(kode or ""),
            "remark": str(first.get("Remark") or ""),
            "periode": str(first.get("Periode") or ""),
            "posting_date": str(first.get("Posting_Date") or ""),
            "text": text,
            "group": group,
        })

    if not grouped:
        return resp

    corpus  = [g["text"] for g in grouped]
    ranked, scores = st_rank_indices(clean_text(remark), corpus, top_k=30)

    best = None
    for idx in ranked:
        idx  = int(idx)
        lines = build_adjustment_lines(grouped[idx]["group"], req)
        if not lines:
            continue
        best = (grouped[idx], lines, float(scores[idx]))
        break

    if not best:
        return resp

    hit, lines, score = best
    resp["lines"] = lines
    resp["remark_suggest"] = remark
    resp["confidence"] = {"overall": score, "adjustment": score}
    resp["evidence"] = [{
        "source": "jurnal_penyesuaian_history",
        "Kode_Jurnal": hit["kode"],
        "Remark": hit["remark"],
        "Posting_Date": hit["posting_date"],
        "score": round(score, 4)
    }]
    return resp


def fuzzy_match_items(texts, conn, table, col_kode, col_nama, threshold=0.1):
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(f"SELECT {col_kode}, {col_nama} FROM {table}")
        db_items = cursor.fetchall()
    except Exception as e:
        print(e)
        return [None]*len(texts)
    finally:
        cursor.close()
        
    db_names = [str(item[col_nama]).lower() for item in db_items]
    
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np

    # Use a token pattern that includes digits and single characters
    vectorizer = TfidfVectorizer(ngram_range=(1, 3), token_pattern=r'(?u)\b\w+\b')
    try:
        tfidf_db = vectorizer.fit_transform(db_names)
    except:
        return [None]*len(texts)

    results = []
    for txt in texts:
        txt_clean = re.sub(r'[^a-zA-Z0-9\s.,/-]', ' ', str(txt)).lower()
        try:
            tfidf_q = vectorizer.transform([txt_clean])
            sim = cosine_similarity(tfidf_q, tfidf_db).flatten()
            best_idx = np.argmax(sim)
            best_score = sim[best_idx]
            if best_score >= threshold:
                results.append((str(db_items[best_idx][col_kode]), str(db_items[best_idx][col_nama])))
            else:
                results.append(None)
        except Exception as e:
            print("fuzzy tfidf err:", e)
            results.append(None)
            
    return results


def ollama_deep_match(raw_text: str, top_candidates: list, match_type: str = "customer"):
    """
    Asks the local Ollama Qwen model to pick the correct Database ID from the TF-IDF candidates.
    Returns the exact ID string or None.
    """
    import urllib.request
    import json
    import os

    if not raw_text or not top_candidates: return None

    # Construct options string
    opts_str = "\n".join([f"ID: {str(c['id'])}, NAMA: {str(c['name'])}" for c in top_candidates])

    if match_type == "customer":
        prompt = f"""Tugas Anda adalah data-matching. Anda harus mencari nama perusahaan mana dalam DATABASE yang SAMA PERSIS dengan teks MENTAH pelanggan.
TEKS MENTAH DARI DOKUMEN: "{raw_text}"

KANDIDAT DATABASE:
{opts_str}

ATURAN:
1. Jika tidak ada yang cocok sama sekali secara logika/makna, jawab dengan kata: "NONE"
2. Jika ada yang cocok, balas HANYA dengan ID-nya, tanpa penjelasan apapun, tanpa tanda kutip. Contoh balasan murni: CST00045"""
    else:
        prompt = f"""Tugas Anda adalah data-matching nama barang.
TEKS BARANG DARI PO: "{raw_text}"

KANDIDAT BARANG DI DATABASE:
{opts_str}

ATURAN:
1. Pilih satu barang dari database yang secara wujud fisik, merk, atau fungsi paling identik.
2. Jika tidak ada yang cocok/meragukan, balas dengan kata: "NONE".
3. Jika yakin cocok, balas HANYA dengan ID-nya secara murni. Contoh balasan murni: M02-005"""

    data = {
        "model": "qwen2.5:3b",
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.0
        }
    }

    try:
        req = urllib.request.Request("http://127.0.0.1:11434/api/generate", data=json.dumps(data).encode('utf-8'))
        req.add_header('Content-Type', 'application/json')
        with urllib.request.urlopen(req, timeout=10) as response:
            res = json.loads(response.read().decode('utf-8'))
            ans = res.get('response', '').strip()
            # Clean possible markdown or weird chat
            ans = ans.replace('"', '').replace("'", "").strip()
            # If Qwen decides to yap, try to find the ID keyword
            for c in top_candidates:
                if str(c['id']).strip() in ans:
                    return str(c['id'])
            if "NONE" in ans.upper():
                return None
            return ans
    except Exception as e:
        print(f"Ollama Error: {e}")
        return None

@app.post("/ocr-po")

async def ocr_po(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename)[1].lower() if file.filename else ".pdf"
    temp_path = f"/tmp/ocr_upload{suffix}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())
        
    from fastapi import HTTPException
    conn = get_db_connection()
    try:
        from google import genai
        from google.genai import types
        import json
        
        # --- Pre-fetch DB Catalog for AI Semantic Matching ---
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT kd_material, material FROM tb_barang")
        all_materials = cursor.fetchall()
        
        cursor.execute("SELECT kd_cs, nm_cs FROM tb_cs")
        all_customers = cursor.fetchall()
        cursor.close()
        
        # We sample up to 1500 items max to avoid huge payload, but usually it's small enough.
        mat_str = ", ".join([f"'{m['kd_material']}': '{m['material'].strip()}'" for m in all_materials[:1500]])
        cs_str = ", ".join([f"'{c['kd_cs']}': '{c['nm_cs'].strip()}'" for c in all_customers[:500]])
        
        mat_by_code = {str(r['kd_material']).strip(): r for r in all_materials}
        cs_by_code = {str(r['kd_cs']).strip(): r for r in all_customers}

        extracted_text = ""
        import fitz
        if temp_path.endswith(".pdf"):
            doc = fitz.open(temp_path)
            for page in doc:
                extracted_text += page.get_text() + "\n"
        else:
            try:
                import pytesseract
                from PIL import Image
                img = Image.open(temp_path)
                extracted_text = pytesseract.image_to_string(img)
            except:
                pass
            
        prompt = f"""Anda adalah ahli akuntansi dan OCR tingkat dewa.
Ekstrak secara presisi data berikut dari lampiran Dokumen Purchase Order, dan format sebagai murni JSON:
{{
  "ref_poin": "Nomor surat pesanan/PO murni dari customer (string). ATURAN MUTLAK: HARUS dicari dari blok identitas dokumen (Kop/Header/Informasi Utama) dengan keyword 'PO No', 'PO Number', 'No. PO', 'Order No'. BUKAN No PR, BUKAN Supplier Qtn No, dan SANGAT DILARANG menggunakan teks dari deskripsi barang (jangan gunakan kode seperti BTL dsb). Ambil angkanya saja jika bentuknya 'PO No. : XXXXX'.",
  "tgl": "Tanggal terbit PO (yyyy-mm-dd). Cari di Kop surat dekat nama kota (contoh: Samarinda, 17 July 2026) atau label 'PO Date'. PENTING: JANGAN mengambil tanggal Quotation (Qtn Date) atau tanggal Purchase Request (PR Date).",
  "delivery_date": "Tanggal pengiriman barang (yyyy-mm-dd). WAJIB dari label pengiriman seperti 'Delivery Date', 'Delivery Due', 'Req. Date'. DILARANG KERAS menggunakan tanggal dari 'Supplier Qtn Date' atau 'PR Date'.",
  "payment": "Syarat Pembayaran. ATURAN: (1) Jika berupa kata umum seperti Cash/Tunai, ambil kata tersebut SAJA tanpa persen atau keterangan tambahan (misal: Cash 100% → tulis Cash, Tunai 50% → tulis Tunai). (2) Jika berupa jumlah hari seperti '30 days', '45 hari', 'NET 30' → tulis angka + Hari saja (misal: 30 Hari, 45 Hari). (3) Jika berupa tanggal jatuh tempo (contoh: 31 August 2026), tulis tanggal tersebut dalam format yyyy-mm-dd.",
  "franco": "Lokasi franco loco atau area pengiriman. Abaikan jika detail kepanjangan, ambil lokasi intinya saja.",
  "ppn_pct": "Pajak Pertambahan Nilai atau PPN (Angka int, misal 11 jika 11%, atau 0 jika tidak ada)",
  "kd_customer": "SANGAT PENTING: Dokumen PO ini selalu dikirimkan KEPADA CV. SEMESTA JAYA ABADI. Jadi CV. SEMESTA JAYA ABADI / PT. SEMESTA JAYA ABADI ADALAH KAMI/PENJUAL BUKAN CUSTOMER/PEMBELI! Haram hukumnya menjadikan SEMESTA JAYA ABADI sebagai customer. Kamu WAJIB mencari nama perusahaan PEMBELI / BUYER yang letaknya PALING ATAS (kiri, tengah, kanan halam) yang mencantumkan logo/tulisan PT, CV, atau nama perusahaannya. JANGAN ambil teks dari blok 'Kepada/To/Vendor/Deliver to'. Setelah dapat nama perusahaan kop surat, temukan di katalog ini: [{cs_str}]. Isi kode jika ada.",
  "nm_customer": "Nama lengkap perusahaan PEMBELI (Nama yang ada di Kop/Header paling atas). MUTLAK: JANGAN PERNAH mengisi ini dengan 'SEMESTA JAYA ABADI'. Tulis nama perusahaannya dari teks jika kode tidak ada di katalog.",
  "catatan": "Catatan / Remarks / Spesifikasi barang, HANYA teks murni. DILARANG memasukkan tulisan metadata seperti nama pembuat, contact, no telp, email, dll.",
  "items": [
      {{
          "kode": "KODE BARANG DALAM KATALOG INI: [{mat_str}]. ATURAN PENCOCOKAN: 1. Cari barang di katalog yang persis sama maknanya secara wujud fisik. DILARANG memilih Buku Panduan / Jasa! 2. CONTOH KASUS KHUSUS DARI INGGRIS: 'Oil Palm Sickle / Sickle' = 'Egrek Hitam'. 'Axe for Harvesting' = 'Kapak Buah + Gagang'. 3. Jika ketemu di katalog, isi kodenya. Jika tidak ada yang sama secara fisik, kosongkan.",
          "desc": "JIKA KODE KOSONG: Tuliskan NAMA PRODUK FISIK + SPESIFIKASI PENTING (Contoh: 'Bola Lampu Tornado 24 Watt', 'Egrek Hitam'). JANGAN masukkan kalimat keterangan seperti 'untuk panen' atau 'digunakan untuk', buang kata kerja! Pertahankan nama merk/spek teknis agar sistem pencari kata bisa bekerja (Contoh: Philips Tornado 24 Watt -> Lampu Tornado 24 Watt). JANGAN masukkan qty.",
          "qty": "Jumlah barang pesanan (angka murni). WAJIB mengambil angka eksak dari bawah kolom 'Quantity' atau 'Qty'. SANGAT DILARANG melakukan perhitungan/pembagian matematis! SANGAT DILARANG mengambil angka dari dalam ukuran/satuan (misal: 5 dari 500ML adalah SALAH, 10 dari 10 GRAM adalah SALAH). Ambil HANYA angka quantity murni (contoh jika '10 BTL', isikan 10).",
          "price": "Harga satuan (angka murni tanpa titik separator). WAJIB mengambil angka eksak dari bawah kolom 'Unit Price' atau 'Price'. SANGAT DILARANG mengambil dari kolom 'Total Price'! SANGAT DILARANG melakukan pembagian sendiri! Salin angka Unit Price apa adanya, misal tertulis 59.000 maka isikan 59000.0.",
          "remark": "Salin SELURUH teks spesifikasi tambahan/baris kedua yang tertulis persis di bawah nama barang utama pada dokumen. WAJIB disalin secara UTUH, dan JANGAN diringkas! Contoh: Jika di bawah nama barang tertulis '*REXCO 18 SPECIALIST CONTACT CLEANER 500 ML', salin seluruh tulisan tersebut ke field ini."
      }}
  ]
}}
DILARANG MENGEMBALIKAN TEKS SELAIN JSON DI ATAS. PASTIKAN JSON VALID.

Isi Dokumen PO:
{extracted_text[:6000]}
"""
        import requests
        gemini_api_key = os.getenv("GEMINI_API_KEY")

        if not gemini_api_key:
            raise HTTPException(status_code=500, detail="Gemini API Key belum disetting (GEMINI_API_KEY)")

        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "systemInstruction": {
                "parts": [
                    {"text": "You are a helpful assistant that strictly outputs JSON."}
                ]
            },
            "generationConfig": {
                "response_mime_type": "application/json",
            }
        }
        headers = {
            "Content-Type": "application/json"
        }
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={gemini_api_key}"
        response = requests.post(url, headers=headers, json=payload, timeout=300)
        
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Gagal menghubungi Gemini API: {response.text}")
            
        res_json = response.json()
        try:
            raw_response = res_json['candidates'][0]['content']['parts'][0]['text']
        except (KeyError, IndexError):
            raise HTTPException(status_code=500, detail=f"Format response Gemini API tidak terduga: {response.text}")
            
        # Clean markdown if present
        import re
        json_match = re.search(r'\{.*\}', raw_response, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(0))
            except json.JSONDecodeError:
                data = {}
        else:
            try:
                data = json.loads(raw_response)
            except json.JSONDecodeError:
                data = {}
        
        print("====== GEMINI OCR OUTPUT ======")
        print(raw_response)
        print("=============================")
        
        # Prepare for fuzzy match
        item_texts = []
        item_codes = []
        raw_qty = []
        raw_price = []
        item_remarks = []
        
        for item in data.get('items', []):
            item_texts.append(item.get('desc', ''))
            item_codes.append(item.get('kode', ''))
            q = item.get('qty', 1)
            raw_qty.append(float(q) if q else 1.0)
            p = item.get('price', 0)
            raw_price.append(float(p) if p else 0.0)
            item_remarks.append("")

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    # --- Step 1 & 2: Process items sequentially to maintain original document order ---
    resolved_items = []
    
    # Pre-fetch database names for fast inline TF-IDF if needed
    db_names = [str(r['material']).strip() for r in all_materials] if all_materials else []

    for i, item in enumerate(data.get('items', [])):
        txt   = item.get('desc', '')
        code  = str(item.get('kode', '')).strip()
        q     = item.get('qty', 1)
        p     = item.get('price', 0)
        qty   = float(q) if q else 1.0
        price = float(p) if p else 0.0
        r_txt = str(item.get('remark', '')).strip()

        # Exact Code Match from Gemini Context
        if code and code in mat_by_code:
            row = mat_by_code[code]
            resolved_items.append({
                "kd_brg": row['kd_material'],
                "nm_brg": row['material'],
                "nm_brg_ocr": txt or code,
                "qty": qty,
                "price": price,
                "remark": r_txt
            })
            continue

        # Fallback to Smart Local Match if no exact code
        matched = False
        if txt and all_materials:
            try:
                # 1. RAG Filter
                db_names = [str(r['material']).strip() for r in all_materials]
                scores = smart_local_match(txt, db_names)
                if scores:
                    import numpy as np
                    top_indices = np.argsort(scores)[-30:][::-1]
                    candidates = []
                    for idx in top_indices:
                        if float(scores[idx]) > 0.01:
                            candidates.append({"id": all_materials[idx]['kd_material'], "name": all_materials[idx]['material']})
                    
                    if candidates:
                        # 2. Ollama precise selection
                        chosen_id = ollama_deep_match(txt, candidates, match_type="item")
                        if chosen_id and str(chosen_id).strip() != "NONE":
                            for c in candidates:
                                if str(c['id']) == str(chosen_id).strip():
                                    resolved_items.append({
                                        "kd_brg": c['id'],
                                        "nm_brg": c['name'],
                                        "nm_brg_ocr": txt,
                                        "qty": qty,
                                        "price": price,
                                        "remark": r_txt
                                    })
                                    matched = True
                                    break
                                    
                if not matched and scores:
                    best_idx = int(np.argmax(scores))
                    if float(scores[best_idx]) > 0.35:
                        resolved_items.append({
                            "kd_brg": str(all_materials[best_idx]['kd_material']),
                            "nm_brg": str(all_materials[best_idx]['material']),
                            "nm_brg_ocr": txt,
                            "qty": qty,
                            "price": price,
                            "remark": r_txt
                        })
                        matched = True
                        
            except Exception as st_err:
                import traceback; traceback.print_exc()

        # If completely unresolvable, push empty/raw row inline to preserve order
        if not matched:
            resolved_items.append({
                "kd_brg": "",
                "nm_brg": "",
                "nm_brg_ocr": txt,
                "qty": qty,
                "price": price,
                "remark": r_txt
            })

    items = resolved_items

    # --- Customer matching with Smart Local Match (TF-IDF Composite) ---
    kd_cs = data.get('kd_customer') or ""
    nm_cs = data.get('nm_customer', '')
    try:
        # If Gemini already found the exact code from injection, use it directly!
        if kd_cs and str(kd_cs) in cs_by_code:
            pass # Already populated by data.get further up implicitly handled by caller mapping... wait, let's map it:
            nm_cs = cs_by_code[str(kd_cs)]['nm_cs']
        elif all_customers and nm_cs:
            # 1. RAG Filter: TF-IDF for fastest Top 30 extraction
            cs_names = [str(r['nm_cs']).strip() for r in all_customers]
            scores = smart_local_match(nm_cs, cs_names)
            if scores:
                import numpy as np
                top_indices = np.argsort(scores)[-30:][::-1]
                candidates = []
                for idx in top_indices:
                    if float(scores[idx]) > 0.01:
                        candidates.append({"id": all_customers[idx]['kd_cs'], "name": all_customers[idx]['nm_cs']})
                
                if candidates:
                    # 2. Ollama evaluates the small short list (100% precision context)
                    chosen_id = ollama_deep_match(nm_cs, candidates, match_type="customer")
                    if chosen_id and str(chosen_id).strip() != "NONE":
                        for c in candidates:
                            if str(c['id']) == str(chosen_id).strip():
                                kd_cs = c['id']
                                nm_cs = c['name']
                                break
                    else:
                        # Auto fallback if very confident
                        best_idx = int(np.argmax(scores))
                        if float(scores[best_idx]) > 0.35:
                            kd_cs = str(all_customers[best_idx]['kd_cs'])
                            nm_cs = str(all_customers[best_idx]['nm_cs'])
    except Exception:
        import traceback; traceback.print_exc()

    conn.close()

    # --- Normalize payment term ---
    def normalize_payment(raw_payment, po_date_str):
        import re
        from datetime import datetime, date

        p = str(raw_payment or "").strip()
        if not p:
            return p

        # Case 1: pure days pattern e.g. "30 days", "45 hari", "net 30", "net30"
        m = re.search(r"(\d+)\s*(days?|hari)", p, re.IGNORECASE)
        if m:
            return f"{m.group(1)} Hari"
        m_net = re.match(r"net\s*(\d+)", p, re.IGNORECASE)
        if m_net:
            return f"{m_net.group(1)} Hari"

        # Case 2: starts with Cash/Tunai/etc (strip extra)
        m_cash = re.match(r"^(cash|tunai|tempo|cod|transfer|kredit|credit)", p, re.IGNORECASE)
        if m_cash:
            return m_cash.group(1).capitalize()

        # Case 3: looks like a date → calculate days from PO date
        date_patterns = [
            r"(\d{4}-\d{2}-\d{2})",
            r"(\d{1,2}[\s\-/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-/]\d{4})",
            r"(\d{1,2}[\s\-/]\d{1,2}[\s\-/]\d{4})",
        ]
        for pat in date_patterns:
            dm = re.search(pat, p, re.IGNORECASE)
            if dm:
                try:
                    from dateutil import parser as dparser
                    due_date = dparser.parse(dm.group(1), dayfirst=True).date()
                    if po_date_str:
                        po_date = dparser.parse(po_date_str).date()
                        diff = (due_date - po_date).days
                        if diff > 0:
                            return f"{diff} Hari"
                    return p  # fallback: return as-is if can't compute
                except Exception:
                    pass

        return p  # return as-is if no pattern matches

    payment_raw = data.get('payment', '')
    payment_normalized = normalize_payment(payment_raw, data.get('tgl', ''))

    return {
        "text_raw": "",
        "ref_poin": data.get('ref_poin', ''),
        "tgl": data.get('tgl', ''),
        "delivery_date": data.get('delivery_date', ''),
        "payment": payment_normalized,
        "franco": data.get('franco', ''),
        "ppn_pct": data.get('ppn_pct', 0),
        "catatan": data.get('catatan', ''),
        "kd_customer": kd_cs,
        "nm_customer": nm_cs,
        "items": items
    }

@app.post("/scan-po")
async def scan_po(file: UploadFile = File(...)):
    # Redirect to the robust ocr_po pipeline that includes fuzzy matching and markdown stripping
    return await ocr_po(file)
