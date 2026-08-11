import urllib.request
import json
import time

API_KEY = "xyz"
BASE_URL = "http://localhost:8108"
HEADERS = {
    "X-TYPESENSE-API-KEY": API_KEY,
    "Content-Type": "application/json"
}

def make_request(path, method="GET", data=None):
    url = f"{BASE_URL}{path}"
    req_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=req_data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8")
        print(f"HTTP Error {e.code} for {method} {path}: {error_msg}")
        raise e

# 1. Create collection
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

print("Creating collection 'catalog'...")
# First, delete collection if it already exists (for clean state)
try:
    make_request("/collections/catalog", method="DELETE")
    print("Deleted existing catalog collection.")
except Exception:
    pass

make_request("/collections", method="POST", data=schema)
print("Collection 'catalog' created successfully.")

# 2. Index documents
documents = [
    {"id": "p1", "name": "Apple iPhone 15", "brand": "Apple", "category": "phone", "popularity": 50},
    {"id": "p2", "name": "Samsung Galaxy phone", "brand": "Samsung", "category": "phone", "popularity": 95},
    {"id": "p3", "name": "Google Pixel phone", "brand": "Google", "category": "phone", "popularity": 70},
    {"id": "p4", "name": "OnePlus 12 phone", "brand": "OnePlus", "category": "phone", "popularity": 30},
    {"id": "p5", "name": "Nokia Classic phone", "brand": "Nokia", "category": "phone", "popularity": 10},
    {"id": "p6", "name": "Refurbished phone deal", "brand": "Refurb", "category": "phone", "popularity": 5},
    {"id": "p7", "name": "Motorola Edge phone", "brand": "Motorola", "category": "phone", "popularity": 40},
]

print("Indexing documents...")
for doc in documents:
    make_request("/collections/catalog/documents", method="POST", data=doc)
print(f"Indexed {len(documents)} documents.")

# 3. Create override rules
# Rule 1: Exact match on phone
# - Pin product p1 to position 1.
# - Pin product p7 to position 2.
# - Exclude (hide) product p2 from the results.
override_1_id = "phone-exact"
override_1_data = {
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

# Rule 2: Contains match on deal
# - Pin product p3 to position 1.
override_2_id = "deal-contains"
override_2_data = {
    "rule": {
        "query": "deal",
        "match": "contains"
    },
    "includes": [
        {"id": "p3", "position": 1}
    ]
}

# Rule 3: Dynamic brand filter
# - for the query pattern {brand} phone (a contains-style rule using the {brand} placeholder)
# - Dynamically apply a brand:={brand} filter derived from the matched brand token
# - The matched brand token must be removed from the query before searching
override_3_id = "brand-phone-dynamic"
override_3_data = {
    "rule": {
        "query": "{brand} phone",
        "match": "contains"
    },
    "filter_by": "brand:={brand}",
    "remove_matched_tokens": True
}

print("Creating override rules...")
make_request(f"/collections/catalog/overrides/{override_1_id}", method="PUT", data=override_1_data)
make_request(f"/collections/catalog/overrides/{override_2_id}", method="PUT", data=override_2_data)
make_request(f"/collections/catalog/overrides/{override_3_id}", method="PUT", data=override_3_data)
print("Override rules created successfully.")

# 4. Write setup.log file
log_file_path = "/home/user/typesense-curation/setup.log"
with open(log_file_path, "w") as f:
    f.write(f"{override_1_id}\n")
    f.write(f"{override_2_id}\n")
    f.write(f"{override_3_id}\n")
print(f"Wrote override IDs to {log_file_path}")

# 5. Verification tests
print("\n--- Running Verification Tests ---")

def run_search(q):
    print(f"\nSearching for: '{q}'")
    url_path = f"/collections/catalog/documents/search?q={urllib.parse.quote(q)}&query_by=name"
    results = make_request(url_path)
    hits = results.get("hits", [])
    print(f"Total hits: {results.get('found', 0)}")
    for i, hit in enumerate(hits):
        doc = hit["document"]
        print(f"  {i+1}. ID: {doc['id']}, Name: {doc['name']}, Brand: {doc['brand']}, Popularity: {doc['popularity']}")

# Test 1: Exact search for "phone"
# Expected: p1 at pos 1, p7 at pos 2, p2 excluded.
run_search("phone")

# Test 2: Contains search for "deal"
# Expected: p3 at pos 1.
run_search("deal")
run_search("phone deal")

# Test 3: Dynamic brand filter "Apple phone" or "Samsung phone"
# Expected: brand filter applied, brand token removed.
run_search("Apple phone")
run_search("Samsung phone")
run_search("Google phone")
