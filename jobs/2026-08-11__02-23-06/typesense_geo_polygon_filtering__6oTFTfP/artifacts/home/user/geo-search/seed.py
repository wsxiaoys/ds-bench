import os
import sys
import requests

def seed():
    api_key = os.environ.get("TYPESENSE_API_KEY")
    if not api_key:
        print("Error: TYPESENSE_API_KEY environment variable not set.")
        sys.exit(1)

    headers = {
        "X-TYPESENSE-API-KEY": api_key,
        "Content-Type": "application/json"
    }

    # 1. Delete the collection if it already exists
    print("Deleting 'hubs' collection if it exists...")
    delete_url = "http://localhost:8108/collections/hubs"
    res = requests.delete(delete_url, headers=headers)
    if res.status_code == 200:
        print("Existing 'hubs' collection deleted.")
    elif res.status_code == 404:
        print("Collection 'hubs' does not exist yet.")
    else:
        print(f"Warning: unexpected status code when deleting collection: {res.status_code}")

    # 2. Create the 'hubs' collection
    print("Creating 'hubs' collection...")
    schema = {
        "name": "hubs",
        "fields": [
            {"name": "name", "type": "string"},
            {"name": "status", "type": "string", "facet": True},
            {"name": "location", "type": "geopoint"}
        ]
    }
    create_url = "http://localhost:8108/collections"
    res = requests.post(create_url, headers=headers, json=schema)
    if res.status_code not in (200, 201):
        print(f"Error creating collection: {res.status_code} - {res.text}")
        sys.exit(1)
    print("Collection 'hubs' created successfully.")

    # 3. Seed the dataset
    hubs = [
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

    print("Indexing hub documents...")
    import_url = "http://localhost:8108/collections/hubs/documents"
    for hub in hubs:
        res = requests.post(import_url, headers=headers, json=hub)
        if res.status_code not in (200, 201):
            print(f"Error indexing document {hub['id']}: {res.status_code} - {res.text}")
            sys.exit(1)
        print(f"Indexed {hub['id']} ({hub['name']})")

    print("Seeding completed successfully.")

if __name__ == "__main__":
    seed()
