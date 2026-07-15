#!/usr/bin/env python3
"""Hybrid LanceDB + DuckDB analytics bridge.

Retrieves semantic candidates from a local LanceDB table via L2 vector
search, then analyses the candidate pool with DuckDB SQL: a JOIN against an
auxiliary categories CSV, predicate filters, a per-department aggregation, and
a per-department ranking window function.
"""

import argparse
import json
import os
import sys

import duckdb
import lancedb
import pyarrow as pa

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(PROJECT_DIR, "data")
LANCEDB_PATH = os.path.join(PROJECT_DIR, "lancedb")
DOCUMENTS_PATH = os.path.join(DATA_DIR, "documents.jsonl")
CATEGORIES_PATH = os.path.join(DATA_DIR, "categories.csv")
TABLE_NAME = "documents"
VECTOR_DIM = 8


# --------------------------------------------------------------------------- #
# LanceDB ingestion
# --------------------------------------------------------------------------- #
def load_documents():
    """Read documents.jsonl into a list of dicts."""
    records = []
    with open(DOCUMENTS_PATH, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            records.append(json.loads(line))
    return records


def build_arrow_table(records):
    """Build a PyArrow table with the vector column typed as a fixed-size
    list of float32 so LanceDB can perform vector search against a float32
    query vector."""
    ids = pa.array([r["id"] for r in records], type=pa.int64())
    titles = pa.array([r["title"] for r in records], type=pa.utf8())
    categories = pa.array([r["category"] for r in records], type=pa.utf8())
    prices = pa.array([r["price"] for r in records], type=pa.float64())
    in_stocks = pa.array([r["in_stock"] for r in records], type=pa.bool_())
    # fixed_size_list<item: float>[8]  -- required for a searchable vector column
    vectors = pa.array(
        [r["vector"] for r in records], type=pa.list_(pa.float32(), VECTOR_DIM)
    )
    return pa.table(
        {
            "id": ids,
            "title": titles,
            "category": categories,
            "price": prices,
            "in_stock": in_stocks,
            "vector": vectors,
        }
    )


def ensure_table():
    """Create (or recreate) the LanceDB table and return the opened table
    handle.  Dropping and recreating keeps the CLI fully rerunnable and
    deterministic regardless of any prior state."""
    db = lancedb.connect(LANCEDB_PATH)
    records = load_documents()
    arrow_table = build_arrow_table(records)
    db.drop_table(TABLE_NAME, ignore_missing=True)
    table = db.create_table(TABLE_NAME, data=arrow_table)
    # Fold the newly added rows into the table's index structures.
    table.optimize()
    return table


# --------------------------------------------------------------------------- #
# LanceDB retrieval
# --------------------------------------------------------------------------- #
def retrieve_candidates(table, query_vector, top_k):
    """Return the top-K nearest documents from LanceDB using L2 distance.

    No metadata filtering is applied at the LanceDB stage -- the candidate pool
    is the raw nearest neighbours.  The returned Arrow table includes the
    LanceDB ``_distance`` column (L2 distance).
    """
    results = (
        table.search(query_vector, vector_column_name="vector")
        .metric("L2")
        .limit(top_k)
        .to_arrow()
    )
    return results


# --------------------------------------------------------------------------- #
# DuckDB analytics
# --------------------------------------------------------------------------- #
def analyse(candidates_arrow, max_price, category):
    """Run the analytics pipeline inside DuckDB.

    The LanceDB candidate set (an Arrow table) and the auxiliary categories
    CSV are registered as DuckDB relations.  DuckDB then performs the JOIN,
    predicate filtering, per-department aggregation, and the ROW_NUMBER()
    window function.  Category values may contain apostrophes; these are
    handled via DuckDB named-parameter binding rather than string
    interpolation.
    """
    con = duckdb.connect(database=":memory:")
    # Register the LanceDB result set as a DuckDB relation.
    con.register("candidates", candidates_arrow)
    # Register the auxiliary categories CSV.
    con.execute(
        "CREATE VIEW categories AS "
        "SELECT category, department, tax_rate "
        f"FROM read_csv_auto('{CATEGORIES_PATH}')"
    )

    # Build the filtered + ranked set.  Parameters are bound once via a
    # params CTE so each named parameter appears exactly once, and apostrophe
    # containing values are handled safely by the binding layer.
    con.execute(
        """
        CREATE TEMP TABLE ranked AS
        WITH params AS (
            SELECT $max_price AS max_price,
                   $category  AS cat_filter
        ),
        filtered AS (
            SELECT c.id           AS id,
                   c.title        AS title,
                   c.category     AS category,
                   cat.department AS department,
                   CAST(c.price     AS DOUBLE) AS price,
                   CAST(c._distance AS DOUBLE) AS distance
            FROM candidates c, params
            JOIN categories cat
              ON c.category = cat.category
            WHERE c.in_stock = true
              AND c.price <= params.max_price
              AND (params.cat_filter IS NULL
                   OR c.category = params.cat_filter)
        )
        SELECT id, title, category, department, price, distance,
               ROW_NUMBER() OVER (
                   PARTITION BY department
                   ORDER BY distance ASC, id ASC
               ) AS dept_rank
        FROM filtered
        """,
        {"max_price": max_price, "category": category},
    )

    # Surviving candidates ordered by ascending distance, ties broken by id.
    hits = (
        con.execute(
            "SELECT id, title, category, department, price, distance, dept_rank "
            "FROM ranked "
            "ORDER BY distance ASC, id ASC"
        )
        .to_arrow_table()
        .to_pylist()
    )

    # Per-department aggregation over the surviving hit set.
    departments = (
        con.execute(
            "SELECT department, "
            "COUNT(*) AS num_docs, "
            "ROUND(AVG(price), 4) AS avg_price, "
            "MIN(distance) AS min_distance "
            "FROM ranked "
            "GROUP BY department "
            "ORDER BY department ASC"
        )
        .to_arrow_table()
        .to_pylist()
    )

    return hits, departments


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def parse_query_vector(raw):
    """Parse a comma-separated list of exactly 8 floats."""
    parts = [p.strip() for p in raw.split(",") if p.strip() != ""]
    try:
        values = [float(p) for p in parts]
    except ValueError:
        raise ValueError(f"--query-vector contains non-numeric values: {raw!r}")
    if len(values) != VECTOR_DIM:
        raise ValueError(
            f"--query-vector must contain exactly {VECTOR_DIM} floats, "
            f"got {len(values)}"
        )
    return values


def main(argv=None):
    parser = argparse.ArgumentParser(
        description="Hybrid LanceDB + DuckDB analytics bridge"
    )
    parser.add_argument(
        "--query-vector",
        required=True,
        help=f"Comma-separated list of exactly {VECTOR_DIM} floats.",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        required=True,
        help="Size of the LanceDB nearest-neighbour candidate pool.",
    )
    parser.add_argument(
        "--max-price",
        type=float,
        required=True,
        help="Only candidates with price <= max_price are kept.",
    )
    parser.add_argument(
        "--category",
        default=None,
        help="Optional exact category filter (may contain apostrophes).",
    )

    args = parser.parse_args(argv)

    # --- parse & validate the query vector -------------------------------- #
    try:
        query_vector = parse_query_vector(args.query_vector)
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    if args.top_k <= 0:
        print("error: --top-k must be a positive integer", file=sys.stderr)
        return 2

    # --- LanceDB ingestion / retrieval ----------------------------------- #
    table = ensure_table()
    candidates_arrow = retrieve_candidates(table, query_vector, args.top_k)

    # --- DuckDB analytics -------------------------------------------------- #
    hits, departments = analyse(candidates_arrow, args.max_price, args.category)

    # --- output: a single JSON object ------------------------------------- #
    output = {"hits": hits, "departments": departments}
    print(json.dumps(output))
    return 0


if __name__ == "__main__":
    sys.exit(main())