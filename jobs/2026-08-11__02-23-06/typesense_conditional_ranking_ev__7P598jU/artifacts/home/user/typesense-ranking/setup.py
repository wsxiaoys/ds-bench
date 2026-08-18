import typesense

def setup_catalog():
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    # Drop collection if it exists
    try:
        client.collections['catalog'].delete()
        print("Existing 'catalog' collection dropped.")
    except Exception:
        pass

    # Create collection
    schema = {
        'name': 'catalog',
        'fields': [
            {'name': 'title', 'type': 'string'},
            {'name': 'description', 'type': 'string'},
            {'name': 'badge', 'type': 'string', 'facet': True},
            {'name': 'popularity', 'type': 'int32'}
        ]
    }

    client.collections.create(schema)
    print("Collection 'catalog' created.")

    # Insert documents
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

    for doc in documents:
        client.collections['catalog'].documents.create(doc)
    
    print(f"Successfully indexed {len(documents)} documents.")

if __name__ == '__main__':
    setup_catalog()
