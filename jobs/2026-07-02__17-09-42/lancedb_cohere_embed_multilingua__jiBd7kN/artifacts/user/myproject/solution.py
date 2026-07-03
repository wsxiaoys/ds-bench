"""Cross-lingual semantic search using Cohere multilingual embeddings and LanceDB.

Reads a fixed multilingual corpus (English / Spanish / French) from
``corpus.json``, embeds every document with Cohere's
``embed-multilingual-v3.0`` model, persists the vectors into a run-scoped
LanceDB table, and exposes a ``cross_lingual_search`` function that can answer
queries in any of the three languages with documents from all of them.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, Optional

import lancedb
import pyarrow as pa
from lancedb.pydantic import LanceModel, Vector

try:
    import cohere
except Exception:  # pragma: no cover - import-time guard
    cohere = None  # type: ignore[assignment]


# --------------------------------------------------------------------------- #
# Paths / configuration
# --------------------------------------------------------------------------- #

PROJECT_DIR = Path("/home/user/myproject")
CORPUS_PATH = PROJECT_DIR / "corpus.json"
LANCEDB_DIR = PROJECT_DIR / "lancedb_data"
RUN_ID_PATH = Path("/logs/artifacts/run-id")

EMBED_MODEL = "embed-multilingual-v3.0"
EMBED_DIM = 1024


# --------------------------------------------------------------------------- #
# Schema / table name
# --------------------------------------------------------------------------- #


class CorpusRow(LanceModel):
    """Pydantic schema for the LanceDB table holding multilingual corpus rows."""

    concept_id: int
    language: str
    text: str
    vector: Vector(EMBED_DIM)  # 1024-d float32 fixed-size-list column


def _load_run_id() -> str:
    """Read the run id used to scope the LanceDB table name."""
    if RUN_ID_PATH.exists():
        run_id = RUN_ID_PATH.read_text(encoding="utf-8").strip()
        if run_id:
            return run_id
    # Fallback: derive something unique from the environment / a random value.
    return os.environ.get("RUN_ID", "default")


def _table_name() -> str:
    return f"multilingual_{_load_run_id()}"


# --------------------------------------------------------------------------- #
# Cohere client / embedding helpers
# --------------------------------------------------------------------------- #


def _get_cohere_client() -> "cohere.Client":
    if cohere is None:
        raise RuntimeError("The 'cohere' package is not installed.")
    api_key = os.environ.get("COHERE_API_KEY")
    if not api_key:
        raise RuntimeError("COHERE_API_KEY environment variable is not set.")
    return cohere.Client(api_key=api_key)


def _extract_embeddings(response) -> List[List[float]]:
    """Pull the per-text float embeddings out of a Cohere embed response.

    Supports the two response shapes the official SDK uses depending on the
    version of the package:
      * legacy: ``response.embeddings`` is a list of lists.
      * new:    ``response.embeddings.float_`` (or ``.float``) is the same list.
    """
    embeddings_obj = response.embeddings

    # Newer SDKs expose a typed wrapper.
    if embeddings_obj is not None and not isinstance(embeddings_obj, list):
        if hasattr(embeddings_obj, "float_"):
            return [list(map(float, vec)) for vec in embeddings_obj.float_]
        if hasattr(embeddings_obj, "float"):
            return [list(map(float, vec)) for vec in embeddings_obj.float]

    # Legacy / generic list-of-lists path.
    return [list(map(float, vec)) for vec in embeddings_obj]


def _embed_texts(
    texts: List[str], input_type: str, client: Optional["cohere.Client"] = None
) -> List[List[float]]:
    """Embed a batch of texts with the multilingual v3 model."""
    client = client or _get_cohere_client()
    response = client.embed(
        texts=list(texts),
        model=EMBED_MODEL,
        input_type=input_type,
    )
    vectors = _extract_embeddings(response)
    if len(vectors) != len(texts):
        raise RuntimeError(
            f"Cohere returned {len(vectors)} embeddings for {len(texts)} texts."
        )
    for vec in vectors:
        if len(vec) != EMBED_DIM:
            raise RuntimeError(
                f"Expected {EMBED_DIM}-d vectors, got {len(vec)}."
            )
    return vectors


# --------------------------------------------------------------------------- #
# Build / load index
# --------------------------------------------------------------------------- #


_TABLE: Optional["lancedb.table.LanceTable"] = None
_DB: Optional["lancedb.db.LanceDBConnection"] = None


def _connect_db() -> "lancedb.db.LanceDBConnection":
    LANCEDB_DIR.mkdir(parents=True, exist_ok=True)
    return lancedb.connect(str(LANCEDB_DIR))


def _load_corpus() -> List[dict]:
    with CORPUS_PATH.open("r", encoding="utf-8") as fh:
        rows = json.load(fh)
    if not isinstance(rows, list):
        raise ValueError("corpus.json must contain a JSON array of objects.")
    return rows


def build_index() -> "lancedb.table.LanceTable":
    """Embed the corpus and persist it into a run-scoped LanceDB table."""
    global _TABLE, _DB

    corpus = _load_corpus()
    texts = [row["text"] for row in corpus]

    client = _get_cohere_client()
    vectors = _embed_texts(texts, input_type="search_document", client=client)

    db = _connect_db()
    table_name = _table_name()

    # Drop any stale data with the same run-scoped name so the build is
    # idempotent across re-runs that share the same RUN_ID.
    if table_name in db.table_names():
        db.drop_table(table_name)

    records = [
        {
            "concept_id": int(row["concept_id"]),
            "language": str(row["language"]),
            "text": str(row["text"]),
            "vector": [float(x) for x in vec],
        }
        for row, vec in zip(corpus, vectors)
    ]

    table = db.create_table(
        table_name,
        data=records,
        schema=CorpusRow,
        mode="create",
        exist_ok=False,
    )

    _DB = db
    _TABLE = table
    return table


def _get_table():
    """Return the cached LanceDB table, building it lazily if needed."""
    global _TABLE, _DB
    if _TABLE is not None:
        return _TABLE

    db = _connect_db()
    table_name = _table_name()
    if table_name in db.table_names():
        _DB = db
        _TABLE = db.open_table(table_name)
        return _TABLE

    return build_index()


# --------------------------------------------------------------------------- #
# Public search API
# --------------------------------------------------------------------------- #


def cross_lingual_search(query: str, k: int = 3) -> List[dict]:
    """Return the top-``k`` documents across all three languages for ``query``."""
    if not isinstance(query, str) or not query.strip():
        raise ValueError("query must be a non-empty string.")
    if not isinstance(k, int) or k <= 0:
        raise ValueError("k must be a positive integer.")

    client = _get_cohere_client()
    query_vectors = _embed_texts(
        [query], input_type="search_query", client=client
    )
    query_vector = query_vectors[0]

    table = _get_table()
    results = (
        table.search(query_vector, vector_column_name="vector")
        .metric("cosine")
        .limit(k)
        .to_list()
    )

    output: List[dict] = []
    for row in results:
        output.append(
            {
                "concept_id": int(row["concept_id"]),
                "language": str(row["language"]),
                "text": str(row["text"]),
            }
        )
    return output


if __name__ == "__main__":  # pragma: no cover - manual smoke test
    table = build_index()
    print(f"Built table '{table.name}' with {table.count_rows()} rows.")
    for hit in cross_lingual_search("What is the tallest mountain on Earth?", k=3):
        print(hit)
