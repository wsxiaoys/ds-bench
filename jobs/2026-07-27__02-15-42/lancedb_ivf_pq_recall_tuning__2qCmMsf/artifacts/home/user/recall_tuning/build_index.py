import lancedb
from lancedb.index import IvfPq
import time

db = lancedb.connect("/home/user/recall_tuning/lancedb")
table = db["vectors"]

print("Building index IVF_PQ with IvfPq config...")
start_idx = time.time()
table.create_index(
    "vector",
    config=IvfPq(
        distance_type="l2",
        num_partitions=128,
        num_sub_vectors=16
    ),
    replace=True
)
print(f"Index built in {time.time() - start_idx:.2f} seconds.")
