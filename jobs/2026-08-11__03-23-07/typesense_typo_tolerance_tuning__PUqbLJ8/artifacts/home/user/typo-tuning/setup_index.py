import json
import typesense

client = typesense.Client({
    'nodes': [{
        'host': 'localhost',
        'port': '8108',
        'protocol': 'http'
    }],
    'api_key': 'xyz',
    'connection_timeout_seconds': 2
})

# Delete collection if it exists
try:
    client.collections['catalog'].delete()
    print("Deleted existing catalog collection.")
except Exception as e:
    pass

# Create collection
schema = {
    'name': 'catalog',
    'fields': [
        {'name': 'name', 'type': 'string'},
        {'name': 'brand', 'type': 'string'}
    ]
}

client.collections.create(schema)
print("Created catalog collection.")

# Import documents
documents = []
with open('/home/user/typo-tuning/products.jsonl', 'r') as f:
    for line in f:
        line = line.strip()
        if line:
            documents.append(json.loads(line))

import_results = client.collections['catalog'].documents.import_(documents, {'action': 'upsert'})
print("Imported documents:", import_results)
