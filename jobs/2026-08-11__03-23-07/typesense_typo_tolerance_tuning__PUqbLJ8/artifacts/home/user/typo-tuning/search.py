import sys
import json
import argparse
import typesense

def main():
    parser = argparse.ArgumentParser(description="Typesense search tool")
    parser.add_argument("--q", required=True, help="Search query text")
    args = parser.parse_args()

    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 2
    })

    params = {
        'q': args.q,
        'query_by': 'name,brand',
        'num_typos': '2,0',
        'min_len_1typo': 4,
        'min_len_2typo': 6,
        'drop_tokens_threshold': 1,
        'typo_tokens_threshold': 1,
        'split_join_tokens': 'fallback',
        'prefix': False
    }

    try:
        res = client.collections['catalog'].documents.search(params)
        hits = res.get('hits', [])
        ids = [hit['document']['id'] for hit in hits]
        print(json.dumps(ids))
    except Exception as e:
        # If there's an error, print an empty array or handle gracefully
        print(json.dumps([]))

if __name__ == "__main__":
    main()
