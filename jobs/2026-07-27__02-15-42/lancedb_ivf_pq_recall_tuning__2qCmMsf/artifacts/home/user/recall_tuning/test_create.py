import lancedb
import pyarrow as pa
import numpy as np

base_vectors = np.load("/home/user/recall_tuning/data/base_vectors.npy")
query_vectors = np.load("/home/user/recall_tuning/data/query_vectors.npy")

print("Base vectors shape:", base_vectors.shape)
print("Query vectors shape:", query_vectors.shape)

db = lancedb.connect("/home/user/recall_tuning/lancedb")
if "vectors" in db.table_names():
    db.drop_table("vectors")

ids = np.arange(len(base_vectors), dtype=np.int64)
vector_array = pa.FixedSizeListArray.from_arrays(base_vectors.flatten(), 128)

schema = pa.schema([
    pa.field("id", pa.int64()),
    pa.field("vector", pa.list_(pa.float32(), 128))
])

pa_table = pa.Table.from_arrays([ids, vector_array], schema=schema)
table = db.create_table("vectors", data=pa_table)
print("Table created successfully!")
print("Number of rows:", len(table))
print("Schema:", table.schema)
