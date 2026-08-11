import argparse
import json
import os
import sys
import requests

def main():
    parser = argparse.ArgumentParser(description="Search delivery hubs in a polygon.")
    parser.add_argument("--polygon", required=True, help="Comma-separated string of lat,lng,lat,lng...")
    parser.add_argument("--exclude-status", help="Exclude hubs with this status")
    args = parser.parse_args()

    # Get API key
    api_key = os.environ.get("TYPESENSE_API_KEY")
    if not api_key:
        print("Error: TYPESENSE_API_KEY environment variable not set.", file=sys.stderr)
        sys.exit(1)

    polygon_str = args.polygon.strip()
    if not polygon_str:
        print(json.dumps({"hub_ids": []}))
        return

    # Construct the filter_by query
    filter_by = f"location:({polygon_str})"
    if args.exclude_status:
        filter_by += f" && status:!={args.exclude_status}"

    headers = {
        "X-TYPESENSE-API-KEY": api_key,
        "Content-Type": "application/json"
    }

    params = {
        "q": "*",
        "filter_by": filter_by,
        "per_page": 250
    }

    try:
        res = requests.get("http://localhost:8108/collections/hubs/documents/search", headers=headers, params=params)
        res.raise_for_status()
        data = res.json()
    except Exception as e:
        print(f"Error querying Typesense: {e}", file=sys.stderr)
        sys.exit(1)

    hub_ids = []
    hits = data.get("hits", [])
    for hit in hits:
        doc = hit.get("document", {})
        if "id" in doc:
            hub_ids.append(doc["id"])

    # Sort in ascending lexicographic order
    hub_ids.sort()

    # Output the result as JSON to stdout
    print(json.dumps({"hub_ids": hub_ids}))

if __name__ == "__main__":
    main()
