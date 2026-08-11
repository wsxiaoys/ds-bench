import argparse
import json
import typesense

def main():
    parser = argparse.ArgumentParser(description="Query Typesense catalog with conditional ranking.")
    parser.add_argument('--query', required=True, help="Search query string")
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

    search_parameters = {
        'q': args.query,
        'query_by': 'title,description',
        'text_match_type': 'sum_score',
        'sort_by': '_eval([ (badge:=sponsored):2, (badge:=featured):1 ]):desc,_text_match:desc,popularity:desc',
        'per_page': 250
    }

    try:
        results = client.collections['catalog'].documents.search(search_parameters)
        ids = [hit['document']['id'] for hit in results.get('hits', [])]
        print(json.dumps(ids))
    except Exception as e:
        print(json.dumps([]))

if __name__ == '__main__':
    main()
