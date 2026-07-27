import json
import typesense

def init_typesense():
    client = typesense.Client({
        'nodes': [{
            'host': '127.0.0.1',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'w3E7XhJMftaUNPbVwOkBp0PaKCgfHWxt',
        'connection_timeout_seconds': 5
    })

    # Delete existing collection if it exists
    try:
        client.collections['knowledge_base'].delete()
        print("Deleted existing collection 'knowledge_base'")
    except Exception as e:
        print("Collection 'knowledge_base' did not exist or could not be deleted:", e)

    # Create collection schema
    schema = {
        'name': 'knowledge_base',
        'fields': [
            {'name': 'id', 'type': 'string'},
            {'name': 'title', 'type': 'string'},
            {'name': 'body', 'type': 'string'},
            {
                'name': 'embedding',
                'type': 'float[]',
                'num_dim': 8,
                'vec_dist': 'cosine'
            }
        ]
    }

    client.collections.create(schema)
    print("Created collection 'knowledge_base'")

    # Load documents
    with open('/home/user/kbsearch/data/documents.json', 'r') as f:
        documents = json.load(f)

    # Index documents
    for doc in documents:
        client.collections['knowledge_base'].documents.create(doc)
        print(f"Indexed document: {doc['id']}")

if __name__ == '__main__':
    init_typesense()
