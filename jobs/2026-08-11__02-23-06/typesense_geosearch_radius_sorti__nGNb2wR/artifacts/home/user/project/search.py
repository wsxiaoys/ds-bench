import os
import sys
import json
import argparse
import typesense

def main():
    parser = argparse.ArgumentParser(description="Airport Geosearch CLI")
    parser.add_argument('--lat', type=float, required=True, help="Latitude of reference point")
    parser.add_argument('--lng', type=float, required=True, help="Longitude of reference point")
    parser.add_argument('--radius-km', type=float, required=True, help="Search radius in kilometers")

    args = parser.parse_args()

    api_key = os.environ.get('TYPESENSE_API_KEY', 'xyz')
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': api_key,
        'connection_timeout_seconds': 5
    })

    # Prepare search parameters
    # We want to retrieve all matching documents within the radius.
    # Since the dataset is small (20 airports), setting per_page to 250 ensures we get all of them.
    search_parameters = {
        'q': '*',
        'query_by': 'name',
        'filter_by': f'location:({args.lat}, {args.lng}, {args.radius_km} km)',
        'sort_by': f'location({args.lat}, {args.lng}):asc',
        'per_page': 250
    }

    try:
        search_result = client.collections['airports'].documents.search(search_parameters)
    except Exception as e:
        # If there's an error, we should print it to stderr and exit with non-zero code
        print(f"Error executing search: {e}", file=sys.stderr)
        sys.exit(1)

    hits = search_result.get('hits', [])
    results = []
    for hit in hits:
        doc = hit.get('document', {})
        geo_dist = hit.get('geo_distance_meters', {})
        distance_meters = geo_dist.get('location')
        
        # Ensure we have a valid distance_meters integer
        if distance_meters is not None:
            distance_meters = int(distance_meters)
        else:
            distance_meters = 0

        results.append({
            'id': str(doc.get('id', '')),
            'iata': str(doc.get('iata', '')),
            'name': str(doc.get('name', '')),
            'distance_meters': distance_meters
        })

    output = {
        'reference': {
            'lat': args.lat,
            'lng': args.lng,
            'radius_km': args.radius_km
        },
        'found': len(results),
        'results': results
    }

    # Print the single JSON object to stdout
    print(json.dumps(output))

if __name__ == '__main__':
    main()
