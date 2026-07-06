"""Seed a LanceDB `notes` table, perform apostrophe-bearing updates,
and persist the post-update JSON snapshot."""

import json
import os

import lancedb
import pyarrow as pa


DB_PATH = "/home/user/db"
TABLE_NAME = "notes"
OUTPUT_PATH = "/home/user/output/notes_after.json"

# Seed data -- simple ASCII strings and deterministic 4-d vectors.
SEED_AUTHORS = [
    "alice",
    "bob",
    "carol",
    "dave",
    "eve",
    "frank",
    "grace",
    "heidi",
]
SEED_BODIES = [
    "hello world",
    "lorem ipsum",
    "dolor sit amet",
    "consectetur adipiscing elit",
    "sed do eiusmod tempor",
    "incididunt ut labore",
    "et dolore magna aliqua",
    "ut enim ad minim",
]
SEED_VECTORS = [
    [float(i) + 0.1, float(i) + 0.2, float(i) + 0.3, float(i) + 0.4]
    for i in range(1, 9)
]


def main() -> None:
    # Make sure the output directory exists.
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    # Connect to LanceDB.
    db = lancedb.connect(DB_PATH)

    # Define the explicit schema: id int64, author/body strings,
    # vector is fixed_size_list<float32>[4].
    schema = pa.schema(
        [
            pa.field("id", pa.int64()),
            pa.field("author", pa.string()),
            pa.field("body", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), 4)),
        ]
    )

    # Seed rows.
    seed_rows = [
        {
            "id": i,
            "author": SEED_AUTHORS[i - 1],
            "body": SEED_BODIES[i - 1],
            "vector": SEED_VECTORS[i - 1],
        }
        for i in range(1, 9)
    ]

    # Drop any pre-existing `notes` table so we start from a clean slate.
    if TABLE_NAME in db.table_names():
        db.drop_table(TABLE_NAME)

    table = db.create_table(TABLE_NAME, data=seed_rows, schema=schema)

    # --- Updates using the Python `values=` form -------------------------
    # The values are bound, not interpolated, so apostrophes are safe.
    table.update(where="id = 2", values={"body": "I'm good"})
    table.update(where="id = 4", values={"body": "It's a test"})
    table.update(where="id = 6", values={"author": "O'Brien"})

    # --- Read back rows, sort, and persist -----------------------------
    df = (
        table.to_pandas()[["id", "author", "body"]]
        .sort_values("id")
        .reset_index(drop=True)
    )
    records = [
        {"id": int(row.id), "author": row.author, "body": row.body}
        for row in df.itertuples(index=False)
    ]

    with open(OUTPUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(records, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    print(f"Wrote {len(records)} rows to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
