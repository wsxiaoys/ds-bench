import argparse
import json
import sys
import typesense

def main():
    parser = argparse.ArgumentParser(description="Search airports near coordinates")
    parser.add_argument('--lat', type=float, required=True, help="Latitude")
    parser.add_argument('--lng', type=float, required=True, help="Longitude")
    parser.add_argument('--radius-km', type=float, required=True, help="Radius in kilometers")
    
    args = parser.parse_args()
    
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': 'xyz',
        'connection_timeout_seconds': 5
    })

    search_params = {
        'q': '*',
        'filter_by': f'location:({args.lat}, {args.lng}, {args.radius_km} km)',
        'sort_by': f'location({args.lat}, {args.lng}):asc',
        'per_page': 250
    }

    try:
        search_res = client.collections['airports'].documents.search(search_params)
    except Exception as e:
        print(f"Error searching Typesense: {e}", file=sys.stderr)
        sys.exit(1)

    results = []
    for hit in search_res.get('hits', []):
        doc = hit.get('document', {})
        geo_distance = hit.get('geo_distance_meters', {})
        # Typesense returns the distance under the field name inside geo_distance_meters
        distance_meters = geo_distance.get('location', 0)
        
        results.append({
            'id': str(doc.get('id', '')),
            'iata': str(doc.get('iata', '')),
            'name': str(doc.get('name', '')),
            'distance_meters': int(distance_meters)
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

    print(json.dumps(output, indent=2))

if __name__ == '__main__':
    main()
