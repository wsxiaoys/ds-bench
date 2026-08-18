import urllib.request
import json

url_prefix = "http://localhost:8108"
headers = {
    "X-TYPESENSE-API-KEY": "xyz"
}

def search(q):
    url = f"{url_prefix}/collections/catalog/documents/search?q={urllib.parse.quote(q)}&query_by=name"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode())
            hits = res.get("hits", [])
            print(f"\n--- Search results for '{q}' ---")
            for i, hit in enumerate(hits):
                doc = hit["document"]
                print(f"Position {i+1}: ID={doc['id']}, Name='{doc['name']}', Brand='{doc['brand']}', Category='{doc['category']}', Popularity={doc['popularity']}")
    except Exception as e:
        print(f"Error searching for '{q}': {e}")

# Test 1: Exact match on "phone"
search("phone")

# Test 2: Contains match on "deal"
search("refurbished phone deal")

# Test 3: Dynamic brand filter "Apple phone"
search("Apple phone")

# Test 4: Dynamic brand filter "Samsung phone"
search("Samsung phone")
