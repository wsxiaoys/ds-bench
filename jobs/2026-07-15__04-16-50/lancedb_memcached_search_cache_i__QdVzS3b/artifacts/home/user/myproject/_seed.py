import json
import os

import lancedb
import numpy as np
import pyarrow as pa

DIM = 32
N = 500
CATEGORIES = ["A", "B", "C", "D", "E"]

run_id = os.environ.get("ZEALT_RUN_ID", "local")
project_dir = "/home/user/myproject"
db_path = os.path.join(project_dir, "lancedb")
table_name = f"search_docs_{run_id}"

rng = np.random.default_rng(2026)
vectors = rng.standard_normal((N, DIM)).astype("float32")
cat_idx = rng.integers(0, len(CATEGORIES), size=N)
categories = [CATEGORIES[i] for i in cat_idx]

schema = pa.schema(
    [
        pa.field("id", pa.int64()),
        pa.field("category", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), DIM)),
    ]
)

ids = pa.array(list(range(N)), pa.int64())
cats = pa.array(categories, pa.string())
flat = pa.array(vectors.reshape(-1).tolist(), pa.float32())
vecs = pa.FixedSizeListArray.from_arrays(flat, DIM)
arrow_table = pa.Table.from_arrays([ids, cats, vecs], schema=schema)

db = lancedb.connect(db_path)
if table_name in db.table_names():
    db.drop_table(table_name)
db.create_table(table_name, data=arrow_table)

fixture = {
    "db_path": db_path,
    "table_name": table_name,
    "dim": DIM,
    "num_rows": N,
}
with open(os.path.join(project_dir, "fixture.json"), "w") as f:
    json.dump(fixture, f)

print(f"Seeded table {table_name} with {N} rows at {db_path}")

# lancedb 0.25.3 can raise SIGABRT during interpreter teardown; exit hard.
os._exit(0)
