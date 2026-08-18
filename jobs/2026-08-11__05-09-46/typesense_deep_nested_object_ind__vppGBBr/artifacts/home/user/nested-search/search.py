import argparse
import json
import requests
import sys

def main():
    parser = argparse.ArgumentParser(description="Deeply nested search query tool for Typesense.")
    parser.add_argument("--keyword", required=True, help="Search keyword for product name.")
    parser.add_argument("--color", required=True, help="Filter by nested product attribute color.")
    
    args = parser.parse_args()
    
    TYPESENSE_URL = "http://localhost:8108"
    HEADERS = {
        "X-TYPESENSE-API-KEY": "xyz"
    }
    
    url = f"{TYPESENSE_URL}/collections/nested_orders/documents/search"
    params = {
        "q": args.keyword,
        "query_by": "orders.line_items.name",
        "filter_by": f"orders.line_items.attributes.color:={args.color}",
        "facet_by": "orders.line_items.category",
        "per_page": 250
    }
    
    try:
        response = requests.get(url, headers=HEADERS, params=params)
        if response.status_code != 200:
            # If there's an error, print to stderr and exit
            print(f"Error from Typesense: {response.text}", file=sys.stderr)
            sys.exit(1)
            
        search_result = response.json()
        
        # Extract matched customer IDs and sort them lexicographically
        matched_ids = []
        for hit in search_result.get("hits", []):
            doc_id = hit.get("document", {}).get("id")
            if doc_id:
                matched_ids.append(doc_id)
        matched_ids.sort()
        
        # Extract category facet counts
        category_facet_counts = {}
        if "facet_counts" in search_result:
            for facet in search_result["facet_counts"]:
                if facet.get("field_name") == "orders.line_items.category":
                    for item in facet.get("counts", []):
                        category_facet_counts[item["value"]] = item["count"]
                        
        output = {
            "matched_customer_ids": matched_ids,
            "category_facet_counts": category_facet_counts
        }
        
        # Print exactly one JSON object to stdout
        print(json.dumps(output))
        
    except Exception as e:
        print(f"An unexpected error occurred: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
