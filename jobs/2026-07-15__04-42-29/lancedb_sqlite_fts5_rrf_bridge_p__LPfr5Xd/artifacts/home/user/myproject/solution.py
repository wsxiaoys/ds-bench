"""
Hybrid search: SQLite FTS5 BM25 + LanceDB vectors fused with weighted RRF.

Config is read once at import time from /app/data/config.json so that every
call to search() uses the same connection parameters without re-reading the
file on each invocation.
"""

import json
import sqlite3
from pathlib import Path

import lancedb

# ---------------------------------------------------------------------------
# Bootstrap: read config written by the seeder
# ---------------------------------------------------------------------------

_CONFIG_PATH = "/app/data/config.json"

with open(_CONFIG_PATH) as _f:
    _CFG = json.load(_f)

_SQLITE_PATH: str = _CFG["sqlite_path"]
_LANCEDB_URI: str = _CFG["lancedb_uri"]
_TABLE_NAME: str = _CFG["table_name"]
_DISTANCE_METRIC: str = _CFG["distance_metric"]
_RRF_K: int = int(_CFG["rrf_k"])

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

_CANDIDATE_POOL = 50  # generous pool pulled from each store


def _keyword_candidates(
    query: str,
    title_weight: float,
    body_weight: float,
    limit: int,
) -> list[int]:
    """Return up to *limit* document ids ranked by FTS5 BM25 (best first)."""
    sql = (
        f"SELECT rowid FROM {_TABLE_NAME} "
        f"WHERE {_TABLE_NAME} MATCH ? "
        f"ORDER BY bm25({_TABLE_NAME}, {float(title_weight)}, {float(body_weight)}), rowid "
        f"LIMIT {int(limit)}"
    )
    con = sqlite3.connect(_SQLITE_PATH)
    try:
        rows = con.execute(sql, (query,)).fetchall()
    finally:
        con.close()
    return [int(r[0]) for r in rows]


def _vector_candidates(query_vector: list[float], limit: int) -> list[int]:
    """Return up to *limit* document ids ranked by ascending vector distance."""
    db = lancedb.connect(_LANCEDB_URI)
    tbl = db.open_table(_TABLE_NAME)
    results = (
        tbl.search(query_vector)
        .distance_type(_DISTANCE_METRIC)
        .limit(limit)
        .to_list()
    )
    # Sort by distance ascending, break ties by id ascending for determinism.
    results.sort(key=lambda r: (r["_distance"], int(r["id"])))
    return [int(r["id"]) for r in results]


def _weighted_rrf(
    keyword_ids: list[int],
    vector_ids: list[int],
    k: int,
    keyword_weight: float,
    rrf_k: int,
) -> list[dict]:
    """
    Fuse two ranked lists with weighted RRF.

    fused_score(d) =
        keyword_weight       * (1 / (rrf_k + bm25_rank(d)))   [if in keyword list]
      + (1 - keyword_weight) * (1 / (rrf_k + vector_rank(d))) [if in vector list]

    Absent-store contribution is 0.

    Returns list[dict] with keys 'id' (int) and 'score' (float), sorted by
    score descending then id ascending, length min(k, n_candidates).
    """
    # 1-based ranks
    bm25_rank: dict[int, int] = {doc_id: rank + 1 for rank, doc_id in enumerate(keyword_ids)}
    vector_rank: dict[int, int] = {doc_id: rank + 1 for rank, doc_id in enumerate(vector_ids)}

    all_ids = set(keyword_ids) | set(vector_ids)

    scored: list[tuple[float, int]] = []
    for doc_id in all_ids:
        score = 0.0
        if doc_id in bm25_rank:
            score += keyword_weight * (1.0 / (rrf_k + bm25_rank[doc_id]))
        if doc_id in vector_rank:
            score += (1.0 - keyword_weight) * (1.0 / (rrf_k + vector_rank[doc_id]))
        scored.append((score, doc_id))

    # Descending score, then ascending id for full determinism
    scored.sort(key=lambda x: (-x[0], x[1]))

    top = scored[:k]
    return [{"id": doc_id, "score": score} for score, doc_id in top]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def search(
    query: str,
    query_vector: list[float],
    k: int,
    keyword_weight: float,
    title_weight: float = 1.0,
    body_weight: float = 1.0,
) -> list[dict]:
    """
    Hybrid search over the dual-store corpus.

    Parameters
    ----------
    query : str
        Keyword query issued to the SQLite FTS5 store via MATCH.
    query_vector : list[float]
        Semantic query embedding issued to LanceDB.
    k : int
        Number of fused results to return.
    keyword_weight : float
        Blend factor in [0, 1].  1.0 = pure keyword; 0.0 = pure vector.
    title_weight : float
        Per-column BM25 weight for the *title* column (default 1.0).
    body_weight : float
        Per-column BM25 weight for the *body* column (default 1.0).

    Returns
    -------
    list[dict]
        Each element has keys ``id`` (int) and ``score`` (float), ordered
        best-first, with length ``min(k, number_of_candidates)``.
    """
    pool = max(_CANDIDATE_POOL, k)

    keyword_ids = _keyword_candidates(query, title_weight, body_weight, limit=pool)
    vector_ids = _vector_candidates(query_vector, limit=pool)

    return _weighted_rrf(keyword_ids, vector_ids, k, keyword_weight, _RRF_K)
