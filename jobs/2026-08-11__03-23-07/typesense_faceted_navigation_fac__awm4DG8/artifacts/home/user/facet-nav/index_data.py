#!/usr/bin/env python3
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

    # Recreate the collection
    try:
        client.collections['products'].delete()
        print("Deleted existing 'products' collection.")
    except Exception as e:
        print(f"No existing collection to delete or error deleting: {e}")

    schema = {
        'name': 'products',
        'fields': [
            {'name': 'product_name', 'type': 'string'},
            {'name': 'brand', 'type': 'string', 'facet': True},
            {'name': 'category', 'type': 'string', 'facet': True},
            {'name': 'tags', 'type': 'string[]', 'facet': True},
            {'name': 'price', 'type': 'float', 'facet': True},
            {'name': 'rating', 'type': 'float'}
        ]
    }

    print("Creating 'products' collection...")
    client.collections.create(schema)
    print("Collection created successfully.")

    documents = []
    with open('/home/user/facet-nav/data/products.jsonl', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                doc = json.loads(line)
                if 'price' in doc:
                    doc['price'] = float(doc['price'])
                if 'rating' in doc:
                    doc['rating'] = float(doc['rating'])
                documents.append(doc)

    print(f"Importing {len(documents)} documents...")
    import_results = client.collections['products'].documents.import_(documents, {'action': 'upsert'})
    
    # Check if there were any errors in the import
    failed_imports = [res for res in import_results if not res.get('success', True)]
    if failed_imports:
        print(f"Error: {len(failed_imports)} documents failed to import!")
        for res in failed_imports[:5]:
            print(res)
        sys.exit(1)
    else:
        print("All documents imported successfully.")

if __name__ == '__main__':
    main()
