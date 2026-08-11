import typesense

def setup_collection():
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    # Drop collection if it already exists
    try:
        client.collections['catalog'].delete()
        print("Deleted existing 'catalog' collection.")
    except Exception as e:
        print(f"No existing collection to delete: {e}")

    # Create collection schema
    schema = {
        "name": "catalog",
        "fields": [
            {"name": "title", "type": "string"},
            {"name": "description", "type": "string"},
            {"name": "badge", "type": "string", "facet": True},
            {"name": "popularity", "type": "int32"}
        ]
    }

    print("Creating 'catalog' collection...")
    client.collections.create(schema)
    print("Collection created successfully.")

    # Documents to index
    documents = [
        {
            "id": "P1",
            "title": "Alpine Trek Boots",
            "description": "Alpine Trek ready footwear",
            "badge": "featured",
            "popularity": 10
        },
        {
            "id": "P2",
            "title": "Alpine Trek Jacket",
            "description": "Alpine Trek insulated layer",
            "badge": "featured",
            "popularity": 80
        },
        {
            "id": "P3",
            "title": "Alpine Trek Poles",
            "description": "Summit carbon poles",
            "badge": "sponsored",
            "popularity": 5
        },
        {
            "id": "P4",
            "title": "Alpine Trek Tent",
            "description": "Alpine Trek shelter system",
            "badge": "none",
            "popularity": 99
        },
        {
            "id": "P5",
            "title": "Alpine Trek Gloves",
            "description": "Summit winter gloves",
            "badge": "sponsored",
            "popularity": 40
        },
        {
            "id": "P6",
            "title": "Alpine Trek Socks",
            "description": "Merino wool socks",
            "badge": "featured",
            "popularity": 100
        }
    ]

    print("Importing documents...")
    import_results = client.collections['catalog'].documents.import_(documents, {'action': 'create'})
    print("Import results:", import_results)

if __name__ == '__main__':
    setup_collection()
