import os
import sys
import json
import argparse
import requests

def parse_args():
    parser = argparse.ArgumentParser(description="Typesense Geo-Polygon Search CLI")
    parser.add_argument("--polygon", required=True, help="Comma-separated string of alternating lat/lng values")
    parser.add_argument("--exclude-status", help="Exclude hubs with this status")
    return parser.parse_args()

def main():
    args = parse_args()
    
    # Clean up and parse the polygon string
    polygon_str = args.polygon.strip("()[]{} ")
    parts = [p.strip() for p in polygon_str.split(",")]
    parts = [p for p in parts if p]
    
    if len(parts) % 2 != 0:
        print("Error: Polygon must have an even number of coordinates (lat,lng pairs).", file=sys.stderr)
        sys.exit(1)
    if len(parts) < 6:
        print("Error: Polygon must have at least 3 vertices (6 coordinates).", file=sys.stderr)
        sys.exit(1)
        
    # Format the coordinate string for Typesense
    coords_str = ", ".join(parts)
    filter_by = f"location:({coords_str})"
    
    if args.exclude_status:
        filter_by += f" && status:!={args.exclude_status}"
        
    api_key = os.environ.get("TYPESENSE_API_KEY")
    if not api_key:
        print("Error: TYPESENSE_API_KEY environment variable not set.", file=sys.stderr)
        sys.exit(1)
        
    base_url = "http://localhost:8108"
    headers = {
        "X-TYPESENSE-API-KEY": api_key,
    }
    
    params = {
        "q": "*",
        "filter_by": filter_by,
        "per_page": 250  # Ensure all matching hubs are returned on a single page
    }
    
    try:
        response = requests.get(f"{base_url}/collections/hubs/documents/search", params=params, headers=headers)
        if response.status_code != 200:
            print(f"Error from Typesense: {response.status_code} - {response.text}", file=sys.stderr)
            sys.exit(1)
            
        data = response.json()
        hub_ids = []
        for hit in data.get("hits", []):
            doc = hit.get("document", {})
            hub_id = doc.get("id")
            if hub_id:
                hub_ids.append(hub_id)
                
        # Sort lexicographically
        hub_ids.sort()
        
        # Print JSON output
        print(json.dumps({"hub_ids": hub_ids}))
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
