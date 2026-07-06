import os
import json
import shutil
import lancedb
import pyarrow as pa

DB_PATH = "/home/user/db"
OUT_PATH = "/home/user/output/notes_after.json"
TABLE_NAME = "notes"

# Clean up any previous state so the script is idempotent.
if os.path.isdir(DB_PATH):
    shutil.rmtree(DB_PATH)
os.makedirs(DB_PATH, exist_ok=True)
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)

# Build schema with explicit types.
vector_type = pa.list_(pa.float32(), 4)  # fixed_size_list<float32>[4]
schema = pa.schema(
    [
        pa.field("id", pa.int64()),
        pa.field("author", pa.string()),
        pa.field("body", pa.string()),
        pa.field("vector", vector_type),
    ]
)

db = lancedb.connect(DB_PATH)

# Seed data: 8 rows with deterministic 4-d float32 vectors.
authors = [
    "alice", "bob", "carol", "dave",
    "eve", "frank", "grace", "heidi",
]
bodies = [
    "hello world",
    "first note",
    "second note",
    "third note",
    "fourth note",
    "fifth note",
    "sixth note",
    "seventh note",
]
ids = list(range(1, 9))

rows = []
for i, aid, b in zip(ids, authors, bodies):
    rows.append(
        {
            "id": aid if False else int(aid[:0] + str(i)),  # placeholder, replaced below
            "author": aid,
            "body": b,
            "vector": [float(i), float(i) + 0.5, float(i) - 0.25, float(i) * 1.5],
        }
    )
# Fix id field (above placeholder is silly; rebuild cleanly).
rows = []
for i, aid, b in zip(ids, authors, bodies):
    rows.append(
        {
            "id": int(i),
            "author": aid,
            "body": b,
            "vector": [float(i), float(i) + 0.5, float(i) - 0.25, float(i) * 1.5],
        }
    )

table = db.create_table(
    TABLE_NAME,
    data=rows,
    schema=schema,
    mode="overwrite",
)

# Perform updates IN ORDER using values= (Python dict, NOT values_sql).
# This sidesteps the single-quote / Unterminated string literal bug.
table.update(where="id = 2", values={"body": "I'm good"})
table.update(where="id = 4", values={"body": "It's a test"})
table.update(where="id = 6", values={"author": "O'Brien"})

# Read back the rows with id in 1..8, sorted ascending.
result = table.search().where("id >= 1 AND id <= 8", prefilter=True).to_list()
# Result is unordered; sort by id.
result.sort(key=lambda r: r["id"])

# Strip vector and emit JSON.
out = [
    {"id": int(r["id"]), "author": r["author"], "body": r["body"]}
    for r in result
]

with open(OUT_PATH, "w") as f:
    json.dump(out, f, indent=2)

print(json.dumps(out, indent=2))
print("Wrote", OUT_PATH)
