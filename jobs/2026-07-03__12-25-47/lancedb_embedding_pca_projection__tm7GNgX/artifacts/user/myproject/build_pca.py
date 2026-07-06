import os
import numpy as np
import lancedb
import pyarrow as pa
from sklearn.decomposition import PCA

DB_DIR = '/home/user/myproject/lancedb/'
RUN_ID = open('/logs/artifacts/run-id').read().strip()
NEW_TABLE = f'articles_pca_{RUN_ID}'
MODEL_PATH = '/app/pca_model.npz'

print(f'Connecting to {DB_DIR}')
db = lancedb.connect(DB_DIR)

print('Reading source table articles ...')
src = db['articles']
print('rows:', src.count_rows())

# Read into pandas to get all data + ids + titles
df = src.to_pandas()
print('df shape:', df.shape)
print('cols:', df.columns.tolist())
print('embedding example:', type(df['embedding'].iloc[0]), len(df['embedding'].iloc[0]))

X = np.stack([np.asarray(v, dtype=np.float32) for v in df['embedding'].values]).astype(np.float64)
print('X shape:', X.shape, X.dtype)

ids = df['id'].astype(np.int64).tolist()
titles = df['title'].astype(str).tolist()

print('Fitting PCA(n_components=16, random_state=0) ...')
pca = PCA(n_components=16, random_state=0)
Xp = pca.fit_transform(X)
print('Xp shape:', Xp.shape)
print('components shape:', pca.components_.shape)
print('mean shape:', pca.mean_.shape)

# Save model in sklearn convention
print(f'Saving model to {MODEL_PATH}')
np.savez(MODEL_PATH, components=pca.components_.astype(np.float64), mean=pca.mean_.astype(np.float64))

# Project must match: Xp = (X - mean) @ components.T
# Verifier convention: pca.transform(x) = (x - mean) @ components.T
check = (X - pca.mean_) @ pca.components_.T
print('recompute diff max:', np.max(np.abs(check - Xp)))

# Build new table
print(f'Building new table {NEW_TABLE}')
Xp32 = Xp.astype(np.float32)
records = []
for i, (id_, title_) in enumerate(zip(ids, titles)):
    rec = {
        'id': int(id_),
        'title': title_,
        'embedding': Xp32[i].tolist(),
        'original_id': int(id_),
    }
    records.append(rec)

# If table exists, drop and recreate (idempotent)
if NEW_TABLE in db.table_names():
    print('Dropping existing', NEW_TABLE)
    db.drop_table(NEW_TABLE)

schema = pa.schema([
    pa.field('id', pa.int64()),
    pa.field('title', pa.string()),
    pa.field('embedding', pa.list_(pa.float32(), 16)),
    pa.field('original_id', pa.int64()),
])

tbl = db.create_table(NEW_TABLE, records, schema=schema, mode='overwrite')
print('Created, rows =', tbl.count_rows())
print('Schema:')
print(tbl.schema)
