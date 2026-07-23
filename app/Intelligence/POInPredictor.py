import sys
import json
import re
from collections import Counter

def clean_name(name):
    if not name:
        return ""
    # Remove common prefixes/suffixes to improve matching
    name = re.sub(r'^(PT\.|CV\.|UD\.)\s*', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*(PT\.|CV\.|UD\.)$', '', name, flags=re.IGNORECASE)
    return name.strip().lower()

def calculate_similarity(s1, s2):
    # Simple n-gram similarity (bigrams)
    if not s1 or not s2:
        return 0
    s1, s2 = clean_name(s1), clean_name(s2)
    if s1 == s2:
        return 1.0
    
    def get_bigrams(s):
        return set(s[i:i+2] for i in range(len(s)-1))
    
    b1, b2 = get_bigrams(s1), get_bigrams(s2)
    if not b1 or not b2:
        return 0
        
    overlap = len(b1 & b2)
    # Using min instead of max allows for partial substring matches (e.g., 'telen' and 'telen prima sawit')
    # but we will take a weighted average between Jaccard and Substring match
    jaccard = overlap / max(len(b1), len(b2))
    substring = overlap / min(len(b1), len(b2))
    return (jaccard * 0.3) + (substring * 0.7)

def predict_next_po(po_list):
    """
    Memprediksi nomor PO In selanjutnya dengan mencari angka terbesar 
    dari histori PO milik customer tersebut, meskipun awalan karakternya tidak sama persis.
    """
    if not po_list:
        return None
    
    max_num = -1
    best_match = None
    
    for po in po_list:
        po_str = str(po).strip()
        if not po_str:
            continue
        
        # Regex ini akan mengambil deret angka TERAKHIR dalam string.
        # Contoh 1: "5000001" -> prefix="", num="5000001", suffix=""
        # Contoh 2: "PO/4600123/A" -> prefix="PO/", num="4600123", suffix="/A"
        match = re.search(r'^(.*?)(\d+)(\D*)$', po_str)
        if match:
            prefix, num_str, suffix = match.groups()
            num_val = int(num_str)
            
            # Cari angka terbesar dari semua riwayat PO customer ini
            if num_val > max_num:
                max_num = num_val
                best_match = (prefix, num_str, suffix)
            
    # Jika ditemukan angka, buat PO selanjutnya
    if best_match:
        prefix, num_str, suffix = best_match
        next_num = max_num + 1
        
        # Pertahankan padding 0 di depan (contoh "005" + 1 -> "006", "5000001" + 1 -> "5000002")
        next_num_str = str(next_num).zfill(len(num_str))
        
        # Gabungkan kembali format pemenangnya
        return f"{prefix}{next_num_str}{suffix}"
        
    return None

def predict(target_customer, historical_data):
    """
    historical_data: list of dicts with {customer_name, franco_loco, ppn_percent, payment_term, no_poin}
    """
    scores = []
    for entry in historical_data:
        similarity = calculate_similarity(target_customer, entry.get('customer_name', ''))
        if similarity > 0.5: # Threshold for similarity
            scores.append((similarity, entry))
    
    if not scores:
        return {"ppn": None, "franco": None, "payment_term": None, "next_poin": None, "confidence": 0}

    # Weighting based on similarity
    franco_votes = Counter()
    ppn_votes = Counter()
    term_votes = Counter()
    
    # List untuk menampung seluruh history No PO IN dari customer yang mirip
    po_list = []
    
    for similarity, entry in scores:
        weight = similarity ** 2 # Prefer closer matches
        franco_votes[entry.get('franco_loco')] += weight
        ppn_votes[entry.get('ppn_percent')] += weight
        term_votes[entry.get('payment_term')] += weight
        
        # Mengumpulkan No PO IN dengan batas kemiripan > 0.9 (dilonggarkan agar gampang terdeteksi)
        if similarity > 0.9 and entry.get('no_poin'):
            po_list.append(entry.get('no_poin'))
    
    best_franco = franco_votes.most_common(1)[0][0] if franco_votes else None
    best_ppn = ppn_votes.most_common(1)[0][0] if ppn_votes else None
    best_term = term_votes.most_common(1)[0][0] if term_votes else None
    
    # Panggil fungsi predict_next_po untuk mendapatkan nomor PO selanjutnya
    next_poin = predict_next_po(po_list)
    
    # Calculate confidence based on similarity
    max_similarity = max(s for s, _ in scores)
    
    return {
        "ppn": best_ppn,
        "franco": best_franco,
        "payment_term": best_term,
        "next_poin": next_poin,
        "confidence": round(max_similarity * 100, 2)
    }

if __name__ == "__main__":
    try:
        # Expecting JSON input from stdin
        input_data = json.load(sys.stdin)
        target = input_data.get('customer_name', '')
        history = input_data.get('history', [])
        
        result = predict(target, history)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e), "ppn": None, "franco": None, "payment_term": None, "next_poin": None, "confidence": 0}))