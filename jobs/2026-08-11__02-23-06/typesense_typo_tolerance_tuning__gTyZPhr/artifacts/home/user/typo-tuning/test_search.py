import typesense
import json

client = typesense.Client({
    'nodes': [{
        'host': 'localhost',
        'port': '8108',
        'protocol': 'http'
    }],
    'api_key': 'xyz',
    'connection_timeout_seconds': 2
})

def search(q, split_join='always'):
    search_parameters = {
        'q': q,
        'query_by': 'name,brand',
        'num_typos': '2,0',
        'min_len_1typo': 4,
        'min_len_2typo': 6,
        'drop_tokens_threshold': 1,
        'typo_tokens_threshold': 1,
        'split_join_tokens': split_join,
        'prefix': 'false',
        'drop_tokens_mode': 'both_sides:3'
    }
    res = client.collections['catalog'].documents.search(search_parameters)
    ids = [doc['document']['id'] for doc in res.get('hits', [])]
    return ids

test_cases = [
    ("cemera", "Should match ID 3 (Camera Bag) with 2 typos on camera (len=6)"),
    ("Nikan", "Should NOT match brand Nikon (ID 3) because brand has 0 typo tolerance"),
    ("Nikon", "Should match ID 3 (Camera Bag) exactly"),
    ("beg", "Should NOT match ID 3 or 10 (bag, len=3)"),
    ("wafi", "Should match ID 9 (Wifi Router) with 1 typo on wifi (len=4)"),
    ("Wireless Keyboard", "Should match ID 1 and ID 2 (token dropping activated because no single doc has both)"),
    ("Wireless Mouse", "Should match ONLY ID 1 (no token dropping because ID 1 has both words)"),
    ("Camera Bag", "Should match ONLY ID 3 (no token dropping to pull in ID 10 Beach Bag)"),
    ("Charter", "Should match ONLY ID 11 (Charter Bus), NOT ID 6 (Portable Charger) because Charter has exact match"),
    ("Chorter", "Should match ID 11 (Charter Bus) (and maybe ID 6) because Chorter has no exact match"),
    ("basket ball", "Should match ID 7 (Basketball Shoes)"),
    ("waterbottle", "Should match ID 8 (Water Bottle)")
]

print("--- Testing with split_join_tokens = always AND drop_tokens_mode = both_sides:3 ---")
for q, desc in test_cases:
    res = search(q, split_join='always')
    print(f"Query: {q:20} | Expected: {desc} | Got: {res}")

print("\n--- Testing with split_join_tokens = fallback AND drop_tokens_mode = both_sides:3 ---")
for q, desc in test_cases:
    res = search(q, split_join='fallback')
    print(f"Query: {q:20} | Expected: {desc} | Got: {res}")
