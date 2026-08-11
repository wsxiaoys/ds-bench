import urllib.request
import json
import time

url_prefix = "http://localhost:8108"
headers = {
    "X-TYPESENSE-API-KEY": "xyz",
    "Content-Type": "application/json"
}

# 1. Wait for Typesense to be ready
print("Waiting for Typesense to be ready...")
for i in range(15):
    try:
        req = urllib.request.Request(f"{url_prefix}/health", headers=headers)
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode())
            if res.get("ok") or res.get("healthy"):
                print("Typesense is ready!")
                break
    except Exception as e:
        print(f"Not ready yet, retrying... ({e})")
        time.sleep(1)

# 2. Delete existing 'catalog' collection if it exists
try:
    req = urllib.request.Request(f"{url_prefix}/collections/catalog", headers=headers, method="DELETE")
    with urllib.request.urlopen(req) as response:
        print("Deleted existing 'catalog' collection.")
except Exception as e:
    print("Catalog collection didn't exist or couldn't be deleted:", e)

# 3. Create 'catalog' collection
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
req = urllib.request.Request(
    f"{url_prefix}/collections",
    data=json.dumps(schema).encode(),
    headers=headers,
    method="POST"
)
with urllib.request.urlopen(req) as response:
    print("Created 'catalog' collection:", response.read().decode())

# 4. Index documents
documents = [
    {"id": "p1", "name": "Apple iPhone 15", "brand": "Apple", "category": "phone", "popularity": 50},
    {"id": "p2", "name": "Samsung Galaxy phone", "brand": "Samsung", "category": "phone", "popularity": 95},
    {"id": "p3", "name": "Google Pixel phone", "brand": "Google", "category": "phone", "popularity": 70},
    {"id": "p4", "name": "OnePlus 12 phone", "brand": "OnePlus", "category": "phone", "popularity": 30},
    {"id": "p5", "name": "Nokia Classic phone", "brand": "Nokia", "category": "phone", "popularity": 10},
    {"id": "p6", "name": "Refurbished phone deal", "brand": "Refurb", "category": "phone", "popularity": 5},
    {"id": "p7", "name": "Motorola Edge phone", "brand": "Motorola", "category": "phone", "popularity": 40}
]

for doc in documents:
    req = urllib.request.Request(
        f"{url_prefix}/collections/catalog/documents",
        data=json.dumps(doc).encode(),
        headers=headers,
        method="POST"
    )
    with urllib.request.urlopen(req) as response:
        print(f"Indexed document {doc['id']}:", response.read().decode())

# 5. Create override rules
# Rule 1: Exact match on phone
override1 = {
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
override2 = {
    "rule": {
        "query": "deal",
        "match": "contains"
    },
    "includes": [
        {"id": "p3", "position": 1}
    ]
}

# Rule 3: Dynamic brand filter
override3 = {
    "rule": {
        "query": "{brand} phone",
        "match": "contains"
    },
    "filter_by": "brand:={brand}",
    "remove_matched_tokens": True
}

overrides = {
    "phone-exact": override1,
    "deal-contains": override2,
    "brand-dynamic": override3
}

created_ids = []
for override_id, body in overrides.items():
    req = urllib.request.Request(
        f"{url_prefix}/collections/catalog/overrides/{override_id}",
        data=json.dumps(body).encode(),
        headers=headers,
        method="PUT"
    )
    with urllib.request.urlopen(req) as response:
        print(f"Created override {override_id}:", response.read().decode())
        created_ids.append(override_id)

# 6. Write to setup.log
with open("/home/user/typesense-curation/setup.log", "w") as f:
    for oid in created_ids:
        f.write(f"{oid}\n")
print("Wrote setup.log.")
