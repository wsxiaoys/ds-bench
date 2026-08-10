import importlib
import json
import os
import sys

import pytest

PROJECT_DIR = "/home/user/project"
CORPUS_PATH = os.path.join(PROJECT_DIR, "data", "corpus.json")

if PROJECT_DIR not in sys.path:
    sys.path.insert(0, PROJECT_DIR)


@pytest.fixture(scope="session")
def corpus():
    with open(CORPUS_PATH) as f:
        records = json.load(f)
    return {r["id"]: r for r in records}


@pytest.fixture(scope="session")
def pipeline():
    # Import the solution module produced by the executor.
    module = importlib.import_module("hybrid_pipeline")
    assert hasattr(module, "retrieve"), "hybrid_pipeline must expose a `retrieve` callable."
    return module


@pytest.fixture(scope="session")
def filter_types():
    from llama_index.core.vector_stores import (
        FilterCondition,
        FilterOperator,
        MetadataFilter,
        MetadataFilters,
    )

    return {
        "MetadataFilters": MetadataFilters,
        "MetadataFilter": MetadataFilter,
        "FilterOperator": FilterOperator,
        "FilterCondition": FilterCondition,
    }


def _ids(results):
    return [r["id"] for r in results]


def test_return_schema_and_id_preservation(pipeline, corpus):
    results = pipeline.retrieve("language models", None, 4)
    assert isinstance(results, list), "retrieve must return a list."
    assert len(results) <= 4, f"Expected at most 4 results, got {len(results)}."
    for item in results:
        assert isinstance(item, dict), f"Each result must be a dict, got {type(item)}."
        assert set(item.keys()) == {"id", "text"}, (
            f"Each result must have exactly keys 'id' and 'text', got {sorted(item.keys())}."
        )
        assert item["id"] in corpus, f"Returned id {item['id']} is not a corpus id."
        assert item["text"] == corpus[item["id"]]["text"], (
            f"Returned text for {item['id']} does not match the corpus text."
        )
    assert _ids(results) == ["d6", "d1", "d3", "d9"], (
        f"Unexpected hybrid ranking for 'language models': {_ids(results)}"
    )


def test_exact_match_filter(pipeline, corpus, filter_types):
    MetadataFilters = filter_types["MetadataFilters"]
    MetadataFilter = filter_types["MetadataFilter"]
    FilterOperator = filter_types["FilterOperator"]

    filters = MetadataFilters(
        filters=[
            MetadataFilter(key="category", operator=FilterOperator.EQ, value="db")
        ]
    )
    results = pipeline.retrieve("database search over embeddings", filters, 3)
    ids = _ids(results)
    assert ids == ["d5", "d3", "d7"], f"Unexpected filtered ranking: {ids}"
    for item in results:
        assert corpus[item["id"]]["category"] == "db", (
            f"Result {item['id']} violates category == 'db' filter."
        )


def test_combined_and_range_filter(pipeline, corpus, filter_types):
    MetadataFilters = filter_types["MetadataFilters"]
    MetadataFilter = filter_types["MetadataFilter"]
    FilterOperator = filter_types["FilterOperator"]
    FilterCondition = filter_types["FilterCondition"]

    filters = MetadataFilters(
        filters=[
            MetadataFilter(key="category", operator=FilterOperator.EQ, value="ml"),
            MetadataFilter(key="year", operator=FilterOperator.GTE, value=2018),
        ],
        condition=FilterCondition.AND,
    )
    results = pipeline.retrieve("neural network training optimization", filters, 3)
    ids = _ids(results)
    assert ids == ["d2", "d1", "d6"], f"Unexpected AND-filtered ranking: {ids}"
    for item in results:
        rec = corpus[item["id"]]
        assert rec["category"] == "ml", f"Result {item['id']} violates category == 'ml'."
        assert rec["year"] >= 2018, f"Result {item['id']} violates year >= 2018."
    # documents that fail the range must never appear
    assert "d10" not in ids, "d10 (year 2015) must be excluded by year >= 2018."
    assert "d8" not in ids, "d8 (year 2017) must be excluded by year >= 2018."


def test_filter_restricts_to_single_category(pipeline, corpus, filter_types):
    MetadataFilters = filter_types["MetadataFilters"]
    MetadataFilter = filter_types["MetadataFilter"]
    FilterOperator = filter_types["FilterOperator"]

    filters = MetadataFilters(
        filters=[
            MetadataFilter(key="category", operator=FilterOperator.EQ, value="systems")
        ]
    )
    results = pipeline.retrieve("consensus algorithms", filters, 5)
    ids = _ids(results)
    assert ids == ["d4"], f"Expected only ['d4'] for systems category, got {ids}"


def test_top_k_bound(pipeline):
    results = pipeline.retrieve("neural networks", None, 2)
    assert len(results) <= 2, f"top_k=2 must cap results, got {len(results)}."
