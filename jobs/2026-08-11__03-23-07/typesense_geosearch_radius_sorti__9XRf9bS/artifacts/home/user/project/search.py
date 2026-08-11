import os
import json
import sys
import argparse
import typesense

def main():
    parser = argparse.ArgumentParser(description="Airport Geosearch CLI")
    parser.add_argument('--lat', type=float, required=True, help="Latitude of the reference point")
    parser.add_argument('--lng', type=float, required=True, help="Longitude of the reference point")
    parser.add_argument('--radius-km', type=float, required=True, help="Search radius in kilometers")
    
    args = parser.parse_args()
    
    api_key = os.environ.get('TYPESENSE_API_KEY', 'xyz')
    
    # Initialize Typesense Client
    client = typesense.Client({
        'nodes': [{
            'host': 'localhost',
            'port': '8108',
            'protocol': 'http'
        }],
        'api_key': api_key,
        'connection_timeout_seconds': 5
    })
    
    collection_name = 'airports'
    
    # We set per_page to 250 to ensure we get all matches (dataset is 20 rows)
    search_parameters = {
        'q': '*',
        'filter_by': f'location:({args.lat}, {args.lng}, {args.radius_km} km)',
        'sort_by': f'location({args.lat}, {args.lng}):asc',
        'per_page': 250
    }
    
    try:
        search_res = client.collections[collection_name].documents.search(search_parameters)
    except Exception as e:
        print(f"Error executing search: {e}", file=sys.stderr)
        sys.exit(1)
        
    hits = search_res.get('hits', [])
    
    results = []
    for hit in hits:
        doc = hit.get('document', {})
        geo_dist = hit.get('geo_distance_meters', {})
        # The key inside geo_distance_meters is the geopoint field name, i.e., 'location'
        distance_meters = int(geo_dist.get('location', 0))
        
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
    
    print(json.dumps(output, indent=2))

if __name__ == '__main__':
    main()
