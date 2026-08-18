import os
import sys
import json
import argparse
import typesense

def make_ccw(points):
    total = 0.0
    n = len(points)
    for i in range(n):
        x1, y1 = points[i][1], points[i][0]
        x2, y2 = points[(i + 1) % n][1], points[(i + 1) % n][0]
        total += (x2 - x1) * (y2 + y1)
    if total > 0:
        return points[::-1]
    return points

def main():
    parser = argparse.ArgumentParser(description="Search delivery hubs within a geo-polygon.")
    parser.add_argument("--polygon", required=True, help="Comma-separated alternating latitude/longitude values.")
    parser.add_argument("--exclude-status", help="Status to exclude from results.")
    args = parser.parse_args()

    api_key = os.environ.get("TYPESENSE_API_KEY")
    if not api_key:
        print("Error: TYPESENSE_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)

    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': api_key,
        'connection_timeout_seconds': 5
    })

    # Parse polygon coordinates
    try:
        coords = [float(x.strip()) for x in args.polygon.split(",") if x.strip()]
    except ValueError as e:
        print(f"Error parsing coordinates: {e}", file=sys.stderr)
        sys.exit(1)

    if len(coords) % 2 != 0:
        print("Error: Polygon must contain an even number of coordinates (alternating lat, lng).", file=sys.stderr)
        sys.exit(1)
    if len(coords) < 6:
        print("Error: Polygon must have at least 3 points (6 coordinate values).", file=sys.stderr)
        sys.exit(1)

    points = []
    for i in range(0, len(coords), 2):
        points.append((coords[i], coords[i+1]))

    # Ensure points are in counter-clockwise order for Typesense
    points_ccw = make_ccw(points)

    # Format polygon for Typesense filter_by
    flat_coords = []
    for lat, lng in points_ccw:
        flat_coords.append(f"{lat}, {lng}")
    polygon_filter = f"location:({', '.join(flat_coords)})"

    filter_by = polygon_filter
    if args.exclude_status:
        filter_by += f" && status:!={args.exclude_status}"

    search_parameters = {
        'q': '*',
        'query_by': 'name',
        'filter_by': filter_by,
        'per_page': 250
    }

    try:
        res = client.collections['hubs'].documents.search(search_parameters)
        hub_ids = sorted([hit['document']['id'] for hit in res.get('hits', [])])
        print(json.dumps({"hub_ids": hub_ids}))
    except Exception as e:
        print(f"Error executing search: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
