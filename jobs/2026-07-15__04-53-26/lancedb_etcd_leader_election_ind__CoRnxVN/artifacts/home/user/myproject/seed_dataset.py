import os
from datetime import timedelta

import lancedb
import numpy as np
import pyarrow as pa

DB_URI = "/home/user/myproject/lancedb"
TABLE_NAME = "documents"
EMBED_DIM = 16
SEED = 2026

SCHEMA = pa.schema(
    [
        pa.field("id", pa.int64()),
        pa.field("text", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), EMBED_DIM)),
    ]
)


def _make_rows(start, count, rng):
    rows = []
    for i in range(start, start + count):
        vec = rng.standard_normal(EMBED_DIM).astype(np.float32)
        rows.append({"id": int(i), "text": "document-%d" % i, "vector": vec.tolist()})
    return rows


def _index_name(tbl):
    idxs = tbl.list_indices()
    return idxs[0].name if idxs else "vector_idx"


def reset():
    db = lancedb.connect(DB_URI)
    if TABLE_NAME in db.table_names():
        db.drop_table(TABLE_NAME)
    rng = np.random.default_rng(SEED)
    initial = _make_rows(0, 300, rng)
    tbl = db.create_table(TABLE_NAME, data=initial, schema=SCHEMA)
    tbl.create_index(
        index_type="IVF_PQ",
        metric="cosine",
        num_partitions=8,
        num_sub_vectors=4,
        replace=True,
    )
    tbl.wait_for_index([_index_name(tbl)], timedelta(seconds=180))
    # 200 unindexed rows appended in small batches -> multiple small fragments.
    for start in range(300, 500, 20):
        tbl.add(_make_rows(start, 20, rng))
    return tbl.count_rows()


def append_unindexed(n):
    db = lancedb.connect(DB_URI)
    tbl = db.open_table(TABLE_NAME)
    existing = tbl.count_rows()
    rng = np.random.default_rng(SEED + existing)
    added = 0
    while added < n:
        batch = min(20, n - added)
        tbl.add(_make_rows(existing + added, batch, rng))
        added += batch
    return n


if __name__ == "__main__":
    total = reset()
    print("seeded", total, "rows")
    os._exit(0)
