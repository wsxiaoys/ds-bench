import importlib.util
import json
import os

PROJECT_DIR = "/home/user/project"
CORPUS_PATH = os.path.join(PROJECT_DIR, "data", "corpus.json")


def test_lancedb_importable():
    assert importlib.util.find_spec("lancedb") is not None, "lancedb is not importable."


def test_lancedb_rerankers_importable():
    assert (
        importlib.util.find_spec("lancedb.rerankers") is not None
    ), "lancedb.rerankers is not importable."


def test_llama_index_core_importable():
    assert (
        importlib.util.find_spec("llama_index.core") is not None
    ), "llama_index.core is not importable."


def test_llama_index_lancedb_vector_store_importable():
    assert (
        importlib.util.find_spec("llama_index.vector_stores.lancedb") is not None
    ), "llama_index.vector_stores.lancedb is not importable."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_corpus_file_exists():
    assert os.path.isfile(CORPUS_PATH), f"Corpus file {CORPUS_PATH} does not exist."


def test_corpus_structure():
    with open(CORPUS_PATH) as f:
        records = json.load(f)
    assert isinstance(records, list), "corpus.json must contain a JSON array."
    assert len(records) == 10, f"Expected 10 corpus records, found {len(records)}."
    ids = set()
    for r in records:
        assert set(["id", "text", "category", "year"]).issubset(
            r.keys()
        ), f"Record missing required keys: {r}"
        assert isinstance(r["id"], str), f"Record id must be a string: {r}"
        assert isinstance(r["text"], str), f"Record text must be a string: {r}"
        assert isinstance(r["category"], str), f"Record category must be a string: {r}"
        assert isinstance(r["year"], int), f"Record year must be an integer: {r}"
        ids.add(r["id"])
    assert ids == {f"d{i}" for i in range(1, 11)}, f"Unexpected corpus ids: {sorted(ids)}"


def test_solution_module_not_present_initially():
    solution_path = os.path.join(PROJECT_DIR, "hybrid_pipeline.py")
    assert not os.path.exists(
        solution_path
    ), "hybrid_pipeline.py should not exist before the task is solved."
