#!/usr/bin/env python3
import json
import sys
import typesense

def build_filter_by(filters, exclude_field=None):
    if not filters:
        return ""
    
    parts = []
    for field, val in filters.items():
        if field == exclude_field:
            continue
        
        if field == "price":
            price_parts = []
            if "min" in val:
                price_parts.append(f"price:>={val['min']}")
            if "max" in val:
                price_parts.append(f"price:<={val['max']}")
            if price_parts:
                parts.append(" && ".join(price_parts))
        else:
            if val:
                # Escape backticks inside each value and wrap in backticks
                escaped_vals = [f"`{str(v).replace('`', '\\`')}`" for v in val]
                # Join with commas for OR condition
                parts.append(f"{field}:=[{', '.join(escaped_vals)}]")
                
    return " && ".join(parts) if parts else ""

def extract_counts(result, field_name):
    counts = []
    for fc in result.get("facet_counts", []):
        if fc.get("field_name") == field_name:
            for item in fc.get("counts", []):
                counts.append({
                    "value": item["value"],
                    "count": item["count"]
                })
            break
    # Sort by count descending, then value ascending to be stable
    counts.sort(key=lambda x: (-x["count"], x["value"]))
    return counts

def main():
    # Read from stdin
    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            return
        request = json.loads(input_data)
    except Exception as e:
        print(json.dumps({"error": f"Failed to parse stdin JSON: {e}"}))
        sys.exit(1)

    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    q = request.get("q", "*")
    if q is None:
        q = "*"
    
    filters = request.get("filters", {}) or {}
    facet_query = request.get("facet_query")
    max_facet_values = request.get("max_facet_values", 10)
    if max_facet_values is None:
        max_facet_values = 10

    searches = []

    # 0. Found and price_stats
    searches.append({
        'collection': 'products',
        'q': q,
        'query_by': 'product_name',
        'filter_by': build_filter_by(filters),
        'facet_by': 'price',
        'per_page': 0,
        'max_facet_values': max_facet_values
    })

    # 1. Brand facet
    searches.append({
        'collection': 'products',
        'q': q,
        'query_by': 'product_name',
        'filter_by': build_filter_by(filters, exclude_field='brand'),
        'facet_by': 'brand',
        'per_page': 0,
        'max_facet_values': max_facet_values
    })

    # 2. Category facet
    searches.append({
        'collection': 'products',
        'q': q,
        'query_by': 'product_name',
        'filter_by': build_filter_by(filters, exclude_field='category'),
        'facet_by': 'category',
        'per_page': 0,
        'max_facet_values': max_facet_values
    })

    # 3. Tags facet
    searches.append({
        'collection': 'products',
        'q': q,
        'query_by': 'product_name',
        'filter_by': build_filter_by(filters, exclude_field='tags'),
        'facet_by': 'tags',
        'per_page': 0,
        'max_facet_values': max_facet_values
    })

    if facet_query:
        fq_field = facet_query.get("field")
        fq_prefix = facet_query.get("prefix", "")
        searches.append({
            'collection': 'products',
            'q': q,
            'query_by': 'product_name',
            'filter_by': build_filter_by(filters, exclude_field=fq_field),
            'facet_by': fq_field,
            'facet_query': f"{fq_field}:{fq_prefix}",
            'per_page': 0,
            'max_facet_values': max_facet_values
        })

    try:
        res = client.multi_search.perform({'searches': searches})
        results = res.get('results', [])
    except Exception as e:
        print(json.dumps({"error": f"Typesense query failed: {e}"}))
        sys.exit(1)

    if not results:
        print(json.dumps({"error": "No results returned from Typesense"}))
        sys.exit(1)

    # Extract found
    found = results[0].get("found", 0)

    # Extract price_stats
    stats = {}
    for fc in results[0].get("facet_counts", []):
        if fc.get("field_name") == "price":
            stats = fc.get("stats", {})
            break

    if found == 0 or not stats:
        price_stats = {
            "min": 0.0,
            "max": 0.0,
            "avg": 0.0,
            "sum": 0.0
        }
    else:
        price_stats = {
            "min": round(stats.get("min", 0.0), 2) if stats.get("min") is not None else 0.0,
            "max": round(stats.get("max", 0.0), 2) if stats.get("max") is not None else 0.0,
            "avg": round(stats.get("avg", 0.0), 2) if stats.get("avg") is not None else 0.0,
            "sum": round(stats.get("sum", 0.0), 2) if stats.get("sum") is not None else 0.0,
        }

    # Extract facets
    facets = {
        "brand": [],
        "category": [],
        "tags": []
    }

    facets["brand"] = extract_counts(results[1], "brand")
    facets["category"] = extract_counts(results[2], "category")
    facets["tags"] = extract_counts(results[3], "tags")

    response = {
        "found": found,
        "facets": facets,
        "price_stats": price_stats
    }

    if facet_query:
        fq_field = facet_query.get("field")
        facet_query_matches = extract_counts(results[4], fq_field)
        response["facet_query_matches"] = facet_query_matches

    # Write to stdout
    print(json.dumps(response))

if __name__ == '__main__':
    main()
