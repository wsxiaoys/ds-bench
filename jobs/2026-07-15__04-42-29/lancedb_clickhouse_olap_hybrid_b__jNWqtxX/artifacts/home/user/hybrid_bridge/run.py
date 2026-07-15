"""
Two-Tier Retrieval + OLAP Bridge (LanceDB + ClickHouse)

Pipeline:
  1. Recall candidates via LanceDB FTS on `text`.
  2. Compute per-candidate vector distance (L2) via LanceDB ANN.
  3. Enrich candidates via a single batched ClickHouse query.
  4. Fuse: score = premium_value_sum / (1 + vector_distance), top-N by score desc, doc_id asc.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np
import lancedb
import clickhouse_connect


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------

def embed_text(text: str) -> np.ndarray:
    """
    Deterministic 32-dim bag-of-words embedding (MD5 hash routing, L2-normalised).
    dtype is float32 to match stored vectors.
    """
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    vec = np.zeros(32, dtype=np.float32)
    for token in tokens:
        idx = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16) % 32
        vec[idx] += 1.0
    norm = float(np.linalg.norm(vec))
    if norm > 0.0:
        vec = vec / norm
    return vec


# ---------------------------------------------------------------------------
# Step 1 & 2 — LanceDB recall + vector distances
# ---------------------------------------------------------------------------

LANCEDB_PATH = "/home/user/hybrid_bridge/data/lancedb"
LANCEDB_TABLE = "documents"
# Use a generous limit so we get all FTS matches (table has 400 rows).
FTS_RECALL_LIMIT = 10_000


def recall_and_distances(query_text: str) -> dict[int, float]:
    """
    Returns {doc_id: vector_distance} for every document that matches the FTS query.
    """
    db = lancedb.connect(LANCEDB_PATH)
    tbl = db.open_table(LANCEDB_TABLE)

    # --- Step 1: FTS recall (get candidate id set) ---
    fts_rows = (
        tbl.search(query_text, query_type="fts")
        .limit(FTS_RECALL_LIMIT)
        .to_list()
    )
    if not fts_rows:
        return {}

    candidate_ids: list[int] = [int(r["id"]) for r in fts_rows]

    # --- Step 2: vector distance for every candidate ---
    query_vec = embed_text(query_text)

    # Build a WHERE filter accepted by LanceDB (string expression).
    # For a single candidate we still need a valid IN clause.
    if len(candidate_ids) == 1:
        id_filter = f"id = {candidate_ids[0]}"
    else:
        id_filter = f"id IN {tuple(candidate_ids)}"

    vec_rows = (
        tbl.search(query_vec, vector_column_name="vector")
        .where(id_filter, prefilter=True)
        .limit(len(candidate_ids))
        .to_list()
    )

    # Build map: doc_id -> _distance
    distances: dict[int, float] = {}
    for r in vec_rows:
        doc_id = int(r["id"])
        distances[doc_id] = float(r["_distance"])

    # Any candidate that somehow missed the ANN scan (edge-case: all-zero vector)
    # gets assigned distance 0.0 so it is not silently dropped.
    for cid in candidate_ids:
        if cid not in distances:
            distances[cid] = 0.0

    return distances


# ---------------------------------------------------------------------------
# Step 3 — ClickHouse enrichment
# ---------------------------------------------------------------------------

CLICKHOUSE_HOST = "localhost"
CLICKHOUSE_PORT = 8123
CLICKHOUSE_USER = "default"
CLICKHOUSE_PASSWORD = ""
CLICKHOUSE_DB = "default"


def enrich(
    candidate_ids: list[int],
    window_start: str,
    window_end: str,
) -> dict[int, dict]:
    """
    Single batched ClickHouse lookup for the candidate doc_ids.
    Returns {doc_id: {events_in_window, premium_value_sum, p95_value, peak_hour_count}}.
    Missing documents (no events in window) are NOT included; the caller back-fills them.
    """
    if not candidate_ids:
        return {}

    client = clickhouse_connect.get_client(
        host=CLICKHOUSE_HOST,
        port=CLICKHOUSE_PORT,
        username=CLICKHOUSE_USER,
        password=CLICKHOUSE_PASSWORD,
        database=CLICKHOUSE_DB,
    )

    # Pass ids as native Python ints to avoid numpy-scalar / string mismatch.
    ids_literal = ", ".join(str(int(i)) for i in candidate_ids)

    query = f"""
SELECT
    base.doc_id                 AS doc_id,
    base.events_in_window       AS events_in_window,
    base.premium_value_sum      AS premium_value_sum,
    base.p95_value              AS p95_value,
    ph.peak_hour_count          AS peak_hour_count
FROM (
    -- per-document aggregates (requires JOIN with users for tier)
    SELECT
        e.doc_id                                    AS doc_id,
        count()                                     AS events_in_window,
        sumIf(e.value, u.tier = 'premium')          AS premium_value_sum,
        quantileExact(0.95)(e.value)                AS p95_value
    FROM events AS e
    JOIN users AS u ON e.user_id = u.user_id
    WHERE e.doc_id IN ({ids_literal})
      AND e.ts >= '{window_start}'
      AND e.ts  < '{window_end}'
    GROUP BY e.doc_id
) AS base
JOIN (
    -- peak hourly event count (no tier constraint per spec)
    SELECT
        doc_id,
        max(hour_count) AS peak_hour_count
    FROM (
        SELECT
            doc_id,
            toStartOfHour(ts) AS h,
            count()           AS hour_count
        FROM events
        WHERE doc_id IN ({ids_literal})
          AND ts >= '{window_start}'
          AND ts  < '{window_end}'
        GROUP BY doc_id, h
    )
    GROUP BY doc_id
) AS ph ON base.doc_id = ph.doc_id
"""

    result = client.query(query)
    col_names = result.column_names  # ('doc_id', 'events_in_window', ...)

    enriched: dict[int, dict] = {}
    for row in result.result_rows:
        row_dict = dict(zip(col_names, row))
        doc_id = int(row_dict["doc_id"])
        enriched[doc_id] = {
            "events_in_window": int(row_dict["events_in_window"]),
            "premium_value_sum": float(row_dict["premium_value_sum"]),
            "p95_value": float(row_dict["p95_value"]),
            "peak_hour_count": int(row_dict["peak_hour_count"]),
        }

    return enriched


# ---------------------------------------------------------------------------
# Step 4 — Fusion & ordering
# ---------------------------------------------------------------------------

def fuse(
    distances: dict[int, float],
    enrichment: dict[int, dict],
    top: int,
) -> list[dict]:
    """
    Merges distance and enrichment data, computes scores, returns top-N rows.
    score = premium_value_sum / (1 + vector_distance)  rounded to 6 d.p.
    Ordering: score desc, doc_id asc.
    """
    zero_enrich = {
        "events_in_window": 0,
        "premium_value_sum": 0.0,
        "p95_value": 0.0,
        "peak_hour_count": 0,
    }

    rows = []
    for doc_id, dist in distances.items():
        enc = enrichment.get(doc_id, zero_enrich)
        score = round(
            enc["premium_value_sum"] / (1.0 + dist),
            6,
        )
        rows.append(
            {
                "doc_id": int(doc_id),
                "events_in_window": int(enc["events_in_window"]),
                "premium_value_sum": float(enc["premium_value_sum"]),
                "p95_value": float(enc["p95_value"]),
                "peak_hour_count": int(enc["peak_hour_count"]),
                "vector_distance": float(dist),
                "score": float(score),
            }
        )

    # Sort: score descending, doc_id ascending
    rows.sort(key=lambda r: (-r["score"], r["doc_id"]))
    return rows[:top]


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Two-tier LanceDB + ClickHouse retrieval pipeline."
    )
    parser.add_argument(
        "--query-file",
        required=True,
        type=Path,
        help="Path to JSON query file.",
    )
    parser.add_argument(
        "--output",
        required=True,
        type=Path,
        help="Path for JSON output file.",
    )
    args = parser.parse_args()

    # --- Load query ---
    with open(args.query_file) as fh:
        query = json.load(fh)

    query_text: str = query["text"]
    window_start: str = query["window_start"]
    window_end: str = query["window_end"]
    top: int = int(query["top"])

    # --- Step 1 & 2: recall + vector distances ---
    print(f"[1/4] FTS recall + vector distance for: {query_text!r}", file=sys.stderr)
    distances = recall_and_distances(query_text)
    print(f"      Candidates found: {len(distances)}", file=sys.stderr)

    if not distances:
        print("      No candidates — writing empty result.", file=sys.stderr)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with open(args.output, "w") as fh:
            json.dump([], fh, indent=2)
        return

    candidate_ids = list(distances.keys())

    # --- Step 3: ClickHouse enrichment ---
    print(
        f"[2/4] ClickHouse enrichment for {len(candidate_ids)} docs "
        f"({window_start} → {window_end})",
        file=sys.stderr,
    )
    enrichment = enrich(candidate_ids, window_start, window_end)
    print(f"      Docs with events in window: {len(enrichment)}", file=sys.stderr)

    # --- Step 4: fusion & ranking ---
    print(f"[3/4] Fusion & ranking (top {top})", file=sys.stderr)
    result = fuse(distances, enrichment, top)

    # --- Write output ---
    print(f"[4/4] Writing {len(result)} rows to {args.output}", file=sys.stderr)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with open(args.output, "w") as fh:
        json.dump(result, fh, indent=2)

    print("Done.", file=sys.stderr)


if __name__ == "__main__":
    main()
