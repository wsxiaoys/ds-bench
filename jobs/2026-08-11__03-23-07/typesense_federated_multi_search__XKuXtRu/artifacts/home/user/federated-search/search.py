import os
import sys
import json
import urllib.parse
import requests
import argparse

TYPESENSE_HOST = "localhost"
TYPESENSE_PORT = 8108
TYPESENSE_API_KEY = os.environ.get("TYPESENSE_API_KEY", "xyz")

BASE_URL = f"http://{TYPESENSE_HOST}:{TYPESENSE_PORT}"
HEADERS = {
    "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY,
    "Content-Type": "application/json"
}

COLLECTIONS_CONFIG = [
    {"name": "products", "query_by": "product_name"},
    {"name": "articles", "query_by": "title,body"},
    {"name": "users", "query_by": "username,full_name"}
]

def main():
    parser = argparse.ArgumentParser(description="Federated search across products, articles, and users.")
    parser.add_argument("--query", required=True, help="The search query string")
    args = parser.parse_args()
    
    query = args.query

    # Build the multi_search payload with per-query parameters
    payload = {
        "searches": [
            {
                "collection": config["name"],
                "query_by": config["query_by"]
            }
            for config in COLLECTIONS_CONFIG
        ]
    }

    # Pass the shared query parameter 'q' as a common parameter in the URL query string
    query_params = {
        "q": query
    }
    url = f"{BASE_URL}/multi_search?{urllib.parse.urlencode(query_params)}"

    try:
        res = requests.post(url, json=payload, headers=HEADERS)
        if res.status_code != 200:
            # If the entire multi_search request fails, represent all collections with errors
            error_msg = f"HTTP {res.status_code}: {res.text}"
            results = {
                config["name"]: {"error": error_msg}
                for config in COLLECTIONS_CONFIG
            }
        else:
            response_json = res.json()
            results_slots = response_json.get("results", [])
            
            results = {}
            for config, slot in zip(COLLECTIONS_CONFIG, results_slots):
                name = config["name"]
                if "error" in slot:
                    results[name] = {
                        "error": slot["error"]
                    }
                else:
                    hits = [hit["document"] for hit in slot.get("hits", []) if "document" in hit]
                    results[name] = {
                        "found": slot.get("found", 0),
                        "hits": hits
                    }
    except Exception as e:
        error_msg = str(e)
        results = {
            config["name"]: {"error": error_msg}
            for config in COLLECTIONS_CONFIG
        }

    output = {
        "query": query,
        "results": results
    }

    print(json.dumps(output))
    sys.exit(0)

if __name__ == "__main__":
    main()
