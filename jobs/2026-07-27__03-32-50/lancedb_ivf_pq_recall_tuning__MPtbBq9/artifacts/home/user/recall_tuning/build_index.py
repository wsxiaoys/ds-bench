"""
Build the LanceDB table + IVF_PQ ANN index for the recall-tuning task.

Run once to (re)create:
  /home/user/recall_tuning/lancedb   (table "vectors")
"""

import os
import shutil

import numpy as np
import pyarrow as pa
import lancedb

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(PROJECT_DIR, "data")
DB_PATH = os.path.join(PROJECT_DIR, "lancedb")

BASE_VECTORS_PATH = os.path.join(DATA_DIR, "base_vectors.npy")

DIM = 128
NUM_PARTITIONS = 256
NUM_SUB_VECTORS = 32  # 128 / 32 = 4 dims per sub-vector, evenly divides 128


def main():
    base = np.load(BASE_VECTORS_PATH)
    assert base.shape == (60000, DIM)
    assert base.dtype == np.float32

    # Fresh DB every time this script is run.
    if os.path.exists(DB_PATH):
        shutil.rmtree(DB_PATH)

    db = lancedb.connect(DB_PATH)

    ids = np.arange(base.shape[0], dtype=np.int64)

    schema = pa.schema(
        [
            pa.field("id", pa.int64()),
            pa.field("vector", pa.list_(pa.float32(), DIM)),
        ]
    )

    tbl_data = pa.table(
        {
            "id": pa.array(ids, type=pa.int64()),
            "vector": pa.array(base.tolist(), type=pa.list_(pa.float32(), DIM)),
        },
        schema=schema,
    )

    table = db.create_table("vectors", tbl_data)

    print(f"Created table with {table.count_rows()} rows")

    table.create_index(
        metric="l2",
        vector_column_name="vector",
        index_type="IVF_PQ",
        num_partitions=NUM_PARTITIONS,
        num_sub_vectors=NUM_SUB_VECTORS,
        replace=True,
    )

    print("Index created.")
    print(table.list_indices())


if __name__ == "__main__":
    main()
