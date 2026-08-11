#!/usr/bin/env python3
import urllib.request
import urllib.error
import json
import os
import sys

API_URL = "http://localhost:8108"
API_KEY = "xyz"
HEADERS = {
    "X-TYPESENSE-API-KEY": API_KEY,
    "Content-Type": "application/json"
}

def make_request(url, method='GET', data=None, headers=None):
    if headers is None:
        headers = HEADERS.copy()
    else:
        # Merge HEADERS
        h = HEADERS.copy()
        h.update(headers)
        headers = h
    
    req_data = None
    if data is not None:
        if isinstance(data, str):
            req_data = data.encode('utf-8')
        else:
            req_data = json.dumps(data).encode('utf-8')
            if 'Content-Type' not in headers:
                headers['Content-Type'] = 'application/json'
                
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            resp_data = response.read().decode('utf-8')
            return status, resp_data
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        print(f"HTTP Error: {e.code} - {err_msg}", file=sys.stderr)
        raise Exception(f"HTTP {e.code}: {err_msg}")

def main():
    print("Checking Typesense health...")
    try:
        status, health_resp = make_request(f"{API_URL}/health")
        health = json.loads(health_resp)
        if not health.get("ok"):
            print("Typesense health check failed", file=sys.stderr)
            sys.exit(1)
        print("Typesense is healthy!")
    except Exception as e:
        print(f"Failed to connect to Typesense: {e}", file=sys.stderr)
        sys.exit(1)

    # 1. Resolve current physical collection behind alias
    print("Resolving alias 'products'...")
    try:
        status, alias_resp = make_request(f"{API_URL}/aliases/products")
        alias_data = json.loads(alias_resp)
        old_collection = alias_data["collection_name"]
        print(f"Alias 'products' currently points to: {old_collection}")
    except Exception as e:
        print(f"Failed to resolve alias 'products': {e}", file=sys.stderr)
        sys.exit(1)

    # Define new collection name
    new_collection = "products_v2"
    if old_collection == new_collection:
        # Just in case, if it already points to v2, we might want to migrate to v3
        new_collection = "products_v3"

    print(f"New collection name will be: {new_collection}")

    # Clean up new collection if it already exists (for clean retryability)
    try:
        print(f"Checking if {new_collection} exists and deleting it for a clean slate...")
        make_request(f"{API_URL}/collections/{new_collection}", method='DELETE')
        print(f"Deleted existing collection {new_collection}")
    except Exception:
        # Ignore if it doesn't exist
        print(f"Collection {new_collection} does not exist or could not be deleted (this is expected for fresh runs)")

    # 2. Fetch schema of old collection
    print(f"Fetching schema for {old_collection}...")
    try:
        status, schema_resp = make_request(f"{API_URL}/collections/{old_collection}")
        schema = json.loads(schema_resp)
    except Exception as e:
        print(f"Failed to fetch schema for {old_collection}: {e}", file=sys.stderr)
        sys.exit(1)

    # 3. Create the new schema payload
    new_schema = {
        "name": new_collection,
        "fields": [],
        "default_sorting_field": schema.get("default_sorting_field"),
        "enable_nested_fields": schema.get("enable_nested_fields", False),
        "symbols_to_index": schema.get("symbols_to_index", []),
        "token_separators": schema.get("token_separators", [])
    }

    for field in schema.get("fields", []):
        new_field = field.copy()
        if field["name"] == "rating":
            new_field["type"] = "float"
            print(f"Changing rating field type from {field['type']} to float")
        new_schema["fields"].append(new_field)

    # 4. Create the new collection
    print(f"Creating new collection {new_collection}...")
    try:
        status, create_resp = make_request(f"{API_URL}/collections", method='POST', data=new_schema)
        print(f"Successfully created collection {new_collection}!")
    except Exception as e:
        print(f"Failed to create collection {new_collection}: {e}", file=sys.stderr)
        sys.exit(1)

    # 5. Export documents from old collection
    print(f"Exporting documents from {old_collection}...")
    try:
        status, export_resp = make_request(f"{API_URL}/collections/{old_collection}/documents/export")
    except Exception as e:
        print(f"Failed to export documents from {old_collection}: {e}", file=sys.stderr)
        sys.exit(1)

    # 6. Parse, coerce 'rating' to float, and prepare import payload
    lines = export_resp.strip().split('\n')
    documents = []
    for line in lines:
        if not line.strip():
            continue
        doc = json.loads(line)
        if "rating" in doc:
            doc["rating"] = float(doc["rating"])
        documents.append(doc)

    num_documents = len(documents)
    print(f"Exported {num_documents} documents.")

    # Convert back to JSONL for bulk import
    import_payload = "\n".join(json.dumps(doc) for doc in documents)

    # 7. Import documents to new collection
    print(f"Importing {num_documents} documents to {new_collection}...")
    try:
        status, import_resp = make_request(
            f"{API_URL}/collections/{new_collection}/documents/import?action=create",
            method='POST',
            data=import_payload,
            headers={"Content-Type": "text/plain"}
        )
        # Verify import success
        import_results = import_resp.strip().split('\n')
        success_count = 0
        for res_line in import_results:
            if not res_line.strip():
                continue
            res = json.loads(res_line)
            if res.get("success", False):
                success_count += 1
            else:
                print(f"Warning: Document import failed: {res}", file=sys.stderr)
        
        print(f"Successfully imported {success_count}/{num_documents} documents.")
        if success_count != num_documents:
            print("Error: Some documents failed to import!", file=sys.stderr)
            sys.exit(1)
    except Exception as e:
        print(f"Failed to import documents to {new_collection}: {e}", file=sys.stderr)
        sys.exit(1)

    # 8. Switch the alias atomically
    print(f"Switching alias 'products' to point to {new_collection}...")
    try:
        alias_update_payload = {"collection_name": new_collection}
        status, alias_update_resp = make_request(
            f"{API_URL}/aliases/products",
            method='PUT',
            data=alias_update_payload
        )
        print("Successfully updated alias!")
    except Exception as e:
        print(f"Failed to update alias: {e}", file=sys.stderr)
        sys.exit(1)

    # Verify alias update
    try:
        status, alias_verify_resp = make_request(f"{API_URL}/aliases/products")
        alias_verify_data = json.loads(alias_verify_resp)
        current_target = alias_verify_data["collection_name"]
        if current_target != new_collection:
            print(f"Error: Alias update verification failed. Points to {current_target} instead of {new_collection}", file=sys.stderr)
            sys.exit(1)
        print(f"Verified: Alias 'products' points to {new_collection}")
    except Exception as e:
        print(f"Failed to verify alias: {e}", file=sys.stderr)
        sys.exit(1)

    # 9. Drop the old collection
    print(f"Dropping old collection {old_collection}...")
    try:
        make_request(f"{API_URL}/collections/{old_collection}", method='DELETE')
        print(f"Successfully deleted {old_collection}!")
    except Exception as e:
        print(f"Failed to delete old collection {old_collection}: {e}", file=sys.stderr)
        sys.exit(1)

    # 10. Write migration log
    log_path = "/home/user/project/migration.log"
    print(f"Writing migration log to {log_path}...")
    try:
        with open(log_path, "w") as log_file:
            log_file.write(f"Migrated {num_documents} documents to {new_collection}\n")
            log_file.write(f"Alias products -> {new_collection}\n")
        print("Migration complete and logged successfully!")
    except Exception as e:
        print(f"Failed to write migration log: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
