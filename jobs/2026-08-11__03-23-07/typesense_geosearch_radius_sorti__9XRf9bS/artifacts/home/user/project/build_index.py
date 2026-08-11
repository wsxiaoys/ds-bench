import os
import json
import sys
import typesense

def main():
    api_key = os.environ.get('TYPESENSE_API_KEY', 'xyz')
    
    # Initialize Typesense Client
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': api_key,
        'connection_timeout_seconds': 5
    })
    
    collection_name = 'airports'
    
    # Check if collection exists and delete it to ensure idempotency
    try:
        client.collections[collection_name].delete()
        print(f"Deleted existing collection '{collection_name}'")
    except Exception as e:
        # If it doesn't exist, Typesense will raise an ObjectNotFound exception
        print(f"Collection '{collection_name}' did not exist, or could not be deleted: {e}")
        
    # Define collection schema
    schema = {
        'name': collection_name,
        'fields': [
            {'name': 'id', 'type': 'string'},
            {'name': 'name', 'type': 'string'},
            {'name': 'iata', 'type': 'string'},
            {'name': 'city', 'type': 'string'},
            {'name': 'country', 'type': 'string'},
            {'name': 'lat', 'type': 'float'},
            {'name': 'lng', 'type': 'float'},
            {'name': 'location', 'type': 'geopoint'}
        ]
    }
    
    # Create the collection
    client.collections.create(schema)
    print(f"Created collection '{collection_name}' with schema.")
    
    # Read and parse dataset
    dataset_path = '/home/user/project/data/airports.jsonl'
    documents = []
    with open(dataset_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            
            # Map lat/lng to geopoint location: [latitude, longitude]
            # Ensure types are correct
            lat = float(record['lat'])
            lng = float(record['lng'])
            
            document = {
                'id': str(record['id']),
                'name': str(record['name']),
                'iata': str(record['iata']),
                'city': str(record['city']),
                'country': str(record['country']),
                'lat': lat,
                'lng': lng,
                'location': [lat, lng]
            }
            documents.append(document)
            
    # Bulk import documents
    print(f"Importing {len(documents)} documents into '{collection_name}'...")
    results = client.collections[collection_name].documents.import_(documents)
    
    # Check for any failures in the import results
    failed = 0
    for idx, res in enumerate(results):
        if not res.get('success', False):
            print(f"Failed to import document at index {idx}: {res}", file=sys.stderr)
            failed += 1
            
    if failed > 0:
        print(f"Import finished with {failed} failures.", file=sys.stderr)
        sys.exit(1)
    else:
        print("All documents imported successfully.")

if __name__ == '__main__':
    main()
