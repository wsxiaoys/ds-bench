import importlib
import json
import os
import sys

import pytest

PROJECT_DIR = "/home/user/rag"
CORPUS_PATH = os.path.join(PROJECT_DIR, "corpus.json")
EMBEDDINGS_PATH = os.path.join(PROJECT_DIR, "local_embeddings.py")

REQUIRED_DOC_KEYS = {"doc_id", "text", "source", "section", "timestamp"}


def test_lancedb_importable():
    import lancedb  # noqa: F401

    assert lancedb is not None, "lancedb package is not importable."


def test_langchain_importable():
    import langchain_community  # noqa: F401
    import langchain_core  # noqa: F401
    from langchain_community.vectorstores import LanceDB  # noqa: F401

    assert LanceDB is not None, "langchain_community LanceDB vector store is not importable."


def test_pinned_versions():
    import langchain_community
    import langchain_core
    import lancedb

    assert lancedb.__version__ == "0.25.2", (
        f"Expected lancedb==0.25.2, found {lancedb.__version__}."
    )
    assert langchain_community.__version__ == "0.3.27", (
        f"Expected langchain-community==0.3.27, found {langchain_community.__version__}."
    )
    assert langchain_core.__version__ == "0.3.75", (
        f"Expected langchain-core==0.3.75, found {langchain_core.__version__}."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_local_embeddings_file_exists():
    assert os.path.isfile(EMBEDDINGS_PATH), (
        f"Provided embeddings file {EMBEDDINGS_PATH} does not exist."
    )


def test_hash_embeddings_available_and_deterministic():
    if PROJECT_DIR not in sys.path:
        sys.path.insert(0, PROJECT_DIR)
    module = importlib.import_module("local_embeddings")
    assert hasattr(module, "HashEmbeddings"), (
        "local_embeddings.py must define a HashEmbeddings class."
    )
    from langchain_core.embeddings import Embeddings

    emb = module.HashEmbeddings()
    assert isinstance(emb, Embeddings), (
        "HashEmbeddings must be a subclass instance of langchain_core Embeddings."
    )
    vec = emb.embed_query("lancedb vector search")
    assert len(vec) == 64, f"HashEmbeddings must produce dimension-64 vectors, got {len(vec)}."
    vec2 = emb.embed_query("lancedb vector search")
    assert vec == vec2, "HashEmbeddings must be deterministic for identical input."


def test_corpus_file_valid():
    assert os.path.isfile(CORPUS_PATH), f"Corpus file {CORPUS_PATH} does not exist."
    with open(CORPUS_PATH) as f:
        corpus = json.load(f)
    assert isinstance(corpus, list) and len(corpus) > 0, (
        "corpus.json must be a non-empty JSON array."
    )
    doc_ids = set()
    for doc in corpus:
        assert isinstance(doc, dict), "Each corpus entry must be a JSON object."
        assert REQUIRED_DOC_KEYS.issubset(doc.keys()), (
            f"Each corpus document must contain keys {sorted(REQUIRED_DOC_KEYS)}; "
            f"found {sorted(doc.keys())}."
        )
        assert isinstance(doc["timestamp"], int), "Corpus 'timestamp' must be an integer."
        doc_ids.add(doc["doc_id"])
    assert len(doc_ids) == len(corpus), "Corpus doc_id values must be unique."


def test_solution_not_present_yet():
    solution_path = os.path.join(PROJECT_DIR, "solution.py")
    assert not os.path.exists(solution_path), (
        "solution.py should not exist before the task starts; the executor must create it."
    )
