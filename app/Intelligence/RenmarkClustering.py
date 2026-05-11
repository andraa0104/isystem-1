import sys
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import DBSCAN

def clean_sisa_pr(val):
    if val is None:
        return 0.0
    try:
        # Bersihkan koma jika format datanya string ribuan (misal: "1,000.00")
        s = str(val).replace(',', '').strip()
        return float(s) if s else 0.0
    except ValueError:
        return 0.0

def generate_ml_note(materials):
    # 1. FILTERING DATA (Memisahkan tugas Controller ke Python)
    valid_items = []
    for m in materials:
        renmark_text = str(m.get('renmark', '')).strip()
        sisa_pr_val = clean_sisa_pr(m.get('sisa_pr', 0))
        
        # Hanya ambil yang sisa_pr > 0 dan renmark tidak kosong
        if sisa_pr_val > 0 and renmark_text != '':
            valid_items.append(m)

    if not valid_items:
        return ""
    
    if len(valid_items) == 1:
        return valid_items[0]['renmark']

    texts = [m['renmark'] for m in valid_items]

    try:
        # 2. EKSTRAKSI FITUR (TF-IDF)
        vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4))
        X = vectorizer.fit_transform(texts)

        # 3. CLUSTERING (DBSCAN)
        clustering = DBSCAN(eps=0.3, min_samples=1, metric='cosine').fit(X)
        labels = clustering.labels_

    except Exception:
        labels = list(range(len(texts))) 

    # 4. GROUPING HASIL
    groups = {}
    for idx, label in enumerate(labels):
        if label not in groups:
            groups[label] = []
        groups[label].append(valid_items[idx])

    # 5. FORMATTING TEKS
    notes = []
    for label, items in groups.items():
        indices = [item['index'] for item in items]
        representative_text = items[0]['renmark']

        if len(indices) == 1:
            notes.append(f"({indices[0]}) {representative_text}")
        elif len(indices) == 2:
            notes.append(f"({indices[0]}) & ({indices[1]}) {representative_text}")
        else:
            notes.append(f"({indices[0]}) - ({indices[-1]}) {representative_text}")

    return ", ".join(notes)

if __name__ == "__main__":
    try:
        input_data = sys.argv[1] if len(sys.argv) > 1 else "[]"
        materials = json.loads(input_data)
        
        result = generate_ml_note(materials)
        print(result)
    except Exception as e:
        print(f"Error AI: {str(e)}")