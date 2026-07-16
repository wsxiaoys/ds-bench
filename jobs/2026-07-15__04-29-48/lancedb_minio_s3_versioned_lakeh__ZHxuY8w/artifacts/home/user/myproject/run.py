#!/usr/bin/env python3
"""Versioned LanceDB lakehouse on S3-compatible (MinIO) object storage.

Sub-commands:
  build                 Build the versioned `documents` table on MinIO and
                        record the LanceDB version numbers after each step to
                        versions.json.
  query --query <name>  Time-travel: open the table as of <version>, run an L2
        --version <int> nearest-neighbour search for the query vector named
        --k <int>        <name> and print the matching ids as JSON.
"""
import argparse
import json
import os
import sys

import lancedb

# --------------------------------------------------------------------------- #
# Fixed environment facts
# --------------------------------------------------------------------------- #
DB_URI = "s3://lancedb-lakehouse/db"
TABLE_NAME = "documents"

MINIO_ENDPOINT = "http://127.0.0.1:9000"
MINIO_REGION = "us-east-1"
MINIO_ACCESS_KEY = "minioadmin"
MINIO_SECRET_KEY = "minioadmin"

FIXTURE_BASE = "/app/fixtures/base.json"
FIXTURE_ADDED = "/app/fixtures/added.json"
FIXTURE_QUERIES = "/app/fixtures/queries.json"

VERSIONS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "versions.json")

STORAGE_OPTIONS = {
    "region": MINIO_REGION,
    "aws_access_key_id": MINIO_ACCESS_KEY,
    "aws_secret_access_key": MINIO_SECRET_KEY,
    "aws_endpoint": MINIO_ENDPOINT,
    "allow_http": "true",
}


def connect():
    """Open a LanceDB connection backed by the MinIO S3 store."""
    return lancedb.connect(DB_URI, storage_options=STORAGE_OPTIONS)


def _load_rows(path):
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


# --------------------------------------------------------------------------- #
# build
# --------------------------------------------------------------------------- #
def cmd_build(_args):
    db = connect()

    # Drop any pre-existing table so the command is fully rerunnable and the
    # version counter starts fresh at 1.
    db.drop_table(TABLE_NAME, ignore_missing=True)

    rows_base = _load_rows(FIXTURE_BASE)
    rows_added = _load_rows(FIXTURE_ADDED)

    # 1. Create the table from base.json (overwrite semantics via the drop above).
    table = db.create_table(TABLE_NAME, rows_base, mode="overwrite")
    base_version = table.version

    # 2. Append the rows from added.json.
    table.add(rows_added)
    table.checkout_latest()
    added_version = table.version

    # 3. Delete every row whose category == 'legacy'.
    table.delete("category = 'legacy'")
    table.checkout_latest()
    deleted_version = table.version

    # 4. Run optimize() to compact the small data files produced by the append.
    table.optimize()
    table.checkout_latest()
    latest_version = table.version

    versions = {
        "base": int(base_version),
        "added": int(added_version),
        "deleted": int(deleted_version),
        "latest": int(latest_version),
    }

    if not (versions["latest"] > versions["deleted"]):
        # optimize() must produce at least one further version.
        raise RuntimeError(
            "optimize() did not create a newer version: "
            f"deleted={versions['deleted']} latest={versions['latest']}"
        )

    with open(VERSIONS_PATH, "w", encoding="utf-8") as fh:
        json.dump(versions, fh, indent=2)
        fh.write("\n")

    # Flush everything to object storage before we force a clean exit.
    del table
    del db

    print(
        "build: base={base} added={added} deleted={deleted} latest={latest}".format(
            **versions
        ),
        file=sys.stderr,
    )
    # LanceDB background threads can abort during interpreter shutdown when
    # writing to object storage; force a clean exit status 0.
    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(0)


# --------------------------------------------------------------------------- #
# query
# --------------------------------------------------------------------------- #
def cmd_query(args):
    db = connect()
    table = db.open_table(TABLE_NAME)

    queries = _load_rows(FIXTURE_QUERIES)
    if args.query not in queries:
        print(f"unknown query name: {args.query}", file=sys.stderr)
        os._exit(1)

    query_vector = queries[args.query]

    # Time-travel: check out the requested version.
    version = int(args.version)
    table.checkout(version)

    # L2 nearest-neighbour search.
    results = (
        table.search(query_vector)
        .metric("L2")
        .limit(int(args.k))
        .to_list()
    )

    # Order nearest-first by ascending L2 distance, breaking ties by id.
    results.sort(key=lambda r: (r["_distance"], r["id"]))
    ids = [int(r["id"]) for r in results[: int(args.k)]]

    payload = {"version": version, "ids": ids}
    print(json.dumps(payload), flush=True)

    sys.stdout.flush()
    sys.stderr.flush()
    os._exit(0)


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def main():
    parser = argparse.ArgumentParser(description="LanceDB MinIO lakehouse CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("build", help="build the versioned table and write versions.json")

    q = sub.add_parser("query", help="time-travel L2 vector search")
    q.add_argument("--query", required=True, help="query vector name in queries.json")
    q.add_argument("--version", required=True, type=int, help="LanceDB version to read")
    q.add_argument("--k", required=True, type=int, help="number of nearest neighbours")

    args = parser.parse_args()
    if args.command == "build":
        cmd_build(args)
    elif args.command == "query":
        cmd_query(args)


if __name__ == "__main__":
    main()