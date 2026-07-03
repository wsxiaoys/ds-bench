"""Query expansion with WordNet and LanceDB native FTS.

Combines WordNet synonyms with LanceDB's native FTS engine
(`use_tantivy=False`) so that lexical queries for words like ``car``
also retrieve documents that use synonyms such as ``REDACTEDmobile`` or
``motorcar``.

The pre-seeded LanceDB database is expected to be available at the
path stored in the ``LANCEDB_URI`` environment variable, with the table
name in ``LANCEDB_TABLE``. The table schema is::

    id: int64
    content: string

Public API
----------
``expanded_search(query: str, k: int = 10) -> list[int]``
    Run a WordNet-expanded native FTS search and return the top-k
    document ids ordered by FTS score descending.
"""

from __future__ import annotations

import os
import threading

import lancedb
from lancedb.common import DATA  # noqa: F401  (ensures LanceDB native modules register)
from lancedb.query import BooleanQuery, MatchQuery, Occur


# ---------------------------------------------------------------------------
# Module-level singletons
# ---------------------------------------------------------------------------

_TABLE = None
_INDEX_READY = False
_LOCK = threading.Lock()


def _get_table():
    """Open (and lazily FTS-index) the seeded LanceDB table exactly once."""
    global _TABLE, _INDEX_READY

    if _TABLE is not None and _INDEX_READY:
        return _TABLE

    with _LOCK:
        if _TABLE is not None and _INDEX_READY:
            return _TABLE

        db_path = os.environ.get("LANCEDB_URI", "/app/lancedb_data")
        table_name = os.environ.get("LANCEDB_TABLE", "docs")

        db = lancedb.connect(db_path)
        table = db.open_table(table_name)

        # ``replace=False`` keeps an existing index intact (calling
        # ``expanded_search`` more than once must not error), but the index
        # must also be created on first use if it does not yet exist.
        # ``create_fts_index`` raises if the index already exists, so we
        # detect that case and skip rebuilding.
        try:
            table.create_fts_index(
                "content",
                use_tantivy=False,
                replace=False,
            )
        except Exception as exc:  # pragma: no cover - defensive
            # ``ValueError`` is raised by LanceDB when an index already
            # exists; treat that as success. Anything else is re-raised.
            if "already exists" not in str(exc).lower():
                # Some LanceDB versions raise different exception types;
                # fall back to inspecting the index list below.
                if not _has_fts_index(table, "content"):
                    raise

        _TABLE = table
        _INDEX_READY = True
        return _TABLE


def _has_fts_index(table, column: str) -> bool:
    """Return True if the table already has an FTS index on ``column``."""
    try:
        indices = table.list_indices()
    except Exception:
        return False
    for idx in indices or []:
        # ``idx`` may be a dict-like or an object with attributes.
        try:
            idx_type = (idx.get("type") or idx.type) if hasattr(idx, "get") else getattr(idx, "type", None)
        except Exception:
            idx_type = getattr(idx, "type", None)
        if (idx_type or "").lower() != "fts":
            continue
        try:
            columns = idx.get("columns") if hasattr(idx, "get") else getattr(idx, "columns", None)
        except Exception:
            columns = getattr(idx, "columns", None)
        if columns and column in columns:
            return True
    return False


# ---------------------------------------------------------------------------
# Query expansion
# ---------------------------------------------------------------------------

def _expand_token(token: str, max_synonyms: int = 3) -> list[str]:
    """Return a list of single-token synonyms for ``token`` (incl. itself).

    WordNet may include multi-word lemma names containing ``_`` or spaces;
    those are filtered out so the resulting list always contains words that
    can be looked up token-for-token by the FTS engine.
    """
    token = token.lower()
    syns: list[str] = []
    seen: set[str] = set()
    seen.add(token)

    try:
        from nltk.corpus import wordnet as wn  # local import keeps top of file cheap
    except Exception:
        return [token]

    # ``wn.synonyms`` returns a list-of-lists (one per sense); flatten and
    # de-duplicate while preserving order.
    try:
        grouped = wn.synonyms(token) or []
    except Exception:
        grouped = []

    for group in grouped:
        for lemma in group:
            if not isinstance(lemma, str):
                continue
            lemma_lc = lemma.lower()
            if lemma_lc in seen:
                continue
            # Skip multi-word lemmas (they would contain '_' or whitespace).
            if "_" in lemma_lc or any(ch.isspace() for ch in lemma_lc):
                continue
            syns.append(lemma_lc)
            seen.add(lemma_lc)
            if len(syns) >= max_synonyms:
                return [token] + syns

    return [token] + syns


def _expand_query(query: str) -> list[str]:
    """Lowercase ``query`` and return the list of expanded tokens."""
    query = (query or "").lower()
    tokens = [t for t in query.split() if t]
    expanded: list[str] = []
    for tok in tokens:
        expanded.extend(_expand_token(tok))
    # De-duplicate while preserving order.
    seen = set()
    result: list[str] = []
    for term in expanded:
        if term not in seen:
            seen.add(term)
            result.append(term)
    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def expanded_search(query: str, k: int = 10) -> list[int]:
    """Run a WordNet-expanded native FTS search and return top-k doc ids.

    Parameters
    ----------
    query:
        Whitespace-separated query string. Lowercased before expansion.
    k:
        Number of results to return (top-k by FTS score, descending).

    Returns
    -------
    list[int]
        Document ids ordered by descending FTS score.
    """
    table = _get_table()
    terms = _expand_query(query)

    # If expansion produced nothing (e.g. empty query), fall back to an
    # empty-string search that LanceDB accepts and returns 0 rows for.
    if not terms:
        return []

    clauses = [(Occur.SHOULD, MatchQuery(term, "content")) for term in terms]
    bool_query = BooleanQuery(clauses)

    results = (
        table.search(bool_query, query_type="fts")
        .limit(k)
        .to_list()
    )

    return [int(row["id"]) for row in results]


__all__ = ["expanded_search"]