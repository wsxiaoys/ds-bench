import json
import requests

def main():
    base_url = "http://localhost:8108"
    headers = {
        "X-TYPESENSE-API-KEY": "xyz",
        "Content-Type": "application/json"
    }

    print("Checking Typesense server health...")
    health_resp = requests.get(f"{base_url}/health")
    health_resp.raise_for_status()
    print("Health check response:", health_resp.json())

    # 1. Fetch current alias products to find the source collection
    print("Fetching aliases...")
    alias_resp = requests.get(f"{base_url}/aliases", headers=headers)
    alias_resp.raise_for_status()
    aliases = alias_resp.json().get("aliases", [])
    
    source_collection = None
    for alias in aliases:
        if alias["name"] == "products":
            source_collection = alias["collection_name"]
            break
            
    if not source_collection:
        print("Alias 'products' not found. Defaulting source collection to 'products_v1'.")
        source_collection = "products_v1"
    else:
        print(f"Alias 'products' currently points to: {source_collection}")

    # 2. Fetch source collection schema
    print(f"Fetching schema for {source_collection}...")
    col_resp = requests.get(f"{base_url}/collections/{source_collection}", headers=headers)
    col_resp.raise_for_status()
    source_schema = col_resp.json()
    print("Source schema:")
    print(json.dumps(source_schema, indent=2))

    # 3. Create new collection name
    # If source is products_v1, new is products_v2. Otherwise append _v2 or increment
    if source_collection.endswith("_v1"):
        new_collection = source_collection[:-3] + "_v2"
    else:
        new_collection = f"{source_collection}_v2"
    print(f"New collection name will be: {new_collection}")

    # 4. Construct new schema with rating field typed as float
    new_fields = []
    for field in source_schema.get("fields", []):
        new_field = dict(field)
        if new_field["name"] == "rating":
            new_field["type"] = "float"
        new_fields.append(new_field)

    new_schema = {
        "name": new_collection,
        "fields": new_fields,
        "default_sorting_field": source_schema.get("default_sorting_field"),
        "enable_nested_fields": source_schema.get("enable_nested_fields", False),
        "symbols_to_index": source_schema.get("symbols_to_index", []),
        "token_separators": source_schema.get("token_separators", [])
    }
    
    print("New schema:")
    print(json.dumps(new_schema, indent=2))

    # 5. Create the new collection
    print(f"Creating new collection {new_collection}...")
    create_resp = requests.post(f"{base_url}/collections", headers=headers, json=new_schema)
    create_resp.raise_for_status()
    print("Collection created successfully.")

    # 6. Export documents from source collection
    print(f"Exporting documents from {source_collection}...")
    # Use headers without Content-Type application/json for export if needed, but requests handles it
    export_headers = {"X-TYPESENSE-API-KEY": "xyz"}
    export_resp = requests.get(f"{base_url}/collections/{source_collection}/documents/export", headers=export_headers)
    export_resp.raise_for_status()
    
    raw_lines = export_resp.text.strip().split("\n")
    documents = []
    for line in raw_lines:
        if line.strip():
            doc = json.loads(line)
            # Carry over rating and coerce to float
            if "rating" in doc:
                doc["rating"] = float(doc["rating"])
            documents.append(doc)

    print(f"Exported {len(documents)} documents.")

    # 7. Import documents into the new collection
    print(f"Importing {len(documents)} documents into {new_collection}...")
    import_lines = "\n".join(json.dumps(doc) for doc in documents)
    
    import_headers = {
        "X-TYPESENSE-API-KEY": "xyz",
        "Content-Type": "text/plain"
    }
    import_resp = requests.post(
        f"{base_url}/collections/{new_collection}/documents/import?action=create",
        headers=import_headers,
        data=import_lines
    )
    import_resp.raise_for_status()
    
    # Parse import results
    import_results = import_resp.text.strip().split("\n")
    success_count = 0
    for res_line in import_results:
        if res_line.strip():
            res = json.loads(res_line)
            if res.get("success", True):
                success_count += 1
            else:
                print(f"Failed to import document: {res}")
                
    print(f"Successfully imported {success_count} / {len(documents)} documents.")
    if success_count != len(documents):
        raise Exception("Some documents failed to import!")

    # 8. Atomically switch the alias
    print(f"Switching alias 'products' to point to {new_collection}...")
    alias_payload = {
        "collection_name": new_collection
    }
    alias_update_resp = requests.put(
        f"{base_url}/aliases/products",
        headers=headers,
        json=alias_payload
    )
    alias_update_resp.raise_for_status()
    print("Alias switched successfully.")

    # 9. Drop the old collection
    print(f"Dropping old collection {source_collection}...")
    delete_resp = requests.delete(f"{base_url}/collections/{source_collection}", headers=headers)
    delete_resp.raise_for_status()
    print(f"Dropped old collection {source_collection} successfully.")

    # 10. Write migration log
    log_file_path = "/home/user/project/migration.log"
    print(f"Writing migration report to {log_file_path}...")
    with open(log_file_path, "w") as log_file:
        log_file.write(f"Migrated {success_count} documents to {new_collection}\n")
        log_file.write(f"Alias products -> {new_collection}\n")
    
    print("Migration completed successfully!")

if __name__ == "__main__":
    main()
