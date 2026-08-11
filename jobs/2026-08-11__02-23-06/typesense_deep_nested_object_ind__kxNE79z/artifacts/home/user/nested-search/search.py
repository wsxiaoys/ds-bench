#!/usr/bin/env python3
import argparse
import json
import os
import sys
import typesense

def main():
    parser = argparse.ArgumentParser(description="Query nested orders in Typesense.")
    parser.add_argument("--keyword", required=True, help="Keyword to search in product names")
    parser.add_argument("--color", required=True, help="Color to filter by")
    args = parser.parse_args()

    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    # Ensure collection exists and is populated
    collection_name = 'nested_orders'
    dataset_path = '/home/user/nested-search/data/orders.jsonl'

    try:
        # Check if collection exists
        client.collections[collection_name].retrieve()
    except Exception:
        # Create collection
        schema = {
            'name': collection_name,
            'enable_nested_fields': True,
            'fields': [
                {'name': 'orders.line_items.name', 'type': 'string[]'},
                {'name': 'orders.line_items.category', 'type': 'string[]', 'facet': True},
                {'name': 'orders.line_items.attributes.color', 'type': 'string[]', 'facet': True}
            ]
        }
        try:
            client.collections.create(schema)
        except Exception as e:
            # If it failed because it was created concurrently, ignore
            pass

    # Check if there are documents in the collection, if not, index them
    try:
        coll_info = client.collections[collection_name].retrieve()
        if coll_info.get('num_documents', 0) == 0:
            # Read and index
            if os.path.exists(dataset_path):
                docs = []
                with open(dataset_path, 'r') as f:
                    for line in f:
                        if line.strip():
                            docs.append(json.loads(line.strip()))
                if docs:
                    client.collections[collection_name].documents.import_(docs, {'action': 'upsert'})
    except Exception as e:
        # If anything goes wrong with indexing, we can log to stderr, but we must keep stdout clean
        print(f"Error during initialization: {e}", file=sys.stderr)

    # Perform search
    search_parameters = {
        'q': args.keyword,
        'query_by': 'orders.line_items.name',
        'filter_by': f'orders.line_items.attributes.color:={args.color}',
        'facet_by': 'orders.line_items.category',
        'per_page': 250  # Ensure we get all matches if dataset is larger
    }

    try:
        res = client.collections[collection_name].documents.search(search_parameters)
        
        # Extract matched customer IDs sorted in ascending lexicographic order
        matched_ids = sorted([hit['document']['id'] for hit in res.get('hits', [])])
        
        # Extract facet counts
        category_facet_counts = {}
        for facet in res.get('facet_counts', []):
            if facet['field_name'] == 'orders.line_items.category':
                for count in facet['counts']:
                    category_facet_counts[count['value']] = count['count']

        output = {
            "matched_customer_ids": matched_ids,
            "category_facet_counts": category_facet_counts
        }
        
        # Print exactly one JSON object to stdout
        print(json.dumps(output))

    except Exception as e:
        print(f"Error searching: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
