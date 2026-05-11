import sys
import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.cluster import DBSCAN

def generate_ml_note(materials):
    # Filter item yang renmark-nya tidak kosong
    valid_items = [m for m in materials if str(m.get('renmark', '')).strip() != '']

    if not valid_items:
        return ""
    
    if len(valid_items) == 1:
        return valid_items[0]['renmark']

    # Ambil semua teks renmark untuk dianalisis
    texts = [m['renmark'] for m in valid_items]

    try:
        # 1. Ubah teks menjadi representasi angka (vektor) menggunakan TF-IDF
        # Ini akan mengevaluasi bobot kata. Kata yang sering muncul di berbagai dokumen
        # akan disesuaikan bobotnya agar kita bisa melihat kemiripannya.
        vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 4))
        X = vectorizer.fit_transform(texts)

        # 2. Lakukan Clustering (Pengelompokan) dengan DBSCAN
        # eps=0.3 artinya jika kemiringan/jarak kosinus teks <= 0.3, anggap 1 grup.
        # metric='cosine' sangat cocok untuk membandingkan kemiripan teks.
        clustering = DBSCAN(eps=0.3, min_samples=1, metric='cosine').fit(X)
        labels = clustering.labels_

    except Exception:
        # Fallback jika terjadi error saat ekstraksi ML (misal teks terlalu aneh/pendek)
        labels = list(range(len(texts))) # Jadikan masing-masing grup berbeda

    # 3. Kumpulkan berdasarkan hasil prediksi label AI
    groups = {}
    for idx, label in enumerate(labels):
        if label not in groups:
            groups[label] = []
        groups[label].append(valid_items[idx])

    # 4. Format Output sesuai aturan: (1), (1)&(2), atau (1)-(3)
    notes = []
    for label, items in groups.items():
        indices = [item['index'] for item in items]
        
        # Ambil teks representatif dari grup tersebut (kita ambil teks dari index pertama)
        representative_text = items[0]['renmark']

        if len(indices) == 1:
            notes.append(f"({indices[0]}) {representative_text}")
        elif len(indices) == 2:
            notes.append(f"({indices[0]}) & ({indices[1]}) {representative_text}")
        else:
            # Jika urutan melompat, misal index 1, 3, 4. Kita tetap ambil [0] dan [-1] 
            # untuk format ujung ke ujung
            notes.append(f"({indices[0]}) - ({indices[-1]}) {representative_text}")

    return ", ".join(notes)

if __name__ == "__main__":
    # Baca input JSON yang dikirim dari Laravel PHP
    try:
        input_data = sys.argv[1] if len(sys.argv) > 1 else "[]"
        materials = json.loads(input_data)
        
        # Cetak hasil agar bisa ditangkap oleh shell_exec di PHP
        result = generate_ml_note(materials)
        print(result)
    except Exception as e:
        # Jangan cetak error yang merusak string, kembalikan string kosong atau error code
        print(f"Error AI: {str(e)}")