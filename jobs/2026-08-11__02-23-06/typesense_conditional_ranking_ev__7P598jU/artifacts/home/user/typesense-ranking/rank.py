import argparse
import json
import sys
import typesense

def query_catalog(query_str):
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    search_parameters = {
        'q': query_str,
        'query_by': 'title,description',
        'sort_by': '_eval([(badge:=sponsored):2, (badge:=featured):1]):desc,_text_match:desc,popularity:desc',
        'text_match_type': 'sum_score',
        'per_page': 100
    }

    try:
        res = client.collections['catalog'].documents.search(search_parameters)
        ids = [hit['document']['id'] for hit in res.get('hits', [])]
        print(json.dumps(ids))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        print(json.dumps([]))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--query', required=True, type=str)
    args = parser.parse_args()
    query_catalog(args.query)
