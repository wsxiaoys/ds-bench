import json
import urllib.request
import urllib.error

# Config
URL_BASE = "http://localhost:8108"
API_KEY = "xyz"
ALIAS_NAME = "products"
NEW_COLLECTION_NAME = "products_v2"

def request(path, method="GET", data=None, headers=None):
    url = f"{URL_BASE}{path}"
    req_headers = {
        "X-TYPESENSE-API-KEY": API_KEY,
        "Content-Type": "application/json"
    }
    if headers:
        req_headers.update(headers)
    
    req_data = None
    if data is not None:
        if isinstance(data, str):
            req_data = data.encode('utf-8')
        else:
            req_data = json.dumps(data).encode('utf-8')
            
    req = urllib.request.Request(url, data=req_data, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return response.status, response.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        print(f"HTTP Error {e.code}: {err_msg}")
        raise e

# 1. Check health
print("Checking Typesense health...")
status, body = request("/health")
health = json.loads(body)
if not health.get("ok"):
    raise RuntimeError("Typesense is not healthy")
print("Typesense is healthy!")

# 2. Get current alias mapping
print(f"Fetching alias '{ALIAS_NAME}'...")
status, body = request(f"/aliases/{ALIAS_NAME}")
alias_info = json.loads(body)
old_collection_name = alias_info["collection_name"]
print(f"Alias '{ALIAS_NAME}' currently points to '{old_collection_name}'")

# 3. Get old collection schema
print(f"Fetching schema for '{old_collection_name}'...")
status, body = request(f"/collections/{old_collection_name}")
old_schema = json.loads(body)

# 4. Construct new schema
# We need to change name to NEW_COLLECTION_NAME and change rating type to float
new_schema = {
    "name": NEW_COLLECTION_NAME,
    "fields": [],
}

if "default_sorting_field" in old_schema:
    new_schema["default_sorting_field"] = old_schema["default_sorting_field"]
if "enable_nested_fields" in old_schema:
    new_schema["enable_nested_fields"] = old_schema["enable_nested_fields"]
if "symbols_to_index" in old_schema:
    new_schema["symbols_to_index"] = old_schema["symbols_to_index"]
if "token_separators" in old_schema:
    new_schema["token_separators"] = old_schema["token_separators"]

for field in old_schema.get("fields", []):
    new_field = dict(field)
    if new_field["name"] == "rating":
        new_field["type"] = "float"
    new_schema["fields"].append(new_field)

print("New collection schema:")
print(json.dumps(new_schema, indent=2))

# 5. Create new collection
print(f"Creating new collection '{NEW_COLLECTION_NAME}'...")
status, body = request("/collections", method="POST", data=new_schema)
print("New collection created successfully!")

# 6. Export documents from old collection
print(f"Exporting documents from '{old_collection_name}'...")
status, export_data = request(f"/collections/{old_collection_name}/documents/export")
# Count documents (one JSON per line)
num_docs = len([line for line in export_data.splitlines() if line.strip()])
print(f"Exported {num_docs} documents.")

# 7. Import documents into new collection
print(f"Importing documents into '{NEW_COLLECTION_NAME}'...")
status, import_response = request(
    f"/collections/{NEW_COLLECTION_NAME}/documents/import?action=create",
    method="POST",
    data=export_data,
    headers={"Content-Type": "text/plain"}
)
print("Import response:")
print(import_response)

# 8. Atomically switch alias
print(f"Switching alias '{ALIAS_NAME}' to point to '{NEW_COLLECTION_NAME}'...")
alias_update_payload = {
    "collection_name": NEW_COLLECTION_NAME
}
status, alias_response = request(f"/aliases/{ALIAS_NAME}", method="PUT", data=alias_update_payload)
print("Alias switched successfully!")

# 9. Verify alias
status, body = request(f"/aliases/{ALIAS_NAME}")
alias_info_new = json.loads(body)
if alias_info_new["collection_name"] != NEW_COLLECTION_NAME:
    raise RuntimeError("Alias was not switched correctly!")
print(f"Alias verified: '{ALIAS_NAME}' -> '{alias_info_new['collection_name']}'")

# 10. Drop old collection
print(f"Dropping old collection '{old_collection_name}'...")
status, drop_response = request(f"/collections/{old_collection_name}", method="DELETE")
print(f"Dropped collection '{old_collection_name}' successfully!")

# 11. Write migration report to log file
log_path = "/home/user/project/migration.log"
print(f"Writing migration report to '{log_path}'...")
with open(log_path, "w") as log_file:
    log_file.write(f"Migrated {num_docs} documents to {NEW_COLLECTION_NAME}\n")
    log_file.write(f"Alias products -> {NEW_COLLECTION_NAME}\n")
print("Migration completed successfully!")
