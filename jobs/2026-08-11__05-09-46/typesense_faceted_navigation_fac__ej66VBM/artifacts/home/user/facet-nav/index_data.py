#!/usr/bin/env python3
import os
import json
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

    # Delete collection if it exists
    try:
        client.collections['products'].delete()
        print("Deleted existing 'products' collection.")
    except Exception as e:
        print("No existing 'products' collection to delete or error:", e)

    # Create schema
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

    client.collections.create(schema)
    print("Created 'products' collection.")

    # Get current script directory and read products
    script_dir = os.path.dirname(os.path.abspath(__file__))
    jsonl_path = os.path.join(script_dir, 'data', 'products.jsonl')

    import_data = []
    with open(jsonl_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                import_data.append(json.loads(line))

    # Bulk import
    print(f"Importing {len(import_data)} documents...")
    res = client.collections['products'].documents.import_(import_data, {'action': 'upsert'})
    # Check if there are import errors
    if isinstance(res, list):
        failed = [item for item in res if not item.get('success', True)]
        if failed:
            print(f"Failed to import {len(failed)} documents!")
            print(failed[:5])
        else:
            print("Successfully imported all documents.")
    else:
        print("Import result:", res)

if __name__ == '__main__':
    main()
