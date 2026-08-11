import requests
import json
import sys

TYPESENSE_URL = "http://localhost:8108"
HEADERS = {
    "X-TYPESENSE-API-KEY": "xyz",
    "Content-Type": "application/json"
}

def setup_collection():
    # 1. Delete collection if exists
    print("Checking if collection 'catalog' exists...")
    r = requests.get(f"{TYPESENSE_URL}/collections/catalog", headers=HEADERS)
    if r.status_code == 200:
        print("Deleting existing collection 'catalog'...")
        del_r = requests.delete(f"{TYPESENSE_URL}/collections/catalog", headers=HEADERS)
        if del_r.status_code != 200:
            print(f"Failed to delete collection: {del_r.text}")
            sys.exit(1)
        print("Collection deleted successfully.")

    # 2. Create collection
    schema = {
        "name": "catalog",
        "fields": [
            {"name": "title", "type": "string"},
            {"name": "description", "type": "string"},
            {"name": "badge", "type": "string", "facet": True},
            {"name": "popularity", "type": "int32"}
        ]
    }
    
    print("Creating collection 'catalog'...")
    r = requests.post(f"{TYPESENSE_URL}/collections", headers=HEADERS, json=schema)
    if r.status_code != 201:
        print(f"Failed to create collection: {r.text}")
        sys.exit(1)
    print("Collection created successfully.")

    # 3. Index documents
    documents = [
        {"id": "P1", "title": "Alpine Trek Boots", "description": "Alpine Trek ready footwear", "badge": "featured", "popularity": 10},
        {"id": "P2", "title": "Alpine Trek Jacket", "description": "Alpine Trek insulated layer", "badge": "featured", "popularity": 80},
        {"id": "P3", "title": "Alpine Trek Poles", "description": "Summit carbon poles", "badge": "sponsored", "popularity": 5},
        {"id": "P4", "title": "Alpine Trek Tent", "description": "Alpine Trek shelter system", "badge": "none", "popularity": 99},
        {"id": "P5", "title": "Alpine Trek Gloves", "description": "Summit winter gloves", "badge": "sponsored", "popularity": 40},
        {"id": "P6", "title": "Alpine Trek Socks", "description": "Merino wool socks", "badge": "featured", "popularity": 100}
    ]

    print("Indexing documents...")
    for doc in documents:
        r = requests.post(f"{TYPESENSE_URL}/collections/catalog/documents", headers=HEADERS, json=doc)
        if r.status_code not in (200, 201):
            print(f"Failed to index document {doc['id']}: {r.text}")
            sys.exit(1)
        print(f"Indexed document {doc['id']}")

    print("Setup completed successfully.")

if __name__ == "__main__":
    setup_collection()
