import requests
import json
import os

TYPESENSE_URL = "http://localhost:8108"
HEADERS = {
    "X-TYPESENSE-API-KEY": "xyz",
    "Content-Type": "application/json"
}

def delete_collection():
    url = f"{TYPESENSE_URL}/collections/nested_orders"
    response = requests.delete(url, headers=HEADERS)
    print("Delete collection status:", response.status_code)
    if response.status_code == 200:
        print("Collection deleted successfully.")
    else:
        print("Collection did not exist or delete failed:", response.text)

def create_collection():
    url = f"{TYPESENSE_URL}/collections"
    schema = {
        "name": "nested_orders",
        "enable_nested_fields": True,
        "fields": [
            {"name": "orders", "type": "object[]"},
            {"name": "orders.line_items", "type": "object[]"},
            {"name": "orders.line_items.name", "type": "string[]"},
            {"name": "orders.line_items.category", "type": "string[]", "facet": True},
            {"name": "orders.line_items.attributes", "type": "object[]"},
            {"name": "orders.line_items.attributes.color", "type": "string[]"}
        ]
    }
    response = requests.post(url, headers=HEADERS, json=schema)
    print("Create collection status:", response.status_code)
    if response.status_code == 201:
        print("Collection created successfully.")
    else:
        print("Failed to create collection:", response.text)

def import_documents():
    file_path = "/home/user/nested-search/data/orders.jsonl"
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return
    
    with open(file_path, "r") as f:
        jsonl_data = f.read()
    
    url = f"{TYPESENSE_URL}/collections/nested_orders/documents/import?action=upsert"
    # Note: import endpoint expects text/plain or application/json for JSONL data
    import_headers = {
        "X-TYPESENSE-API-KEY": "xyz",
        "Content-Type": "text/plain"
    }
    response = requests.post(url, headers=import_headers, data=jsonl_data)
    print("Import status:", response.status_code)
    print("Import response:")
    print(response.text)

if __name__ == "__main__":
    delete_collection()
    create_collection()
    import_documents()
