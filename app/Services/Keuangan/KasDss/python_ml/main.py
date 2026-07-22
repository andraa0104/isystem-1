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

def suggest_from_history(mode, cleaned_input, dpp, max_lines):
    hist = models.get(f"history_{mode}")
    if not hist or cleaned_input == "":
        return None

    try:
        vectorizer = hist["vectorizer"]
        matrix = hist["matrix"]
        df = hist["df"]
        query_vec = vectorizer.transform([cleaned_input])
        sims = cosine_similarity(query_vec, matrix)[0]
        if len(sims) == 0:
            return None
        for idx in sims.argsort()[-25:][::-1]:
            idx = int(idx)
            score = float(sims[idx])
            if score < 0.12:
                break

            row = df.iloc[idx]
            lines = build_history_lines(row, dpp, max_lines, mode, cleaned_input)
            if not lines:
                continue

            return {
                "lines": lines,
                "score": score,
                "evidence": {
                    "Kode_Voucher": str(row.get("Kode_Voucher") or ""),
                    "Tgl_Voucher": str(row.get("Tgl_Voucher") or ""),
                    "Keterangan": str(row.get("Keterangan") or ""),
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

        hist_vectorizer = TfidfVectorizer(ngram_range=(1,2), max_features=8000)
        hist_matrix = hist_vectorizer.fit_transform(df['X'])
        models[f"history_{mode}"] = {
            "vectorizer": hist_vectorizer,
            "matrix": hist_matrix,
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

    vectorizer = TfidfVectorizer(ngram_range=(1,2), max_features=6000)
    matrix = vectorizer.fit_transform(df["X"])
    sims = cosine_similarity(vectorizer.transform([query]), matrix)[0]

    best = None
    for idx in sims.argsort()[-30:][::-1]:
        idx = int(idx)
        score = float(sims[idx])
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
            score = float(sims[int(idx)]) if int(idx) < len(sims) else 0.0
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

    vectorizer = TfidfVectorizer(ngram_range=(1,2), max_features=6000)
    matrix = vectorizer.fit_transform(df["X"])
    sims = cosine_similarity(vectorizer.transform([query]), matrix)[0]

    best = None
    for idx in sims.argsort()[-30:][::-1]:
        idx = int(idx)
        row = df.iloc[idx]
        lines = build_sales_lines(row, dpp, has_ppn)
        if not lines:
            continue
        best = (row, lines, float(sims[idx]))
        break

    if not best:
        for idx, row in df.head(200).iterrows():
            lines = build_sales_lines(row, dpp, has_ppn)
            if not lines:
                continue
            score = float(sims[int(idx)]) if int(idx) < len(sims) else 0.0
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

    vectorizer = TfidfVectorizer(ngram_range=(1,2), max_features=6000)
    matrix = vectorizer.fit_transform([g["text"] for g in grouped])
    sims = cosine_similarity(vectorizer.transform([clean_text(remark)]), matrix)[0]

    best = None
    for idx in sims.argsort()[-30:][::-1]:
        idx = int(idx)
        lines = build_adjustment_lines(grouped[idx]["group"], req)
        if not lines:
            continue
        best = (grouped[idx], lines, float(sims[idx]))
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

@app.post("/ocr-po")

async def ocr_po(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename)[1].lower() if file.filename else ".pdf"
    temp_path = f"/tmp/ocr_upload{suffix}"
    with open(temp_path, "wb") as f:
        f.write(await file.read())
        
    text = ""
    tables = []
    try:
        import pdfplumber
        with pdfplumber.open(temp_path) as pdf:
            for page in pdf.pages:
                extracted = page.extract_text(x_tolerance=2)
                if extracted: text += extracted + "\n"
                tbls = page.extract_tables()
                if tbls:
                    for t in tbls:
                        if t: tables.extend(t)
    except Exception as e:
        return {"error": str(e)}
        
    if os.path.exists(temp_path):
        os.remove(temp_path)

    def search(pattern, txt, group=1, flags=re.IGNORECASE):
        m = re.search(pattern, txt, flags)
        return m.group(group).strip() if m else ""

    for row in tables:
        cells = [str(c).strip() for c in row if c]
        if any(re.search(r'(?:No\.?\s*PO|Tanggal|Date|Jadwal|Delivery|Syarat)', c, re.IGNORECASE) for c in cells):
            text += "\n" + " ".join(cells)

    ref_po = search(r'(?:No\.?\s*PO|Nomor\s+PO|Purchase\s+Order\s+No|PO\s+Number|Order\s+No)[^\w]*([\w\-\/]+)', text)

    MONTH_PATTERN = r'(?:Jan(?:uari)?|Feb(?:ruari)?|Mar(?:et)?|Apr(?:il)?|Mei|Jun(?:i)?|Jul(?:i)?|Agt|Agu(?:stus)?|Sep(?:tember)?|Okt(?:ober)?|Nov(?:ember)?|Des(?:ember)?)'
    DATE_PATTERN_ALPHA = r'\d{1,2}[^\w\d\n]{0,3}' + MONTH_PATTERN + r'[^\w\d\n]{0,3}\d{4}'
    DATE_PATTERN_NUM = r'\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}'
    DATE_PATTERN  = rf'({DATE_PATTERN_ALPHA}|{DATE_PATTERN_NUM})'

    tgl_raw = search(r'(?:Tanggal(?:\s+PO|)|Tgl\.?(?:\s*PO|\s*Order|)|Date(?:\s+PO\s+In|))[^\w\d\n]*' + DATE_PATTERN, text)
    delivery_raw = search(r'(?:Jadwal\s+Pengiriman|Delivery\s+Date|Tgl\.?\s*Kirim|Due\s+Date|Pengiriman)[^\w\d\n]*' + DATE_PATTERN, text)

    payment = search(r'(?:Syarat|Payment\s*Term[s]?|Pembayaran|Term[s]?\s+of\s+Payment)[^\w]*([^\n]+)', text)
    if payment: payment = payment.split('\n')[0].strip()[:80]

    ppn_pct = ""
    ppn_val_str = search(r'PPN[^\d]*([\d.,]+)', text)
    subtotal_str = search(r'(?:Sub\s*Total|Subtotal)[^\d]*([\d.,]+)', text)
    def parse_idr(s):
        if not s: return 0.0
        dot_count = s.count('.')
        if dot_count > 1 or (dot_count == 1 and len(s.split('.')[-1]) == 3): s = s.replace('.', '')
        s = s.replace(',', '.')
        try: return float(s)
        except: return 0.0

    ppn_val = parse_idr(ppn_val_str)
    subtotal_val = parse_idr(subtotal_str)
    if ppn_val > 0 and subtotal_val > 0:
        computed_pct = round((ppn_val / subtotal_val) * 100)
        if computed_pct in [0, 1, 2, 5, 10, 11, 12]: ppn_pct = str(computed_pct)

    franco = search(r'Franco\s*(?:Loco|Lokasi)?[^\w\n]*([^\n]+(?:\n[^\n]+){0,3})', text)
    if franco: franco = franco.strip().split('\n')[0].strip()[:150]

    catatan_raw = search(r'(?:Catatan|Keterangan|Notes?|Remarks?)\s*:?\s*([^\n]+(?:\n[^\n]+){0,6})', text)
    catatan = ""
    if catatan_raw:
        right_col_markers = re.compile(r'(?:Franco|Loco|NPWP|Syarat|Jadwal|Pengiriman|Sub\s*Total|PPN|Grand|Terbilang)', re.IGNORECASE)
        lines_out = []
        footer_markers = re.compile(r'(?:Mangkupalas|Telp/?Fax|Contact|Dibuat|Hormat|Mengetahui|Approved|Telp\.|Fax\.)', re.IGNORECASE)
        for line in catatan_raw.splitlines():
            if footer_markers.search(line):
                break # Stop processing Catatan when we hit the document footer!
                
            if right_col_markers.search(line):
                m = right_col_markers.search(line)
                left = line[:m.start()].strip()
                if left: lines_out.append(left)
            else:
                if line.strip(): lines_out.append(line.strip())
        catatan = "\n".join(l for l in lines_out if l).strip()[:300]

    lines_all = text.split('\n')
    kepada_idx = next((i for i, l in enumerate(lines_all) if re.search(r'^\s*Kepada', l, re.IGNORECASE)), min(6, len(lines_all)))
    top_lines = "\n".join(lines_all[:kepada_idx]).strip()
    if not top_lines: top_lines = "\n".join(lines_all[:4])

    conn = get_db_connection()
    cust_match = fuzzy_match_items([top_lines], conn, "tb_cs", "kd_cs", "nm_cs")
    kd_cs = cust_match[0][0] if cust_match[0] else ""
    nm_cs = cust_match[0][1] if cust_match[0] else ""

    items = []
    item_texts = []
    item_codes = []
    raw_qty = []
    raw_price = []

    for row in tables:
        row = [str(cell).strip() if cell else "" for cell in row]
        row_text = " ".join(row).lower()
        if any(h in row_text for h in ["qty", "quantity", "description", "nama barang", "harga satuan", "kode barang", "satuan", "no."]): continue
        if any(h in row_text for h in ["sub total", "subtotal", "grand total", "ppn", "terbilang"]): continue

        desc = ""
        kode = ""
        qty = 0.0
        price = 0.0

        for i_cell, cell in enumerate(row):
            c = cell.strip()
            if not c: continue
            
            # Skip likely row numbers at the start (1, 2, 3...)
            if i_cell == 0 and re.match(r'^\d+$', c) and float(c) < 100:
                continue
                
            if re.match(r'^\d{6,12}$', c):
                kode = c
                continue
            if re.match(r'^[\d.,]+$', c):
                dc, cc = c.count('.'), c.count(',')
                if dc > 1: val_s = c.replace('.', '').replace(',', '.')
                elif dc == 1 and cc == 0:
                    parts = c.split('.')
                    val_s = c.replace('.', '') if len(parts[1]) == 3 else c
                elif cc == 1: val_s = c.replace('.', '').replace(',', '.')
                else: val_s = re.sub(r'[^0-9.]', '', c)
                try: num = float(val_s) if val_s else 0.0
                except ValueError: num = 0.0

                if num > 0 and num < 10000 and qty == 0: qty = num
                elif num >= 1000 and price == 0: price = num
                continue
            if re.match(r'^(?:PCS|KG|LTR|M|BUH|SET|PC|BOX|BTL|LBR|UNIT|ROLL|BTG|MTR)$', c, re.IGNORECASE): continue
            if len(c) > len(desc): desc = c

        if not desc and not kode: continue
        if qty <= 0 and price <= 0: continue

        item_texts.append(desc)
        item_codes.append(kode)
        raw_qty.append(qty if qty > 0 else 1)
        raw_price.append(price)

    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT kd_material, material FROM tb_barang")
    all_materials = cursor.fetchall()
    cursor.close()

    mat_by_code = {str(r['kd_material']).strip(): r for r in all_materials}

    fuzzy_texts = []
    fuzzy_indices = []
    for i, (code, txt) in enumerate(zip(item_codes, item_texts)):
        if code and code in mat_by_code:
            row = mat_by_code[code]
            items.append({
                "kd_brg": row['kd_material'],
                "nm_brg": row['material'],
                "nm_brg_ocr": txt or code,
                "qty": raw_qty[i],
                "price": raw_price[i]
            })
        else:
            fuzzy_texts.append(txt or code)
            fuzzy_indices.append(i)

    if fuzzy_texts:
        def clean_m(t): return re.sub(r'[^a-z0-9]', '', str(t).lower())
        for j, idx in enumerate(fuzzy_indices):
            ocr_text = item_texts[idx]
            ocr_clean = clean_m(ocr_text)
            best_match = None
            for db_row in all_materials:
                db_clean = clean_m(db_row['material'])
                if ocr_clean in db_clean or db_clean in ocr_clean:
                    best_match = (db_row['kd_material'], db_row['material'])
                    break
            if not best_match:
                m = fuzzy_match_items([ocr_text], conn, "tb_barang", "kd_material", "material", threshold=0.1)
                best_match = m[0] if m and m[0] else None
            if best_match:
                items.append({
                    "kd_brg": best_match[0], 
                    "nm_brg": best_match[1], 
                    "nm_brg_ocr": ocr_text, 
                    "qty": raw_qty[idx], 
                    "price": raw_price[idx]
                })

    def normalize_date(d_str):
        if not d_str: return ""
        d_str = d_str.strip()
        m = re.search(r"(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})", d_str)
        if m: return f"{m.group(1).zfill(2)}/{m.group(2).zfill(2)}/{m.group(3)}"
        months_dic = {
            "jan": "01", "januari": "01", "feb": "02", "februari": "02", "pebruari": "02",
            "mar": "03", "maret": "03", "apr": "04", "april": "04", "mei": "05",
            "jun": "06", "juni": "06", "jul": "07", "juli": "07", "agt": "08",
            "agustus": "08", "agu": "08", "sep": "09", "september": "09",
            "okt": "10", "oktober": "10", "nov": "11", "november": "11",
            "des": "12", "desember": "12"
        }
        ma = re.search(r"(\d{1,2})[^\w\d\n]{1,3}([a-zA-Z]+)[^\w\d\n]{1,3}(\d{4})", d_str)
        if ma:
            mon = months_dic.get(ma.group(2).lower(), "01")
            return f"{ma.group(1).zfill(2)}/{mon}/{ma.group(3)}"
        return d_str

    conn.close()

    return {
        "text_raw": text[:1500],
        "ref_poin": ref_po,
        "tgl": normalize_date(tgl_raw),
        "delivery_date": normalize_date(delivery_raw),
        "payment": payment,
        "ppn_pct": ppn_pct,
        "franco": franco,
        "catatan": catatan,
        "kd_customer": kd_cs,
        "nm_customer": nm_cs,
        "items": items
    }
