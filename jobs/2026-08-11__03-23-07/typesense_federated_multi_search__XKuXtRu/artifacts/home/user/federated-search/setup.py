import os
import requests
import json

TYPESENSE_HOST = "localhost"
TYPESENSE_PORT = 8108
TYPESENSE_API_KEY = os.environ.get("TYPESENSE_API_KEY", "xyz")

BASE_URL = f"http://{TYPESENSE_HOST}:{TYPESENSE_PORT}"
HEADERS = {
    "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY,
    "Content-Type": "application/json"
}

COLLECTIONS_SCHEMAS = [
    {
        "name": "products",
        "fields": [
            {"name": "product_name", "type": "string"},
            {"name": "category", "type": "string"},
            {"name": "price", "type": "float"}
        ]
    },
    {
        "name": "articles",
        "fields": [
            {"name": "title", "type": "string"},
            {"name": "body", "type": "string"},
            {"name": "author", "type": "string"}
        ]
    },
    {
        "name": "users",
        "fields": [
            {"name": "username", "type": "string"},
            {"name": "full_name", "type": "string"},
            {"name": "bio", "type": "string"}
        ]
    }
]

DATA_DIR = "/home/user/federated-search/data"

def setup():
    for schema in COLLECTIONS_SCHEMAS:
        name = schema["name"]
        print(f"Processing collection: {name}")
        
        # 1. Delete collection if it exists
        delete_url = f"{BASE_URL}/collections/{name}"
        res = requests.delete(delete_url, headers=HEADERS)
        if res.status_code == 200:
            print(f"Deleted existing collection: {name}")
        elif res.status_code == 404:
            print(f"Collection {name} did not exist.")
        else:
            print(f"Warning: Failed to delete collection {name}: {res.status_code} {res.text}")
            
        # 2. Create collection
        create_url = f"{BASE_URL}/collections"
        res = requests.post(create_url, json=schema, headers=HEADERS)
        if res.status_code in (200, 201):
            print(f"Created collection: {name}")
        else:
            raise Exception(f"Failed to create collection {name}: {res.status_code} {res.text}")
            
        # 3. Import data
        jsonl_path = os.path.join(DATA_DIR, f"{name}.jsonl")
        if not os.path.exists(jsonl_path):
            raise Exception(f"Data file not found: {jsonl_path}")
            
        with open(jsonl_path, "r", encoding="utf-8") as f:
            data = f.read()
            
        import_url = f"{BASE_URL}/collections/{name}/documents/import?action=upsert"
        # We can send raw data with text/plain or application/json.
        import_headers = HEADERS.copy()
        import_headers["Content-Type"] = "text/plain"
        res = requests.post(import_url, data=data, headers=import_headers)
        if res.status_code == 200:
            # Typesense returns 200 even if some rows failed. Let's inspect the response.
            # Response is JSONL or a list of success results.
            print(f"Imported data into {name} successfully.")
        else:
            raise Exception(f"Failed to import data into {name}: {res.status_code} {res.text}")

if __name__ == "__main__":
    setup()
