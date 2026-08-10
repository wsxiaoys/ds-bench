"""Retrieval layer built on LangChain's LanceDB vector store integration.

This module builds a local, fully offline LanceDB-backed vector store from
``corpus.json`` using the deterministic ``HashEmbeddings`` model defined in
``local_embeddings.py``. It exposes the store as a LangChain retriever and
provides convenience functions for similarity and MMR search, both of which
support metadata pre-filtering via LanceDB SQL predicate strings.
"""

from __future__ import annotations

import json
import os
from typing import Any, List, Optional

import lancedb
from langchain_community.vectorstores import LanceDB
from langchain_core.callbacks import CallbackManagerForRetrieverRun
from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever

from local_embeddings import HashEmbeddings

# ---------------------------------------------------------------------------
# Constants / paths
# ---------------------------------------------------------------------------

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_URI = os.path.join(_BASE_DIR, "lancedb")
TABLE_NAME = "documents"
CORPUS_PATH = os.path.join(_BASE_DIR, "corpus.json")

# A single, shared embedding model instance. HashEmbeddings is deterministic
# and offline, so it is safe (and cheap) to reuse across calls.
_embeddings = HashEmbeddings()


# ---------------------------------------------------------------------------
# Corpus loading helpers
# ---------------------------------------------------------------------------


def _load_corpus() -> List[dict]:
    with open(CORPUS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _to_metadata(doc: dict) -> dict:
    return {
        "doc_id": doc["doc_id"],
        "source": doc["source"],
        "section": doc["section"],
        "timestamp": doc["timestamp"],
    }


# ---------------------------------------------------------------------------
# Index construction
# ---------------------------------------------------------------------------


def build_index() -> LanceDB:
    """(Re)create the ``documents`` table from ``corpus.json``.

    Each document's text and metadata (doc_id, source, section, timestamp)
    are stored. Calling this function multiple times always results in
    exactly one full copy of the corpus in the table (the table is
    overwritten from scratch on every call, so no duplicates accumulate).

    Returns the LangChain ``LanceDB`` vector store object backed by the
    freshly (re)built table.
    """
    corpus = _load_corpus()

    texts = [d["text"] for d in corpus]
    ids = [d["doc_id"] for d in corpus]
    metadatas = [_to_metadata(d) for d in corpus]
    vectors = _embeddings.embed_documents(texts)

    records = [
        {
            "vector": vectors[i],
            "id": ids[i],
            "text": texts[i],
            "metadata": metadatas[i],
            # Flattened top-level copies of the metadata fields so that
            # callers can write simple SQL predicates such as
            # "source = 'guide'" instead of needing to know that the
            # LangChain integration nests metadata under a struct column.
            "doc_id": metadatas[i]["doc_id"],
            "source": metadatas[i]["source"],
            "section": metadatas[i]["section"],
            "timestamp": metadatas[i]["timestamp"],
        }
        for i in range(len(corpus))
    ]

    connection = lancedb.connect(DB_URI)
    # mode="overwrite" replaces any existing table content, guaranteeing a
    # single, fresh copy of the corpus regardless of how many times
    # build_index() is invoked.
    table = connection.create_table(TABLE_NAME, data=records, mode="overwrite")

    vectorstore = LanceDB(
        connection=connection,
        embedding=_embeddings,
        uri=DB_URI,
        table=table,
        table_name=TABLE_NAME,
        vector_key="vector",
        id_key="id",
        text_key="text",
        mode="overwrite",
        distance="cosine",
    )
    return vectorstore


def _get_vectorstore() -> LanceDB:
    """Open (without rebuilding) the vector store backed by the on-disk table.

    If the table does not yet exist, it is built first via build_index().
    """
    connection = lancedb.connect(DB_URI)
    try:
        table = connection.open_table(TABLE_NAME)
    except Exception:
        return build_index()

    return LanceDB(
        connection=connection,
        embedding=_embeddings,
        uri=DB_URI,
        table=table,
        table_name=TABLE_NAME,
        vector_key="vector",
        id_key="id",
        text_key="text",
        distance="cosine",
    )


# ---------------------------------------------------------------------------
# Custom retriever
#
# The bundled langchain_community.vectorstores.LanceDB.max_marginal_relevance_search
# method does not forward arbitrary keyword arguments (such as `prefilter`)
# down to the underlying LanceDB query, so relying on the default
# VectorStoreRetriever would silently lose pre-filtering semantics for MMR
# search. This retriever calls the vector store's lower level, kwarg-
# forwarding APIs directly so that a `where` filter is always applied as a
# pre-filter, for both similarity and MMR search types.
# ---------------------------------------------------------------------------


class LanceDBRetriever(BaseRetriever):
    """A LangChain retriever over a LanceDB-backed vector store.

    Attributes:
        vectorstore: The underlying LangChain ``LanceDB`` vector store.
        search_type: Either ``"similarity"`` or ``"mmr"``.
        search_kwargs: Keyword arguments controlling the search, e.g.
            ``{"k": 5, "where": "source = 'guide'"}`` for similarity search or
            ``{"k": 5, "fetch_k": 20, "lambda_mult": 0.5, "where": ...}``
            for MMR search.
    """

    vectorstore: Any
    search_type: str = "similarity"
    search_kwargs: dict = {}

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        kwargs = dict(self.search_kwargs)
        where = kwargs.pop("where", None)
        if where is None:
            where = kwargs.pop("filter", None)

        if self.search_type == "mmr":
            k = kwargs.get("k", 4)
            fetch_k = kwargs.get("fetch_k", 20)
            lambda_mult = kwargs.get("lambda_mult", 0.5)
            return _mmr_search(
                self.vectorstore,
                query,
                k=k,
                fetch_k=fetch_k,
                lambda_mult=lambda_mult,
                where=where,
            )
        elif self.search_type == "similarity":
            k = kwargs.get("k", 4)
            return self.vectorstore.similarity_search(
                query, k=k, filter=where, prefilter=True
            )
        else:
            raise ValueError(
                f"Unsupported search_type: {self.search_type!r}. "
                "Expected 'similarity' or 'mmr'."
            )


def _mmr_search(
    vectorstore: LanceDB,
    query: str,
    k: int,
    fetch_k: int,
    lambda_mult: float,
    where: Optional[str] = None,
) -> List[Document]:
    """Run MMR search directly against the vector store's by-vector API.

    This bypasses ``LanceDB.max_marginal_relevance_search``, which does not
    forward the ``prefilter`` keyword to the underlying LanceDB query,
    ensuring that ``where`` is honored as a true pre-filter.
    """
    embedding = vectorstore._embedding.embed_query(query)
    return vectorstore.max_marginal_relevance_search_by_vector(
        embedding,
        k=k,
        fetch_k=fetch_k,
        lambda_mult=lambda_mult,
        filter=where,
        prefilter=True,
    )


def get_retriever(search_type: str = "similarity", search_kwargs: Optional[dict] = None) -> BaseRetriever:
    """Return a LangChain retriever over the ``documents`` table.

    Args:
        search_type: ``"similarity"`` or ``"mmr"``.
        search_kwargs: Dict of search parameters. Supported keys:
            - ``k``: number of documents to return.
            - ``fetch_k``: (mmr only) number of candidates to fetch.
            - ``lambda_mult``: (mmr only) diversity trade-off parameter.
            - ``where``: optional LanceDB SQL predicate string used as a
              metadata pre-filter.
    """
    vectorstore = _get_vectorstore()
    return LanceDBRetriever(
        vectorstore=vectorstore,
        search_type=search_type,
        search_kwargs=dict(search_kwargs or {}),
    )


# ---------------------------------------------------------------------------
# Convenience retrieval functions
# ---------------------------------------------------------------------------


def retrieve(query: str, k: int, where: Optional[str] = None) -> List[str]:
    """Similarity search returning ranked doc_id values.

    Args:
        query: The query text.
        k: Maximum number of results to return.
        where: Optional LanceDB SQL predicate string applied as a metadata
            pre-filter (before the vector search).

    Returns:
        A list of doc_id strings, ordered from most to least similar.
    """
    vectorstore = _get_vectorstore()
    docs = vectorstore.similarity_search(query, k=k, filter=where, prefilter=True)
    return [doc.metadata["doc_id"] for doc in docs]


def retrieve_mmr(
    query: str,
    k: int,
    fetch_k: int,
    lambda_mult: float,
    where: Optional[str] = None,
) -> List[str]:
    """MMR search returning ranked doc_id values.

    Args:
        query: The query text.
        k: Number of results to return.
        fetch_k: Number of candidates fetched for the MMR algorithm.
        lambda_mult: Diversity trade-off in [0, 1] (0 = max diversity,
            1 = max relevance).
        where: Optional LanceDB SQL predicate string applied as a metadata
            pre-filter (before the vector search).

    Returns:
        A list of doc_id strings in MMR selection order.
    """
    vectorstore = _get_vectorstore()
    docs = _mmr_search(
        vectorstore, query, k=k, fetch_k=fetch_k, lambda_mult=lambda_mult, where=where
    )
    return [doc.metadata["doc_id"] for doc in docs]


if __name__ == "__main__":
    build_index()
