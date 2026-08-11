import json
import sys
import typesense

def main():
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    # Drop collection if it exists
    try:
        client.collections['airports'].delete()
        print("Existing 'airports' collection deleted.")
    except Exception as e:
        # If it doesn't exist, Typesense will raise an ObjectNotFound error
        pass

    # Create the schema
    schema = {
        'name': 'airports',
        'fields': [
            {'name': 'id', 'type': 'string'},
            {'name': 'name', 'type': 'string'},
            {'name': 'iata', 'type': 'string'},
            {'name': 'city', 'type': 'string'},
            {'name': 'country', 'type': 'string'},
            {'name': 'location', 'type': 'geopoint'},
            {'name': 'lat', 'type': 'float'},
            {'name': 'lng', 'type': 'float'}
        ]
    }

    print("Creating 'airports' collection...")
    client.collections.create(schema)
    print("Collection created successfully.")

    # Read and parse dataset
    documents = []
    dataset_path = '/home/user/project/data/airports.jsonl'
    with open(dataset_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            doc = json.loads(line)
            # Ensure lat and lng are floats and create location geopoint [lat, lng]
            lat = float(doc['lat'])
            lng = float(doc['lng'])
            doc['location'] = [lat, lng]
            doc['lat'] = lat
            doc['lng'] = lng
            documents.append(doc)

    print(f"Importing {len(documents)} documents into Typesense...")
    # Bulk import
    res = client.collections['airports'].documents.import_(documents, {'action': 'create'})
    
    # Check if there were any import errors
    # The return value can be a list of dicts (one per doc) or a JSON string depending on SDK/response.
    # Let's inspect the results.
    failed = 0
    if isinstance(res, list):
        for item in res:
            if not item.get('success', True):
                print(f"Failed to import document: {item}", file=sys.stderr)
                failed += 1
    elif isinstance(res, str):
        # The result might be a newline-delimited JSON string
        for line in res.strip().split('\n'):
            if line:
                item = json.loads(line)
                if not item.get('success', True):
                    print(f"Failed to import document: {item}", file=sys.stderr)
                    failed += 1

    if failed > 0:
        print(f"Completed with {failed} errors.", file=sys.stderr)
        sys.exit(1)
    else:
        print("All documents imported successfully.")

if __name__ == '__main__':
    main()
