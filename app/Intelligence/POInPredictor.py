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
    return len(b1 & b2) / max(len(b1), len(b2))

def predict(target_customer, historical_data):
    """
    historical_data: list of dicts with {customer_name, franco_loco, ppn_percent}
    """
    scores = []
    for entry in historical_data:
        similarity = calculate_similarity(target_customer, entry.get('customer_name', ''))
        if similarity > 0.5: # Threshold for similarity
            scores.append((similarity, entry))
    
    if not scores:
        return {"ppn": None, "franco": None, "confidence": 0}

    # Weighting based on similarity
    franco_votes = Counter()
    ppn_votes = Counter()
    term_votes = Counter()
    
    for similarity, entry in scores:
        weight = similarity ** 2 # Prefer closer matches
        franco_votes[entry.get('franco_loco')] += weight
        ppn_votes[entry.get('ppn_percent')] += weight
        term_votes[entry.get('payment_term')] += weight
    
    best_franco = franco_votes.most_common(1)[0][0] if franco_votes else None
    best_ppn = ppn_votes.most_common(1)[0][0] if ppn_votes else None
    best_term = term_votes.most_common(1)[0][0] if term_votes else None
    
    # Calculate confidence based on similarity and consistency
    max_similarity = max(s for s, _ in scores)
    
    return {
        "ppn": best_ppn,
        "franco": best_franco,
        "payment_term": best_term,
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
        print(json.dumps({"error": str(e), "ppn": None, "franco": None, "confidence": 0}))
