"""Dual-store hybrid search: SQLite FTS5 BM25 + LanceDB vectors fused with weighted RRF."""

import json
import os
import sqlite3

import lancedb

# Cache the config so we read it once per process.
_CONFIG_CACHE = None
_CONFIG_PATH = "/app/data/config.json"


def _load_config():
    global _CONFIG_CACHE
    if _CONFIG_CACHE is None:
        with open(_CONFIG_PATH, "r") as f:
            _CONFIG_CACHE = json.load(f)
    return _CONFIG_CACHE


def _keyword_candidates(config, query, title_weight, body_weight, limit=50):
    """Return list of document ids (1-based rank implied by order) from the FTS5 store."""
    table = config["table_name"]
    sqlite_path = config["sqlite_path"]
    con = sqlite3.connect(sqlite_path)
    try:
        sql = (
            f"SELECT rowid FROM {table} WHERE {table} MATCH ? "
            f"ORDER BY bm25({table}, {float(title_weight)}, {float(body_weight)}), rowid "
            f"LIMIT {int(limit)}"
        )
        rows = con.execute(sql, (query,)).fetchall()
    finally:
        con.close()
    return [int(r[0]) for r in rows]


def _vector_candidates(config, query_vector, limit=50):
    """Return list of document ids (1-based rank implied by order) from the LanceDB store."""
    table = config["table_name"]
    db = lancedb.connect(config["lancedb_uri"])
    tbl = db.open_table(table)
    res = (
        tbl.search(query_vector)
        .distance_type(config["distance_metric"])
        .limit(int(limit))
        .to_list()
    )
    # Honor ascending distance; break ties by id ascending for determinism.
    res.sort(key=lambda r: (r["_distance"], int(r["id"])))
    return [int(r["id"]) for r in res]


def _weighted_rrf(bm25_ids, vector_ids, k, keyword_weight, rrf_k):
    """Fuse two ranked lists with weighted Reciprocal Rank Fusion."""
    bm25_rank = {d: i + 1 for i, d in enumerate(bm25_ids)}
    vector_rank = {d: i + 1 for i, d in enumerate(vector_ids)}

    all_ids = set(bm25_ids) | set(vector_ids)
    scored = []
    for d in all_ids:
        score = 0.0
        if d in bm25_rank:
            score += keyword_weight * (1.0 / (rrf_k + bm25_rank[d]))
        if d in vector_rank:
            score += (1.0 - keyword_weight) * (1.0 / (rrf_k + vector_rank[d]))
        scored.append((d, score))

    # Rank by fused_score descending, tie-break by id ascending.
    scored.sort(key=lambda x: (-x[1], x[0]))

    return [{"id": d, "score": float(s)} for d, s in scored[:k]]


def search(query, query_vector, k, keyword_weight, title_weight=1.0, body_weight=1.0):
    """Run hybrid search and return top-k fused results.

    Parameters
    ----------
    query : str
        Keyword query issued to the SQLite FTS5 store via MATCH.
    query_vector : list[float]
        Semantic query embedding issued to LanceDB.
    k : int
        Number of fused results to return.
    keyword_weight : float in [0, 1]
        Blend factor between keyword (BM25) and vector stores.
    title_weight, body_weight : float
        Per-column BM25 weights passed to the FTS5 bm25() function.
    """
    config = _load_config()
    rrf_k = config["rrf_k"]

    bm25_ids = _keyword_candidates(config, query, title_weight, body_weight, limit=50)
    vector_ids = _vector_candidates(config, query_vector, limit=50)

    results = _weighted_rrf(bm25_ids, vector_ids, k, keyword_weight, rrf_k)
    return results