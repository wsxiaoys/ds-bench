import urllib.request
import urllib.error
import json
import os
import sys

def api_request(method, path, api_key, data=None):
    url = f"http://localhost:8108{path}"
    headers = {
        "X-TYPESENSE-API-KEY": api_key,
    }
    if data is not None:
        headers["Content-Type"] = "application/json"
        req_data = json.dumps(data).encode("utf-8")
    else:
        req_data = None
        
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            body = response.read().decode("utf-8")
            if body:
                try:
                    return status, json.loads(body)
                except Exception:
                    return status, body
            else:
                return status, None
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, body
    except Exception as e:
        return 500, str(e)

def main():
    bootstrap_key = "xyz"
    
    print("--- 1. Cleaning up existing collections & keys if any ---")
    # Clean up collections
    for col in ["products", "orders", "test_collection"]:
        status, res = api_request("DELETE", f"/collections/{col}", bootstrap_key)
        if status == 200:
            print(f"Deleted existing collection: {col}")
            
    # Clean up keys (get all keys and delete them)
    status, res = api_request("GET", "/keys", bootstrap_key)
    if status == 200 and isinstance(res, dict) and "keys" in res:
        for key_info in res["keys"]:
            key_id = key_info["id"]
            api_request("DELETE", f"/keys/{key_id}", bootstrap_key)
            print(f"Deleted existing key ID: {key_id}")

    print("\n--- 2. Creating collections ---")
    # Create products collection
    products_schema = {
        "name": "products",
        "fields": [
            {"name": "title", "type": "string"}
        ]
    }
    status, res = api_request("POST", "/collections", bootstrap_key, products_schema)
    if status != 201:
        print(f"Failed to create products collection: {status}, {res}")
        sys.exit(1)
    print("Created products collection successfully.")

    # Create orders collection
    orders_schema = {
        "name": "orders",
        "fields": [
            {"name": "title", "type": "string"}
        ]
    }
    status, res = api_request("POST", "/collections", bootstrap_key, orders_schema)
    if status != 201:
        print(f"Failed to create orders collection: {status}, {res}")
        sys.exit(1)
    print("Created orders collection successfully.")

    print("\n--- 3. Indexing documents ---")
    # Index product document
    product_doc = {"title": "Premium Leather Wallet"}
    status, res = api_request("POST", "/collections/products/documents", bootstrap_key, product_doc)
    if status != 201:
        print(f"Failed to index product document: {status}, {res}")
        sys.exit(1)
    print("Indexed product document successfully.")

    # Index order document
    order_doc = {"title": "Order #10025"}
    status, res = api_request("POST", "/collections/orders/documents", bootstrap_key, order_doc)
    if status != 201:
        print(f"Failed to index order document: {status}, {res}")
        sys.exit(1)
    print("Indexed order document successfully.")

    print("\n--- 4. Creating fine-grained API Keys ---")
    
    # 4.1 Search-only key
    # May search any collection, but cannot write documents or manage collections/keys.
    search_only_payload = {
        "description": "Search-only key for any collection",
        "actions": ["documents:search"],
        "collections": ["*"]
    }
    status, res = api_request("POST", "/keys", bootstrap_key, search_only_payload)
    if status != 201:
        print(f"Failed to create search-only key: {status}, {res}")
        sys.exit(1)
    search_only_key = res["value"]
    print(f"Created search-only key: {search_only_key}")

    # 4.2 Documents-write key
    # May write documents (create, upsert, and import) into ONLY the products collection,
    # and cannot search and cannot write to any other collection.
    products_writer_payload = {
        "description": "Write-only key for products collection",
        "actions": ["documents:create", "documents:upsert", "documents:import"],
        "collections": ["products"]
    }
    status, res = api_request("POST", "/keys", bootstrap_key, products_writer_payload)
    if status != 201:
        print(f"Failed to create products-writer key: {status}, {res}")
        sys.exit(1)
    products_writer_key = res["value"]
    print(f"Created products-writer key: {products_writer_key}")

    # 4.3 Admin key
    # May perform all operations on all collections.
    admin_payload = {
        "description": "Admin key with full access",
        "actions": ["*"],
        "collections": ["*"]
    }
    status, res = api_request("POST", "/keys", bootstrap_key, admin_payload)
    if status != 201:
        print(f"Failed to create admin key: {status}, {res}")
        sys.exit(1)
    admin_key = res["value"]
    print(f"Created admin key: {admin_key}")

    print("\n--- 5. Saving keys to keys.json ---")
    keys_data = {
        "search_only": search_only_key,
        "products_writer": products_writer_key,
        "admin": admin_key
    }
    keys_path = "/home/user/typesense-rbac/keys.json"
    with open(keys_path, "w") as f:
        json.dump(keys_data, f, indent=2)
    print(f"Saved keys to {keys_path}")

    print("\n--- 6. Running Validation Tests ---")
    failed = False

    # Helper for asserting status codes
    def assert_status(expected_statuses, actual_status, test_name):
        nonlocal failed
        if actual_status in expected_statuses:
            print(f"[PASS] {test_name} (Status: {actual_status})")
        else:
            print(f"[FAIL] {test_name} (Expected: {expected_statuses}, Got: {actual_status})")
            failed = True

    # 6.1 Test search_only key
    print("\nTesting search_only key:")
    # Can search products
    status, res = api_request("GET", "/collections/products/documents/search?q=*&query_by=title", search_only_key)
    assert_status([200], status, "search_only: search products")
    # Can search orders
    status, res = api_request("GET", "/collections/orders/documents/search?q=*&query_by=title", search_only_key)
    assert_status([200], status, "search_only: search orders")
    # Cannot write to products (create)
    status, res = api_request("POST", "/collections/products/documents", search_only_key, {"title": "Prohibited Product"})
    assert_status([401, 403], status, "search_only: write to products (should fail)")
    # Cannot write to orders (create)
    status, res = api_request("POST", "/collections/orders/documents", search_only_key, {"title": "Prohibited Order"})
    assert_status([401, 403], status, "search_only: write to orders (should fail)")
    # Cannot create collection
    status, res = api_request("POST", "/collections", search_only_key, {"name": "test_collection", "fields": [{"name": "title", "type": "string"}]})
    assert_status([401, 403], status, "search_only: create collection (should fail)")

    # 6.2 Test products_writer key
    print("\nTesting products_writer key:")
    # Can write to products (create)
    status, res = api_request("POST", "/collections/products/documents", products_writer_key, {"title": "Writer Product"})
    assert_status([201], status, "products_writer: create document in products")
    # Can write to products (upsert)
    status, res = api_request("POST", "/collections/products/documents?action=upsert", products_writer_key, {"id": "writer-1", "title": "Writer Product Upsert"})
    assert_status([200, 201], status, "products_writer: upsert document in products")
    # Can write to products (import)
    status, res = api_request("POST", "/collections/products/documents/import?action=create", products_writer_key, {"title": "Imported Product"})
    # Note: import endpoint returns 200 OK with success JSONL lines, let's accept 200 or 201
    assert_status([200, 201], status, "products_writer: import document in products")
    
    # Cannot write to orders (create)
    status, res = api_request("POST", "/collections/orders/documents", products_writer_key, {"title": "Prohibited Order"})
    assert_status([401, 403], status, "products_writer: write to orders (should fail)")
    # Cannot search products
    status, res = api_request("GET", "/collections/products/documents/search?q=*&query_by=title", products_writer_key)
    assert_status([401, 403], status, "products_writer: search products (should fail)")
    # Cannot search orders
    status, res = api_request("GET", "/collections/orders/documents/search?q=*&query_by=title", products_writer_key)
    assert_status([401, 403], status, "products_writer: search orders (should fail)")
    # Cannot create collection
    status, res = api_request("POST", "/collections", products_writer_key, {"name": "test_collection", "fields": [{"name": "title", "type": "string"}]})
    assert_status([401, 403], status, "products_writer: create collection (should fail)")

    # 6.3 Test admin key
    print("\nTesting admin key:")
    # Can search products
    status, res = api_request("GET", "/collections/products/documents/search?q=*&query_by=title", admin_key)
    assert_status([200], status, "admin: search products")
    # Can search orders
    status, res = api_request("GET", "/collections/orders/documents/search?q=*&query_by=title", admin_key)
    assert_status([200], status, "admin: search orders")
    # Can write to products
    status, res = api_request("POST", "/collections/products/documents", admin_key, {"title": "Admin Product"})
    assert_status([201], status, "admin: write to products")
    # Can write to orders
    status, res = api_request("POST", "/collections/orders/documents", admin_key, {"title": "Admin Order"})
    assert_status([201], status, "admin: write to orders")
    # Can create collection
    status, res = api_request("POST", "/collections", admin_key, {"name": "test_collection", "fields": [{"name": "title", "type": "string"}]})
    assert_status([201], status, "admin: create collection")
    # Can delete collection
    status, res = api_request("DELETE", "/collections/test_collection", admin_key)
    assert_status([200], status, "admin: delete collection")

    if failed:
        print("\n[RESULT] Some validation tests FAILED!")
        sys.exit(1)
    else:
        print("\n[RESULT] All validation tests PASSED successfully!")

if __name__ == "__main__":
    main()
