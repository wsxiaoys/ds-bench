#!/usr/bin/env python3
import argparse
import sys
import json
import os
import subprocess
import time
import requests

def is_server_running():
    try:
        response = requests.get('http://localhost:8108/health', timeout=2)
        return response.status_code == 200
    except Exception:
        return False

def ensure_server_running():
    if is_server_running():
        return True
    
    os.makedirs('/home/user/typesense-app/data', exist_ok=True)
    log_path = '/home/user/typesense-app/typesense.log'
    
    # Start typesense-server
    with open(log_path, 'a') as log_file:
        subprocess.Popen(
            [
                '/usr/local/bin/typesense-server',
                '--data-dir=/home/user/typesense-app/data',
                '--api-key=xyz',
                '--api-port=8108'
            ],
            stdout=log_file,
            stderr=log_file,
            start_new_session=True
        )
    
    # Wait for server to start
    for _ in range(20):
        time.sleep(0.5)
        if is_server_running():
            return True
    return False

def setup():
    if not ensure_server_running():
        print("Error: Could not start or connect to Typesense server.", file=sys.stderr)
        sys.exit(1)
        
    headers = {
        "X-TYPESENSE-API-KEY": "xyz",
        "Content-Type": "application/json"
    }
    
    # 1. Create/recreate collection
    print("Recreating collection 'library'...")
    try:
        requests.delete('http://localhost:8108/collections/library', headers=headers, timeout=5)
    except Exception:
        pass
        
    schema = {
        "name": "library",
        "fields": [
            {"name": "title", "type": "string"},
            {"name": "author", "type": "string"},
            {"name": "points", "type": "int32"}
        ],
        "default_sorting_field": "points"
    }
    
    r = requests.post('http://localhost:8108/collections', headers=headers, json=schema, timeout=5)
    r.raise_for_status()
    
    # 2. Index documents
    print("Indexing documents...")
    docs = [
        {"id": "1", "title": "The Great Gatsby", "author": "F Scott Fitzgerald", "points": 90},
        {"id": "2", "title": "The Wizard of Oz", "author": "L Frank Baum", "points": 70},
        {"id": "3", "title": "A Wizard of Earthsea", "author": "Ursula K Le Guin", "points": 85},
        {"id": "4", "title": "Harry Potter and the Sorcerers Stone", "author": "J K Rowling", "points": 95},
        {"id": "5", "title": "The Lord of the Rings", "author": "J R R Tolkien", "points": 99}
    ]
    for doc in docs:
        r = requests.post('http://localhost:8108/collections/library/documents', headers=headers, json=doc, timeout=5)
        r.raise_for_status()
        
    # 3. Create/overwrite stopwords set
    print("Registering stopwords set 'en_stopwords'...")
    stopwords_data = {
        "stopwords": ["the", "a", "of", "and"],
        "locale": "en"
    }
    r = requests.put('http://localhost:8108/stopwords/en_stopwords', headers=headers, json=stopwords_data, timeout=5)
    r.raise_for_status()
    
    # 4. Create/overwrite preset
    print("Registering preset 'library_default'...")
    preset_data = {
        "value": {
            "query_by": "title,author",
            "sort_by": "points:desc",
            "stopwords": "en_stopwords"
        }
    }
    r = requests.put('http://localhost:8108/presets/library_default', headers=headers, json=preset_data, timeout=5)
    r.raise_for_status()
    
    print("Setup completed successfully.")

def search(query_text, explicit=False):
    if not is_server_running():
        # Auto-ensure server is running for convenience, or print error
        if not ensure_server_running():
            print("Error: Typesense server is not running and could not be started.", file=sys.stderr)
            sys.exit(1)

    headers = {
        "X-TYPESENSE-API-KEY": "xyz"
    }
    
    if explicit:
        params = {
            "q": query_text,
            "query_by": "title,author",
            "sort_by": "points:desc",
            "stopwords": "en_stopwords"
        }
    else:
        params = {
            "q": query_text,
            "preset": "library_default"
        }
        
    try:
        response = requests.get(
            'http://localhost:8108/collections/library/documents/search',
            headers=headers,
            params=params,
            timeout=5
        )
        response.raise_for_status()
        res_json = response.json()
        
        found = res_json.get("found", 0)
        hits = [hit["document"]["id"] for hit in res_json.get("hits", []) if "document" in hit and "id" in hit["document"]]
        
        print(json.dumps({"found": found, "hits": hits}))
    except Exception as e:
        print(f"Error during search: {e}", file=sys.stderr)
        if 'response' in locals() and response is not None:
            print(f"Response text: {response.text}", file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Typesense Search Presets and Stopwords CLI")
    parser.add_argument("--setup", action="store_true", help="Setup the Typesense server, collections, documents, stopwords and presets.")
    parser.add_argument("--q", type=str, help="The search query text.")
    parser.add_argument("--explicit", action="store_true", help="Run the search using explicit parameters instead of the preset.")
    
    args = parser.parse_args()
    
    if args.setup:
        setup()
    elif args.q is not None:
        search(args.q, explicit=args.explicit)
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
