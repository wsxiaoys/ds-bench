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

# Let's read query vectors
with open('/home/user/kbsearch/data/query_vectors.json', 'r') as f:
    query_vectors = json.load(f)

query_text = "speed up slow website"
vector = query_vectors[query_text]

print("--- KEYWORD SEARCH ---")
keyword_res = client.collections['knowledge_base'].documents.search({
    'q': query_text,
    'query_by': 'title,body'
})
for hit in keyword_res.get('hits', []):
    print(f"ID: {hit['document']['id']}, Title: {hit['document']['title']}, Text Match Score: {hit.get('text_match')}, Text Match Info: {hit.get('text_match_info')}")

print("\n--- SEMANTIC SEARCH ---")
# Semantic search
semantic_res = client.collections['knowledge_base'].documents.search({
    'q': '*',
    'vector_query': f"embedding:({vector}, k:10)"
})
for hit in semantic_res.get('hits', []):
    print(f"ID: {hit['document']['id']}, Title: {hit['document']['title']}, Distance: {hit.get('vector_distance')}")

print("\n--- HYBRID SEARCH (alpha=0.5) ---")
hybrid_res = client.collections['knowledge_base'].documents.search({
    'q': query_text,
    'query_by': 'title,body',
    'vector_query': f"embedding:({vector}, alpha: 0.5)"
})
for hit in hybrid_res.get('hits', []):
    print(f"ID: {hit['document']['id']}, Title: {hit['document']['title']}, Text Match: {hit.get('text_match')}, Distance: {hit.get('vector_distance')}, Hybrid Info: {hit.get('hybrid_search_info')}")

print("\n--- HYBRID SEARCH (alpha=0.0) ---")
hybrid_res_0 = client.collections['knowledge_base'].documents.search({
    'q': query_text,
    'query_by': 'title,body',
    'vector_query': f"embedding:({vector}, alpha: 0.0)"
})
for hit in hybrid_res_0.get('hits', []):
    print(f"ID: {hit['document']['id']}, Title: {hit['document']['title']}, Text Match: {hit.get('text_match')}, Distance: {hit.get('vector_distance')}, Hybrid Info: {hit.get('hybrid_search_info')}")

print("\n--- HYBRID SEARCH (alpha=1.0) ---")
hybrid_res_1 = client.collections['knowledge_base'].documents.search({
    'q': query_text,
    'query_by': 'title,body',
    'vector_query': f"embedding:({vector}, alpha: 1.0)"
})
for hit in hybrid_res_1.get('hits', []):
    print(f"ID: {hit['document']['id']}, Title: {hit['document']['title']}, Text Match: {hit.get('text_match')}, Distance: {hit.get('vector_distance')}, Hybrid Info: {hit.get('hybrid_search_info')}")
