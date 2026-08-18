#!/usr/bin/env python3
import sys
import json
import typesense

def main():
    # Read from stdin
    try:
        input_data = json.load(sys.stdin)
    except Exception as e:
        sys.stderr.write(f"Error reading input: {e}\n")
        sys.exit(1)

    # Initialize client
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    # Parse request parameters
    q = input_data.get('q', '*')
    if not q:
        q = '*'

    filters = input_data.get('filters', {})
    if filters is None:
        filters = {}

    facet_query = input_data.get('facet_query')
    max_facet_values = input_data.get('max_facet_values', 10)
    if max_facet_values is None:
        max_facet_values = 10

    # Build filters
    def build_field_filter(field_name, values):
        if not values:
            return None
        escaped_values = [f"`{str(v).replace('`', '\\`')}`" for v in values]
        return f"{field_name}:=[{', '.join(escaped_values)}]"

    def build_price_filter(price_filter):
        if not price_filter:
            return None
        min_val = price_filter.get('min')
        max_val = price_filter.get('max')
        if min_val is not None and max_val is not None:
            return f"price:[{min_val}..{max_val}]"
        elif min_val is not None:
            return f"price:>={min_val}"
        elif max_val is not None:
            return f"price:<={max_val}"
        return None

    brand_filter = build_field_filter('brand', filters.get('brand'))
    category_filter = build_field_filter('category', filters.get('category'))
    tags_filter = build_field_filter('tags', filters.get('tags'))
    price_filter = build_price_filter(filters.get('price'))

    # Main filter
    main_filters = [f for f in [brand_filter, category_filter, tags_filter, price_filter] if f]
    main_filter_by = " && ".join(main_filters) if main_filters else None

    # Brand disjunctive filter
    brand_dis_filters = [f for f in [category_filter, tags_filter, price_filter] if f]
    brand_filter_by = " && ".join(brand_dis_filters) if brand_dis_filters else None

    # Category disjunctive filter
    category_dis_filters = [f for f in [brand_filter, tags_filter, price_filter] if f]
    category_filter_by = " && ".join(category_dis_filters) if category_dis_filters else None

    # Tags disjunctive filter
    tags_dis_filters = [f for f in [brand_filter, category_filter, price_filter] if f]
    tags_filter_by = " && ".join(tags_dis_filters) if tags_dis_filters else None

    # Construct queries list
    requests = []

    # 1. Main query (gets found and price stats)
    main_q = {
        'collection': 'products',
        'q': q,
        'query_by': 'product_name',
        'facet_by': 'price',
        'max_facet_values': 10000,
        'facet_strategy': 'exhaustive'
    }
    if main_filter_by:
        main_q['filter_by'] = main_filter_by
    requests.append(main_q)

    # 2. Brand query
    brand_q = {
        'collection': 'products',
        'q': q,
        'query_by': 'product_name',
        'facet_by': 'brand',
        'max_facet_values': max_facet_values,
        'per_page': 0
    }
    if brand_filter_by:
        brand_q['filter_by'] = brand_filter_by
    requests.append(brand_q)

    # 3. Category query
    category_q = {
        'collection': 'products',
        'q': q,
        'query_by': 'product_name',
        'facet_by': 'category',
        'max_facet_values': max_facet_values,
        'per_page': 0
    }
    if category_filter_by:
        category_q['filter_by'] = category_filter_by
    requests.append(category_q)

    # 4. Tags query
    tags_q = {
        'collection': 'products',
        'q': q,
        'query_by': 'product_name',
        'facet_by': 'tags',
        'max_facet_values': max_facet_values,
        'per_page': 0
    }
    if tags_filter_by:
        tags_q['filter_by'] = tags_filter_by
    requests.append(tags_q)

    # 5. Facet query matches (if facet_query is provided)
    if facet_query:
        fq_field = facet_query.get('field')
        fq_prefix = facet_query.get('prefix')
        
        # Build disjunctive filter for facet query matches
        fq_dis_filters = []
        if fq_field != 'brand' and brand_filter: fq_dis_filters.append(brand_filter)
        if fq_field != 'category' and category_filter: fq_dis_filters.append(category_filter)
        if fq_field != 'tags' and tags_filter: fq_dis_filters.append(tags_filter)
        if fq_field != 'price' and price_filter: fq_dis_filters.append(price_filter)
        fq_filter_by = " && ".join(fq_dis_filters) if fq_dis_filters else None

        fq_q = {
            'collection': 'products',
            'q': q,
            'query_by': 'product_name',
            'facet_by': fq_field,
            'facet_query': f"{fq_field}:{fq_prefix}",
            'max_facet_values': max_facet_values,
            'per_page': 0
        }
        if fq_filter_by:
            fq_q['filter_by'] = fq_filter_by
        requests.append(fq_q)

    # Execute Multi-Search
    try:
        res = client.multi_search.perform({'searches': requests})
    except Exception as e:
        sys.stderr.write(f"Typesense Multi-Search error: {e}\n")
        sys.exit(1)

    results = res.get('results', [])
    
    # Parse Main Query Result
    main_res = results[0]
    found = main_res.get('found', 0)
    
    # Parse Price Stats
    price_stats = {
        'min': 0.0,
        'max': 0.0,
        'avg': 0.0,
        'sum': 0.0
    }
    if found > 0:
        for fc in main_res.get('facet_counts', []):
            if fc.get('field_name') == 'price':
                stats = fc.get('stats', {})
                if 'min' in stats: price_stats['min'] = round(stats['min'], 2)
                if 'max' in stats: price_stats['max'] = round(stats['max'], 2)
                if 'avg' in stats: price_stats['avg'] = round(stats['avg'], 2)
                if 'sum' in stats: price_stats['sum'] = round(stats['sum'], 2)

    # Parse Facets
    facets = {
        'brand': [],
        'category': [],
        'tags': []
    }

    # Brand facet counts (index 1)
    brand_res = results[1]
    for fc in brand_res.get('facet_counts', []):
        if fc.get('field_name') == 'brand':
            for item in fc.get('counts', []):
                facets['brand'].append({
                    'value': item['value'],
                    'count': item['count']
                })
    facets['brand'].sort(key=lambda x: -x['count'])

    # Category facet counts (index 2)
    category_res = results[2]
    for fc in category_res.get('facet_counts', []):
        if fc.get('field_name') == 'category':
            for item in fc.get('counts', []):
                facets['category'].append({
                    'value': item['value'],
                    'count': item['count']
                })
    facets['category'].sort(key=lambda x: -x['count'])

    # Tags facet counts (index 3)
    tags_res = results[3]
    for fc in tags_res.get('facet_counts', []):
        if fc.get('field_name') == 'tags':
            for item in fc.get('counts', []):
                facets['tags'].append({
                    'value': item['value'],
                    'count': item['count']
                })
    facets['tags'].sort(key=lambda x: -x['count'])

    # Build Response Object
    response_obj = {
        'found': found,
        'facets': facets,
        'price_stats': price_stats
    }

    # Parse Facet Query Matches (index 4, if present)
    if facet_query:
        facet_query_matches = []
        fq_res = results[4]
        fq_field = facet_query.get('field')
        for fc in fq_res.get('facet_counts', []):
            if fc.get('field_name') == fq_field:
                for item in fc.get('counts', []):
                    facet_query_matches.append({
                        'value': item['value'],
                        'count': item['count']
                    })
        facet_query_matches.sort(key=lambda x: -x['count'])
        response_obj['facet_query_matches'] = facet_query_matches

    # Print to stdout
    print(json.dumps(response_obj, indent=2))

if __name__ == '__main__':
    main()
