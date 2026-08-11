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

search_parameters = {
  'q': '*',
  'query_by': 'product_name',
  'facet_by': 'price,brand,category,tags',
  'max_facet_values': 10
}

res = client.collections['products'].documents.search(search_parameters)
print(json.dumps(res, indent=2))
