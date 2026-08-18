import argparse
import json
import os
import typesense

def main():
    parser = argparse.ArgumentParser(description="Query many-to-many joins in Typesense")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--product', help='Product ID to find users who liked it')
    group.add_argument('--user', help='User ID to find products they liked')
    
    args = parser.parse_args()
    
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': os.getenv('TYPESENSE_API_KEY', 'xyz'),
        'connection_timeout_seconds': 5
    })
    
    results = []
    
    if args.product:
        # We want to find all users who liked this product
        page = 1
        per_page = 250
        while True:
            search_params = {
                'q': '*',
                'filter_by': f'product_id:={args.product}',
                'include_fields': '$users(*)',
                'per_page': per_page,
                'page': page
            }
            try:
                res = client.collections['likes'].documents.search(search_params)
            except Exception:
                # If collection doesn't exist or other error, break and output empty list
                break
            
            hits = res.get('hits', [])
            for hit in hits:
                doc = hit.get('document', {})
                user_obj = doc.get('users')
                if user_obj and 'username' in user_obj:
                    results.append(user_obj['username'])
            
            if len(hits) < per_page or len(results) >= res.get('found', 0):
                break
            page += 1
            
    elif args.user:
        # We want to find all products liked by this user
        page = 1
        per_page = 250
        while True:
            search_params = {
                'q': '*',
                'filter_by': f'user_id:={args.user}',
                'include_fields': '$products(*)',
                'per_page': per_page,
                'page': page
            }
            try:
                res = client.collections['likes'].documents.search(search_params)
            except Exception:
                # If collection doesn't exist or other error, break and output empty list
                break
            
            hits = res.get('hits', [])
            for hit in hits:
                doc = hit.get('document', {})
                prod_obj = doc.get('products')
                if prod_obj and 'product_name' in prod_obj:
                    results.append(prod_obj['product_name'])
            
            if len(hits) < per_page or len(results) >= res.get('found', 0):
                break
            page += 1
            
    # Sort in ascending order and remove duplicates
    unique_sorted_results = sorted(list(set(results)))
    print(json.dumps(unique_sorted_results))

if __name__ == '__main__':
    main()
