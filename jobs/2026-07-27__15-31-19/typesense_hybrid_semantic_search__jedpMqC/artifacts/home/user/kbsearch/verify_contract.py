import typesense
import json

client = typesense.Client({
    'nodes': [{
        'host': '127.0.0.1',
        'port': '8108',
        'protocol': 'http'
    }],
    'api_key': 'w3E7XhJMftaUNPbVwOkBp0PaKCgfHWxt',
    'connection_timeout_seconds': 5
})

with open('/home/user/kbsearch/data/query_vectors.json', 'r') as f:
    query_vectors = json.load(f)

for query_text, vector in query_vectors.items():
    print(f"========================================\nQUERY: '{query_text}'")
    
    # 1. Keyword
    kw_res = client.collections['knowledge_base'].documents.search({
        'q': query_text,
        'query_by': 'title,body'
    })
    kw_hits = kw_res.get('hits', [])
    kw_top = kw_hits[0]['document']['id'] if kw_hits else None
    print(f"Keyword top ID: {kw_top} (found {len(kw_hits)} matches)")
    
    # 2. Semantic
    sem_res = client.collections['knowledge_base'].documents.search({
        'q': '*',
        'vector_query': f"embedding:({vector}, k:10)"
    })
    sem_hits = sem_res.get('hits', [])
    sem_top = sem_hits[0]['document']['id'] if sem_hits else None
    print(f"Semantic top ID: {sem_top}")
    
    # 3. Hybrid alpha=0.0
    hyb0_res = client.collections['knowledge_base'].documents.search({
        'q': query_text,
        'query_by': 'title,body',
        'vector_query': f"embedding:({vector}, alpha: 0.0)"
    })
    hyb0_hits = hyb0_res.get('hits', [])
    hyb0_top = hyb0_hits[0]['document']['id'] if hyb0_hits else None
    print(f"Hybrid alpha=0.0 top ID: {hyb0_top}")
    
    # 4. Hybrid alpha=1.0
    hyb1_res = client.collections['knowledge_base'].documents.search({
        'q': query_text,
        'query_by': 'title,body',
        'vector_query': f"embedding:({vector}, alpha: 1.0)"
    })
    hyb1_hits = hyb1_res.get('hits', [])
    hyb1_top = hyb1_hits[0]['document']['id'] if hyb1_hits else None
    print(f"Hybrid alpha=1.0 top ID: {hyb1_top}")
    
    # Check contract
    kw_match = (kw_top == hyb0_top)
    sem_match = (sem_top == hyb1_top)
    print(f"Contract alpha=0.0 match: {kw_match}")
    print(f"Contract alpha=1.0 match: {sem_match}")
