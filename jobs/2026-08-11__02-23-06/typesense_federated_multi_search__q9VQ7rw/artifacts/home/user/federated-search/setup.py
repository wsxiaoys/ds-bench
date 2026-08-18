import os
import json
import typesense

def setup():
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

    collections_schema = {
        'products': {
            'name': 'products',
            'fields': [
                {'name': 'product_name', 'type': 'string'},
                {'name': 'category', 'type': 'string', 'facet': True},
                {'name': 'price', 'type': 'float'}
            ]
        },
        'articles': {
            'name': 'articles',
            'fields': [
                {'name': 'title', 'type': 'string'},
                {'name': 'body', 'type': 'string'},
                {'name': 'author', 'type': 'string', 'facet': True}
            ]
        },
        'users': {
            'name': 'users',
            'fields': [
                {'name': 'username', 'type': 'string'},
                {'name': 'full_name', 'type': 'string'},
                {'name': 'bio', 'type': 'string'}
            ]
        }
    }

    data_dir = '/home/user/federated-search/data'

    for name, schema in collections_schema.items():
        # Delete collection if it exists
        try:
            client.collections[name].delete()
            print(f"Deleted existing collection: {name}")
        except Exception as e:
            # Collection might not exist, which is fine
            pass

        # Create collection
        client.collections.create(schema)
        print(f"Created collection: {name}")

        # Read JSONL file and import documents
        file_path = os.path.join(data_dir, f"{name}.jsonl")
        documents = []
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line:
                        documents.append(json.loads(line))
            
            if documents:
                import_results = client.collections[name].documents.import_(documents, {'action': 'create'})
                print(f"Imported {len(documents)} documents into {name}")
                # Print any errors in import
                for res in import_results:
                    if not res.get('success', True):
                        print(f"Error importing document: {res}")
        else:
            print(f"Data file not found: {file_path}")

if __name__ == '__main__':
    setup()
