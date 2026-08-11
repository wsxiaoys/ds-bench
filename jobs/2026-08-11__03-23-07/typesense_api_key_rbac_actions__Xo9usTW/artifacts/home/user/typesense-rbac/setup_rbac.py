import requests
import json
import time

BASE_URL = "http://localhost:8108"
ADMIN_KEY = "xyz"

headers = {
    "X-TYPESENSE-API-KEY": ADMIN_KEY,
    "Content-Type": "application/json"
}

def wait_for_typesense():
    print("Waiting for Typesense to be healthy...")
    for _ in range(10):
        try:
            r = requests.get(f"{BASE_URL}/health", headers=headers)
            if r.status_code == 200 and r.json().get("ok"):
                print("Typesense is healthy!")
                return True
        except Exception as e:
            pass
        time.sleep(1)
    raise RuntimeError("Typesense did not start in time")

def delete_collection_if_exists(name):
    url = f"{BASE_URL}/collections/{name}"
    r = requests.delete(url, headers=headers)
    if r.status_code == 200:
        print(f"Deleted existing collection: {name}")

def create_collection(name):
    url = f"{BASE_URL}/collections"
    schema = {
        "name": name,
        "fields": [
            {"name": "title", "type": "string"}
        ]
    }
    r = requests.post(url, headers=headers, json=schema)
    if r.status_code == 201:
        print(f"Created collection: {name}")
    else:
        print(f"Failed to create collection {name}: {r.status_code} {r.text}")
        r.raise_for_status()

def index_document(collection, document):
    url = f"{BASE_URL}/collections/{collection}/documents"
    r = requests.post(url, headers=headers, json=document)
    if r.status_code == 201:
        print(f"Indexed document into {collection}")
    else:
        print(f"Failed to index document into {collection}: {r.status_code} {r.text}")
        r.raise_for_status()

def create_key(description, actions, collections):
    url = f"{BASE_URL}/keys"
    payload = {
        "description": description,
        "actions": actions,
        "collections": collections
    }
    r = requests.post(url, headers=headers, json=payload)
    if r.status_code == 201:
        data = r.json()
        print(f"Created key: {description}")
        return data["value"]
    else:
        print(f"Failed to create key {description}: {r.status_code} {r.text}")
        r.raise_for_status()

def run():
    wait_for_typesense()

    # Clean up and recreate collections to ensure clean state
    delete_collection_if_exists("products")
    delete_collection_if_exists("orders")

    create_collection("products")
    create_collection("orders")

    index_document("products", {"title": "Sample Product"})
    index_document("orders", {"title": "Sample Order"})

    # Create the keys
    search_only_key = create_key(
        description="Search-only key",
        actions=["documents:search"],
        collections=["*"]
    )

    products_writer_key = create_key(
        description="Documents-write key for products only",
        actions=["documents:create", "documents:upsert", "documents:import"],
        collections=["products"]
    )

    admin_key = create_key(
        description="Admin key",
        actions=["*"],
        collections=["*"]
    )

    keys_data = {
        "search_only": search_only_key,
        "products_writer": products_writer_key,
        "admin": admin_key
    }

    # Write keys to /home/user/typesense-rbac/keys.json
    with open("/home/user/typesense-rbac/keys.json", "w") as f:
        json.dump(keys_data, f, indent=2)
    print("Keys saved to /home/user/typesense-rbac/keys.json")

    # Perform validation tests
    print("\n--- Running RBAC Validation Tests ---")

    test_results = []

    def test_request(method, path, key, payload=None, expected_status=None, description=""):
        test_headers = {
            "X-TYPESENSE-API-KEY": key,
            "Content-Type": "application/json"
        }
        url = f"{BASE_URL}{path}"
        try:
            if method == "GET":
                r = requests.get(url, headers=test_headers)
            elif method == "POST":
                r = requests.post(url, headers=test_headers, json=payload)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = r.status_code in expected_status
            print(f"[{'PASS' if success else 'FAIL'}] {description}")
            print(f"   Request: {method} {path}")
            print(f"   Response status: {r.status_code} (Expected: {expected_status})")
            test_results.append(success)
        except Exception as e:
            print(f"[FAIL] {description} due to exception: {e}")
            test_results.append(False)

    # 1. Test search_only key
    print("\nTesting search_only key:")
    # Can search products
    test_request("GET", "/collections/products/documents/search?q=*", search_only_key, expected_status=[200], description="search_only can search products")
    # Can search orders
    test_request("GET", "/collections/orders/documents/search?q=*", search_only_key, expected_status=[200], description="search_only can search orders")
    # Cannot write to products
    test_request("POST", "/collections/products/documents", search_only_key, payload={"title": "Denied Product"}, expected_status=[401, 403], description="search_only CANNOT write products")
    # Cannot write to orders
    test_request("POST", "/collections/orders/documents", search_only_key, payload={"title": "Denied Order"}, expected_status=[401, 403], description="search_only CANNOT write orders")

    # 2. Test products_writer key
    print("\nTesting products_writer key:")
    # Can write to products
    test_request("POST", "/collections/products/documents", products_writer_key, payload={"title": "Allowed Product"}, expected_status=[201], description="products_writer can write products")
    # Cannot write to orders
    test_request("POST", "/collections/orders/documents", products_writer_key, payload={"title": "Denied Order"}, expected_status=[401, 403], description="products_writer CANNOT write orders")
    # Cannot search products
    test_request("GET", "/collections/products/documents/search?q=*", products_writer_key, expected_status=[401, 403], description="products_writer CANNOT search products")

    # 3. Test admin key
    print("\nTesting admin key:")
    # Can search products
    test_request("GET", "/collections/products/documents/search?q=*", admin_key, expected_status=[200], description="admin can search products")
    # Can write to products
    test_request("POST", "/collections/products/documents", admin_key, payload={"title": "Admin Product"}, expected_status=[201], description="admin can write products")
    # Can search orders
    test_request("GET", "/collections/orders/documents/search?q=*", admin_key, expected_status=[200], description="admin can search orders")
    # Can write to orders
    test_request("POST", "/collections/orders/documents", admin_key, payload={"title": "Admin Order"}, expected_status=[201], description="admin can write orders")

    if all(test_results):
        print("\nAll RBAC tests passed successfully!")
    else:
        print("\nSome RBAC tests failed!")
        exit(1)

if __name__ == "__main__":
    run()
