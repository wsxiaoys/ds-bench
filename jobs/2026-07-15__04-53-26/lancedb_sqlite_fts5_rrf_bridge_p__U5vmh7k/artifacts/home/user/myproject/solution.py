"""Hybrid retrieval: SQLite FTS5 (BM25) + LanceDB (vectors) fused with weighted RRF."""

import json
import sqlite3

import lancedb

# Default location of the seeder-written config file.
CONFIG_PATH = "/app/data/config.json"

# Minimum candidate pool requested by the spec.
CANDIDATE_POOL = 50


def _load_config(path=None):
    """Read the JSON config that the seeder dropped on disk."""
    with open(path or CONFIG_PATH) as f:
        return json.load(f)


def _bm25_candidates(sqlite_path, table, query, title_weight, body_weight, limit):
    """Return up to `limit` rowids ordered by bm25() ascending (best first).

    The ``rowid`` secondary sort makes ordering fully deterministic even
    when two documents happen to share a BM25 score.
    """
    tw = float(title_weight)
    bw = float(body_weight)
    sql = (
        f"SELECT rowid FROM {table} WHERE {table} MATCH ? "
        f"ORDER BY bm25({table}, {tw}, {bw}), rowid "
        f"LIMIT {int(limit)}"
    )
    con = sqlite3.connect(sqlite_path)
    try:
        rows = con.execute(sql, (query,)).fetchall()
    finally:
        con.close()
    return [int(r[0]) for r in rows]


def _vector_candidates(lancedb_uri, table, query_vector, distance_metric, limit):
    """Return up to `limit` ids ordered by ascending distance (closest first).

    The store may over-fetch a handful of rows for tie-breaking; we sort
    by (distance, id) to stay deterministic and then cap to `limit`.
    """
    db = lancedb.connect(lancedb_uri)
    tbl = db.open_table(table)
    res = tbl.search(query_vector).distance_type(distance_metric).limit(limit).to_list()
    res.sort(key=lambda r: (r["_distance"], int(r["id"])))
    return [int(r["id"]) for r in res][:limit]


def search(query, query_vector, k,
           keyword_weight, title_weight=1.0, body_weight=1.0):
    """Hybrid search blending FTS5 BM25 with LanceDB vector ranking via weighted RRF.

    Args:
        query: keyword query passed to the FTS5 ``MATCH`` operator.
        query_vector: embedding used for the LanceDB nearest-neighbour search.
        k: number of fused results to return.
        keyword_weight: blend factor in ``[0, 1]``; ``1`` = pure keyword,
            ``0`` = pure vector.
        title_weight: BM25 weight for the ``title`` column.
        body_weight: BM25 weight for the ``body`` column.

    Returns:
        ``list[dict]`` of length ``min(k, number_of_candidates)`` with keys
        ``id`` (int) and ``score`` (float), ordered by fused score desc,
        ties broken by ascending id.
    """
    cfg = _load_config()
    sqlite_path = cfg["sqlite_path"]
    lancedb_uri = cfg["lancedb_uri"]
    table = cfg["table_name"]
    distance_metric = cfg["distance_metric"]
    rrf_k = float(cfg["rrf_k"])

    kw_w = float(keyword_weight)
    vec_w = 1.0 - kw_w

    # Pull the candidate pools (no fewer than the spec allows).
    bm25_ids = _bm25_candidates(
        sqlite_path, table, query, title_weight, body_weight, CANDIDATE_POOL
    )
    vec_ids = _vector_candidates(
        lancedb_uri, table, query_vector, distance_metric, CANDIDATE_POOL
    )

    # 1-based ranks within each store's candidate list.
    bm25_rank = {doc_id: i + 1 for i, doc_id in enumerate(bm25_ids)}
    vec_rank = {doc_id: i + 1 for i, doc_id in enumerate(vec_ids)}

    # Weighted RRF: missing-on-one-side contributes 0 for that term.
    fused = {}
    for doc_id in set(bm25_ids) | set(vec_ids):
        score = 0.0
        if doc_id in bm25_rank:
            score += kw_w * (1.0 / (rrf_k + bm25_rank[doc_id]))
        if doc_id in vec_rank:
            score += vec_w * (1.0 / (rrf_k + vec_rank[doc_id]))
        fused[doc_id] = score

    # Sort by fused score desc, then id asc for determinism.
    ranked = sorted(fused.items(), key=lambda kv: (-kv[1], kv[0]))

    return [{"id": int(doc_id), "score": float(score)}
            for doc_id, score in ranked[:k]]