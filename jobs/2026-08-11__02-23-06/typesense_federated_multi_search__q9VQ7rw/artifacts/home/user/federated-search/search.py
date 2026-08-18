import sys
import os
import json
import argparse
import typesense

def main():
    parser = argparse.ArgumentParser(description="Federated Search CLI using Typesense multi_search")
    parser.add_argument('--query', type=str, required=True, help="Search query string")
    args = parser.parse_args()

    query = args.query

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

    collections = ['products', 'articles', 'users']
    searches = [
        {"collection": "products", "query_by": "product_name"},
        {"collection": "articles", "query_by": "title,body"},
        {"collection": "users", "query_by": "username,full_name"}
    ]

    results = {}

    try:
        # Perform the multi_search
        response = client.multi_search.perform(
            {"searches": searches},
            {"q": query}
        )
        
        response_results = response.get('results', [])
        
        for i, col_name in enumerate(collections):
            if i < len(response_results):
                res_slot = response_results[i]
                if 'error' in res_slot:
                    results[col_name] = {
                        "error": res_slot['error']
                    }
                elif 'code' in res_slot and res_slot.get('code') >= 400:
                    results[col_name] = {
                        "error": res_slot.get('error', f"HTTP error {res_slot.get('code')}")
                    }
                else:
                    hits = [hit['document'] for hit in res_slot.get('hits', [])]
                    results[col_name] = {
                        "found": res_slot.get('found', 0),
                        "hits": hits
                    }
            else:
                results[col_name] = {
                    "error": "No result returned for this collection"
                }

    except Exception as e:
        # If the entire request fails (e.g., Typesense server down or invalid API key),
        # represent all collections with the error entry.
        error_msg = str(e)
        for col_name in collections:
            results[col_name] = {
                "error": error_msg
            }

    output = {
        "query": query,
        "results": results
    }

    # Print a single JSON object to stdout and exit with status code 0
    print(json.dumps(output))
    sys.exit(0)

if __name__ == '__main__':
    main()
