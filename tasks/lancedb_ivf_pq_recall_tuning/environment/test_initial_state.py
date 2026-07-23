import os

import numpy as np

PROJECT_DIR = "/home/user/recall_tuning"
DATA_DIR = os.path.join(PROJECT_DIR, "data")
BASE_PATH = os.path.join(DATA_DIR, "base_vectors.npy")
QUERY_PATH = os.path.join(DATA_DIR, "query_vectors.npy")


def test_lancedb_importable():
    import lancedb  # noqa: F401

    assert hasattr(lancedb, "connect"), "lancedb is installed but lancedb.connect is missing."


def test_numpy_importable():
    assert hasattr(np, "load"), "numpy is not available in the environment."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_data_dir_exists():
    assert os.path.isdir(DATA_DIR), f"Data directory {DATA_DIR} does not exist."


def test_base_vectors_present_and_shaped():
    assert os.path.isfile(BASE_PATH), f"Base vectors file {BASE_PATH} does not exist."
    arr = np.load(BASE_PATH)
    assert arr.shape == (60000, 128), f"Expected base_vectors.npy shape (60000, 128), got {arr.shape}."
    assert arr.dtype == np.float32, f"Expected base_vectors.npy dtype float32, got {arr.dtype}."


def test_query_vectors_present_and_shaped():
    assert os.path.isfile(QUERY_PATH), f"Query vectors file {QUERY_PATH} does not exist."
    arr = np.load(QUERY_PATH)
    assert arr.shape == (1000, 128), f"Expected query_vectors.npy shape (1000, 128), got {arr.shape}."
    assert arr.dtype == np.float32, f"Expected query_vectors.npy dtype float32, got {arr.dtype}."
