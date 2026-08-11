#!/usr/bin/env python3
import sys
import json
import typesense

def build_filter_by(filters, exclude_field=None):
    if not filters:
        return ""
    
    clauses = []
    
    # brand filter
    if "brand" in filters and exclude_field != "brand":
        brands = filters["brand"]
        if isinstance(brands, list) and brands:
            escaped_brands = [f"`{b}`" for b in brands]
            clauses.append(f"brand:=[{', '.join(escaped_brands)}]")
            
    # category filter
    if "category" in filters and exclude_field != "category":
        categories = filters["category"]
        if isinstance(categories, list) and categories:
            escaped_categories = [f"`{c}`" for c in categories]
            clauses.append(f"category:=[{', '.join(escaped_categories)}]")
            
    # tags filter
    if "tags" in filters and exclude_field != "tags":
        tags = filters["tags"]
        if isinstance(tags, list) and tags:
            escaped_tags = [f"`{t}`" for t in tags]
            clauses.append(f"tags:=[{', '.join(escaped_tags)}]")
            
    # price filter
    if "price" in filters and exclude_field != "price":
        price = filters["price"]
        if isinstance(price, dict) and price:
            if "min" in price and price["min"] is not None:
                clauses.append(f"price:>={price['min']}")
            if "max" in price and price["max"] is not None:
                clauses.append(f"price:<={price['max']}")
                
    return " && ".join(clauses)

def main():
    # Read search/navigation request from stdin
    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            return
        req = json.loads(input_data)
    except Exception as e:
        print(json.dumps({"error": f"Failed to parse input JSON: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

    # Extract parameters
    q = req.get("q", "*")
    filters = req.get("filters", {})
    facet_query = req.get("facet_query")
    max_facet_values = req.get("max_facet_values", 10)

    # Connect to Typesense
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    # Prepare multi-search queries
    # Query 1: Main Query (with ALL filters) to get 'found' and 'price_stats'
    query_1 = {
        'collection': 'products',
        'q': q,
        'query_by': 'product_name',
        'per_page': 0,
        'facet_by': 'price',
        'max_facet_values': 1000000
    }
    filter_all = build_filter_by(filters)
    if filter_all:
        query_1['filter_by'] = filter_all

    # Query 2: Brand Facet (excluding brand filter)
    query_brand = {
        'collection': 'products',
        'q': q,
        'query_by': 'product_name',
        'per_page': 0,
        'facet_by': 'brand',
        'max_facet_values': max_facet_values
    }
    filter_brand = build_filter_by(filters, exclude_field='brand')
    if filter_brand:
        query_brand['filter_by'] = filter_brand

    # Query 3: Category Facet (excluding category filter)
    query_category = {
        'collection': 'products',
        'q': q,
        'query_by': 'product_name',
        'per_page': 0,
        'facet_by': 'category',
        'max_facet_values': max_facet_values
    }
    filter_category = build_filter_by(filters, exclude_field='category')
    if filter_category:
        query_category['filter_by'] = filter_category

    # Query 4: Tags Facet (excluding tags filter)
    query_tags = {
        'collection': 'products',
        'q': q,
        'query_by': 'product_name',
        'per_page': 0,
        'facet_by': 'tags',
        'max_facet_values': max_facet_values
    }
    filter_tags = build_filter_by(filters, exclude_field='tags')
    if filter_tags:
        query_tags['filter_by'] = filter_tags

    searches = [query_1, query_brand, query_category, query_tags]

    # Query 5: Optional Facet Query Matches
    fq_field = None
    fq_prefix = None
    if isinstance(facet_query, dict):
        fq_field = facet_query.get("field")
        fq_prefix = facet_query.get("prefix")
        if fq_field and fq_prefix is not None:
            query_fq = {
                'collection': 'products',
                'q': q,
                'query_by': 'product_name',
                'per_page': 0,
                'facet_by': fq_field,
                'facet_query': f'{fq_field}:{fq_prefix}',
                'max_facet_values': max_facet_values
            }
            filter_fq = build_filter_by(filters, exclude_field=fq_field)
            if filter_fq:
                query_fq['filter_by'] = filter_fq
            searches.append(query_fq)

    # Execute multi-search
    try:
        response = client.multi_search.perform({'searches': searches}, {})
        results = response.get('results', [])
    except Exception as e:
        print(json.dumps({"error": f"Typesense search failed: {str(e)}"}), file=sys.stderr)
        sys.exit(1)

    # Parse Query 1 (Main Query)
    res_1 = results[0]
    found = res_1.get('found', 0)
    
    price_stats = {
        'min': 0,
        'max': 0,
        'avg': 0,
        'sum': 0
    }
    if found > 0:
        facet_counts = res_1.get('facet_counts', [])
        price_facet = next((f for f in facet_counts if f['field_name'] == 'price'), None)
        if price_facet and 'stats' in price_facet:
            stats = price_facet['stats']
            price_stats = {
                'min': round(stats.get('min', 0.0), 2),
                'max': round(stats.get('max', 0.0), 2),
                'avg': round(stats.get('avg', 0.0), 2),
                'sum': round(stats.get('sum', 0.0), 2)
            }

    # Helper function to extract facet counts
    def extract_facet(res, field_name):
        facet_counts = res.get('facet_counts', [])
        facet = next((f for f in facet_counts if f['field_name'] == field_name), None)
        if not facet:
            return []
        
        items = []
        for item in facet.get('counts', []):
            items.append({
                'value': item['value'],
                'count': item['count']
            })
        # Ensure correct sorting by count desc, then alphabetically by value for deterministic tie-breaking
        items.sort(key=lambda x: (-x['count'], x['value']))
        return items

    # Parse Query 2, 3, 4
    brand_facets = extract_facet(results[1], 'brand')
    category_facets = extract_facet(results[2], 'category')
    tags_facets = extract_facet(results[3], 'tags')

    output = {
        "found": found,
        "facets": {
            "brand": brand_facets,
            "category": category_facets,
            "tags": tags_facets
        },
        "price_stats": price_stats
    }

    # Parse Query 5 if present
    if fq_field and fq_prefix is not None:
        res_fq = results[4]
        fq_matches = extract_facet(res_fq, fq_field)
        output["facet_query_matches"] = fq_matches

    # Output response JSON
    print(json.dumps(output))

if __name__ == '__main__':
    main()
