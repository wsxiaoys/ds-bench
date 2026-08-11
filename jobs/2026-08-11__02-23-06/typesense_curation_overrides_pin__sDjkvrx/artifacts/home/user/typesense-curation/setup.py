import json
import time
import requests

BASE_URL = "http://localhost:8108"
HEADERS = {
    "X-TYPESENSE-API-KEY": "xyz",
    "Content-Type": "application/json"
}

def wait_for_typesense():
    print("Waiting for Typesense server to be healthy...")
    for _ in range(30):
        try:
            response = requests.get(f"{BASE_URL}/health", headers=HEADERS, timeout=2)
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    print("Typesense is healthy!")
                    return True
        except requests.exceptions.RequestException:
            pass
        time.sleep(1)
    raise RuntimeError("Typesense server did not become healthy in time.")

def create_collection():
    print("Deleting collection 'catalog' if it exists...")
    requests.delete(f"{BASE_URL}/collections/catalog", headers=HEADERS)

    print("Creating collection 'catalog'...")
    schema = {
        "name": "catalog",
        "fields": [
            {"name": "name", "type": "string"},
            {"name": "brand", "type": "string", "facet": True},
            {"name": "category", "type": "string", "facet": True},
            {"name": "popularity", "type": "int32"}
        ],
        "default_sorting_field": "popularity"
    }
    response = requests.post(f"{BASE_URL}/collections", headers=HEADERS, json=schema)
    print("Create collection response:", response.status_code, response.text)
    response.raise_for_status()

def index_documents():
    print("Indexing documents...")
    documents = [
        {"id": "p1", "name": "Apple iPhone 15", "brand": "Apple", "category": "phone", "popularity": 50},
        {"id": "p2", "name": "Samsung Galaxy phone", "brand": "Samsung", "category": "phone", "popularity": 95},
        {"id": "p3", "name": "Google Pixel phone", "brand": "Google", "category": "phone", "popularity": 70},
        {"id": "p4", "name": "OnePlus 12 phone", "brand": "OnePlus", "category": "phone", "popularity": 30},
        {"id": "p5", "name": "Nokia Classic phone", "brand": "Nokia", "category": "phone", "popularity": 10},
        {"id": "p6", "name": "Refurbished phone deal", "brand": "Refurb", "category": "phone", "popularity": 5},
        {"id": "p7", "name": "Motorola Edge phone", "brand": "Motorola", "category": "phone", "popularity": 40}
    ]
    
    # Import documents as JSONL
    jsonl_data = "\n".join(json.dumps(doc) for doc in documents)
    headers = {**HEADERS, "Content-Type": "text/plain"}
    response = requests.post(f"{BASE_URL}/collections/catalog/documents/import?action=upsert", headers=headers, data=jsonl_data)
    print("Index documents response:", response.status_code, response.text)
    response.raise_for_status()

def create_override_rules():
    print("Creating override rules...")
    
    # Rule 1: Exact match on "phone"
    rule_1 = {
        "rule": {
            "query": "phone",
            "match": "exact"
        },
        "includes": [
            {"id": "p1", "position": 1},
            {"id": "p7", "position": 2}
        ],
        "excludes": [
            {"id": "p2"}
        ]
    }
    
    # Rule 2: Contains match on "deal"
    rule_2 = {
        "rule": {
            "query": "deal",
            "match": "contains"
        },
        "includes": [
            {"id": "p3", "position": 1}
        ]
    }
    
    # Rule 3: Dynamic brand filter
    rule_3 = {
        "rule": {
            "query": "{brand} phone",
            "match": "contains"
        },
        "filter_by": "brand:={brand}",
        "remove_matched_tokens": True
    }
    
    overrides = {
        "exact-phone": rule_1,
        "contains-deal": rule_2,
        "dynamic-brand": rule_3
    }
    
    for override_id, payload in overrides.items():
        url = f"{BASE_URL}/collections/catalog/overrides/{override_id}"
        response = requests.put(url, headers=HEADERS, json=payload)
        print(f"Create override {override_id} response:", response.status_code, response.text)
        response.raise_for_status()
        
    # Write setup.log
    log_path = "/home/user/typesense-curation/setup.log"
    with open(log_path, "w") as f:
        for override_id in overrides.keys():
            f.write(f"{override_id}\n")
    print(f"Wrote rule IDs to {log_path}")

def test_searches():
    print("\n--- Running Search Tests ---")
    
    # Test 1: exact match "phone"
    print("\nTest 1: Searching for 'phone'")
    params = {
        "q": "phone",
        "query_by": "name"
    }
    res = requests.get(f"{BASE_URL}/collections/catalog/documents/search", headers=HEADERS, params=params).json()
    hits = [hit["document"]["id"] for hit in res.get("hits", [])]
    print("Hits for 'phone':", hits)
    # Expected: p1 at pos 1, p7 at pos 2, and p2 (Samsung) is excluded.
    assert hits[0] == "p1", f"Expected position 1 to be p1, got {hits[0]}"
    assert hits[1] == "p7", f"Expected position 2 to be p7, got {hits[1]}"
    assert "p2" not in hits, f"Expected p2 to be excluded, but found in hits"
    print("Test 1 Passed!")

    # Test 2: contains match "deal"
    print("\nTest 2: Searching for 'refurbished phone deal'")
    params = {
        "q": "refurbished phone deal",
        "query_by": "name"
    }
    res = requests.get(f"{BASE_URL}/collections/catalog/documents/search", headers=HEADERS, params=params).json()
    hits = [hit["document"]["id"] for hit in res.get("hits", [])]
    print("Hits for 'refurbished phone deal':", hits)
    # Expected: p3 pinned to position 1
    assert hits[0] == "p3", f"Expected position 1 to be p3, got {hits[0]}"
    print("Test 2 Passed!")

    # Test 3: dynamic brand filter "Apple phone"
    print("\nTest 3: Searching for 'Apple phone'")
    params = {
        "q": "Apple phone",
        "query_by": "name"
    }
    res = requests.get(f"{BASE_URL}/collections/catalog/documents/search", headers=HEADERS, params=params).json()
    hits = [hit["document"]["id"] for hit in res.get("hits", [])]
    print("Hits for 'Apple phone':", hits)
    # Expected only Apple brand products (p1)
    for hit_id in hits:
        # Let's verify that the brand of hit_id is Apple
        doc_res = requests.get(f"{BASE_URL}/collections/catalog/documents/{hit_id}", headers=HEADERS).json()
        assert doc_res["brand"] == "Apple", f"Expected only Apple products, but got {hit_id} with brand {doc_res['brand']}"
    print("Test 3 Passed!")

if __name__ == "__main__":
    wait_for_typesense()
    create_collection()
    index_documents()
    create_override_rules()
    test_searches()
    print("\nAll setup and test steps completed successfully!")
