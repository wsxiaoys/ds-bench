"""Cross-lingual semantic search with Cohere embed-multilingual-v3.0 and LanceDB.

This module reads a fixed corpus (90 rows: 30 concepts x 3 languages en/es/fr),
embeds every sentence with Cohere's `embed-multilingual-v3.0` model using
`input_type="search_document"`, persists the rows into a run-scoped LanceDB
table, and exposes :func:`cross_lingual_search` to retrieve the top-k matches
across all languages for a query embedded with `input_type="search_query"`.
"""

from __future__ import annotations

import json
import os
from typing import Any

import numpy as np
import pyarrow as pa
import lancedb
import cohere

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CORPUS_PATH = os.environ.get("CORPUS_PATH", "/home/user/myproject/corpus.json")
DB_PATH = os.environ.get("LANCEDB_PATH", "/home/user/myproject/lancedb_data")
EMBED_MODEL = "embed-multilingual-v3.0"
EMBED_DIM = 1024
BATCH_SIZE = 96  # Cohere embed accepts at most 96 texts per request.

# Module-level cached handles so we only build the index once per process.
_client: cohere.ClientV2 | None = None
_db: lancedb.LanceDBConnection | None = None
_table: Any = None
_run_id: str | None = None


def _get_run_id() -> str:
    """Return the run-scoped id used to name the LanceDB table.

    Reads ``/logs/artifacts/run-id`` from the environment. Falls back to a
    stable default so the module remains importable outside the grader.
    """
    global _run_id
    if _run_id is not None:
        return _run_id
    run_id = "local"
    run_id_file = os.environ.get("RUN_ID_FILE", "/logs/artifacts/run-id")
    try:
        with open(run_id_file, "r", encoding="utf-8") as fh:
            content = fh.read().strip()
        if content:
            run_id = content
    except OSError:
        pass
    _run_id = run_id
    return _run_id


def _table_name() -> str:
    return f"multilingual_{_get_run_id()}"


def _get_client() -> cohere.ClientV2:
    global _client
    if _client is None:
        api_key = os.environ["COHERE_API_KEY"]
        _client = cohere.ClientV2(api_key=api_key)
    return _client


def _get_db():
    global _db
    if _db is None:
        os.makedirs(DB_PATH, exist_ok=True)
        _db = lancedb.connect(DB_PATH)
    return _db


def _extract_embeddings(response) -> list[list[float]]:
    """Normalize a Cohere embed response into a plain list[list[float]].

    The V2 SDK with ``embedding_types=["float"]`` exposes
    ``response.embeddings.float_`` (a list of lists). Without
    ``embedding_types`` the legacy form ``response.embeddings`` is a plain
    list of lists. We handle both shapes defensively.
    """
    emb_obj = getattr(response, "embeddings", None)
    if emb_obj is None:
        # Some legacy SDKs return the list directly.
        return [list(map(float, row)) for row in response]

    # Preferred V2 path: typed embeddings object with .float_ attribute.
    float_emb = None
    for attr in ("float_", "float"):
        float_emb = getattr(emb_obj, attr, None)
        if float_emb is not None:
            break
    if float_emb is not None:
        return [list(map(float, row)) for row in float_emb]

    # Legacy fallback: emb_obj itself is a list of lists.
    try:
        return [list(map(float, row)) for row in emb_obj]
    except TypeError:
        return [list(map(float, row)) for row in response]


def _embed_texts(texts: list[str], input_type: str) -> list[list[float]]:
    """Embed a list of texts in batches, returning float32-castable vectors."""
    client = _get_client()
    all_vectors: list[list[float]] = []
    for start in range(0, len(texts), BATCH_SIZE):
        batch = texts[start:start + BATCH_SIZE]
        response = client.embed(
            texts=batch,
            model=EMBED_MODEL,
            input_type=input_type,
            embedding_types=["float"],
        )
        all_vectors.extend(_extract_embeddings(response))
    return all_vectors


def _load_corpus() -> list[dict]:
    with open(CORPUS_PATH, "r", encoding="utf-8") as fh:
        rows = json.load(fh)
    return rows


def _schema() -> pa.schema:
    return pa.schema(
        [
            pa.field("concept_id", pa.int32()),
            pa.field("language", pa.string()),
            pa.field("text", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), EMBED_DIM)),
        ]
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def build_index() -> Any:
    """Embed the corpus once and persist it into a run-scoped LanceDB table.

    Returns the LanceDB table. Safe to call multiple times: it will only
    embed + ingest the first time, then reuse the cached table handle.
    """
    global _table
    if _table is not None:
        return _table

    rows = _load_corpus()
    texts = [r["text"] for r in rows]
    vectors = _embed_texts(texts, input_type="search_document")

    records = pa.Table.from_pylist(
        [
            {
                "concept_id": int(r["concept_id"]),
                "language": str(r["language"]),
                "text": str(r["text"]),
                "vector": np.asarray(vectors[i], dtype=np.float32),
            }
            for i, r in enumerate(rows)
        ],
        schema=_schema(),
    )

    db = _get_db()
    name = _table_name()
    # Drop any stale table from a previous run with the same id, then create.
    try:
        db.drop_table(name)
    except Exception:
        pass
    _table = db.create_table(name, data=records, mode="overwrite")
    return _table


def _get_table():
    global _table
    if _table is not None:
        return _table
    db = _get_db()
    name = _table_name()
    try:
        _table = db.open_table(name)
    except Exception:
        # Table does not exist yet -> build it.
        _table = build_index()
    return _table


def cross_lingual_search(query: str, k: int = 3) -> list[dict]:
    """Return the top-k corpus rows matching ``query`` across all languages.

    The query is embedded with ``input_type="search_query"`` and searched
    against the run-scoped LanceDB table using cosine distance. Results are
    sorted by ascending distance and each dict contains ``concept_id``,
    ``language`` and ``text``.
    """
    table = _get_table()

    q_vectors = _embed_texts([query], input_type="search_query")
    q_vector = [float(x) for x in q_vectors[0]]

    results = (
        table.search(q_vector, vector_column_name="vector")
        .metric("cosine")
        .limit(k)
        .to_list()
    )

    output: list[dict] = []
    for row in results:
        output.append(
            {
                "concept_id": int(row["concept_id"]),
                "language": str(row["language"]),
                "text": str(row["text"]),
                "_distance": float(row.get("_distance", row.get("distance", 0.0))),
            }
        )
    # LanceDB already returns ascending distance, but ensure ordering.
    output.sort(key=lambda d: d["_distance"])
    # Trim the internal distance key from the public result.
    return [{"concept_id": d["concept_id"], "language": d["language"], "text": d["text"]} for d in output]


if __name__ == "__main__":
    # Quick smoke test when run directly.
    build_index()
    for q in ["Where is the Eiffel Tower?", "¿Dónde está la Torre Eiffel?"]:
        print(f"\nQuery: {q}")
        for hit in cross_lingual_search(q, k=3):
            print(f"  [{hit['language']}] (id={hit['concept_id']}) {hit['text']}")