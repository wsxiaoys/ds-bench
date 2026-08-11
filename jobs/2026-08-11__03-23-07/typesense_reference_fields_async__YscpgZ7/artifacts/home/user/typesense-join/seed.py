import typesense
import os
import time
import json

def seed():
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': os.getenv('TYPESENSE_API_KEY', 'xyz'),
        'connection_timeout_seconds': 5
    })

    # Clean up collections if they exist
    for coll in ['likes', 'products', 'users']:
        try:
            client.collections[coll].delete()
            print(f"Deleted collection: {coll}")
        except Exception as e:
            print(f"Collection {coll} did not exist or could not be deleted: {e}")

    # Define schemas
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

    print("Creating collections...")
    client.collections.create(users_schema)
    client.collections.create(products_schema)
    client.collections.create(likes_schema)
    print("Collections created successfully.")

    # 1. Index a like BEFORE user and product exist
    print("Indexing like-1 before user-1 and prod-1 exist...")
    like_1 = {
        'id': 'like-1',
        'user_id': 'user-1',
        'product_id': 'prod-1'
    }
    client.collections['likes'].documents.create(like_1)
    print("Indexed like-1 successfully.")

    # Let's verify that the reference is currently unresolved
    print("Checking if reference is unresolved in likes...")
    res = client.collections['likes'].documents.search({
        'q': '*',
        'filter_by': 'id:=like-1',
        'include_fields': '$users(*), $products(*)'
    })
    hit_doc = res['hits'][0]['document']
    print("Document state (unresolved):")
    print(json.dumps(hit_doc, indent=2))
    assert 'users' not in hit_doc, "Users should not be resolved yet"
    assert 'products' not in hit_doc, "Products should not be resolved yet"

    # Index other likes where references do not exist yet
    other_likes = [
        {'id': 'like-2', 'user_id': 'user-1', 'product_id': 'prod-2'},
        {'id': 'like-3', 'user_id': 'user-2', 'product_id': 'prod-1'},
        {'id': 'like-4', 'user_id': 'user-3', 'product_id': 'prod-2'},
        {'id': 'like-5', 'user_id': 'user-3', 'product_id': 'prod-3'},
        {'id': 'like-6', 'user_id': 'user-4', 'product_id': 'prod-1'},
        {'id': 'like-7', 'user_id': 'user-4', 'product_id': 'prod-2'},
        {'id': 'like-8', 'user_id': 'user-4', 'product_id': 'prod-3'},
        {'id': 'like-9', 'user_id': 'user-4', 'product_id': 'prod-4'},
    ]
    for l in other_likes:
        client.collections['likes'].documents.create(l)

    # 2. Now index the users and products afterwards
    print("Indexing users and products...")
    users = [
        {'id': 'user-1', 'username': 'alice'},
        {'id': 'user-2', 'username': 'bob'},
        {'id': 'user-3', 'username': 'charlie'},
        {'id': 'user-4', 'username': 'david'},
    ]
    for u in users:
        client.collections['users'].documents.create(u)

    products = [
        {'id': 'prod-1', 'product_name': 'laptop'},
        {'id': 'prod-2', 'product_name': 'smartphone'},
        {'id': 'prod-3', 'product_name': 'headphones'},
        {'id': 'prod-4', 'product_name': 'tablet'},
    ]
    for p in products:
        client.collections['products'].documents.create(p)

    print("Waiting for references to resolve asynchronously...")
    # Give Typesense a couple of seconds to resolve references
    time.sleep(2)

    # 3. Confirm references have resolved
    print("Checking if reference is resolved in likes...")
    res = client.collections['likes'].documents.search({
        'q': '*',
        'filter_by': 'id:=like-1',
        'include_fields': '$users(*), $products(*)'
    })
    hit_doc = res['hits'][0]['document']
    print("Document state (resolved):")
    print(json.dumps(hit_doc, indent=2))
    
    assert 'users' in hit_doc and hit_doc['users']['username'] == 'alice', "User reference failed to resolve"
    assert 'products' in hit_doc and hit_doc['products']['product_name'] == 'laptop', "Product reference failed to resolve"
    print("Asynchronous reference resolution confirmed successfully!")

if __name__ == '__main__':
    seed()
