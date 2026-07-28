"""
Offline LlamaIndex + LanceDB hybrid retriever with metadata filters.

This module builds (or reuses) a LanceDB-backed LlamaIndex retrieval
pipeline that runs entirely offline:

* Embeddings are produced by a deterministic, local hashing scheme (no
  network calls, no pretrained models).
* Retrieval is hybrid: dense vector similarity is combined with a
  full-text (BM25-style) search over the node text, fused with
  Reciprocal Rank Fusion (RRF) -- this is LanceDB's default hybrid
  reranking strategy.
* `llama_index.core.vector_stores.MetadataFilters` (exact-match and
  numeric range conditions, combined with AND) are supported and are
  applied by the underlying vector store query.

The only public entry point is `retrieve(query, filters=None, top_k=5)`.
Importing this module and calling `retrieve(...)` is sufficient to build
(or reuse) the on-disk LanceDB index and run a real hybrid query -- no
extra setup call is required by the caller.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import threading
from typing import Any, Dict, List, Optional

from llama_index.core import Settings, VectorStoreIndex
from llama_index.core.base.embeddings.base import BaseEmbedding
from llama_index.core.llms import MockLLM
from llama_index.core.schema import MetadataMode, TextNode
from llama_index.core.vector_stores.types import (
    MetadataFilters,
    VectorStoreQueryMode,
)
from llama_index.vector_stores.lancedb import LanceDBVectorStore

# --------------------------------------------------------------------------
# Paths / constants
# --------------------------------------------------------------------------

_PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
_CORPUS_PATH = os.path.join(_PROJECT_DIR, "data", "corpus.json")
_LANCEDB_URI = os.path.join(_PROJECT_DIR, "storage", "lancedb")
_TABLE_NAME = "corpus_nodes"

_EMBED_DIM = 32
_TOKEN_RE = re.compile(r"[a-z0-9]+")


# --------------------------------------------------------------------------
# Deterministic, purely local embedding function
# --------------------------------------------------------------------------


def _embed_text(text: str) -> List[float]:
    """Deterministic, local, hashing-based embedding.

    Algorithm (must stay in sync with the task spec):
      1. Lowercase the text and extract tokens matching [a-z0-9]+.
      2. Start from a length-32 zero vector.
      3. For each token, idx = int(sha256(token).hexdigest(), 16) % 32;
         add 1.0 to position idx.
      4. L2-normalize the vector (leave as all-zeros if the norm is 0).
    """
    vec = [0.0] * _EMBED_DIM
    tokens = _TOKEN_RE.findall(text.lower())
    for token in tokens:
        idx = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16) % _EMBED_DIM
        vec[idx] += 1.0

    norm = sum(v * v for v in vec) ** 0.5
    if norm > 0:
        vec = [v / norm for v in vec]
    return vec


class LocalHashEmbedding(BaseEmbedding):
    """A fully local, deterministic embedding model.

    No network access, no pretrained weights: embeddings are computed by
    `_embed_text`. Used for both document ingestion and query embedding so
    that results are fully reproducible offline.
    """

    def __init__(self, **kwargs: Any) -> None:
        super().__init__(model_name="local-hash-embedding-32", **kwargs)

    def _get_query_embedding(self, query: str) -> List[float]:
        return _embed_text(query)

    async def _aget_query_embedding(self, query: str) -> List[float]:
        return _embed_text(query)

    def _get_text_embedding(self, text: str) -> List[float]:
        return _embed_text(text)

    async def _aget_text_embedding(self, text: str) -> List[float]:
        return _embed_text(text)

    def _get_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        return [_embed_text(t) for t in texts]


# --------------------------------------------------------------------------
# Global LlamaIndex settings: pin embed_model / llm so nothing ever tries to
# resolve a remote (OpenAI, HuggingFace hub, Cohere, ...) default.
# --------------------------------------------------------------------------

_local_embed_model = LocalHashEmbedding()
Settings.embed_model = _local_embed_model
Settings.llm = MockLLM()


# --------------------------------------------------------------------------
# Lazy, thread-safe singleton state for the built index.
# --------------------------------------------------------------------------

_lock = threading.Lock()
_state: Dict[str, Any] = {"index": None}


def _load_corpus() -> List[Dict[str, Any]]:
    with open(_CORPUS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _make_vector_store() -> LanceDBVectorStore:
    os.makedirs(_LANCEDB_URI, exist_ok=True)
    # `mode="create"` only matters the first time the table is created;
    # if the table already exists on disk it is opened (and reused) as-is.
    # `query_type="hybrid"` makes every query combine dense vector search
    # with full-text search, fused via LanceDB's default RRF reranker.
    return LanceDBVectorStore(
        uri=_LANCEDB_URI,
        table_name=_TABLE_NAME,
        mode="create",
        query_type="hybrid",
    )


def _ensure_populated(vector_store: LanceDBVectorStore) -> None:
    """Ingest the corpus into the vector store if it isn't there yet."""
    records = _load_corpus()

    existing_count = 0
    if vector_store._table is not None:
        try:
            existing_count = vector_store._table.count_rows()
        except Exception:
            existing_count = 0

    if existing_count >= len(records):
        # Already ingested from a previous run -- reuse as-is.
        return

    nodes: List[TextNode] = []
    for record in records:
        node = TextNode(
            id_=str(record["id"]),
            text=record["text"],
            metadata={
                "category": record["category"],
                "year": int(record["year"]),
            },
        )
        node.embedding = _embed_text(node.get_content(metadata_mode=MetadataMode.NONE))
        nodes.append(node)

    vector_store.add(nodes)


def _get_index() -> VectorStoreIndex:
    with _lock:
        if _state["index"] is None:
            vector_store = _make_vector_store()
            _ensure_populated(vector_store)
            _state["index"] = VectorStoreIndex.from_vector_store(
                vector_store=vector_store,
                embed_model=_local_embed_model,
            )
        return _state["index"]


def retrieve(
    query: str,
    filters: Optional[MetadataFilters] = None,
    top_k: int = 5,
) -> List[Dict[str, str]]:
    """Run a hybrid (dense + full-text, RRF-fused) retrieval query.

    Args:
        query: the natural-language query string.
        filters: optional `llama_index.core.vector_stores.MetadataFilters`
            (exact-match / numeric-range conditions, AND-combined) applied
            through the retriever to the LanceDB store.
        top_k: maximum number of results to return.

    Returns:
        A list of dicts with keys "id" and "text", ordered from most to
        least relevant, with at most `top_k` items.
    """
    if not isinstance(query, str):
        raise TypeError("query must be a str")
    if top_k <= 0:
        return []

    index = _get_index()

    retriever = index.as_retriever(
        similarity_top_k=top_k,
        vector_store_query_mode=VectorStoreQueryMode.HYBRID,
        filters=filters,
        embed_model=_local_embed_model,
    )

    nodes_with_scores = retriever.retrieve(query)

    results: List[Dict[str, str]] = []
    for node_with_score in nodes_with_scores[:top_k]:
        node = node_with_score.node
        results.append(
            {
                "id": node.node_id,
                "text": node.get_content(metadata_mode=MetadataMode.NONE),
            }
        )
    return results
