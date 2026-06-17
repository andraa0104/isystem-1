from fastapi import FastAPI
from pydantic import BaseModel
import os
import re
import pandas as pd
import mysql.connector
from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.pipeline import make_pipeline

# Load parent generic .env to connect to DB
load_dotenv('/root/isystem-1/.env')

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

def train_models():
    for mode in ["out", "in"]:
        conn = get_db_connection()
        op = ">" if mode == "in" else "<"
        query = f"""
        SELECT Keterangan, Kode_Akun, Kode_Akun1, Kode_Akun3, Mutasi_Kas 
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
    
    if req.seedAkun and req.seedAkun not in ['1100AD', '1200AD']:
        lines.append({"akun": req.seedAkun, "jenis": "Debit" if req.mode == "out" else "Kredit", "nominal": 0.0})
        
    for a, p in best_lawan:
        if len(lines) >= max_lines: break
        if a not in [l['akun'] for l in lines]:
            lines.append({"akun": a, "jenis": "Debit" if req.mode == "out" else "Kredit", "nominal": 0.0})
            
    if not lines and best_lawan:
        lines.append({"akun": best_lawan[0][0], "jenis": "Debit" if req.mode == "out" else "Kredit", "nominal": 0.0})
            
    dpp = req.nominal - (req.ppnNominal if req.hasPpn else 0.0)
    dpp = max(0.0, dpp)
    
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
