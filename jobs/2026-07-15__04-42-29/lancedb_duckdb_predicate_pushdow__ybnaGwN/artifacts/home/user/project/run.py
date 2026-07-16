#!/usr/bin/env python3
"""
Hybrid LanceDB + DuckDB analytics bridge.

Ingests documents.jsonl into LanceDB (float32 vector column) on first run,
then performs vector search followed by DuckDB SQL analytics.

Usage:
    python3 run.py --query-vector 0.9,0.1,0.0,0.0,0.5,0.2,0.1,0.3 \
                   --top-k 10 --max-price 150.0 [--category "Women's Apparel"]
"""

import argparse
import json
import os
import sys

import duckdb
import pyarrow as pa
import lancedb

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_DIR   = "/home/user/project"
DATA_DIR      = os.path.join(PROJECT_DIR, "data")
DOCUMENTS_JSONL = os.path.join(DATA_DIR, "documents.jsonl")
CATEGORIES_CSV  = os.path.join(DATA_DIR, "categories.csv")
LANCEDB_PATH  = os.path.join(PROJECT_DIR, "lancedb")
TABLE_NAME    = "documents"
VECTOR_DIM    = 8


# ---------------------------------------------------------------------------
# Ingestion (idempotent)
# ---------------------------------------------------------------------------

def _build_arrow_schema() -> pa.Schema:
    """Return the PyArrow schema with a fixed-size float32 vector column."""
    return pa.schema([
        pa.field("id",       pa.int64()),
        pa.field("title",    pa.utf8()),
        pa.field("category", pa.utf8()),
        pa.field("price",    pa.float64()),
        pa.field("in_stock", pa.bool_()),
        pa.field("vector",   pa.list_(pa.float32(), VECTOR_DIM)),
    ])


def ingest(db: lancedb.DBConnection) -> lancedb.table.Table:
    """
    Load documents.jsonl into LanceDB.  Re-uses the existing table when it
    already contains data so the CLI is fully rerunnable.
    """
    _lt = db.list_tables()
    existing = _lt.tables if hasattr(_lt, "tables") else list(_lt)
    if TABLE_NAME in existing:
        tbl = db.open_table(TABLE_NAME)
        if tbl.count_rows() > 0:
            return tbl
        # Table exists but is empty – drop and re-create.
        db.drop_table(TABLE_NAME)

    # Read JSONL
    rows = []
    with open(DOCUMENTS_JSONL, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line:
                rows.append(json.loads(line))

    # Build PyArrow table with explicit schema so vector is float32 fixed-size.
    schema = _build_arrow_schema()
    arrays = {
        "id":       pa.array([r["id"]       for r in rows], type=pa.int64()),
        "title":    pa.array([r["title"]    for r in rows], type=pa.utf8()),
        "category": pa.array([r["category"] for r in rows], type=pa.utf8()),
        "price":    pa.array([r["price"]    for r in rows], type=pa.float64()),
        "in_stock": pa.array([r["in_stock"] for r in rows], type=pa.bool_()),
        "vector":   pa.array(
            [r["vector"] for r in rows],
            type=pa.list_(pa.float32(), VECTOR_DIM),
        ),
    }
    arrow_table = pa.table(arrays, schema=schema)

    tbl = db.create_table(TABLE_NAME, data=arrow_table, mode="create")

    # Build the ANN index so vector search is indexed.
    tbl.optimize()

    return tbl


# ---------------------------------------------------------------------------
# Retrieval + Analytics
# ---------------------------------------------------------------------------

def retrieve_and_analyze(
    tbl: lancedb.table.Table,
    query_vector: list[float],
    top_k: int,
    max_price: float,
    category: str | None,
) -> dict:
    """
    1. Vector search in LanceDB (L2, no metadata filter) → top-K candidates.
    2. Hand candidates + categories CSV to DuckDB for filtering, JOIN,
       aggregation, and window ranking.
    3. Return the structured result dict.
    """

    # --- Step 1: LanceDB vector search ------------------------------------
    # Query vector must be float32 to match the column type.
    q_vec_f32 = [float(x) for x in query_vector]

    results = (
        tbl.search(q_vec_f32, query_type="vector")
           .metric("l2")
           .limit(top_k)
           .to_arrow()          # returns PyArrow table with _distance column
    )

    # Convert to a plain Python list-of-dicts for DuckDB registration.
    candidates_pa = results  # keep as Arrow table – DuckDB can ingest directly

    # --- Step 2: DuckDB analytics -----------------------------------------
    con = duckdb.connect()

    # Register the LanceDB result as a virtual relation.
    # The Arrow table from LanceDB contains: id, title, category, price,
    # in_stock, vector, _distance.
    con.register("candidates_raw", candidates_pa)

    # Read the categories CSV directly in DuckDB.
    # Use read_csv_auto with the file path; this sidesteps any quote issues
    # in Python string building.
    con.execute(
        f"CREATE VIEW categories AS SELECT * FROM read_csv_auto('{CATEGORIES_CSV}')"
    )

    # Build the WHERE clause predicates.  Category values can contain single
    # quotes, so we pass them through DuckDB's parameter binding ($1) rather
    # than embedding them in SQL strings.
    extra_filter_sql = ""
    params: list = [max_price]          # $1 = max_price

    if category is not None:
        params.append(category)         # $2 = category string
        extra_filter_sql = "AND cr.category = $2"

    analytics_sql = f"""
    WITH filtered AS (
        SELECT
            CAST(cr.id       AS BIGINT)  AS id,
            cr.title,
            cr.category,
            cat.department,
            CAST(cr.price    AS DOUBLE)  AS price,
            CAST(cr._distance AS DOUBLE) AS distance
        FROM candidates_raw AS cr
        JOIN categories     AS cat  ON cr.category = cat.category
        WHERE cr.in_stock = TRUE
          AND cr.price   <= $1
          {extra_filter_sql}
    ),
    ranked AS (
        SELECT
            f.*,
            ROW_NUMBER() OVER (
                PARTITION BY f.department
                ORDER BY     f.distance ASC, f.id ASC
            ) AS dept_rank
        FROM filtered AS f
    )
    SELECT * FROM ranked
    ORDER BY distance ASC, id ASC
    """

    rows_result = con.execute(analytics_sql, params).fetchall()
    col_names   = [d[0] for d in con.description]

    # --- Step 3: Build hits list ------------------------------------------
    hits = []
    for row in rows_result:
        rec = dict(zip(col_names, row))
        hits.append({
            "id":         int(rec["id"]),
            "title":      str(rec["title"]),
            "category":   str(rec["category"]),
            "department": str(rec["department"]),
            "price":      float(rec["price"]),
            "distance":   float(rec["distance"]),
            "dept_rank":  int(rec["dept_rank"]),
        })

    # --- Step 4: Build departments summary --------------------------------
    dept_sql = """
    SELECT
        department,
        COUNT(*)                       AS num_docs,
        ROUND(AVG(price), 4)           AS avg_price,
        MIN(distance)                  AS min_distance
    FROM ranked
    GROUP BY department
    ORDER BY department ASC
    """

    # Re-run to get dept aggregates (CTE is local to the previous query;
    # re-execute the full CTE chain here).
    dept_analytics_sql = f"""
    WITH filtered AS (
        SELECT
            CAST(cr.id       AS BIGINT)  AS id,
            cr.title,
            cr.category,
            cat.department,
            CAST(cr.price    AS DOUBLE)  AS price,
            CAST(cr._distance AS DOUBLE) AS distance
        FROM candidates_raw AS cr
        JOIN categories     AS cat  ON cr.category = cat.category
        WHERE cr.in_stock = TRUE
          AND cr.price   <= $1
          {extra_filter_sql}
    ),
    ranked AS (
        SELECT
            f.*,
            ROW_NUMBER() OVER (
                PARTITION BY f.department
                ORDER BY     f.distance ASC, f.id ASC
            ) AS dept_rank
        FROM filtered AS f
    )
    {dept_sql}
    """

    dept_rows   = con.execute(dept_analytics_sql, params).fetchall()
    dept_cols   = [d[0] for d in con.description]

    departments = []
    for row in dept_rows:
        rec = dict(zip(dept_cols, row))
        departments.append({
            "department":   str(rec["department"]),
            "num_docs":     int(rec["num_docs"]),
            "avg_price":    float(rec["avg_price"]),
            "min_distance": float(rec["min_distance"]),
        })

    con.close()

    return {"hits": hits, "departments": departments}


# ---------------------------------------------------------------------------
# CLI entry-point
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Hybrid LanceDB + DuckDB analytics bridge"
    )
    parser.add_argument(
        "--query-vector",
        required=True,
        help="Comma-separated list of exactly 8 floats.",
    )
    parser.add_argument(
        "--top-k",
        required=True,
        type=int,
        help="Number of nearest-neighbor candidates to retrieve from LanceDB.",
    )
    parser.add_argument(
        "--max-price",
        required=True,
        type=float,
        help="Maximum price (inclusive) for DuckDB filter.",
    )
    parser.add_argument(
        "--category",
        default=None,
        help="Optional exact category filter (may contain apostrophes).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    # Parse query vector
    try:
        qv = [float(x) for x in args.query_vector.split(",")]
    except ValueError as exc:
        sys.exit(f"ERROR: --query-vector parse failed: {exc}")
    if len(qv) != VECTOR_DIM:
        sys.exit(f"ERROR: --query-vector must have exactly {VECTOR_DIM} floats; got {len(qv)}")

    # Open (or create) LanceDB
    db  = lancedb.connect(LANCEDB_PATH)
    tbl = ingest(db)

    result = retrieve_and_analyze(
        tbl,
        query_vector=qv,
        top_k=args.top_k,
        max_price=args.max_price,
        category=args.category,
    )

    # Print ONLY the JSON object, nothing else.
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
