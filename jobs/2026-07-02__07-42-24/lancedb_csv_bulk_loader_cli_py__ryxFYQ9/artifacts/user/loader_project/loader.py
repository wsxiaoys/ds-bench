#!/usr/bin/env python3
import os
import sys
import csv
import json
import time
import argparse
import httpx
import lancedb
import pyarrow as pa
from openai import OpenAI

DB_DIR = "/home/user/loader_project/lance_db"

def get_embeddings_with_retry(client, texts, model="text-embedding-3-small", max_retries=5, initial_backoff=1.0):
    retries = 0
    backoff = initial_backoff
    while True:
        try:
            response = client.embeddings.create(
                input=texts,
                model=model
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            retries += 1
            if retries > max_retries:
                print(f"Error calling OpenAI API after {max_retries} retries: {e}", file=sys.stderr)
                raise e
            print(f"OpenAI API call failed: {e}. Retrying in {backoff:.1f}s...", file=sys.stderr)
            time.sleep(backoff)
            backoff *= 2.0

def handle_ingest(args):
    # Ensure OPENAI_API_KEY is set
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)
    
    # Read CSV file
    csv_path = args.csv
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found at '{csv_path}'", file=sys.stderr)
        sys.exit(1)
        
    print(f"Reading CSV file from {csv_path}...", file=sys.stderr)
    try:
        with open(csv_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except Exception as e:
        print(f"Error reading CSV file: {e}", file=sys.stderr)
        sys.exit(1)
        
    print(f"Successfully read {len(rows)} rows from CSV.", file=sys.stderr)
    if not rows:
        print("CSV file is empty or contains no data rows.", file=sys.stderr)
        # We still want to connect to DB and create an empty table with the correct schema
    
    text_col = args.text_col
    if rows and text_col not in rows[0]:
        print(f"Error: Chosen text column '{text_col}' not found in CSV headers: {list(rows[0].keys())}", file=sys.stderr)
        sys.exit(1)
        
    # Set up LanceDB
    print(f"Connecting to LanceDB at {DB_DIR}...", file=sys.stderr)
    os.makedirs(DB_DIR, exist_ok=True)
    db = lancedb.connect(DB_DIR)
    
    # Define PyArrow schema
    schema = pa.schema([
        pa.field("id", pa.int64()),
        pa.field("title", pa.string()),
        pa.field("body", pa.string()),
        pa.field("category", pa.string()),
        pa.field("published", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), 1536))
    ])
    
    # Create or overwrite table
    table_name = args.table
    print(f"Creating table '{table_name}' with overwrite-on-rerun semantics...", file=sys.stderr)
    table = db.create_table(table_name, schema=schema, mode="overwrite")
    
    if not rows:
        print("No rows to ingest. Table created empty.", file=sys.stderr)
        sys.exit(0)
        
    # Initialize OpenAI client
    client = OpenAI(api_key=api_key, http_client=httpx.Client())
    
    # Split rows into batches
    batch_size = args.batch_size
    if batch_size <= 0:
        print(f"Error: Batch size must be a positive integer, got {batch_size}", file=sys.stderr)
        sys.exit(1)
        
    batches = [rows[i:i + batch_size] for i in range(0, len(rows), batch_size)]
    print(f"Splitting ingestion into {len(batches)} batches of size {batch_size}...", file=sys.stderr)
    
    for idx, batch in enumerate(batches):
        print(f"Processing batch {idx + 1}/{len(batches)} (size: {len(batch)})...", file=sys.stderr)
        texts = [row[text_col] for row in batch]
        # Defensively handle empty or whitespace-only texts to avoid OpenAI API errors
        texts_to_embed = [t if (t and t.strip()) else " " for t in texts]
        
        try:
            embeddings = get_embeddings_with_retry(client, texts_to_embed)
        except Exception as e:
            print(f"Failed to generate embeddings for batch {idx + 1}: {e}", file=sys.stderr)
            sys.exit(1)
            
        # Format rows for table addition
        batch_data = []
        for row, emb in zip(batch, embeddings):
            batch_data.append({
                "id": int(row["id"]),
                "title": str(row["title"]),
                "body": str(row["body"]),
                "category": str(row["category"]),
                "published": str(row["published"]),
                "vector": emb
            })
            
        try:
            table.add(batch_data)
        except Exception as e:
            print(f"Error adding batch {idx + 1} to LanceDB: {e}", file=sys.stderr)
            sys.exit(1)
            
    print(f"Ingestion complete. Preserved {len(table)} rows in table '{table_name}'.", file=sys.stderr)
    sys.exit(0)

def handle_search(args):
    # Ensure OPENAI_API_KEY is set
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Error: OPENAI_API_KEY environment variable is not set.", file=sys.stderr)
        sys.exit(1)
        
    table_name = args.table
    query_string = args.query
    k = args.k
    
    if k <= 0:
        # If k is 0 or negative, we output an empty result list
        output = {
            "query": query_string,
            "k": k,
            "results": []
        }
        print(json.dumps(output, indent=2))
        sys.exit(0)
        
    # Set up LanceDB
    if not os.path.exists(DB_DIR):
        print(f"Error: LanceDB database directory '{DB_DIR}' does not exist.", file=sys.stderr)
        sys.exit(1)
        
    db = lancedb.connect(DB_DIR)
    if table_name not in db.table_names():
        print(f"Error: Table '{table_name}' does not exist in LanceDB.", file=sys.stderr)
        sys.exit(1)
        
    table = db.open_table(table_name)
    
    # Initialize OpenAI client
    client = OpenAI(api_key=api_key, http_client=httpx.Client())
    
    # Embed query string
    try:
        query_vector = get_embeddings_with_retry(client, [query_string])[0]
    except Exception as e:
        print(f"Failed to generate embedding for query: {e}", file=sys.stderr)
        sys.exit(1)
        
    # Perform vector search
    try:
        search_results = table.search(query_vector).limit(k).to_list()
    except Exception as e:
        print(f"Error during vector search: {e}", file=sys.stderr)
        sys.exit(1)
        
    # Format results
    results = []
    for row in search_results:
        results.append({
            "id": int(row["id"]),
            "title": str(row["title"]),
            "category": str(row["category"]),
            "published": str(row["published"]),
            "score": float(row["_distance"])
        })
        
    output = {
        "query": query_string,
        "k": k,
        "results": results
    }
    
    # Print JSON to stdout
    print(json.dumps(output, indent=2))
    sys.exit(0)

def main():
    parser = argparse.ArgumentParser(description="CSV Bulk Loader CLI for LanceDB")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # Ingest subcommand
    ingest_parser = subparsers.add_parser("ingest", help="Ingest a CSV file into LanceDB")
    ingest_parser.add_argument("--csv", required=True, help="Path to the CSV file")
    ingest_parser.add_argument("--table", required=True, help="Name of the LanceDB table")
    ingest_parser.add_argument("--text-col", required=True, help="Name of the text column to embed")
    ingest_parser.add_argument("--batch-size", type=int, required=True, help="Batch size for embedding and ingestion")
    
    # Search subcommand
    search_parser = subparsers.add_parser("search", help="Search the LanceDB table")
    search_parser.add_argument("--table", required=True, help="Name of the LanceDB table")
    search_parser.add_argument("--query", required=True, help="Query string to search for")
    search_parser.add_argument("--k", type=int, required=True, help="Number of top results to return")
    
    args = parser.parse_args()
    
    if args.command == "ingest":
        handle_ingest(args)
    elif args.command == "search":
        handle_search(args)

if __name__ == "__main__":
    main()
