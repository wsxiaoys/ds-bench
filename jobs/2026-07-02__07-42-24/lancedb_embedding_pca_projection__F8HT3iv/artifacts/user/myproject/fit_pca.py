import numpy as np
import lancedb
import pyarrow as pa
import os
from sklearn.decomposition import PCA

def main():
    # 1. Connect to LanceDB and load the articles table
    db_path = "/home/user/myproject/lancedb/"
    db = lancedb.connect(db_path)
    
    print("Loading articles...")
    table = db.open_table("articles")
    df = table.to_pandas()
    print(f"Loaded {len(df)} articles.")
    
    # 2. Extract and stack embeddings
    embeddings = np.stack(df['embedding'].to_numpy())
    print(f"Embeddings shape: {embeddings.shape}")
    
    # 3. Fit PCA
    print("Fitting PCA model...")
    pca = PCA(n_components=16, svd_solver='full')
    projected_embeddings = pca.fit_transform(embeddings)
    print(f"Projected embeddings shape: {projected_embeddings.shape}")
    
    # 4. Save the model to /app/pca_model.npz
    os.makedirs("/app", exist_ok=True)
    np.savez("/app/pca_model.npz", components=pca.components_, mean=pca.mean_)
    print("Saved PCA model to /app/pca_model.npz")
    
    # Check if we can load it back and if values match
    loaded = np.load("/app/pca_model.npz")
    assert np.allclose(loaded['components'], pca.components_)
    assert np.allclose(loaded['mean'], pca.mean_)
    print("Verified saved PCA model.")
    
    # 5. Read run-id to determine new table name
    with open("/logs/artifacts/run-id", "r") as f:
        run_id = f.read().strip()
    new_table_name = f"articles_pca_{run_id}"
    print(f"New table name: {new_table_name}")
    
    # 6. Create the new table data
    # Columns: id, title, embedding, original_id
    new_df = df[['id', 'title']].copy()
    new_df['original_id'] = df['id']
    new_df['embedding'] = list(projected_embeddings.astype(np.float32))
    
    # Define schema explicitly
    schema = pa.schema([
        pa.field('id', pa.int64()),
        pa.field('title', pa.string()),
        pa.field('embedding', pa.list_(pa.float32(), 16)),
        pa.field('original_id', pa.int64())
    ])
    
    # Convert to pyarrow Table
    pyarrow_table = pa.Table.from_pandas(new_df, schema=schema)
    
    # Drop existing table if it exists (though it shouldn't)
    if new_table_name in db.table_names():
        print(f"Table {new_table_name} already exists. Dropping it.")
        db.drop_table(new_table_name)
        
    print(f"Creating new table {new_table_name}...")
    new_table = db.create_table(new_table_name, data=pyarrow_table)
    print(f"New table created. Rows: {len(new_table)}")
    print("Schema of new table:")
    print(new_table.schema)
    
    print("Execution finished successfully. Exiting cleanly.")
    os._exit(0)

if __name__ == "__main__":
    main()
