#!/usr/bin/env python3
"""Versioned LanceDB lakehouse on MinIO.

Two subcommands:

* ``build``  -- (re)create the ``documents`` table on ``s3://lancedb-lakehouse/db``
  from the fixtures in ``/app/fixtures``, performing the create / append / delete
  / optimize sequence and recording each intermediate version number plus the
  final version into ``versions.json`` in this directory.

* ``query --query <name> --version <int> --k <int>`` -- open the table as of the
  given LanceDB version (time-travel) and print a single line of JSON describing
  the nearest ``k`` rows to the named query vector.

The MinIO S3 endpoint, region, and static credentials are taken from the task
environment (see ``_STORAGE_OPTIONS`` below).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import lancedb
import pyarrow as pa


# ---------------------------------------------------------------------------
# Fixed environment constants
# ---------------------------------------------------------------------------

DB_URI = "s3://lancedb-lakehouse/db"
TABLE_NAME = "documents"
VECTOR_DIM = 8

FIXTURES_DIR = Path("/app/fixtures")
BASE_FIXTURE = FIXTURES_DIR / "base.json"
ADDED_FIXTURE = FIXTURES_DIR / "added.json"
QUERIES_FIXTURE = FIXTURES_DIR / "queries.json"

VERSIONS_FILE = Path(__file__).resolve().parent / "versions.json"


# Custom endpoint + plain-HTTP + path-style addressing are required so that
# LanceDB talks to the in-container MinIO server instead of real AWS S3.
_STORAGE_OPTIONS = {
    "aws_access_key_id": "minioadmin",
    "aws_secret_access_key": "minioadmin",
    "aws_region": "us-east-1",
    "aws_endpoint": "http://127.0.0.1:9000",
    "allow_http": "true",
    "aws_virtual_hosted_style_request": "false",
}


# Explicit schema so that the ``vector`` column is stored as a fixed-size
# list of 8 floats, which is what LanceDB expects for L2 nearest-neighbor
# search.
TABLE_SCHEMA = pa.schema(
    [
        pa.field("id", pa.int64(), nullable=False),
        pa.field("text", pa.string(), nullable=False),
        pa.field("category", pa.string(), nullable=False),
        pa.field("vector", pa.list_(pa.float32(), VECTOR_DIM), nullable=False),
    ]
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def connect():
    """Open (and eagerly create) the LanceDB database on MinIO."""
    return lancedb.connect(DB_URI, storage_options=dict(_STORAGE_OPTIONS))


def _load_json(path: Path):
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


# ---------------------------------------------------------------------------
# ``build`` subcommand
# ---------------------------------------------------------------------------

def cmd_build(_args: argparse.Namespace) -> int:
    db = connect()

    # Always start from scratch so the command is rerunnable.
    try:
        db.drop_table(TABLE_NAME)
    except Exception:  # table did not exist
        pass

    base_rows = _load_json(BASE_FIXTURE)
    added_rows = _load_json(ADDED_FIXTURE)

    # 1. Create the table from base.json (version 1).
    table = db.create_table(
        TABLE_NAME,
        data=base_rows,
        schema=TABLE_SCHEMA,
        mode="create",
    )
    base_version = int(table.version)

    # 2. Append added.json (next version).
    table.add(added_rows)
    added_version = int(table.version)

    # 3. Delete every legacy row.
    table.delete("category = 'legacy'")
    deleted_version = int(table.version)

    # 4. Compact the append fragments via optimize(). This always creates at
    #    least one further version; capture the final latest version.
    table.optimize()
    latest_version = int(table.version)

    versions = {
        "base": base_version,
        "added": added_version,
        "deleted": deleted_version,
        "latest": latest_version,
    }
    assert versions["latest"] > versions["deleted"], (
        f"optimize() must advance the version past the delete; got "
        f"{versions['latest']} <= {versions['deleted']}"
    )

    with open(VERSIONS_FILE, "w", encoding="utf-8") as fh:
        json.dump(versions, fh, indent=2, sort_keys=True)
        fh.write("\n")

    # Drop our references so that LanceDB's background threads finish before
    # Python begins interpreter shutdown; otherwise the process can abort
    # with a non-zero exit code on object-storage backends.
    del table
    del db
    return 0


# ---------------------------------------------------------------------------
# ``query`` subcommand
# ---------------------------------------------------------------------------

def cmd_query(args: argparse.Namespace) -> int:
    queries = _load_json(QUERIES_FIXTURE)
    if args.query not in queries:
        raise SystemExit(f"unknown query name: {args.query!r}")
    query_vec = list(queries[args.query])

    db = connect()
    table = db.open_table(TABLE_NAME)

    # Time-travel: pin the table to the requested version before searching.
    table.checkout(int(args.version))

    # ``metric`` defaults to L2 / Euclidean which is exactly what we need.
    df = table.search(query_vec).limit(int(args.k)).to_pandas()

    # Tie-break by id ascending in case two rows are at exactly the same
    # distance from the query vector.
    df = df.sort_values(by=["_distance", "id"], kind="mergesort")
    ids = [int(i) for i in df["id"].tolist()]

    sys.stdout.write(
        json.dumps({"version": int(args.version), "ids": ids}, separators=(",", ":"))
    )
    sys.stdout.write("\n")
    sys.stdout.flush()

    del table
    del db
    return 0


# ---------------------------------------------------------------------------
# CLI plumbing
# ---------------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="run.py",
        description="Versioned LanceDB lakehouse driver (MinIO-backed).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser(
        "build",
        help="(re)build the documents table and write versions.json",
    )

    qp = sub.add_parser(
        "query",
        help="run a vector query against a specific table version",
    )
    qp.add_argument("--query", required=True, help="query name in queries.json")
    qp.add_argument(
        "--version",
        required=True,
        type=int,
        help="LanceDB version number to time-travel to",
    )
    qp.add_argument(
        "--k", required=True, type=int, help="number of nearest neighbours"
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)

    if args.command == "build":
        rc = cmd_build(args)
    elif args.command == "query":
        rc = cmd_query(args)
    else:  # pragma: no cover - argparse ``required=True`` prevents this
        parser.error(f"unknown command: {args.command}")
        rc = 2

    # Flush stdio explicitly so nothing lingers into interpreter shutdown.
    try:
        sys.stdout.flush()
        sys.stderr.flush()
    except Exception:
        pass

    # ``os._exit`` skips the atexit / cleanup chain that, on object-storage
    # backends, can race with LanceDB's background I/O and abort the process
    # with a non-zero exit code after our work is already finished.
    os._exit(rc)


if __name__ == "__main__":
    raise SystemExit(main())