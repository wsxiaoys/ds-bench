import argparse
import requests
import json
import sys

TYPESENSE_URL = "http://localhost:8108"
HEADERS = {
    "X-TYPESENSE-API-KEY": "xyz"
}

def main():
    parser = argparse.ArgumentParser(description="Rank catalog items using Typesense.")
    parser.add_argument("--query", required=True, help="Search query string")
    args = parser.parse_args()

    # Define the search parameters
    # 1. Promotion tier first (dominant signal): badge sponsored (3) > featured (2) > none (1)
    # 2. Text relevance within a tier: more relevant matches first (using _text_match)
    # 3. Popularity tiebreaker: higher popularity first (using popularity)
    # Note: text_match_type is set to "sum_score" to reward matches across multiple fields.
    params = {
        "q": args.query,
        "query_by": "title,description",
        "sort_by": "_eval([ (badge:=sponsored):3, (badge:=featured):2, (badge:=none):1 ]):desc,_text_match:desc,popularity:desc",
        "text_match_type": "sum_score",
        "per_page": 250
    }

    try:
        r = requests.get(f"{TYPESENSE_URL}/collections/catalog/documents/search", headers=HEADERS, params=params)
        if r.status_code != 200:
            # Print to stderr to avoid polluting stdout
            print(f"Error querying Typesense: {r.status_code} - {r.text}", file=sys.stderr)
            sys.exit(1)
        
        results = r.json()
        hits = results.get("hits", [])
        
        # Extract the ids of the matching documents in ranked order
        ranked_ids = [hit["document"]["id"] for hit in hits]
        
        # Print ONLY the JSON array to stdout
        print(json.dumps(ranked_ids))
        
    except Exception as e:
        print(f"An error occurred: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
