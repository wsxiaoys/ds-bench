import os
import json
import typesense

def build_index():
    api_key = os.environ.get('TYPESENSE_API_KEY', 'xyz')
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': api_key,
        'connection_timeout_seconds': 5
    })

    # Delete collection if it already exists
    try:
        client.collections['airports'].delete()
        print("Existing 'airports' collection deleted.")
    except Exception:
        pass

    # Define schema
    schema = {
        'name': 'airports',
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

    print("Creating 'airports' collection...")
    client.collections.create(schema)

    # Read and process documents
    documents = []
    dataset_path = '/home/user/project/data/airports.jsonl'
    with open(dataset_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            doc = json.loads(line)
            # Add geopoint field: [latitude, longitude]
            doc['location'] = [doc['lat'], doc['lng']]
            documents.append(doc)

    print(f"Importing {len(documents)} documents...")
    # Bulk import
    result = client.collections['airports'].documents.import_(documents, {'action': 'create'})
    
    # Typesense import returns newline-delimited JSON or a list of dicts depending on the client/response
    # Let's inspect if there are any import errors
    if isinstance(result, list):
        failed = [r for r in result if not r.get('success', True)]
        if failed:
            print(f"Failed to import some documents: {failed}")
        else:
            print("All documents imported successfully.")
    elif isinstance(result, str):
        # Could be newline-delimited JSON response
        errors = []
        for res_line in result.strip().split('\n'):
            if res_line:
                res_obj = json.loads(res_line)
                if not res_obj.get('success', True):
                    errors.append(res_obj)
        if errors:
            print(f"Failed to import some documents: {errors}")
        else:
            print("All documents imported successfully.")
    else:
        print("Import response:", result)

if __name__ == '__main__':
    build_index()
