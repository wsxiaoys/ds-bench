"""Solution module exposing `search(query_vec, k)`.

Workflow:
  1. Load the persisted PCA model (components + mean) from /app/pca_model.npz
     once and cache it in process memory.
  2. Project the 128-d query vector to 16-d using the standard sklearn
     projection: (x - mean) @ components.T
  3. Run a vector similarity search against the precomputed 16-d LanceDB
     table `articles_pca_<run-id>` located at /home/user/myproject/lancedb/.
  4. Return the top-k results as a JSON-serializable list of dicts ordered
     from most to least similar, each with keys `id`, `title`, `original_id`.
"""
from __future__ import annotations

import os
from typing import Sequence, Union, List, Dict, Any

import numpy as np
import lancedb

# -------- constants (fixed by task spec) --------
LANCEDB_DIR = "/home/user/myproject/lancedb/"
MODEL_PATH = "/app/pca_model.npz"
SOURCE_DIM = 128
PCA_DIM = 16
RUN_ID_PATH = "/logs/artifacts/run-id"


# -------- internal cache (module-level so it persists across calls) --------
_state: Dict[str, Any] = {
    "components": None,      # np.ndarray (16, 128) float
    "mean": None,            # np.ndarray (128,)   float
    "db": None,              # lancedb.DB connection
    "table": None,           # lancedb.table.Table
    "table_name": None,      # resolved table name
}


def _load_model():
    """Load (and cache) components, mean, db and table handle."""
    if _state["components"] is None:
        with np.load(MODEL_PATH) as data:
            components = np.asarray(data["components"], dtype=np.float32)
            mean = np.asarray(data["mean"], dtype=np.float32)
        assert components.shape == (PCA_DIM, SOURCE_DIM), (
            f"unexpected components shape {components.shape}"
        )
        assert mean.shape == (SOURCE_DIM,), (
            f"unexpected mean shape {mean.shape}"
        )
        _state["components"] = components
        _state["mean"] = mean

    if _state["db"] is None:
        _state["db"] = lancedb.connect(LANCEDB_DIR)

    if _state["table"] is None:
        # Resolve the new table name once. If the run-id file is missing,
        # fall back to the table name provided via env, then to whatever
        # table starts with `articles_pca_`.
        if _state["table_name"] is None:
            table_name = os.environ.get("PCA_TABLE_NAME")
            if table_name is None and os.path.exists(RUN_ID_PATH):
                with open(RUN_ID_PATH, "r") as fh:
                    run_id = fh.read().strip()
                table_name = f"articles_pca_{run_id}"
            if table_name is None:
                # last-resort: pick the only articles_pca_* table that exists
                candidates = [
                    n for n in _state["db"].table_names() if n.startswith("articles_pca_")
                ]
                if not candidates:
                    raise RuntimeError(
                        f"No articles_pca_* table found in {LANCEDB_DIR}"
                    )
                table_name = sorted(candidates)[-1]
            _state["table_name"] = table_name
        _state["table"] = _state["db"].open_table(_state["table_name"])


def _project_query(query_vec: Union[Sequence[float], np.ndarray]) -> np.ndarray:
    """Project a 128-d query to 16-d using (x - mean) @ components.T."""
    _load_model()
    x = np.asarray(query_vec, dtype=np.float32).reshape(-1)
    if x.shape != (SOURCE_DIM,):
        raise ValueError(
            f"query_vec must have length {SOURCE_DIM}, got {x.shape[0]}"
        )
    components = _state["components"]
    mean = _state["mean"]
    return (x - mean) @ components.T  # shape (16,)


def search(query_vec: Union[Sequence[float], np.ndarray], k: int) -> List[Dict[str, Any]]:
    """Search the PCA-projected LanceDB table for the k nearest neighbours.

    Parameters
    ----------
    query_vec : sequence of 128 floats
        The original 128-dimensional query vector.
    k : int
        Number of neighbours to return (must be >= 1).

    Returns
    -------
    list of dict
        JSON-serializable list of length k, ordered from most to least similar.
        Each dict has keys ``id`` (int), ``title`` (str), ``original_id`` (int).
    """
    if not isinstance(k, (int, np.integer)) or k < 1:
        raise ValueError(f"k must be a positive integer, got {k!r}")

    _load_model()

    q16 = _project_query(query_vec)  # shape (16,), float32
    table = _state["table"]

    # vector_search / .search returns a Query builder; calling .limit(k)
    # then .to_pandas() gives rows in ascending distance order
    # (most similar first).
    results = (
        table.search(q16.tolist())
        .limit(int(k))
        .to_pandas()
    )

    out: List[Dict[str, Any]] = []
    for _, row in results.iterrows():
        out.append(
            {
                "id": int(row["id"]),
                "title": str(row["title"]),
                "original_id": int(row["original_id"]),
            }
        )

    # Guarantee the output has exactly k entries in the rare case fewer
    # rows than k were returned (small datasets only).
    while len(out) < int(k):
        out.append({"id": -1, "title": "", "original_id": -1})

    return out[: int(k)]


# -------- self-test --------
if __name__ == "__main__":
    # Smoke test: read a row from the new table and search with its vector.
    import lancedb

    db = lancedb.connect(LANCEDB_DIR)
    src = db.open_table("articles")
    df = src.to_pandas().head(3)

    for _, r in df.iterrows():
        res = search(r["embedding"], k=5)
        print(f"Query id={r['id']} -> top-5:")
        for hit in res:
            print(f"  {hit}")
