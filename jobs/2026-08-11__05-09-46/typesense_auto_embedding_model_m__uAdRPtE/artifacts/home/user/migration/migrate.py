import json
import requests

TYPESENSE_URL = "http://localhost:8108"
HEADERS = {
    "X-TYPESENSE-API-KEY": "xyz",
    "Content-Type": "application/json"
}

def get_schema():
    r = requests.get(f"{TYPESENSE_URL}/collections/notes", headers=HEADERS)
    r.raise_for_status()
    return r.json()

def drop_field():
    print("Dropping content_embedding field...")
    payload = {
        "fields": [
            {"name": "content_embedding", "drop": True}
        ]
    }
    r = requests.patch(f"{TYPESENSE_URL}/collections/notes", headers=HEADERS, json=payload)
    print("Drop field response:", r.status_code, r.text)
    r.raise_for_status()

def add_field():
    print("Adding content_embedding field with 8 dimensions...")
    payload = {
        "fields": [
            {
                "name": "content_embedding",
                "type": "float[]",
                "num_dim": 8,
                "optional": False,
                "index": True,
                "vec_dist": "cosine",
                "hnsw_params": {
                    "M": 16,
                    "ef_construction": 200
                }
            }
        ]
    }
    r = requests.patch(f"{TYPESENSE_URL}/collections/notes", headers=HEADERS, json=payload)
    print("Add field response:", r.status_code, r.text)
    r.raise_for_status()

def update_documents():
    print("Updating documents with new 8-dimensional embeddings...")
    # Read the JSONL file
    with open("/home/user/migration/new_vectors.jsonl", "r") as f:
        lines = f.readlines()
    
    # We will use the import endpoint with action=update
    # Typesense import endpoint takes JSONL content as body
    import_data = ""
    for line in lines:
        if line.strip():
            import_data += line.strip() + "\n"
            
    r = requests.post(
        f"{TYPESENSE_URL}/collections/notes/documents/import?action=update",
        headers={"X-TYPESENSE-API-KEY": "xyz", "Content-Type": "text/plain"},
        data=import_data
    )
    print("Update documents response:", r.status_code, r.text)
    r.raise_for_status()

def verify_migration():
    print("Verifying migration...")
    # Fetch schema
    schema = get_schema()
    print("Updated Schema:")
    print(json.dumps(schema, indent=2))
    
    # Search for documents and verify embedding size
    r = requests.get(f"{TYPESENSE_URL}/collections/notes/documents/search?q=*&per_page=100", headers=HEADERS)
    r.raise_for_status()
    results = r.json()
    print(f"Found {results['found']} documents.")
    for hit in results['hits']:
        doc = hit['document']
        emb = doc.get('content_embedding', [])
        print(f"Doc ID: {doc['id']}, Embedding Dim: {len(emb)}, Embedding: {emb}")
        if len(emb) != 8:
            raise ValueError(f"Document {doc['id']} does not have 8-dimensional embedding!")

    # Perform a vector search to make sure nearest-neighbor search works!
    print("Performing a vector search...")
    query_vector = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
    vector_query_str = f"content_embedding:([{','.join(map(str, query_vector))}], k:3)"
    search_payload = {
        "q": "*",
        "vector_query": vector_query_str
    }
    r = requests.get(f"{TYPESENSE_URL}/collections/notes/documents/search", headers=HEADERS, params=search_payload)
    print("Vector Search response status:", r.status_code)
    if r.status_code == 200:
        search_results = r.json()
        print("Vector Search hits:")
        for hit in search_results.get('hits', []):
            print(f"  Hit ID: {hit['document']['id']}, Score: {hit.get('vector_distance')}")
    else:
        print("Vector search failed:", r.text)
        r.raise_for_status()

if __name__ == "__main__":
    print("Initial Schema:")
    print(json.dumps(get_schema(), indent=2))
    
    drop_field()
    update_documents()
    add_field()
    verify_migration()
    print("Migration completed successfully!")
