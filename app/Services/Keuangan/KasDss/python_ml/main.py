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

def build_history_lines(row, dpp, max_lines, mode):
    candidates = []
    for slot in [1, 3]:
        akun = str(row.get(f"Kode_Akun{slot}") or "").strip()
        nominal = float(row.get(f"Nominal{slot}") or 0)
        if not is_valid_account_seed(akun) or nominal <= 0:
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
        idx = int(sims.argmax())
        score = float(sims[idx])
        if score < 0.12:
            return None

        row = df.iloc[idx]
        lines = build_history_lines(row, dpp, max_lines, mode)
        if not lines:
            return None

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
    except Exception:
        return None

def train_models():
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
                if a and a not in ['1100AD', '1200AD']:
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
        if a not in [l['akun'] for l in lines]:
            lines.append({"akun": a, "jenis": "Debit" if req.mode == "out" else "Kredit", "nominal": 0.0})
            
    if not lines and best_lawan:
        lines.append({"akun": best_lawan[0][0], "jenis": "Debit" if req.mode == "out" else "Kredit", "nominal": 0.0})
            
    dpp = req.nominal - (req.ppnNominal if req.hasPpn else 0.0)
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
