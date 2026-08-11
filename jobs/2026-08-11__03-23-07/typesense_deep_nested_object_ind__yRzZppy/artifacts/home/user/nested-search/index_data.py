import typesense
import json

def main():
    client = typesense.Client({
        'nodes': [{
            'host': '127.0.0.1',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    # Delete existing collection if any
    try:
        client.collections['nested_orders'].delete()
        print("Deleted existing collection 'nested_orders'")
    except Exception:
        pass

    schema = {
        "name": "nested_orders",
        "enable_nested_fields": True,
        "fields": [
            {"name": "orders", "type": "object[]"},
            {"name": "orders.line_items", "type": "object[]"},
            {"name": "orders.line_items.name", "type": "string[]"},
            {"name": "orders.line_items.category", "type": "string[]", "facet": True},
            {"name": "orders.line_items.attributes.color", "type": "string[]"}
        ]
    }

    print("Creating collection 'nested_orders'...")
    client.collections.create(schema)
    print("Collection created successfully.")

    print("Indexing documents from /home/user/nested-search/data/orders.jsonl...")
    with open('/home/user/nested-search/data/orders.jsonl', 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            doc = json.loads(line)
            client.collections['nested_orders'].documents.create(doc)
            print(f"Indexed document: {doc.get('id')}")

    print("Indexing complete.")

if __name__ == '__main__':
    main()
