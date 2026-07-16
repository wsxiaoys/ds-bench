#!/usr/bin/env python3
"""Hybrid LanceDB + DuckDB analytics bridge.

Pipeline:
    1. Ingest every row of ``data/documents.jsonl`` into a local LanceDB table
       (path ``./lancedb``). The ``vector`` column is materialized as a
       fixed-size ``list<float32>`` so that L2 vector search works against a
       float32 query vector.
    2. Given a CLI ``--query-vector`` (8 floats) and ``--top-k``, retrieve the
       top-K nearest documents from LanceDB by L2 distance (no metadata
       filtering at the LanceDB stage).
    3. Hand the candidate set to an embedded DuckDB instance, join the
       auxiliary ``data/categories.csv`` table on ``category``, apply the
       requested predicate filters (``in_stock``, ``price <= max_price``,
       optional ``category``), run a per-department aggregation, and compute a
       per-department ``ROW_NUMBER()`` ranking window.
    4. Print a single JSON object to stdout with the keys ``hits`` and
       ``departments`` (the latter derived via DuckDB SQL only).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Iterable

import duckdb
import lancedb
import pyarrow as pa

# ---------------------------------------------------------------------------
# Project paths
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
DOCS_PATH = os.path.join(DATA_DIR, "documents.jsonl")
CATS_PATH = os.path.join(DATA_DIR, "categories.csv")
LANCEDB_DIR = os.path.join(BASE_DIR, "lancedb")
TABLE_NAME = "documents"
VECTOR_DIM = 8


# ---------------------------------------------------------------------------
# JSONL loading
# ---------------------------------------------------------------------------
def _load_documents(path: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    return rows


def _build_arrow_table(rows: Iterable[dict[str, Any]]) -> pa.Table:
    """Build a PyArrow table with a float32 fixed-size list vector column."""
    ids: list[int] = []
    titles: list[str] = []
    categories: list[str] = []
    prices: list[float] = []
    in_stock: list[bool] = []
    vectors: list[list[float]] = []

    for row in rows:
        ids.append(int(row["id"]))
        titles.append(str(row["title"]))
        categories.append(str(row["category"]))
        prices.append(float(row["price"]))
        in_stock.append(bool(row["in_stock"]))
        vec = [float(x) for x in row["vector"]]
        if len(vec) != VECTOR_DIM:
            raise ValueError(
                f"document id={row.get('id')!r} vector has length {len(vec)}, expected {VECTOR_DIM}"
            )
        vectors.append(vec)

    vector_array = pa.array(vectors, type=pa.list_(pa.float32(), VECTOR_DIM))
    return pa.table(
        {
            "id": pa.array(ids, type=pa.int64()),
            "title": pa.array(titles, type=pa.string()),
            "category": pa.array(categories, type=pa.string()),
            "price": pa.array(prices, type=pa.float64()),
            "in_stock": pa.array(in_stock, type=pa.bool_()),
            "vector": vector_array,
        }
    )


# ---------------------------------------------------------------------------
# LanceDB ingestion
# ---------------------------------------------------------------------------
def ingest_lancedb() -> None:
    """Create / refresh the LanceDB table with a float32 vector column."""
    os.makedirs(LANCEDB_DIR, exist_ok=True)
    rows = _load_documents(DOCS_PATH)
    arrow_table = _build_arrow_table(rows)

    db = lancedb.connect(LANCEDB_DIR)
    # Drop and recreate for a clean, idempotent ingest.
    if TABLE_NAME in db.list_tables():
        db.drop_table(TABLE_NAME)
    table = db.create_table(TABLE_NAME, arrow_table, mode="overwrite")
    # Fold new rows into the search index.
    table.optimize()


# ---------------------------------------------------------------------------
# LanceDB retrieval
# ---------------------------------------------------------------------------
def retrieve_candidates(
    query_vector: list[float], top_k: int
) -> "pa.Table":
    """Top-K L2 nearest neighbors from LanceDB returning ``_distance``."""
    if len(query_vector) != VECTOR_DIM:
        raise ValueError(
            f"query vector must have length {VECTOR_DIM}, got {len(query_vector)}"
        )
    query_float32 = pa.array(query_vector, type=pa.float32()).to_pylist()
    db = lancedb.connect(LANCEDB_DIR)
    table = db.open_table(TABLE_NAME)
    # No metadata filter at the LanceDB stage; pure raw nearest neighbors.
    result = table.search(query_float32).metric("l2").limit(top_k).to_arrow()
    return result


# ---------------------------------------------------------------------------
# DuckDB analytics
# ---------------------------------------------------------------------------
def _escape_sql_string(value: str) -> str:
    """Double single quotes for safe SQL string literal interpolation."""
    return value.replace("'", "''")


def run_duckdb_analytics(
    candidates: "pa.Table",
    max_price: float,
    category: str | None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Apply filters, join categories, aggregate, and rank via window fn."""
    con = duckdb.connect(":memory:")

    # Register the LanceDB result set and the CSV auxiliary table.
    con.register("candidates", candidates)
    con.execute(
        f"CREATE TABLE categories AS SELECT * FROM read_csv_auto('{CATS_PATH}')"
    )

    # Build safe WHERE clause (predicate filtering happens in DuckDB, not Python).
    where_parts = ["c.in_stock = TRUE", "c.price <= ?"]
    params: list[Any] = [float(max_price)]

    if category is not None:
        # Parameter binding handles apostrophes safely.
        where_parts.append("c.category = ?")
        params.append(category)

    where_sql = " AND ".join(where_parts)

    # SQL: filter -> join -> window rank. Persist as a temp table so the
    # subsequent GROUP BY query can read it (CTE scope is per-statement).
    sql = f"""
        CREATE OR REPLACE TEMP TABLE ranked AS
        WITH hits AS (
            SELECT
                c.id,
                c.title,
                c.category,
                c.price,
                c."_distance" AS distance,
                cat.department AS department
            FROM candidates c
            JOIN categories cat ON c.category = cat.category
            WHERE {where_sql}
        )
        SELECT *,
               ROW_NUMBER() OVER (
                   PARTITION BY department
                   ORDER BY distance ASC, id ASC
               ) AS dept_rank
        FROM hits
    """
    con.execute(sql, params)

    hits_df = con.execute(
        'SELECT * FROM ranked ORDER BY distance ASC, id ASC'
    ).fetchdf()

    # Per-department aggregation derived from the surviving hit set in DuckDB.
    dept_sql = """
        SELECT
            department,
            COUNT(*)            AS num_docs,
            ROUND(AVG(price), 4) AS avg_price,
            MIN(distance)       AS min_distance
        FROM ranked
        GROUP BY department
        ORDER BY department ASC
    """
    depts_df = con.execute(dept_sql).fetchdf()
    con.close()

    # Convert numpy values to plain Python types.
    hits: list[dict[str, Any]] = []
    for _, r in hits_df.iterrows():
        hits.append(
            {
                "id": int(r["id"]),
                "title": str(r["title"]),
                "category": str(r["category"]),
                "department": str(r["department"]),
                "price": float(r["price"]),
                "distance": float(r["distance"]),
                "dept_rank": int(r["dept_rank"]),
            }
        )

    departments: list[dict[str, Any]] = []
    for _, r in depts_df.iterrows():
        departments.append(
            {
                "department": str(r["department"]),
                "num_docs": int(r["num_docs"]),
                "avg_price": float(r["avg_price"]),
                "min_distance": float(r["min_distance"]),
            }
        )

    return hits, departments


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def _parse_query_vector(value: str) -> list[float]:
    parts = [p.strip() for p in value.split(",") if p.strip() != ""]
    if len(parts) != VECTOR_DIM:
        raise argparse.ArgumentTypeError(
            f"--query-vector must list exactly {VECTOR_DIM} floats, got {len(parts)}"
        )
    try:
        return [float(p) for p in parts]
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            f"--query-vector contains non-numeric value: {exc}"
        ) from exc


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="run.py",
        description="Hybrid LanceDB + DuckDB analytics bridge.",
    )
    parser.add_argument(
        "--query-vector",
        required=True,
        type=_parse_query_vector,
        help="Comma-separated list of exactly 8 floats.",
    )
    parser.add_argument(
        "--top-k",
        required=True,
        type=int,
        help="LanceDB nearest-neighbor candidate pool size.",
    )
    parser.add_argument(
        "--max-price",
        required=True,
        type=float,
        help="Upper bound on candidate price.",
    )
    parser.add_argument(
        "--category",
        default=None,
        help="Optional exact category filter (apostrophes allowed).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])

    ingest_lancedb()
    candidates = retrieve_candidates(args.query_vector, args.top_k)
    hits, departments = run_duckdb_analytics(
        candidates, args.max_price, args.category
    )

    # Print ONLY a single JSON object to stdout.
    sys.stdout.write(json.dumps({"hits": hits, "departments": departments}))
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
