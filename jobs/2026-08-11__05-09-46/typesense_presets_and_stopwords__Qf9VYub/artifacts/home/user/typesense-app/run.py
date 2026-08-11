#!/usr/bin/env python3
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.parse
import urllib.error

TYPESENSE_URL = "http://localhost:8108"
API_KEY = "xyz"

def ensure_server_running():
    # Check health
    try:
        req = urllib.request.Request(f"{TYPESENSE_URL}/health")
        req.add_header("X-TYPESENSE-API-KEY", API_KEY)
        with urllib.request.urlopen(req, timeout=1) as response:
            if response.status == 200:
                data = json.loads(response.read().decode())
                if data.get("ok"):
                    print("Typesense server is already running and healthy.")
                    return
    except Exception:
        pass

    print("Typesense server is not running or not healthy. Starting it...")
    os.makedirs("/home/user/typesense-app/data", exist_ok=True)
    
    # Redirect stdout and stderr to logs
    stdout_log = open("/home/user/typesense-app/typesense.log", "a")
    stderr_log = open("/home/user/typesense-app/typesense.err", "a")
    
    cmd = [
        "/usr/local/bin/typesense-server",
        "--data-dir=/home/user/typesense-app/data",
        "--api-key=xyz",
        "--api-port=8108"
    ]
    
    subprocess.Popen(cmd, stdout=stdout_log, stderr=stderr_log, start_new_session=True)
    
    # Wait for health
    for _ in range(30):
        try:
            req = urllib.request.Request(f"{TYPESENSE_URL}/health")
            req.add_header("X-TYPESENSE-API-KEY", API_KEY)
            with urllib.request.urlopen(req, timeout=1) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    if data.get("ok"):
                        print("Typesense server started successfully.")
                        return
        except Exception:
            pass
        time.sleep(1)
    
    raise RuntimeError("Typesense server failed to start within 30 seconds")

def setup_collection():
    # 1. Delete collection if exists
    req = urllib.request.Request(f"{TYPESENSE_URL}/collections/library", method="DELETE")
    req.add_header("X-TYPESENSE-API-KEY", API_KEY)
    try:
        with urllib.request.urlopen(req) as resp:
            print("Deleted existing library collection.")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print("Library collection did not exist.")
        else:
            print(f"Error deleting collection: {e.read().decode()}")
            raise

    # 2. Create collection
    schema = {
        "name": "library",
        "fields": [
            {"name": "title", "type": "string"},
            {"name": "author", "type": "string"},
            {"name": "points", "type": "int32"}
        ],
        "default_sorting_field": "points"
    }
    
    req = urllib.request.Request(
        f"{TYPESENSE_URL}/collections",
        data=json.dumps(schema).encode("utf-8"),
        method="POST"
    )
    req.add_header("X-TYPESENSE-API-KEY", API_KEY)
    req.add_header("Content-Type", "application/json")
    
    with urllib.request.urlopen(req) as resp:
        print("Created library collection successfully.")

def index_documents():
    documents = [
        {"id": "1", "title": "The Great Gatsby", "author": "F Scott Fitzgerald", "points": 90},
        {"id": "2", "title": "The Wizard of Oz", "author": "L Frank Baum", "points": 70},
        {"id": "3", "title": "A Wizard of Earthsea", "author": "Ursula K Le Guin", "points": 85},
        {"id": "4", "title": "Harry Potter and the Sorcerers Stone", "author": "J K Rowling", "points": 95},
        {"id": "5", "title": "The Lord of the Rings", "author": "J R R Tolkien", "points": 99}
    ]
    
    for doc in documents:
        req = urllib.request.Request(
            f"{TYPESENSE_URL}/collections/library/documents",
            data=json.dumps(doc).encode("utf-8"),
            method="POST"
        )
        req.add_header("X-TYPESENSE-API-KEY", API_KEY)
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req) as resp:
            pass
    print("Indexed 5 documents successfully.")

def setup_stopwords():
    payload = {
        "stopwords": ["the", "a", "of", "and"],
        "locale": "en"
    }
    req = urllib.request.Request(
        f"{TYPESENSE_URL}/stopwords/en_stopwords",
        data=json.dumps(payload).encode("utf-8"),
        method="PUT"
    )
    req.add_header("X-TYPESENSE-API-KEY", API_KEY)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as resp:
        print("Created/updated stopwords set 'en_stopwords'.")

def setup_presets():
    payload = {
        "value": {
            "query_by": "title,author",
            "sort_by": "points:desc",
            "stopwords": "en_stopwords"
        }
    }
    req = urllib.request.Request(
        f"{TYPESENSE_URL}/presets/library_default",
        data=json.dumps(payload).encode("utf-8"),
        method="PUT"
    )
    req.add_header("X-TYPESENSE-API-KEY", API_KEY)
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as resp:
        print("Created/updated preset 'library_default'.")

def run_preset_search(q):
    params = {
        "q": q,
        "preset": "library_default"
    }
    url = f"{TYPESENSE_URL}/collections/library/documents/search?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url)
    req.add_header("X-TYPESENSE-API-KEY", API_KEY)
    
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        
    found = data.get("found", 0)
    hits = [hit["document"]["id"] for hit in data.get("hits", [])]
    return {
        "found": found,
        "hits": hits
    }

def run_explicit_search(q):
    params = {
        "q": q,
        "query_by": "title,author",
        "sort_by": "points:desc",
        "stopwords": "en_stopwords"
    }
    url = f"{TYPESENSE_URL}/collections/library/documents/search?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url)
    req.add_header("X-TYPESENSE-API-KEY", API_KEY)
    
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        
    found = data.get("found", 0)
    hits = [hit["document"]["id"] for hit in data.get("hits", [])]
    return {
        "found": found,
        "hits": hits
    }

def main():
    parser = argparse.ArgumentParser(description="Typesense App CLI")
    parser.add_argument("--setup", action="store_true", help="Setup Typesense server, collection, stopwords, and presets")
    parser.add_argument("--q", type=str, help="Search query text")
    parser.add_argument("--explicit", action="store_true", help="Run explicit search instead of preset search")
    
    args = parser.parse_args()
    
    if args.setup:
        ensure_server_running()
        setup_collection()
        index_documents()
        setup_stopwords()
        setup_presets()
        print("Setup completed successfully.")
        sys.exit(0)
        
    if args.q is not None:
        if args.explicit:
            res = run_explicit_search(args.q)
        else:
            res = run_preset_search(args.q)
        print(json.dumps(res))
        sys.exit(0)
        
    parser.print_help()
    sys.exit(1)

if __name__ == "__main__":
    main()
