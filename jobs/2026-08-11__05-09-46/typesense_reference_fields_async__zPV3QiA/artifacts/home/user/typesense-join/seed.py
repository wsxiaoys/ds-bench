import typesense
import os
import json
import time

def main():
    # Initialize Typesense client
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': os.environ.get('TYPESENSE_API_KEY', 'xyz'),
        'connection_timeout_seconds': 5
    })

    # 1. Delete existing collections if they exist to start fresh
    for col in ['likes', 'users', 'products']:
        try:
            client.collections[col].delete()
            print(f"Deleted existing collection: {col}")
        except Exception:
            pass

    # 2. Define schemas
    users_schema = {
        'name': 'users',
        'fields': [
            {'name': 'username', 'type': 'string'}
        ]
    }

    products_schema = {
        'name': 'products',
        'fields': [
            {'name': 'product_name', 'type': 'string'}
        ]
    }

    likes_schema = {
        'name': 'likes',
        'fields': [
            {
                'name': 'user_id',
                'type': 'string',
                'reference': 'users.id',
                'async_reference': True
            },
            {
                'name': 'product_id',
                'type': 'string',
                'reference': 'products.id',
                'async_reference': True
            }
        ]
    }

    # Create collections
    client.collections.create(users_schema)
    client.collections.create(products_schema)
    client.collections.create(likes_schema)
    print("Created collections: users, products, likes.")

    # 3. Seed: Index at least one likes document BEFORE the user and the product it references
    like_1 = {
        'id': 'like_1',
        'user_id': 'user_1',
        'product_id': 'product_1'
    }
    like_2 = {
        'id': 'like_2',
        'user_id': 'user_2',
        'product_id': 'product_1'
    }

    print("Indexing likes BEFORE the referenced users and products exist...")
    client.collections['likes'].documents.create(like_1)
    client.collections['likes'].documents.create(like_2)
    print("Successfully indexed like_1 and like_2 with unresolved references.")

    # 4. Index those users/products afterwards
    users_to_index = [
        {'id': 'user_1', 'username': 'alice'},
        {'id': 'user_2', 'username': 'bob'},
        {'id': 'user_3', 'username': 'charlie'},
        {'id': 'user_4', 'username': 'david'}
    ]

    products_to_index = [
        {'id': 'product_1', 'product_name': 'laptop'},
        {'id': 'product_2', 'product_name': 'phone'},
        {'id': 'product_3', 'product_name': 'tablet'}
    ]

    print("Indexing users and products now...")
    for user in users_to_index:
        client.collections['users'].documents.create(user)
    for product in products_to_index:
        client.collections['products'].documents.create(product)
    print("Successfully indexed users and products.")

    # Index remaining likes
    remaining_likes = [
        {'id': 'like_3', 'user_id': 'user_1', 'product_id': 'product_2'},
        {'id': 'like_4', 'user_id': 'user_3', 'product_id': 'product_1'},
        {'id': 'like_5', 'user_id': 'user_2', 'product_id': 'product_2'},
        {'id': 'like_6', 'user_id': 'user_1', 'product_id': 'product_1'},  # duplicate
        {'id': 'like_7', 'user_id': 'user_4', 'product_id': 'product_3'}
    ]
    for like in remaining_likes:
        client.collections['likes'].documents.create(like)
    print("Successfully indexed remaining likes.")

    # 5. Confirm the references resolve
    print("Waiting for reference resolution...")
    time.sleep(2)

    search_params = {
        'q': '*',
        'filter_by': 'id:=like_1',
        'include_fields': '$users(username), $products(product_name)'
    }
    res = client.collections['likes'].documents.search(search_params)
    
    hits = res.get('hits', [])
    if hits:
        doc = hits[0].get('document', {})
        user_resolved = 'users' in doc
        product_resolved = 'products' in doc
        if user_resolved and product_resolved:
            print("CONFIRMED: References resolved successfully!")
            print(f"like_1: User={doc['users']['username']}, Product={doc['products']['product_name']}")
        else:
            print("WARNING: References did not resolve yet.")
            print(json.dumps(doc, indent=2))
    else:
        print("ERROR: like_1 not found.")

if __name__ == '__main__':
    main()
