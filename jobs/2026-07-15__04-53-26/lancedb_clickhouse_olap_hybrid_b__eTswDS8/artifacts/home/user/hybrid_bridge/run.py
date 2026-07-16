#!/usr/bin/env python3
"""Two-Tier Retrieval + OLAP Bridge (LanceDB + ClickHouse).

Pipeline:
    1. Recall candidate documents from LanceDB FTS (OR matching).
    2. For each candidate, compute the L2 vector distance using LanceDB.
    3. Enrich the candidates in ClickHouse with time-bucketed aggregates.
    4. Fuse the results and output the top-N scored documents.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Sequence

import numpy as np

import lancedb
import clickhouse_connect


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VECTOR_DIM = 32
LANCEDB_PATH = "/home/user/hybrid_bridge/data/lancedb"
LANCEDB_TABLE = "documents"
VECTOR_COLUMN = "vector"
TEXT_COLUMN = "text"
ID_COLUMN = "id"

CLICKHOUSE_HOST = "localhost"
CLICKHOUSE_PORT = 8123
CLICKHOUSE_USER = "default"
CLICKHOUSE_PASSWORD = ""
CLICKHOUSE_DATABASE = "default"

# Number of FTS candidates to retrieve.  The `documents` table only has
# 400 rows, so 400 is a safe upper bound for the candidate set.
FTS_RECALL_LIMIT = 400


# ---------------------------------------------------------------------------
# Query embedding (deterministic hash bag-of-words)
# ---------------------------------------------------------------------------

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def embed_query(text: str) -> np.ndarray:
    """Reproduce the document-embedding function exactly.

    1. Lowercase and extract tokens matching ``[a-z0-9]+``.
    2. Start from a 32-d zero vector.
    3. For each token, add 1.0 to position ``md5(token) % 32``.
    4. L2-normalize (keep zeros if norm == 0).
    5. Cast to ``float32``.
    """
    vec = np.zeros(VECTOR_DIM, dtype=np.float32)
    for tok in _TOKEN_RE.findall(text.lower()):
        idx = int(hashlib.md5(tok.encode("utf-8")).hexdigest(), 16) % VECTOR_DIM
        vec[idx] += 1.0
    norm = float(np.linalg.norm(vec))
    if norm > 0.0:
        vec = vec / norm
    return vec.astype(np.float32, copy=False)


# ---------------------------------------------------------------------------
# LanceDB recall + vector distance
# ---------------------------------------------------------------------------

def open_lancedb():
    db = lancedb.connect(LANCEDB_PATH)
    return db.open_table(LANCEDB_TABLE)


def fts_recall(table, query_text: str, limit: int = FTS_RECALL_LIMIT) -> List[int]:
    """Return the candidate set: every doc whose text FTS-matches ``query_text``.

    LanceDB's full-text-search uses Tantivy.  When ``query_text`` contains only
    bare terms (no boolean operators), the match is the OR of all terms, which
    is what the task requires.
    """
    rows = table.search(query_text).limit(limit).to_list()
    return [int(r[ID_COLUMN]) for r in rows]


def vector_distances(table, qvec: np.ndarray, doc_ids: Sequence[int]) -> Dict[int, float]:
    """Compute the L2 ``_distance`` that LanceDB reports for each candidate.

    LanceDB's L2 metric actually reports the squared L2 distance; the value
    stored in ``_distance`` is the exact number we must use as
    ``vector_distance`` per the task spec.
    """
    if not doc_ids:
        return {}
    # Build ``id IN (...)`` filter; pass native Python ints.
    ids_str = ",".join(str(int(i)) for i in doc_ids)
    rows = (
        table.search(qvec, vector_column_name=VECTOR_COLUMN)
        .metric("l2")
        .where(f"{ID_COLUMN} IN ({ids_str})")
        .limit(len(doc_ids))
        .to_list()
    )
    return {int(r[ID_COLUMN]): float(r["_distance"]) for r in rows}


# ---------------------------------------------------------------------------
# ClickHouse enrichment
# ---------------------------------------------------------------------------

def open_clickhouse():
    return clickhouse_connect.get_client(
        host=CLICKHOUSE_HOST,
        port=CLICKHOUSE_PORT,
        username=CLICKHOUSE_USER,
        password=CLICKHOUSE_PASSWORD,
        database=CLICKHOUSE_DATABASE,
    )


def build_in_clause(doc_ids: Sequence[int]) -> str:
    # ``doc_id`` is ``Int64``; pass native Python ints (no numpy scalars/strings).
    return ",".join(str(int(i)) for i in doc_ids)


def fetch_enrichment(
    client,
    doc_ids: Sequence[int],
    window_start: str,
    window_end: str,
) -> Dict[int, Dict[str, float]]:
    """Run a single batched ClickHouse query and return per-doc aggregates.

    Returns a dict keyed by doc_id with four numeric fields.  Docs missing
    from the query result are NOT inserted here -- the caller is responsible
    for back-filling missing candidates with zeros.
    """
    if not doc_ids:
        return {}

    ids_csv = build_in_clause(doc_ids)
    # Single batched lookup: one JOIN with users (for tier), one correlated
    # subquery to compute peak_hour_count from per-hour event buckets.
    sql = f"""
        SELECT
            e.doc_id                                            AS doc_id,
            count()                                             AS events_in_window,
            sumIf(e.value, u.tier = 'premium')                  AS premium_value_sum,
            quantileExact(0.95)(e.value)                        AS p95_value,
            (SELECT max(c) FROM (
                 SELECT count() AS c
                 FROM events e2
                 WHERE e2.doc_id = e.doc_id
                   AND e2.ts >= toDateTime(%(ws)s)
                   AND e2.ts <  toDateTime(%(we)s)
                 GROUP BY toStartOfHour(e2.ts)
             ))                                                 AS peak_hour_count
        FROM events e
        INNER JOIN users u ON e.user_id = u.user_id
        WHERE e.doc_id IN ({ids_csv})
          AND e.ts >= toDateTime(%(ws)s)
          AND e.ts <  toDateTime(%(we)s)
        GROUP BY e.doc_id
    """

    result = client.query(
        sql,
        parameters={"ws": window_start, "we": window_end},
    )

    out: Dict[int, Dict[str, float]] = {}
    for row in result.result_rows:
        doc_id = int(row[0])
        out[doc_id] = {
            "events_in_window": int(row[1]),
            "premium_value_sum": float(row[2]) if row[2] is not None else 0.0,
            "p95_value": float(row[3]) if row[3] is not None else 0.0,
            "peak_hour_count": int(row[4]) if row[4] is not None else 0,
        }
    return out


# ---------------------------------------------------------------------------
# Fusion
# ---------------------------------------------------------------------------

def fuse_and_rank(
    candidate_ids: Sequence[int],
    distances: Dict[int, float],
    enrichment: Dict[int, Dict[str, float]],
    top: int,
) -> List[Dict[str, Any]]:
    """Compute the final score and return the ordered top-N rows."""
    rows: List[Dict[str, Any]] = []
    for doc_id in candidate_ids:
        # Back-fill candidates with no events / no aggregation row.
        agg = enrichment.get(
            doc_id,
            {
                "events_in_window": 0,
                "premium_value_sum": 0.0,
                "p95_value": 0.0,
                "peak_hour_count": 0,
            },
        )
        distance = float(distances.get(doc_id, 0.0))
        premium = float(agg["premium_value_sum"])
        score = round(premium / (1.0 + distance), 6)
        rows.append(
            {
                "doc_id": int(doc_id),
                "events_in_window": int(agg["events_in_window"]),
                "premium_value_sum": float(agg["premium_value_sum"]),
                "p95_value": float(agg["p95_value"]),
                "peak_hour_count": int(agg["peak_hour_count"]),
                "vector_distance": float(distance),
                "score": float(score),
            }
        )

    # Order: score DESC, then doc_id ASC (stable tie-break).
    rows.sort(key=lambda r: (-r["score"], r["doc_id"]))
    return rows[: max(0, int(top))]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Two-tier retrieval (LanceDB) + OLAP bridge (ClickHouse)."
    )
    p.add_argument("--query-file", required=True, help="Path to the JSON query file.")
    p.add_argument("--output", required=True, help="Path to write the JSON result.")
    return p.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)

    query_path = Path(args.query_file)
    output_path = Path(args.output)

    with query_path.open("r", encoding="utf-8") as f:
        query = json.load(f)

    text = str(query["text"])
    window_start = str(query["window_start"])
    window_end = str(query["window_end"])
    top = int(query["top"])

    # ---- 1. Embed the query identically to the documents. ---------------
    qvec = embed_query(text)

    # ---- 2. LanceDB FTS recall. ----------------------------------------
    table = open_lancedb()
    candidate_ids = fts_recall(table, text)
    # The candidate set is a *set* of ids.
    candidate_ids = sorted(set(candidate_ids))

    # ---- 3. Vector distances for every candidate. -----------------------
    distances = vector_distances(table, qvec, candidate_ids)

    # ---- 4. ClickHouse enrichment. --------------------------------------
    ch_client = open_clickhouse()
    enrichment = fetch_enrichment(ch_client, candidate_ids, window_start, window_end)

    # ---- 5. Fuse & order. ----------------------------------------------
    ranked = fuse_and_rank(candidate_ids, distances, enrichment, top)

    # ---- 6. Write the JSON array. --------------------------------------
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(ranked, f, ensure_ascii=False, indent=2)
        f.write("\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())