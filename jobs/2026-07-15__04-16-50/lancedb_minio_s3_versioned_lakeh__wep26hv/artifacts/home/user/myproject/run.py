#!/usr/bin/env python3
import argparse
import sys
import os
import json
import pyarrow as pa
import lancedb
import warnings

# Suppress warnings
warnings.filterwarnings("ignore")

def get_connection():
    return lancedb.connect(
        "s3://lancedb-lakehouse/db",
        storage_options={
            "aws_access_key_id": "minioadmin",
            "aws_secret_access_key": "minioadmin",
            "aws_endpoint": "http://127.0.0.1:9000",
            "aws_region": "us-east-1",
            "allow_http": "true"
        }
    )

def cmd_build(args):
    try:
        db = get_connection()
        
        schema = pa.schema([
            pa.field("id", pa.int64()),
            pa.field("text", pa.string()),
            pa.field("category", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), 8))
        ])
        
        # 1. Create the documents table from /app/fixtures/base.json
        with open("/app/fixtures/base.json", "r") as f:
            base_data = json.load(f)
        
        if "documents" in db.table_names():
            db.drop_table("documents")
            
        tbl = db.create_table("documents", data=pa.Table.from_pylist(base_data, schema=schema), mode="overwrite")
        v_base = tbl.version
        
        # 2. Append the rows from /app/fixtures/added.json
        with open("/app/fixtures/added.json", "r") as f:
            added_data = json.load(f)
            
        tbl.add(pa.Table.from_pylist(added_data, schema=schema))
        v_added = tbl.version
        
        # 3. Delete every row whose category equals legacy
        tbl.delete("category = 'legacy'")
        v_deleted = tbl.version
        
        # 4. Run optimize() on the table
        tbl.optimize()
        v_latest = tbl.version
        
        # Write versions.json
        versions = {
            "base": int(v_base),
            "added": int(v_added),
            "deleted": int(v_deleted),
            "latest": int(v_latest)
        }
        
        os.makedirs("/home/user/myproject", exist_ok=True)
        with open("/home/user/myproject/versions.json", "w") as f:
            json.dump(versions, f, indent=2)
            
        # Clean exit to prevent interpreter shutdown issues with LanceDB/PyArrow background threads
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(0)
    except Exception as e:
        print(f"Error during build: {e}", file=sys.stderr)
        os._exit(1)

def cmd_query(args):
    try:
        db = get_connection()
        if "documents" not in db.table_names():
            print("Error: Table 'documents' does not exist. Run build first.", file=sys.stderr)
            os._exit(1)
            
        tbl = db.open_table("documents")
        
        # Time-travel to the requested version
        tbl.checkout(args.version)
        
        # Load query vector
        with open("/app/fixtures/queries.json", "r") as f:
            queries = json.load(f)
            
        if args.query not in queries:
            print(f"Error: Query '{args.query}' not found in queries.json", file=sys.stderr)
            os._exit(1)
            
        query_vector = queries[args.query]
        
        # Perform L2 vector search
        # We limit to a large number to fetch all candidates, then sort and slice in Python
        # to ensure perfect tie-breaking.
        res = tbl.search(query_vector).metric("l2").limit(1000).to_arrow()
        
        # Extract results and sort them to break ties correctly
        items = []
        for i in range(len(res)):
            items.append({
                "id": res["id"][i].as_py(),
                "distance": res["_distance"][i].as_py()
            })
            
        # Sort nearest-first by ascending L2 distance, breaking ties by ascending id
        items.sort(key=lambda x: (x["distance"], x["id"]))
        
        # Get the top k ids
        top_k_ids = [item["id"] for item in items[:args.k]]
        
        # Print exactly one line of JSON to stdout
        output = {
            "version": args.version,
            "ids": top_k_ids
        }
        print(json.dumps(output))
        
        # Clean exit to prevent interpreter shutdown issues
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(0)
    except Exception as e:
        print(f"Error during query: {e}", file=sys.stderr)
        os._exit(1)

def main():
    parser = argparse.ArgumentParser(description="LanceDB Lakehouse CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    # build subcommand
    subparsers.add_parser("build", help="Build the versioned documents table")
    
    # query subcommand
    query_parser = subparsers.add_parser("query", help="Query the versioned documents table")
    query_parser.add_argument("--query", required=True, help="Query name from queries.json")
    query_parser.add_argument("--version", type=int, required=True, help="Version number to query")
    query_parser.add_argument("--k", type=int, required=True, help="Number of nearest neighbors to return")
    
    args = parser.parse_args()
    
    if args.command == "build":
        cmd_build(args)
    elif args.command == "query":
        cmd_query(args)

if __name__ == "__main__":
    main()
