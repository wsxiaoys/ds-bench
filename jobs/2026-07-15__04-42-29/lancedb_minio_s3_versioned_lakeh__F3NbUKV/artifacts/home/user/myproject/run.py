#!/usr/bin/env python3
"""
Versioned LanceDB Lakehouse on MinIO (S3-compatible object storage).

Subcommands:
  build  -- create/overwrite the documents table, append, delete, optimize,
             and write versions.json
  query  -- time-travel vector search on the documents table
"""

import argparse
import json
import os
import sys

import pyarrow as pa
import lancedb

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
S3_URI = "s3://lancedb-lakehouse/db"
TABLE_NAME = "documents"
VERSIONS_PATH = os.path.join(os.path.dirname(__file__), "versions.json")

FIXTURES_BASE = "/app/fixtures/base.json"
FIXTURES_ADDED = "/app/fixtures/added.json"
FIXTURES_QUERIES = "/app/fixtures/queries.json"

STORAGE_OPTIONS = {
    "endpoint_url": "http://127.0.0.1:9000",
    "region": "us-east-1",
    "aws_access_key_id": "minioadmin",
    "aws_secret_access_key": "minioadmin",
    "allow_http": "true",
}

# ---------------------------------------------------------------------------
# Schema helpers
# ---------------------------------------------------------------------------
SCHEMA = pa.schema([
    pa.field("id", pa.int64()),
    pa.field("text", pa.utf8()),
    pa.field("category", pa.utf8()),
    pa.field("vector", pa.list_(pa.float32(), 8)),
])


def rows_to_table(rows: list) -> pa.Table:
    """Convert a list of fixture dicts to a PyArrow table matching SCHEMA."""
    ids = pa.array([r["id"] for r in rows], type=pa.int64())
    texts = pa.array([r["text"] for r in rows], type=pa.utf8())
    categories = pa.array([r["category"] for r in rows], type=pa.utf8())
    vectors = pa.array(
        [[float(v) for v in r["vector"]] for r in rows],
        type=pa.list_(pa.float32(), 8),
    )
    return pa.table(
        {"id": ids, "text": texts, "category": categories, "vector": vectors},
        schema=SCHEMA,
    )


# ---------------------------------------------------------------------------
# build
# ---------------------------------------------------------------------------
def cmd_build():
    # Load fixtures
    with open(FIXTURES_BASE, "r") as f:
        base_rows = json.load(f)
    with open(FIXTURES_ADDED, "r") as f:
        added_rows = json.load(f)

    # Connect
    db = lancedb.connect(S3_URI, storage_options=STORAGE_OPTIONS)

    # Step 1 – create table (overwrite)
    tbl = db.create_table(
        TABLE_NAME,
        data=rows_to_table(base_rows),
        mode="overwrite",
    )
    version_base = tbl.version
    print(f"[build] base version: {version_base}", file=sys.stderr)

    # Step 2 – append
    tbl.add(rows_to_table(added_rows))
    version_added = tbl.version
    print(f"[build] added version: {version_added}", file=sys.stderr)

    # Step 3 – delete legacy rows
    tbl.delete("category = 'legacy'")
    version_deleted = tbl.version
    print(f"[build] deleted version: {version_deleted}", file=sys.stderr)

    # Step 4 – optimize (compact)
    tbl.optimize()
    version_latest = tbl.version
    print(f"[build] latest version (after optimize): {version_latest}", file=sys.stderr)

    # Write versions.json
    versions = {
        "base": version_base,
        "added": version_added,
        "deleted": version_deleted,
        "latest": version_latest,
    }
    with open(VERSIONS_PATH, "w") as f:
        json.dump(versions, f, indent=2)
    print(f"[build] versions.json written: {versions}", file=sys.stderr)


# ---------------------------------------------------------------------------
# query
# ---------------------------------------------------------------------------
def cmd_query(query_name: str, version: int, k: int):
    # Load query vector
    with open(FIXTURES_QUERIES, "r") as f:
        queries = json.load(f)
    if query_name not in queries:
        print(
            f"Unknown query name '{query_name}'. Available: {list(queries.keys())}",
            file=sys.stderr,
        )
        sys.exit(1)
    query_vector = [float(v) for v in queries[query_name]]

    # Connect and time-travel
    db = lancedb.connect(S3_URI, storage_options=STORAGE_OPTIONS)
    tbl = db.open_table(TABLE_NAME)
    tbl.checkout(version)

    # Vector search – L2; include _distance to avoid deprecation warning
    results = (
        tbl.search(query_vector, vector_column_name="vector")
        .metric("l2")
        .limit(k)
        .select(["id", "_distance"])
        .to_arrow()
    )

    # Build id list ordered by ascending L2 distance, tie-break by ascending id
    # The results from LanceDB are already ordered by distance; we collect them
    # and re-sort to guarantee tie-breaking by id.
    rows_list = results.to_pylist()

    # results contain '_distance' column from LanceDB search
    rows_list.sort(key=lambda r: (r.get("_distance", 0.0), r["id"]))
    ids = [int(r["id"]) for r in rows_list]

    output = {"version": version, "ids": ids}
    print(json.dumps(output))


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="LanceDB versioned lakehouse CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("build", help="Build / rebuild the versioned documents table")

    q_parser = sub.add_parser("query", help="Time-travel vector search")
    q_parser.add_argument("--query", required=True, dest="query_name",
                          help="Name of query vector in queries.json")
    q_parser.add_argument("--version", required=True, type=int,
                          help="LanceDB table version to query (time-travel)")
    q_parser.add_argument("--k", required=True, type=int,
                          help="Number of nearest neighbours to return")

    args = parser.parse_args()

    if args.command == "build":
        cmd_build()
        # Explicit clean exit to avoid any LanceDB / object-store shutdown noise
        sys.exit(0)
    elif args.command == "query":
        cmd_query(args.query_name, args.version, args.k)
        sys.exit(0)


if __name__ == "__main__":
    main()
