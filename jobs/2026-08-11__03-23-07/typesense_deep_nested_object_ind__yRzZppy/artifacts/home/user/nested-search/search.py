import argparse
import json
import typesense

def main():
    parser = argparse.ArgumentParser(description="Search nested orders in Typesense")
    parser.add_argument('--keyword', required=True, help="Search keyword for product name")
    parser.add_argument('--color', required=True, help="Filter by attributes.color")
    args = parser.parse_args()

    client = typesense.Client({
        'nodes': [{
            'host': '127.0.0.1',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    page = 1
    per_page = 250
    matched_ids = []
    facet_counts = {}

    while True:
        search_parameters = {
            'q': args.keyword,
            'query_by': 'orders.line_items.name',
            'filter_by': f'orders.line_items.attributes.color:={args.color}',
            'facet_by': 'orders.line_items.category',
            'per_page': per_page,
            'page': page
        }

        try:
            res = client.collections['nested_orders'].documents.search(search_parameters)
        except Exception as e:
            print(json.dumps({"error": str(e)}))
            return

        # Extract matched customer ids
        hits = res.get('hits', [])
        for hit in hits:
            doc = hit.get('document', {})
            doc_id = doc.get('id')
            if doc_id:
                matched_ids.append(doc_id)

        # Extract facet counts from the first page (global over matching set)
        if page == 1:
            facets = res.get('facet_counts', [])
            for facet in facets:
                if facet.get('field_name') == 'orders.line_items.category':
                    counts = facet.get('counts', [])
                    for item in counts:
                        val = item.get('value')
                        count = item.get('count')
                        facet_counts[val] = count

        found = res.get('found', 0)
        if len(matched_ids) >= found or not hits:
            break
        page += 1

    # Sort matched customer ids in ascending lexicographic order
    matched_ids.sort()

    # Print exactly one JSON object to stdout
    output = {
        "matched_customer_ids": matched_ids,
        "category_facet_counts": facet_counts
    }
    print(json.dumps(output))

if __name__ == '__main__':
    main()
