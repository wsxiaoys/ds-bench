"""Build script: fit PCA on source vectors, persist model, create PCA LanceDB table."""
import os
import numpy as np
import lancedb
import pyarrow as pa
from sklearn.decomposition import PCA

LANCEDB_DIR = "/home/user/myproject/lancedb/"
MODEL_PATH = "/app/pca_model.npz"
N_COMPONENTS = 16
SEED = 0


def main():
    # 1. Read run-id
    with open("/logs/artifacts/run-id", "r") as f:
        run_id = f.read().strip()
    new_table_name = f"articles_pca_{run_id}"
    print(f"Run id: {run_id!r}; new table name: {new_table_name!r}")

    # 2. Open source table & load all rows
    db = lancedb.connect(LANCEDB_DIR)
    src = db.open_table("articles")
    df = src.to_pandas()
    assert len(df) == 600, f"expected 600 rows, got {len(df)}"

    ids = df["id"].to_numpy()
    titles = df["title"].to_numpy()
    X = np.stack([np.asarray(v, dtype=np.float32) for v in df["embedding"].to_numpy()]).astype(np.float32)
    assert X.shape == (600, 128), f"unexpected X shape {X.shape}"

    # 3. Fit PCA deterministically
    pca = PCA(n_components=N_COMPONENTS, random_state=SEED)
    pca.fit(X)
    components = pca.components_.astype(np.float32)  # (16, 128)
    mean = pca.mean_.astype(np.float32)              # (128,)
    assert components.shape == (16, 128)
    assert mean.shape == (128,)

    # 4. Project (600, 128) -> (600, 16)
    X_proj = pca.transform(X).astype(np.float32)
    assert X_proj.shape == (600, 16)

    # 5. Persist PCA model
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    np.savez(MODEL_PATH, components=components, mean=mean)
    print(f"Saved model -> {MODEL_PATH}")

    # 6. Build new LanceDB table with fixed-size-list[float32] of length 16
    schema = pa.schema(
        [
            ("id", pa.int64()),
            ("title", pa.string()),
            ("embedding", pa.list_(pa.float32(), 16)),
            ("original_id", pa.int64()),
        ]
    )

    records = []
    for i in range(len(df)):
        records.append(
            {
                "id": int(ids[i]),
                "title": str(titles[i]),
                "embedding": X_proj[i].tolist(),  # list of 16 floats
                "original_id": int(ids[i]),
            }
        )

    # If the table exists, drop and recreate so the script is idempotent
    if new_table_name in db.table_names():
        print(f"Table {new_table_name!r} exists; dropping and recreating.")
        db.drop_table(new_table_name)

    new_tbl = db.create_table(new_table_name, data=records, schema=schema, mode="create")
    print(f"Created table {new_table_name!r} with {new_tbl.count_rows()} rows")

    # Sanity-check the schema
    print("New table schema:")
    print(new_tbl.schema)

    # Round-trip sanity: query the first 5 rows and confirm embedding column shape/dtype
    sample = new_tbl.to_pandas().head()
    sample_emb = sample["embedding"].iloc[0]
    print(f"Sample row 'embedding' type={type(sample_emb).__name__}, len={len(sample_emb)}, dtype={sample_emb.dtype}")


if __name__ == "__main__":
    main()
