import importlib
import json
import os
import sys

import numpy as np
import pyarrow as pa
import pytest

PROJECT_DIR = "/home/user/recall_tuning"
DATA_DIR = os.path.join(PROJECT_DIR, "data")
BASE_PATH = os.path.join(DATA_DIR, "base_vectors.npy")
QUERY_PATH = os.path.join(DATA_DIR, "query_vectors.npy")
DB_DIR = os.path.join(PROJECT_DIR, "lancedb")
REPORT_PATH = os.path.join(PROJECT_DIR, "report.json")
TABLE_NAME = "vectors"
DIM = 128
N_BASE = 60000
N_QUERY = 1000
K = 10

REQUIRED_KEYS = {
    "index_type",
    "metric",
    "num_partitions",
    "num_sub_vectors",
    "nprobes",
    "refine_factor",
    "recall_at_10",
    "num_base_vectors",
    "num_query_vectors",
}


# --------------------------------------------------------------------------- #
# Shared fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def base_vectors():
    assert os.path.isfile(BASE_PATH), f"Base vectors file {BASE_PATH} is missing."
    arr = np.load(BASE_PATH)
    return np.ascontiguousarray(arr, dtype=np.float32)


@pytest.fixture(scope="session")
def query_vectors():
    assert os.path.isfile(QUERY_PATH), f"Query vectors file {QUERY_PATH} is missing."
    arr = np.load(QUERY_PATH)
    return np.ascontiguousarray(arr, dtype=np.float32)


@pytest.fixture(scope="session")
def ground_truth(base_vectors, query_vectors):
    """Exact top-K l2 neighbor id sets for every query, computed with NumPy only."""
    base = base_vectors.astype(np.float64)
    queries = query_vectors.astype(np.float64)
    base_sq = np.einsum("ij,ij->i", base, base)  # ||b||^2
    truth = []
    batch = 50
    for start in range(0, queries.shape[0], batch):
        chunk = queries[start : start + batch]
        # squared l2 distance up to the per-query constant ||q||^2 (irrelevant to ranking)
        dists = base_sq[None, :] - 2.0 * (chunk @ base.T)
        idx = np.argpartition(dists, K, axis=1)[:, :K]
        for row in range(chunk.shape[0]):
            cand = idx[row]
            order = np.argsort(dists[row, cand])
            truth.append(set(int(i) for i in cand[order]))
    assert len(truth) == queries.shape[0], "Ground-truth computation produced the wrong count."
    return truth


@pytest.fixture(scope="session")
def report():
    assert os.path.isfile(REPORT_PATH), f"Report file {REPORT_PATH} does not exist."
    with open(REPORT_PATH) as f:
        data = json.load(f)
    assert isinstance(data, dict), "report.json must contain a single JSON object."
    return data


@pytest.fixture(scope="session")
def opened_table():
    import lancedb

    assert os.path.isdir(DB_DIR), f"LanceDB directory {DB_DIR} does not exist."
    db = lancedb.connect(DB_DIR)
    names = db.table_names()
    assert TABLE_NAME in names, f"Table '{TABLE_NAME}' not found in database (found: {list(names)})."
    return db.open_table(TABLE_NAME)


@pytest.fixture(scope="session")
def tuned_search_module():
    module_path = os.path.join(PROJECT_DIR, "tuned_search.py")
    assert os.path.isfile(module_path), f"tuned_search.py not found at {module_path}."
    if PROJECT_DIR not in sys.path:
        sys.path.insert(0, PROJECT_DIR)
    if "tuned_search" in sys.modules:
        del sys.modules["tuned_search"]
    module = importlib.import_module("tuned_search")
    assert hasattr(module, "search"), "tuned_search module does not expose a 'search' function."
    return module


@pytest.fixture(scope="session")
def measured_recall(tuned_search_module, query_vectors, ground_truth):
    total = 0.0
    for qi in range(query_vectors.shape[0]):
        result = tuned_search_module.search(query_vectors[qi].tolist(), k=K)
        assert isinstance(result, list), f"search() must return a list, got {type(result)} for query {qi}."
        assert len(result) == K, f"search() must return exactly {K} ids, got {len(result)} for query {qi}."
        ids = set()
        for v in result:
            assert isinstance(v, int) and not isinstance(v, bool), (
                f"search() must return plain Python ints, got {type(v)} for query {qi}."
            )
            ids.add(v)
        total += len(ids & ground_truth[qi]) / float(K)
    return total / float(query_vectors.shape[0])


# --------------------------------------------------------------------------- #
# 1. Report schema
# --------------------------------------------------------------------------- #
def test_report_schema(report):
    assert set(report.keys()) == REQUIRED_KEYS, (
        f"report.json keys must be exactly {sorted(REQUIRED_KEYS)}, got {sorted(report.keys())}."
    )
    assert report["index_type"] == "IVF_PQ", f"index_type must be 'IVF_PQ', got {report['index_type']!r}."
    assert report["metric"] == "l2", f"metric must be 'l2', got {report['metric']!r}."
    assert report["num_base_vectors"] == N_BASE, f"num_base_vectors must be {N_BASE}."
    assert report["num_query_vectors"] == N_QUERY, f"num_query_vectors must be {N_QUERY}."

    def is_int(x):
        return isinstance(x, int) and not isinstance(x, bool)

    assert is_int(report["num_partitions"]) and report["num_partitions"] > 0, (
        "num_partitions must be a positive integer."
    )
    assert is_int(report["num_sub_vectors"]) and report["num_sub_vectors"] > 0, (
        "num_sub_vectors must be a positive integer."
    )
    assert DIM % report["num_sub_vectors"] == 0, (
        f"num_sub_vectors ({report['num_sub_vectors']}) must evenly divide {DIM}."
    )
    assert is_int(report["nprobes"]) and report["nprobes"] > 0, "nprobes must be a positive integer."
    assert is_int(report["refine_factor"]) and report["refine_factor"] >= 1, (
        "refine_factor must be an integer >= 1."
    )
    assert isinstance(report["recall_at_10"], (int, float)) and not isinstance(
        report["recall_at_10"], bool
    ), "recall_at_10 must be a number."
    assert 0.0 <= float(report["recall_at_10"]) <= 1.0, "recall_at_10 must be within [0, 1]."


def test_reported_recall_meets_target(report):
    assert float(report["recall_at_10"]) >= 0.90, (
        f"Reported recall_at_10 must be >= 0.90, got {report['recall_at_10']}."
    )


# --------------------------------------------------------------------------- #
# 2. Table state
# --------------------------------------------------------------------------- #
def test_table_row_count(opened_table):
    assert opened_table.count_rows() == N_BASE, (
        f"Table '{TABLE_NAME}' must have exactly {N_BASE} rows, got {opened_table.count_rows()}."
    )


def test_table_schema(opened_table):
    schema = opened_table.schema
    names = set(schema.names)
    assert "id" in names, "Table must have an 'id' column."
    assert "vector" in names, "Table must have a 'vector' column."

    id_type = schema.field("id").type
    assert pa.types.is_integer(id_type), f"'id' column must be an integer type, got {id_type}."

    vec_type = schema.field("vector").type
    assert pa.types.is_fixed_size_list(vec_type), (
        f"'vector' column must be a fixed-size list, got {vec_type}."
    )
    assert vec_type.list_size == DIM, f"'vector' fixed-size list must have length {DIM}, got {vec_type.list_size}."
    assert pa.types.is_float32(vec_type.value_type), (
        f"'vector' element type must be float32, got {vec_type.value_type}."
    )


def test_table_content_matches_source(opened_table, base_vectors):
    tbl_arrow = opened_table.to_arrow()
    ids = tbl_arrow.column("id").to_pylist()
    vecs = tbl_arrow.column("vector").to_pylist()
    assert len(ids) == N_BASE, "Arrow export row count mismatch."
    assert set(ids) == set(range(N_BASE)), "Table 'id' values must be exactly 0..59999 (row indices)."

    id_to_vec = {int(i): v for i, v in zip(ids, vecs)}
    sample_ids = [0, 1, 7, 123, 999, 4096, 25000, 42000, 59999]
    for sid in sample_ids:
        stored = np.asarray(id_to_vec[sid], dtype=np.float32)
        expected = base_vectors[sid]
        assert stored.shape == (DIM,), f"Stored vector for id {sid} has wrong shape {stored.shape}."
        assert np.allclose(stored, expected, atol=1e-5), (
            f"Stored vector for id {sid} does not match base_vectors.npy row {sid}."
        )


# --------------------------------------------------------------------------- #
# 3. Index state
# --------------------------------------------------------------------------- #
def _find_ivf_pq_index(table):
    indices = list(table.list_indices())
    assert indices, "No index found on the table; an IVF_PQ vector index is required."
    for idx in indices:
        name = getattr(idx, "name", None)
        if name is None:
            continue
        stats = table.index_stats(name)
        if stats is not None and stats.index_type == "IVF_PQ":
            return name, stats
    types = []
    for idx in indices:
        name = getattr(idx, "name", None)
        stats = table.index_stats(name) if name else None
        types.append(getattr(stats, "index_type", None))
    raise AssertionError(f"No IVF_PQ index found on the table; index types present: {types}.")


def test_ivf_pq_index_exists(opened_table):
    _find_ivf_pq_index(opened_table)


def test_index_covers_all_rows(opened_table):
    _, stats = _find_ivf_pq_index(opened_table)
    assert stats.num_unindexed_rows == 0, (
        f"IVF_PQ index must cover all rows; {stats.num_unindexed_rows} rows remain unindexed."
    )
    assert stats.num_indexed_rows == N_BASE, (
        f"IVF_PQ index must index all {N_BASE} rows, got {stats.num_indexed_rows}."
    )


def test_index_metric_is_l2(opened_table):
    _, stats = _find_ivf_pq_index(opened_table)
    assert stats.distance_type == "l2", (
        f"IVF_PQ index distance metric must be 'l2', got {stats.distance_type!r}."
    )


# --------------------------------------------------------------------------- #
# 4./5. Recall via the tuned search interface + report honesty
# --------------------------------------------------------------------------- #
def test_measured_recall_meets_target(measured_recall):
    assert measured_recall >= 0.88, (
        f"Independently measured recall@10 of tuned_search.search must be >= 0.88, got {measured_recall:.4f}."
    )


def test_report_recall_is_honest(report, measured_recall):
    diff = abs(float(report["recall_at_10"]) - measured_recall)
    assert diff <= 0.05, (
        f"Reported recall_at_10 ({report['recall_at_10']}) must be within 0.05 of the measured "
        f"recall ({measured_recall:.4f}); difference was {diff:.4f}."
    )


# --------------------------------------------------------------------------- #
# 6. Determinism / persistence
# --------------------------------------------------------------------------- #
def test_search_is_deterministic(tuned_search_module, query_vectors):
    q = query_vectors[0].tolist()
    first = tuned_search_module.search(q, k=K)
    second = tuned_search_module.search(q, k=K)
    assert first == second, "Repeated search() calls on the same query must return identical results."
    assert len(first) == K, f"search() must return exactly {K} ids."
