import os
import sys
import requests

def main():
    api_key = os.environ.get("TYPESENSE_API_KEY")
    if not api_key:
        print("Error: TYPESENSE_API_KEY environment variable not set.", file=sys.stderr)
        sys.exit(1)

    base_url = "http://localhost:8108"
    headers = {
        "X-TYPESENSE-API-KEY": api_key,
        "Content-Type": "application/json"
    }

    # Step 1: Delete collection if it exists
    print("Deleting 'hubs' collection if it exists...")
    delete_url = f"{base_url}/collections/hubs"
    response = requests.delete(delete_url, headers=headers)
    if response.status_code == 200:
        print("Existing 'hubs' collection deleted.")
    elif response.status_code == 404:
        print("'hubs' collection did not exist. Proceeding...")
    else:
        print(f"Unexpected response when deleting collection: {response.status_code} - {response.text}", file=sys.stderr)
        sys.exit(1)

    # Step 2: Create collection
    schema = {
        "name": "hubs",
        "fields": [
            {"name": "name", "type": "string"},
            {"name": "status", "type": "string", "facet": True},
            {"name": "location", "type": "geopoint"}
        ]
    }
    print("Creating 'hubs' collection...")
    create_url = f"{base_url}/collections"
    response = requests.post(create_url, json=schema, headers=headers)
    if response.status_code != 201:
        print(f"Failed to create collection: {response.status_code} - {response.text}", file=sys.stderr)
        sys.exit(1)
    print("Collection 'hubs' created successfully.")

    # Step 3: Seed data
    hubs_data = [
        {"id": "h01", "name": "Alpha", "status": "active", "location": [37.78, -122.42]},
        {"id": "h02", "name": "Bravo", "status": "active", "location": [37.79, -122.42]},
        {"id": "h03", "name": "Charlie", "status": "active", "location": [37.81, -122.42]},
        {"id": "h04", "name": "Delta", "status": "active", "location": [37.78, -122.46]},
        {"id": "h05", "name": "Echo", "status": "active", "location": [37.78, -122.38]},
        {"id": "h06", "name": "Foxtrot", "status": "active", "location": [37.73, -122.42]},
        {"id": "h07", "name": "Golf", "status": "active", "location": [37.77, -122.432]},
        {"id": "h08", "name": "Hotel", "status": "active", "location": [37.77, -122.438]},
        {"id": "h09", "name": "India", "status": "maintenance", "location": [37.775, -122.42]},
        {"id": "h10", "name": "Juliet", "status": "maintenance", "location": [37.785, -122.415]}
    ]

    print("Seeding hub documents...")
    import_url = f"{base_url}/collections/hubs/documents/import?action=create"
    # Convert list of dicts to JSONL
    jsonl_data = "\n".join(requests.compat.json.dumps(doc) for doc in hubs_data)
    
    # We send text/plain or application/octet-stream for JSONL import in Typesense
    import_headers = headers.copy()
    import_headers["Content-Type"] = "text/plain"
    
    response = requests.post(import_url, data=jsonl_data, headers=import_headers)
    if response.status_code != 200:
        print(f"Failed to seed documents: {response.status_code} - {response.text}", file=sys.stderr)
        sys.exit(1)
    
    print("Seed complete. Verification:")
    # Verify by getting document count
    verify_url = f"{base_url}/collections/hubs"
    verify_response = requests.get(verify_url, headers=headers)
    if verify_response.status_code == 200:
        num_documents = verify_response.json().get("num_documents", 0)
        print(f"Collection 'hubs' contains {num_documents} documents.")
    else:
        print("Failed to verify collection stats.")

if __name__ == "__main__":
    main()
