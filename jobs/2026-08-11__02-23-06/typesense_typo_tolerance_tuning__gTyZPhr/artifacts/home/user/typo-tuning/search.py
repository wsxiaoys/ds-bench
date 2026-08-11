import sys
import json
import argparse
import typesense

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--q', required=True, help='Query text')
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

    search_parameters = {
        'q': args.q,
        'query_by': 'name,brand',
        'num_typos': '2,0',
        'min_len_1typo': 4,
        'min_len_2typo': 6,
        'drop_tokens_threshold': 1,
        'typo_tokens_threshold': 1,
        'split_join_tokens': 'always',
        'prefix': 'false',
        'drop_tokens_mode': 'both_sides:3'
    }

    try:
        res = client.collections['catalog'].documents.search(search_parameters)
        ids = [doc['document']['id'] for doc in res.get('hits', [])]
        print(json.dumps(ids))
    except Exception as e:
        print(json.dumps([]))

if __name__ == '__main__':
    main()
