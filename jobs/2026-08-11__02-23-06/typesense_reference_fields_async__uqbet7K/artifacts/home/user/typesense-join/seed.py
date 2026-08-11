import os
import typesense
import time

def main():
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

    print("Deleting existing collections if they exist...")
    for coll in ['likes', 'users', 'products']:
        try:
            client.collections[coll].delete()
            print(f"Deleted collection: {coll}")
        except Exception as e:
            print(f"Collection {coll} did not exist or could not be deleted: {e}")

    # Create users collection
    users_schema = {
        'name': 'users',
        'fields': [
            {'name': 'id', 'type': 'string'},
            {'name': 'username', 'type': 'string'}
        ]
    }
    client.collections.create(users_schema)
    print("Created 'users' collection.")

    # Create products collection
    products_schema = {
        'name': 'products',
        'fields': [
            {'name': 'id', 'type': 'string'},
            {'name': 'product_name', 'type': 'string'}
        ]
    }
    client.collections.create(products_schema)
    print("Created 'products' collection.")

    # Create likes collection
    likes_schema = {
        'name': 'likes',
        'fields': [
            {'name': 'user_id', 'type': 'string', 'reference': 'users.id', 'async_reference': True},
            {'name': 'product_id', 'type': 'string', 'reference': 'products.id', 'async_reference': True}
        ]
    }
    client.collections.create(likes_schema)
    print("Created 'likes' collection with asynchronous references.")

    # STEP 1: Index likes document BEFORE the user and product it references
    like_doc_1 = {
        'id': 'like_1',
        'user_id': 'user_1',
        'product_id': 'product_1'
    }
    client.collections['likes'].documents.create(like_doc_1)
    print("Indexed 'like_1' document (referencing user_1 and product_1) BEFORE they exist.")

    # STEP 2: Index the referenced user and product
    user_doc_1 = {
        'id': 'user_1',
        'username': 'alice'
    }
    client.collections['users'].documents.create(user_doc_1)
    print("Indexed 'user_1' (alice).")

    product_doc_1 = {
        'id': 'product_1',
        'product_name': 'laptop'
    }
    client.collections['products'].documents.create(product_doc_1)
    print("Indexed 'product_1' (laptop).")

    # STEP 3: Index additional users, products, and likes to build a complete many-to-many dataset
    other_users = [
        {'id': 'user_2', 'username': 'bob'},
        {'id': 'user_3', 'username': 'charlie'}
    ]
    for u in other_users:
        client.collections['users'].documents.create(u)
    print("Indexed additional users: bob, charlie.")

    other_products = [
        {'id': 'product_2', 'product_name': 'phone'},
        {'id': 'product_3', 'product_name': 'tablet'}
    ]
    for p in other_products:
        client.collections['products'].documents.create(p)
    print("Indexed additional products: phone, tablet.")

    other_likes = [
        {'id': 'like_2', 'user_id': 'user_2', 'product_id': 'product_1'}, # bob likes laptop
        {'id': 'like_3', 'user_id': 'user_1', 'product_id': 'product_2'}, # alice likes phone
        {'id': 'like_4', 'user_id': 'user_3', 'product_id': 'product_1'}, # charlie likes laptop
        {'id': 'like_5', 'user_id': 'user_2', 'product_id': 'product_3'}, # bob likes tablet
        {'id': 'like_6', 'user_id': 'user_1', 'product_id': 'product_3'}  # alice likes tablet
    ]
    for l in other_likes:
        client.collections['likes'].documents.create(l)
    print("Indexed additional likes.")

    # STEP 4: Verify that the first like document has resolved its references
    print("Waiting for references to resolve asynchronously...")
    time.sleep(2)

    res = client.collections['likes'].documents.search({
        'q': '*',
        'filter_by': 'id:=like_1',
        'include_fields': '$users(*), $products(*)'
    })

    try:
        hit = res['hits'][0]['document']
        resolved_user = hit.get('users', {}).get('username')
        resolved_product = hit.get('products', {}).get('product_name')
        if resolved_user == 'alice' and resolved_product == 'laptop':
            print("SUCCESS: Asynchronous reference resolution confirmed!")
            print(f"  like_1 -> user_id 'user_1' resolved to username: '{resolved_user}'")
            print(f"  like_1 -> product_id 'product_1' resolved to product_name: '{resolved_product}'")
        else:
            print("WARNING: References did not resolve as expected.")
            print(f"  Resolved user: {resolved_user}, Resolved product: {resolved_product}")
    except Exception as e:
        print(f"Error verifying reference resolution: {e}")

if __name__ == '__main__':
    main()
