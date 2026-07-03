#!/usr/bin/env python3
"""
LanceDB: Update rows whose new string values contain single quotes.

This script demonstrates the safe `table.update(where=..., values={...})`
form (Python dict binding) which, unlike `values_sql`, does not interpolate
the value into a SQL string and therefore handles apostrophes like
`I'm good`, `It's a test`, and `O'Brien` without raising an
"Unterminated string literal" error (LanceDB issue #1429).
"""

import json
import os

import lancedb
import pyarrow as pa

DB_PATH = "/home/user/db"
OUTPUT_PATH = "/home/user/output/notes_after.json"
TABLE_NAME = "notes"


def build_schema() -> pa.Schema:
    """Schema for the notes table, including a 4-d float32 vector column."""
    return pa.schema(
        [
            pa.field("id", pa.int64()),
            pa.field("author", pa.string()),
            pa.field("body", pa.string()),
            pa.field(
                "vector",
                pa.list_(pa.float32(), list_size=4),
            ),
        ]
    )


def seed_data() -> pa.Table:
    """Build an Arrow table with exactly 8 rows (id 1..8)."""
    ids = list(range(1, 9))
    authors = [f"author{i}" for i in ids]
    bodies = [f"note body {i}" for i in ids]
    # Deterministic 4-d float32 vectors derived from the row id.
    vectors = [
        pa.array([float(i), float(i) * 2.0, float(i) * 3.0, float(i) * 4.0],
                 type=pa.float32())
        for i in ids
    ]

    return pa.Table.from_arrays(
        [
            pa.array(ids, type=pa.int64()),
            pa.array(authors, type=pa.string()),
            pa.array(bodies, type=pa.string()),
            pa.FixedSizeListArray.from_arrays(
                pa.concat_arrays(vectors).cast(pa.float32()),
                4,
            ),
        ],
        schema=build_schema(),
    )


def main() -> None:
    # Ensure the output directory exists.
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    db = lancedb.connect(DB_PATH)

    # (Re)create the notes table fresh so the run is idempotent.
    if TABLE_NAME in db.table_names():
        db.drop_table(TABLE_NAME)

    table = db.create_table(TABLE_NAME, data=seed_data())

    # --- Updates using the Python `values=` form (bound, not interpolated) ---
    # 1. body of id=2 -> "I'm good"
    table.update(where="id = 2", values={"body": "I'm good"})

    # 2. body of id=4 -> "It's a test"
    table.update(where="id = 4", values={"body": "It's a test"})

    # 3. author of id=6 -> "O'Brien"
    table.update(where="id = 6", values={"author": "O'Brien"})

    # --- Read back and write the post-update state to JSON ---
    # Query rows with id in 1..8, sorted by id ascending, excluding vector.
    arrow_tbl = (
        table.search()
        .where("id >= 1 AND id <= 8")
        .select(["id", "author", "body"])
        .to_arrow()
    )

    # Sort by id ascending and convert to a list of plain dicts.
    sorted_tbl = arrow_tbl.sort_by("id")
    rows = []
    for batch in sorted_tbl.to_batches():
        for row in batch.to_pylist():
            rows.append(
                {
                    "id": int(row["id"]),
                    "author": row["author"],
                    "body": row["body"],
                }
            )

    with open(OUTPUT_PATH, "w") as f:
        json.dump(rows, f, indent=2)

    print(f"Wrote {len(rows)} rows to {OUTPUT_PATH}")
    for r in rows:
        print(r)


if __name__ == "__main__":
    main()