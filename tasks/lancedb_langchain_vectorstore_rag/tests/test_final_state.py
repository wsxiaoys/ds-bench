import importlib
import json
import os
import shutil
import sys
import tempfile
from collections import Counter

import pyarrow as pa
import pytest

PROJECT_DIR = "/home/user/rag"
DB_PATH = os.path.join(PROJECT_DIR, "lancedb")
TABLE_NAME = "documents"
CORPUS_PATH = os.path.join(PROJECT_DIR, "corpus.json")
EMBED_DIM = 64

if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)

# Fixed queries reused across similarity and MMR checks.
QUERIES = [
    "vector search index latency tuning",
    "install lancedb python quickstart guide",
    "metadata filtering sql where clause",
    "embedding model vector dimension registry",
    "hybrid full text search reranker",
]


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def load_corpus():
    with open(CORPUS_PATH) as f:
        return json.load(f)


def corpus_metadatas(corpus):
    return [
        {
            "doc_id": d["doc_id"],
            "source": d["source"],
            "section": d["section"],
            "timestamp": d["timestamp"],
        }
        for d in corpus
    ]


def matches(doc, where_kind, value):
    if where_kind == "source":
        return doc["source"] == value
    if where_kind == "section":
        return doc["section"] == value
    if where_kind == "timestamp_gte":
        return doc["timestamp"] >= value
    raise ValueError(where_kind)


def where_sql(where_kind, value):
    if where_kind == "source":
        return f"metadata.source = '{value}'"
    if where_kind == "section":
        return f"metadata.section = '{value}'"
    if where_kind == "timestamp_gte":
        return f"metadata.timestamp >= {value}"
    raise ValueError(where_kind)


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def corpus():
    return load_corpus()


@pytest.fixture(scope="session")
def solution_module():
    # Rebuild from scratch to make the run deterministic and idempotent.
    if os.path.isdir(DB_PATH):
        shutil.rmtree(DB_PATH)
    module = importlib.import_module("solution")
    module.build_index()
    return module


@pytest.fixture(scope="session")
def oracle(corpus):
    """Independent reference store built with the same corpus and embeddings."""
    import lancedb
    from langchain_community.vectorstores import LanceDB

    local_embeddings = importlib.import_module("local_embeddings")
    emb = local_embeddings.HashEmbeddings()

    tmpdir = tempfile.mkdtemp(prefix="oracle_lancedb_")
    conn = lancedb.connect(tmpdir)
    store = LanceDB(
        connection=conn,
        embedding=emb,
        table_name="oracle",
        mode="overwrite",
    )
    store.add_texts(
        [d["text"] for d in corpus],
        metadatas=corpus_metadatas(corpus),
    )

    def sim_ids(query, k, where=None):
        docs = store.similarity_search(query, k=k, filter=where, prefilter=True)
        return [d.metadata["doc_id"] for d in docs]

    def mmr_ids(query, k, fetch_k, lambda_mult, where=None):
        docs = store.max_marginal_relevance_search(
            query, k=k, fetch_k=fetch_k, lambda_mult=lambda_mult, filter=where
        )
        return [d.metadata["doc_id"] for d in docs]

    yield {"sim_ids": sim_ids, "mmr_ids": mmr_ids}
    shutil.rmtree(tmpdir, ignore_errors=True)


# --------------------------------------------------------------------------- #
# 1. Index construction & persistence
# --------------------------------------------------------------------------- #
def _open_table():
    import lancedb

    conn = lancedb.connect(DB_PATH)
    assert TABLE_NAME in conn.table_names(), (
        f"Expected a table named '{TABLE_NAME}' in the LanceDB database at {DB_PATH}; "
        f"found {conn.table_names()}."
    )
    return conn.open_table(TABLE_NAME)


def _find_vector_field(schema):
    for field in schema:
        if pa.types.is_fixed_size_list(field.type):
            return field
    return None


def _metadata_column_name(schema):
    if "metadata" in schema.names:
        return "metadata"
    for field in schema:
        if pa.types.is_struct(field.type):
            return field.name
    return None


def _text_column_name(schema):
    if "text" in schema.names:
        return "text"
    for field in schema:
        if pa.types.is_string(field.type) and field.name != "id":
            return field.name
    return None


def test_index_created_and_persisted(solution_module, corpus):
    tbl = _open_table()
    assert tbl.count_rows() == len(corpus), (
        f"Expected {len(corpus)} rows in '{TABLE_NAME}', found {tbl.count_rows()}."
    )

    vfield = _find_vector_field(tbl.schema)
    assert vfield is not None, "No fixed-size-list vector column found in the table schema."
    assert vfield.type.list_size == EMBED_DIM, (
        f"Vector column dimension must be {EMBED_DIM}, found {vfield.type.list_size}."
    )


def test_all_documents_present_with_metadata(solution_module, corpus):
    tbl = _open_table()
    rows = tbl.to_arrow().to_pylist()

    meta_col = _metadata_column_name(tbl.schema)
    text_col = _text_column_name(tbl.schema)
    assert meta_col is not None, "No metadata struct column found in the table."
    assert text_col is not None, "No text column found in the table."

    by_id = {}
    for row in rows:
        meta = row[meta_col]
        assert isinstance(meta, dict), "Each record's metadata must be a struct/dict."
        assert "doc_id" in meta, "Each record's metadata must contain 'doc_id'."
        by_id[meta["doc_id"]] = row

    assert len(by_id) == len(corpus), (
        f"Expected {len(corpus)} unique doc_id values, found {len(by_id)}."
    )

    for doc in corpus:
        did = doc["doc_id"]
        assert did in by_id, f"doc_id {did} missing from the stored table."
        row = by_id[did]
        meta = row[meta_col]
        assert row[text_col] == doc["text"], (
            f"Stored text for {did} does not match corpus text."
        )
        for key in ("doc_id", "source", "section", "timestamp"):
            assert meta.get(key) == doc[key], (
                f"Metadata '{key}' for {did} is {meta.get(key)!r}, "
                f"expected {doc[key]!r}."
            )


def test_build_index_is_idempotent(solution_module, corpus):
    solution_module.build_index()
    tbl = _open_table()
    assert tbl.count_rows() == len(corpus), (
        "Re-running build_index() must not create duplicate rows; "
        f"expected {len(corpus)}, found {tbl.count_rows()}."
    )


# --------------------------------------------------------------------------- #
# 2. Retriever object
# --------------------------------------------------------------------------- #
def test_get_retriever_returns_documents(solution_module):
    from langchain_core.documents import Document
    from langchain_core.retrievers import BaseRetriever

    retriever = solution_module.get_retriever("similarity", {"k": 3})
    assert isinstance(retriever, BaseRetriever), (
        "get_retriever must return a LangChain BaseRetriever instance."
    )
    docs = retriever.invoke(QUERIES[0])
    assert 0 < len(docs) <= 3, f"Retriever should return up to 3 documents, got {len(docs)}."
    for d in docs:
        assert isinstance(d, Document), "Retriever must return LangChain Document objects."
        assert "doc_id" in d.metadata, "Returned Document metadata must contain 'doc_id'."


# --------------------------------------------------------------------------- #
# 3. Similarity ordering (no filter)
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("query", QUERIES)
@pytest.mark.parametrize("k", [3, 5])
def test_similarity_ordering_matches_oracle(solution_module, oracle, query, k):
    got = solution_module.retrieve(query, k)
    expected = oracle["sim_ids"](query, k)
    assert isinstance(got, list) and all(isinstance(x, str) for x in got), (
        "retrieve() must return a list of doc_id strings."
    )
    assert got == expected, (
        f"Similarity order mismatch for query={query!r}, k={k}.\n"
        f"  got={got}\n  expected={expected}"
    )


# --------------------------------------------------------------------------- #
# 4. Metadata pre-filter
# --------------------------------------------------------------------------- #
def test_prefilter_returns_only_matching_and_matches_oracle(solution_module, oracle, corpus):
    k = 5
    differs = False
    cases = [
        ("source", "guide", QUERIES[0]),
        ("source", "faq", QUERIES[2]),
        ("section", "search", QUERIES[0]),
    ]
    for where_kind, value, query in cases:
        sql = where_sql(where_kind, value)
        allowed = {d["doc_id"] for d in corpus if matches(d, where_kind, value)}

        got = solution_module.retrieve(query, k, where=sql)
        expected = oracle["sim_ids"](query, k, where=sql)

        assert set(got).issubset(allowed), (
            f"Pre-filtered result for {sql!r} contains doc_ids outside the filter: "
            f"got={got}, allowed={sorted(allowed)}."
        )
        assert got == expected, (
            f"Pre-filtered order mismatch for {sql!r}, query={query!r}.\n"
            f"  got={got}\n  expected={expected}"
        )
        if got != solution_module.retrieve(query, k):
            differs = True

    assert differs, (
        "A metadata pre-filter must change the result for at least one case; "
        "the filter appears to be ignored."
    )


def test_selective_prefilter_returns_fewer_than_k(solution_module, oracle, corpus):
    # Pick a section value that occurs in strictly fewer documents than k.
    k = 5
    counts = Counter(d["section"] for d in corpus)
    selective = [sec for sec, c in counts.items() if 0 < c < k]
    assert selective, "Corpus must contain a section with fewer than k documents for this check."
    section = sorted(selective, key=lambda s: (counts[s], s))[0]
    sql = where_sql("section", section)
    allowed = {d["doc_id"] for d in corpus if d["section"] == section}

    query = QUERIES[3]
    got = solution_module.retrieve(query, k, where=sql)
    expected = oracle["sim_ids"](query, k, where=sql)

    assert set(got) == allowed, (
        f"Highly selective filter {sql!r} must return exactly the matching doc_ids "
        f"{sorted(allowed)}, got {got}."
    )
    assert got == expected, (
        f"Selective pre-filter order mismatch for {sql!r}.\n  got={got}\n  expected={expected}"
    )


def test_timestamp_prefilter_matches_oracle(solution_module, oracle, corpus):
    k = 5
    timestamps = sorted(d["timestamp"] for d in corpus)
    median = timestamps[len(timestamps) // 2]
    sql = where_sql("timestamp_gte", median)
    allowed = {d["doc_id"] for d in corpus if d["timestamp"] >= median}

    query = QUERIES[1]
    got = solution_module.retrieve(query, k, where=sql)
    expected = oracle["sim_ids"](query, k, where=sql)

    assert set(got).issubset(allowed), (
        f"Timestamp pre-filter {sql!r} returned out-of-range doc_ids: got={got}."
    )
    assert got == expected, (
        f"Timestamp pre-filter order mismatch for {sql!r}.\n  got={got}\n  expected={expected}"
    )


# --------------------------------------------------------------------------- #
# 5. MMR retrieval
# --------------------------------------------------------------------------- #
MMR_CASES = [
    (QUERIES[0], 4, 12, 0.2),
    (QUERIES[0], 4, 12, 0.8),
    (QUERIES[2], 3, 15, 0.5),
    (QUERIES[4], 5, 20, 0.3),
]


@pytest.mark.parametrize("query,k,fetch_k,lambda_mult", MMR_CASES)
def test_mmr_matches_oracle(solution_module, oracle, query, k, fetch_k, lambda_mult):
    got = solution_module.retrieve_mmr(query, k, fetch_k, lambda_mult)
    expected = oracle["mmr_ids"](query, k, fetch_k, lambda_mult)
    assert isinstance(got, list) and all(isinstance(x, str) for x in got), (
        "retrieve_mmr() must return a list of doc_id strings."
    )
    assert got == expected, (
        f"MMR order mismatch for query={query!r}, k={k}, fetch_k={fetch_k}, "
        f"lambda_mult={lambda_mult}.\n  got={got}\n  expected={expected}"
    )


def test_mmr_with_filter_matches_oracle(solution_module, oracle, corpus):
    query = QUERIES[0]
    k, fetch_k, lambda_mult = 3, len(corpus), 0.5
    sql = where_sql("source", "guide")
    allowed = {d["doc_id"] for d in corpus if d["source"] == "guide"}

    got = solution_module.retrieve_mmr(query, k, fetch_k, lambda_mult, where=sql)
    expected = oracle["mmr_ids"](query, k, fetch_k, lambda_mult, where=sql)

    assert set(got).issubset(allowed), (
        f"Filtered MMR {sql!r} returned doc_ids outside the filter: got={got}."
    )
    assert got == expected, (
        f"Filtered MMR order mismatch for {sql!r}.\n  got={got}\n  expected={expected}"
    )


# --------------------------------------------------------------------------- #
# 6. Determinism
# --------------------------------------------------------------------------- #
def test_results_are_deterministic(solution_module, oracle):
    query = QUERIES[2]
    sim_a = solution_module.retrieve(query, 5)
    sim_b = solution_module.retrieve(query, 5)
    assert sim_a == sim_b, "Repeated similarity retrieval must be deterministic."

    mmr_a = solution_module.retrieve_mmr(query, 4, 12, 0.4)
    mmr_b = solution_module.retrieve_mmr(query, 4, 12, 0.4)
    assert mmr_a == mmr_b, "Repeated MMR retrieval must be deterministic."
