import requests
import json
import time
import sys

BASE_URL = "http://localhost:8108"
BOOTSTRAP_KEY = "xyz"

# 1. Wait for Typesense to be healthy
print("Waiting for Typesense server to be healthy...")
for i in range(10):
    try:
        res = requests.get(f"{BASE_URL}/health", timeout=2)
        if res.status_code == 200 and res.json().get("ok") is True:
            print("Typesense is healthy and ready!")
            break
    except Exception as e:
        pass
    time.sleep(1)
else:
    print("Error: Typesense server did not become healthy in time.")
    sys.exit(1)

# Headers for bootstrap key requests
bootstrap_headers = {
    "X-TYPESENSE-API-KEY": BOOTSTRAP_KEY,
    "Content-Type": "application/json"
}

# 2. Create products collection
print("Creating 'products' collection...")
products_schema = {
    "name": "products",
    "fields": [
        {"name": "title", "type": "string"}
    ]
}
res = requests.post(f"{BASE_URL}/collections", headers=bootstrap_headers, json=products_schema)
if res.status_code in (200, 201):
    print("Created 'products' collection successfully.")
else:
    print(f"Failed to create 'products' collection: {res.status_code} - {res.text}")
    sys.exit(1)

# 3. Create orders collection
print("Creating 'orders' collection...")
orders_schema = {
    "name": "orders",
    "fields": [
        {"name": "title", "type": "string"}
    ]
}
res = requests.post(f"{BASE_URL}/collections", headers=bootstrap_headers, json=orders_schema)
if res.status_code in (200, 201):
    print("Created 'orders' collection successfully.")
else:
    print(f"Failed to create 'orders' collection: {res.status_code} - {res.text}")
    sys.exit(1)

# 4. Index a document into products
print("Indexing a document into 'products'...")
product_doc = {"title": "Acme Wireless Mouse", "id": "prod-1"}
res = requests.post(f"{BASE_URL}/collections/products/documents", headers=bootstrap_headers, json=product_doc)
if res.status_code in (200, 201):
    print("Indexed product document successfully.")
else:
    print(f"Failed to index product document: {res.status_code} - {res.text}")
    sys.exit(1)

# 5. Index a document into orders
print("Indexing a document into 'orders'...")
order_doc = {"title": "Acme Wireless Mouse Order", "id": "ord-1"}
res = requests.post(f"{BASE_URL}/collections/orders/documents", headers=bootstrap_headers, json=order_doc)
if res.status_code in (200, 201):
    print("Indexed order document successfully.")
else:
    print(f"Failed to index order document: {res.status_code} - {res.text}")
    sys.exit(1)

# 6. Create fine-grained keys
print("Creating fine-grained keys...")

# Search-only key
search_only_payload = {
    "description": "search-only key",
    "actions": ["documents:search"],
    "collections": ["*"]
}
res = requests.post(f"{BASE_URL}/keys", headers=bootstrap_headers, json=search_only_payload)
if res.status_code == 201:
    search_only_key = res.json()["value"]
    print("Created search-only key successfully.")
else:
    print(f"Failed to create search-only key: {res.status_code} - {res.text}")
    sys.exit(1)

# Documents-write key (products_writer)
products_writer_payload = {
    "description": "documents-write key for products",
    "actions": ["documents:create", "documents:upsert", "documents:import"],
    "collections": ["products"]
}
res = requests.post(f"{BASE_URL}/keys", headers=bootstrap_headers, json=products_writer_payload)
if res.status_code == 201:
    products_writer_key = res.json()["value"]
    print("Created products_writer key successfully.")
else:
    print(f"Failed to create products_writer key: {res.status_code} - {res.text}")
    sys.exit(1)

# Admin key
admin_payload = {
    "description": "admin key for all collections",
    "actions": ["*"],
    "collections": ["*"]
}
res = requests.post(f"{BASE_URL}/keys", headers=bootstrap_headers, json=admin_payload)
if res.status_code == 201:
    admin_key = res.json()["value"]
    print("Created admin key successfully.")
else:
    print(f"Failed to create admin key: {res.status_code} - {res.text}")
    sys.exit(1)

# 7. Write keys to /home/user/typesense-rbac/keys.json
keys_data = {
    "search_only": search_only_key,
    "products_writer": products_writer_key,
    "admin": admin_key
}

keys_file_path = "/home/user/typesense-rbac/keys.json"
with open(keys_file_path, "w") as f:
    json.dump(keys_data, f, indent=2)
print(f"Successfully wrote keys to {keys_file_path}")

# 8. Verification Tests
print("\n=== Running Verification Tests ===")

def test_request(method, endpoint, key, payload=None, params=None):
    headers = {
        "X-TYPESENSE-API-KEY": key,
        "Content-Type": "application/json"
    }
    url = f"{BASE_URL}{endpoint}"
    if method == "GET":
        res = requests.get(url, headers=headers, params=params)
    elif method == "POST":
        res = requests.post(url, headers=headers, json=payload, params=params)
    return res.status_code, res.text

all_tests_passed = True

def assert_status(expected_statuses, actual_status, test_name):
    global all_tests_passed
    if not isinstance(expected_statuses, list):
        expected_statuses = [expected_statuses]
    if actual_status in expected_statuses:
        print(f"[PASS] {test_name} (Status: {actual_status})")
    else:
        print(f"[FAIL] {test_name} (Expected one of {expected_statuses}, got {actual_status})")
        all_tests_passed = False

# Test 1: Search-only key can search products
status, body = test_request("GET", "/collections/products/documents/search", search_only_key, params={"q": "Acme", "query_by": "title"})
assert_status(200, status, "Search-only key can search products")

# Test 2: Search-only key can search orders
status, body = test_request("GET", "/collections/orders/documents/search", search_only_key, params={"q": "Acme", "query_by": "title"})
assert_status(200, status, "Search-only key can search orders")

# Test 3: Search-only key cannot write to products
status, body = test_request("POST", "/collections/products/documents", search_only_key, payload={"title": "Unauthorized Product", "id": "unauth-p"})
assert_status([401, 403], status, "Search-only key cannot write to products")

# Test 4: Search-only key cannot write to orders
status, body = test_request("POST", "/collections/orders/documents", search_only_key, payload={"title": "Unauthorized Order", "id": "unauth-o"})
assert_status([401, 403], status, "Search-only key cannot write to orders")

# Test 5: Products-writer key can write to products (using create/POST)
status, body = test_request("POST", "/collections/products/documents", products_writer_key, payload={"title": "Authorized Product", "id": "auth-p"})
assert_status([200, 201], status, "Products-writer key can write to products")

# Test 6: Products-writer key can upsert to products (using action=upsert or upsert endpoint)
# In Typesense, upserting can be done via POST /collections/products/documents?action=upsert
status, body = test_request("POST", "/collections/products/documents", products_writer_key, payload={"title": "Authorized Product Upserted", "id": "auth-p"}, params={"action": "upsert"})
assert_status([200, 201], status, "Products-writer key can upsert to products")

# Test 7: Products-writer key can import to products (using /import endpoint)
# Import accepts newline-delimited JSON or JSONL format.
import_data = json.dumps({"title": "Imported Product 1", "id": "imp-1"}) + "\n" + json.dumps({"title": "Imported Product 2", "id": "imp-2"})
headers = {
    "X-TYPESENSE-API-KEY": products_writer_key,
    "Content-Type": "text/plain"
}
res = requests.post(f"{BASE_URL}/collections/products/documents/import", headers=headers, data=import_data)
assert_status([200, 201], res.status_code, "Products-writer key can import to products")

# Test 8: Products-writer key cannot write to orders
status, body = test_request("POST", "/collections/orders/documents", products_writer_key, payload={"title": "Unauthorized Product Order", "id": "unauth-po"})
assert_status([401, 403], status, "Products-writer key cannot write to orders")

# Test 9: Products-writer key cannot search products
status, body = test_request("GET", "/collections/products/documents/search", products_writer_key, params={"q": "Acme", "query_by": "title"})
assert_status([401, 403], status, "Products-writer key cannot search products")

# Test 10: Admin key can search products
status, body = test_request("GET", "/collections/products/documents/search", admin_key, params={"q": "Acme", "query_by": "title"})
assert_status(200, status, "Admin key can search products")

# Test 11: Admin key can search orders
status, body = test_request("GET", "/collections/orders/documents/search", admin_key, params={"q": "Acme", "query_by": "title"})
assert_status(200, status, "Admin key can search orders")

# Test 12: Admin key can write to products
status, body = test_request("POST", "/collections/products/documents", admin_key, payload={"title": "Admin Product", "id": "admin-p"})
assert_status([200, 201], status, "Admin key can write to products")

# Test 13: Admin key can write to orders
status, body = test_request("POST", "/collections/orders/documents", admin_key, payload={"title": "Admin Order", "id": "admin-o"})
assert_status([200, 201], status, "Admin key can write to orders")

if all_tests_passed:
    print("\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!")
else:
    print("\nSOME VERIFICATION TESTS FAILED!")
    sys.exit(1)
