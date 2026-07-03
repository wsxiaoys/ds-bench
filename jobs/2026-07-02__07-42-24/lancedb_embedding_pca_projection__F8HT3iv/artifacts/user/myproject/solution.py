import os
import lancedb
import numpy as np

# Global cache variables
_pca_components = None
_pca_mean = None
_db_table = None

def _load_resources():
    global _pca_components, _pca_mean, _db_table
    if _pca_components is not None and _db_table is not None:
        return

    # Load PCA model
    model_path = "/app/pca_model.npz"
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"PCA model file not found at {model_path}")
    
    model = np.load(model_path)
    _pca_components = model["components"]  # shape (16, 128)
    _pca_mean = model["mean"]              # shape (128,)

    # Load run-id and table
    run_id = None
    if os.path.exists("/logs/artifacts/run-id"):
        with open("/logs/artifacts/run-id", "r") as f:
            run_id = f.read().strip()
    else:
        for env_var in ["RUN_ID", "run_id", "RUN-ID"]:
            if env_var in os.environ:
                run_id = os.environ[env_var].strip()
                break
    
    if not run_id:
        raise RuntimeError("run-id could not be resolved.")

    table_name = f"articles_pca_{run_id}"
    db = lancedb.connect("/home/user/myproject/lancedb/")
    _db_table = db.open_table(table_name)

def search(query_vec, k):
    """
    Projects query_vec (128-d) to 16-d using the persisted PCA model,
    runs a vector similarity search against the 16-d table, and returns
    a JSON-serializable list of length k.
    
    Each element is a dict with keys: id (int), title (str), original_id (int).
    """
    if k <= 0:
        return []

    # Ensure resources are loaded
    _load_resources()

    # Convert query_vec to numpy array and project
    query_np = np.array(query_vec, dtype=np.float32)
    if query_np.shape != (128,):
        # Handle cases where query_vec might have different dimensions or be nested
        query_np = query_np.flatten()
        if query_np.shape != (128,):
            raise ValueError(f"Expected a 128-dimensional query vector, got shape {query_np.shape}")

    # Project to 16-d
    projected = np.dot(query_np - _pca_mean, _pca_components.T)

    # Perform LanceDB search
    results = _db_table.search(projected).limit(k).to_list()

    # Format the results to be exactly as required and JSON-serializable
    formatted_results = []
    for item in results:
        formatted_results.append({
            "id": int(item["id"]),
            "title": str(item["title"]),
            "original_id": int(item["original_id"])
        })

    return formatted_results
