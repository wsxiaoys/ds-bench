import argparse
import json
import os
import sys
import typesense

def query_product(client, product_id):
    usernames = set()
    page = 1
    per_page = 250

    while True:
        try:
            search_parameters = {
                'q': '*',
                'filter_by': f'product_id:={product_id}',
                'include_fields': '$users(username)',
                'page': page,
                'per_page': per_page
            }
            res = client.collections['likes'].documents.search(search_parameters)
            hits = res.get('hits', [])
            if not hits:
                break
            
            for hit in hits:
                doc = hit.get('document', {})
                user_info = doc.get('users')
                if user_info and 'username' in user_info:
                    usernames.add(user_info['username'])
            
            # If we received fewer hits than requested, we've retrieved everything
            if len(hits) < per_page:
                break
            page += 1
        except Exception as e:
            # If any exception occurs (e.g. collection doesn't exist), print [] and exit
            break

    result = sorted(list(usernames))
    print(json.dumps(result))

def query_user(client, user_id):
    product_names = set()
    page = 1
    per_page = 250

    while True:
        try:
            search_parameters = {
                'q': '*',
                'filter_by': f'user_id:={user_id}',
                'include_fields': '$products(product_name)',
                'page': page,
                'per_page': per_page
            }
            res = client.collections['likes'].documents.search(search_parameters)
            hits = res.get('hits', [])
            if not hits:
                break
            
            for hit in hits:
                doc = hit.get('document', {})
                product_info = doc.get('products')
                if product_info and 'product_name' in product_info:
                    product_names.add(product_info['product_name'])
            
            # If we received fewer hits than requested, we've retrieved everything
            if len(hits) < per_page:
                break
            page += 1
        except Exception as e:
            # If any exception occurs (e.g. collection doesn't exist), print [] and exit
            break

    result = sorted(list(product_names))
    print(json.dumps(result))

def main():
    parser = argparse.ArgumentParser(description="Query social likes graph in Typesense.")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--product', help="Product ID to get users who liked it.")
    group.add_argument('--user', help="User ID to get products they liked.")

    args = parser.parse_args()

    api_key = os.environ.get('TYPESENSE_API_KEY')
    if not api_key:
        print("Error: TYPESENSE_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': api_key,
        'connection_timeout_seconds': 5
    })

    if args.product:
        query_product(client, args.product)
    elif args.user:
        query_user(client, args.user)

if __name__ == '__main__':
    main()
