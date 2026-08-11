import os
import json
import typesense

def main():
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

    collections_to_create = {
        'products': {
            'name': 'products',
            'fields': [
                {'name': 'product_name', 'type': 'string'},
                {'name': 'category', 'type': 'string'},
                {'name': 'price', 'type': 'float'}
            ]
        },
        'articles': {
            'name': 'articles',
            'fields': [
                {'name': 'title', 'type': 'string'},
                {'name': 'body', 'type': 'string'},
                {'name': 'author', 'type': 'string'}
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

    for name, schema in collections_to_create.items():
        # Delete if exists
        try:
            client.collections[name].delete()
            print(f"Deleted existing collection: {name}")
        except Exception:
            pass

        # Create collection
        client.collections.create(schema)
        print(f"Created collection: {name}")

        # Load data
        file_path = os.path.join(data_dir, f"{name}.jsonl")
        documents = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    documents.append(json.loads(line))

        if documents:
            res = client.collections[name].documents.import_(documents)
            print(f"Imported {len(documents)} documents into {name}: {res}")

if __name__ == '__main__':
    main()
