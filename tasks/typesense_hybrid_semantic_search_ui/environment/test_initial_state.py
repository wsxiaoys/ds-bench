import json
import os
import shutil

PROJECT_DIR = "/home/user/kbsearch"
DATA_DIR = os.path.join(PROJECT_DIR, "data")
DOCUMENTS_PATH = os.path.join(DATA_DIR, "documents.json")
QUERY_VECTORS_PATH = os.path.join(DATA_DIR, "query_vectors.json")
TYPESENSE_BINARY = "/usr/local/bin/typesense-server"
EVAL_QUERY = "speed up slow website"
NUM_DIM = 8
NUM_DOCS = 8


def test_typesense_server_binary_available():
    path = shutil.which("typesense-server") or TYPESENSE_BINARY
    assert os.path.isfile(path), "typesense-server binary not found (expected at /usr/local/bin/typesense-server)."
    assert os.access(path, os.X_OK), "typesense-server binary is not executable."


def test_typesense_api_key_env_set():
    assert os.path.isfile("/etc/typesense-api-key"), "API key file /etc/typesense-api-key is missing."
    with open("/etc/typesense-api-key", "r") as f:
        assert f.read().strip(), "API key file is empty."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_documents_dataset_present_and_shaped():
    assert os.path.isfile(DOCUMENTS_PATH), f"Seed dataset {DOCUMENTS_PATH} does not exist."
    with open(DOCUMENTS_PATH) as f:
        docs = json.load(f)
    assert isinstance(docs, list), "documents.json must contain a JSON array."
    assert len(docs) == NUM_DOCS, f"Expected exactly {NUM_DOCS} seed documents, found {len(docs)}."
    for doc in docs:
        assert isinstance(doc, dict), "Each document must be a JSON object."
        for key in ("id", "title", "body", "embedding"):
            assert key in doc, f"Document {doc!r} is missing required key '{key}'."
        assert isinstance(doc["embedding"], list), "Document 'embedding' must be a list."
        assert len(doc["embedding"]) == NUM_DIM, (
            f"Document embedding must have {NUM_DIM} dimensions, found {len(doc['embedding'])}."
        )
        for value in doc["embedding"]:
            assert isinstance(value, (int, float)), "Embedding values must be numeric."


def test_query_vectors_lookup_present_and_shaped():
    assert os.path.isfile(QUERY_VECTORS_PATH), f"Query-vector lookup {QUERY_VECTORS_PATH} does not exist."
    with open(QUERY_VECTORS_PATH) as f:
        lookup = json.load(f)
    assert isinstance(lookup, dict), "query_vectors.json must contain a JSON object."
    assert EVAL_QUERY in lookup, f"Query-vector lookup is missing the evaluation query '{EVAL_QUERY}'."
    vector = lookup[EVAL_QUERY]
    assert isinstance(vector, list) and len(vector) == NUM_DIM, (
        f"Query vector for '{EVAL_QUERY}' must be a list of {NUM_DIM} numbers."
    )
    for value in vector:
        assert isinstance(value, (int, float)), "Query-vector values must be numeric."
