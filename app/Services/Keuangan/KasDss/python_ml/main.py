from fastapi import FastAPI
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
