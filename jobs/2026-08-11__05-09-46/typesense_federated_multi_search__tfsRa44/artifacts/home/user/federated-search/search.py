import argparse
import json
import os
import typesense

def main():
    parser = argparse.ArgumentParser(description="Federated Search with Typesense multi_search")
    parser.add_argument('--query', required=True, help="Query string to search across collections")
    args = parser.parse_args()

    query_str = args.query

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

    collections = ["products", "articles", "users"]
    searches = [
        {"collection": "products", "query_by": "product_name"},
        {"collection": "articles", "query_by": "title,body"},
        {"collection": "users", "query_by": "username,full_name"}
    ]

    results = {}
    try:
        response = client.multi_search.perform(
            {"searches": searches},
            {"q": query_str}
        )
        
        for i, col_name in enumerate(collections):
            res_slot = response["results"][i]
            if "error" in res_slot:
                results[col_name] = {
                    "error": res_slot["error"]
                }
            else:
                hits = [hit["document"] for hit in res_slot.get("hits", [])]
                results[col_name] = {
                    "found": res_slot.get("found", 0),
                    "hits": hits
                }
    except Exception as e:
        error_msg = str(e)
        for col_name in collections:
            results[col_name] = {
                "error": error_msg
            }

    output = {
        "query": query_str,
        "results": results
    }

    print(json.dumps(output, indent=2))

if __name__ == '__main__':
    main()
