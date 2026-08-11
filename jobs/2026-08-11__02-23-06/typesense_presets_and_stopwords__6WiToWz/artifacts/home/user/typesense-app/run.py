import argparse
import json
import os
import socket
import subprocess
import sys
import time
import requests

def is_port_in_use(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('localhost', port)) == 0

def ensure_server_running():
    port = 8108
    api_key = 'xyz'
    data_dir = '/home/user/typesense-app/data'
    log_file_path = '/home/user/typesense-app/typesense.log'

    os.makedirs(data_dir, exist_ok=True)

    # Check if server is already running and healthy
    if is_port_in_use(port):
        try:
            r = requests.get(f'http://localhost:{port}/health', headers={'X-TYPESENSE-API-KEY': api_key}, timeout=2)
            if r.status_code == 200 and r.json().get('ok') is True:
                # Server is already running and healthy!
                return
        except Exception:
            pass

    # If not running or not responding properly, start the typesense-server
    cmd = [
        '/usr/local/bin/typesense-server',
        f'--data-dir={data_dir}',
        f'--api-key={api_key}',
        f'--api-port={port}'
    ]
    
    log_file = open(log_file_path, 'a')
    # Use start_new_session=True to detach the process so it lives on
    subprocess.Popen(cmd, stdout=log_file, stderr=log_file, start_new_session=True)
    
    # Wait for server to become healthy
    start_time = time.time()
    while time.time() - start_time < 15:
        try:
            r = requests.get(f'http://localhost:{port}/health', headers={'X-TYPESENSE-API-KEY': api_key}, timeout=1)
            if r.status_code == 200 and r.json().get('ok') is True:
                return
        except Exception:
            pass
        time.sleep(0.5)
    
    raise RuntimeError("Typesense server failed to start or become healthy within 15 seconds.")

def setup_all():
    ensure_server_running()
    
    port = 8108
    api_key = 'xyz'
    headers = {'X-TYPESENSE-API-KEY': api_key, 'Content-Type': 'application/json'}
    base_url = f'http://localhost:{port}'

    # 1. Setup stopwords set
    # Create/update stopwords set named en_stopwords
    stopwords_payload = {
        "stopwords": ["the", "a", "of", "and"],
        "locale": "en"
    }
    r = requests.put(f'{base_url}/stopwords/en_stopwords', headers=headers, json=stopwords_payload)
    r.raise_for_status()

    # 2. Setup collection
    # Delete if exists to make it safe to re-run and avoid duplicates
    requests.delete(f'{base_url}/collections/library', headers=headers)

    collection_schema = {
        "name": "library",
        "fields": [
            {"name": "title", "type": "string"},
            {"name": "author", "type": "string"},
            {"name": "points", "type": "int32"}
        ],
        "default_sorting_field": "points"
    }
    r = requests.post(f'{base_url}/collections', headers=headers, json=collection_schema)
    r.raise_for_status()

    # Index 5 documents
    documents = [
        {"id": "1", "title": "The Great Gatsby", "author": "F Scott Fitzgerald", "points": 90},
        {"id": "2", "title": "The Wizard of Oz", "author": "L Frank Baum", "points": 70},
        {"id": "3", "title": "A Wizard of Earthsea", "author": "Ursula K Le Guin", "points": 85},
        {"id": "4", "title": "Harry Potter and the Sorcerers Stone", "author": "J K Rowling", "points": 95},
        {"id": "5", "title": "The Lord of the Rings", "author": "J R R Tolkien", "points": 99}
    ]
    jsonl_data = "\n".join(json.dumps(doc) for doc in documents)
    r = requests.post(f'{base_url}/collections/library/documents/import?action=create', headers=headers, data=jsonl_data)
    r.raise_for_status()

    # 3. Setup preset named library_default
    preset_payload = {
        "value": {
            "query_by": "title,author",
            "sort_by": "points:desc",
            "stopwords": "en_stopwords"
        }
    }
    r = requests.put(f'{base_url}/presets/library_default', headers=headers, json=preset_payload)
    r.raise_for_status()

def run_search(query_text, explicit):
    port = 8108
    api_key = 'xyz'
    headers = {'X-TYPESENSE-API-KEY': api_key}
    base_url = f'http://localhost:{port}'

    if explicit:
        params = {
            'q': query_text,
            'query_by': 'title,author',
            'sort_by': 'points:desc',
            'stopwords': 'en_stopwords'
        }
    else:
        params = {
            'q': query_text,
            'preset': 'library_default'
        }

    r = requests.get(f'{base_url}/collections/library/documents/search', headers=headers, params=params)
    r.raise_for_status()
    
    response_json = r.json()
    found = response_json.get('found', 0)
    hits = []
    for hit in response_json.get('hits', []):
        doc = hit.get('document', {})
        doc_id = doc.get('id')
        if doc_id is not None:
            hits.append(str(doc_id))
            
    output = {
        "found": found,
        "hits": hits
    }
    print(json.dumps(output))

def main():
    parser = argparse.ArgumentParser(description="Typesense CLI Tool")
    parser.add_argument('--setup', action='store_true', help='Setup the Typesense server, collection, stopwords, and preset')
    parser.add_argument('--q', type=str, help='Query text to search')
    parser.add_argument('--explicit', action='store_true', help='Run search explicitly without referencing the preset')

    args = parser.parse_args()

    if args.setup:
        try:
            setup_all()
            # print("Setup completed successfully.")
        except Exception as e:
            print(f"Error during setup: {e}", file=sys.stderr)
            sys.exit(1)
    elif args.q is not None:
        try:
            run_search(args.q, args.explicit)
        except Exception as e:
            print(f"Error during search: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
