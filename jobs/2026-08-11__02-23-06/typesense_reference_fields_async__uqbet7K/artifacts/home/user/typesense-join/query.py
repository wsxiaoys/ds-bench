import os
import sys
import json
import argparse
import typesense

def main():
    parser = argparse.ArgumentParser(description="Query social likes graph in Typesense.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--product', help='Get usernames of users who liked this product ID')
    group.add_argument('--user', help='Get product names of products liked by this user ID')
    args = parser.parse_args()

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

    results = set()

    try:
        if args.product:
            # Query users who liked the given product
            search_parameters = {
                'q': '*',
                'filter_by': f'product_id:={args.product}',
                'include_fields': '$users(*)',
                'per_page': 250
            }
            res = client.collections['likes'].documents.search(search_parameters)
            for hit in res.get('hits', []):
                doc = hit.get('document', {})
                user_info = doc.get('users')
                if user_info and isinstance(user_info, dict):
                    username = user_info.get('username')
                    if username:
                        results.add(username)
        elif args.user:
            # Query products liked by the given user
            search_parameters = {
                'q': '*',
                'filter_by': f'user_id:={args.user}',
                'include_fields': '$products(*)',
                'per_page': 250
            }
            res = client.collections['likes'].documents.search(search_parameters)
            for hit in res.get('hits', []):
                doc = hit.get('document', {})
                product_info = doc.get('products')
                if product_info and isinstance(product_info, dict):
                    product_name = product_info.get('product_name')
                    if product_name:
                        results.add(product_name)
    except Exception as e:
        # Print error to stderr and exit with non-zero code or print empty array?
        # The prompt says: "If there are no matches, print an empty JSON array `[]`."
        # Printing empty array on failure or printing error to stderr is safe.
        print(f"Error querying Typesense: {e}", file=sys.stderr)
        print("[]")
        sys.exit(1)

    # Print the sorted list as a JSON array to stdout
    print(json.dumps(sorted(list(results))))

if __name__ == '__main__':
    main()
