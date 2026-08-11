#!/usr/bin/env python3
import os
import json
import typesense

def main():
    # Connect to Typesense
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    # Delete collection if it exists to ensure a clean state
    try:
        client.collections['products'].delete()
    except Exception:
        pass

    # Define schema
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

    # Create collection
    client.collections.create(schema)

    # Read and parse products dataset
    script_dir = os.path.dirname(os.path.abspath(__file__))
    dataset_path = os.path.join(script_dir, 'data', 'products.jsonl')

    documents = []
    with open(dataset_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line:
                doc = json.loads(line)
                documents.append(doc)

    # Import documents
    if documents:
        results = client.collections['products'].documents.import_(documents, {'action': 'create'})
        
        # Check for any failures in import
        failed = [res for res in results if not res.get('success', False)]
        if failed:
            print(f"Warning: {len(failed)} documents failed to import.")
            print(failed[:5])
        else:
            print(f"Successfully imported {len(documents)} products.")
    else:
        print("No documents found to import.")

if __name__ == '__main__':
    main()
