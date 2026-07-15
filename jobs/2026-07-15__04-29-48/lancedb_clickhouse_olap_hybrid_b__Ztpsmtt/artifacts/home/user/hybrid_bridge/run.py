#!/usr/bin/env python3
"""
Two-Tier Retrieval + OLAP Bridge (LanceDB + ClickHouse)

Reads a JSON query file, executes a two-tier pipeline:
  1. Recall candidate documents from LanceDB via full-text-search.
  2. Compute L2 vector distances for those candidates.
  3. Enrich candidates with behavioral aggregations from ClickHouse.
  4. Fuse into a single ordered result set.

Writes a JSON array to the --output path.
"""

import argparse
import hashlib
import json
import re
import sys

import numpy as np
import lancedb
import clickhouse_connect

LANCEDB_PATH = "/home/user/hybrid_bridge/data/lancedb"
CH_HOST = "localhost"
CH_PORT = 8123
CH_USERNAME = "default"
CH_PASSWORD = ""
VECTOR_DIM = 32


# ---------------------------------------------------------------------------
# Deterministic query embedding (must match the document embedding exactly)
# ---------------------------------------------------------------------------

def embed_query(text: str) -> list:
    """Embed query text using the fixed hashing bag-of-words scheme.

    1. Lowercase and extract tokens with [a-z0-9]+.
    2. Start from a 32-dim zero vector (float32).
    3. For each token, idx = md5(token) % 32, add 1.0 to vector[idx].
    4. L2-normalize (leave all-zeros if norm is 0).
    """
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    vec = np.zeros(VECTOR_DIM, dtype=np.float32)
    for token in tokens:
        idx = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16) % VECTOR_DIM
        vec[idx] += 1.0
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    # Return a plain Python list of float32 values
    return vec.astype(np.float32).tolist()


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def run_pipeline(query: dict) -> list:
    text = query["text"]
    window_start = query["window_start"]
    window_end = query["window_end"]
    top = query["top"]

    # ---- 1. Recall (LanceDB FTS) ----------------------------------------
    db = lancedb.connect(LANCEDB_PATH)
    tbl = db.open_table("documents")

    candidate_ids = set()
    if text and text.strip():
        total_rows = tbl.count_rows()
        fts_results = (
            tbl.search(text, query_type="fts")
            .limit(total_rows)
            .to_list()
        )
        candidate_ids = {int(r["id"]) for r in fts_results}

    if not candidate_ids:
        return []

    # ---- 2. Vector distance (LanceDB) -----------------------------------
    qvec = embed_query(text)
    cand_list = sorted(candidate_ids)  # native Python ints

    # Build a SQL WHERE clause for the IN filter.
    if len(cand_list) == 1:
        where_clause = f"id = {cand_list[0]}"
    else:
        where_clause = f"id IN {tuple(cand_list)}"

    vres = (
        tbl.search(qvec, query_type="vector")
        .where(where_clause, prefilter=True)
        .limit(len(cand_list))
        .to_list()
    )
    vector_distances = {int(r["id"]): float(r["_distance"]) for r in vres}

    # ---- 3. Enrichment (ClickHouse) ------------------------------------
    client = clickhouse_connect.get_client(
        host=CH_HOST,
        port=CH_PORT,
        username=CH_USERNAME,
        password=CH_PASSWORD,
    )

    enrichment_sql = """
    SELECT
      base.doc_id                         AS doc_id,
      base.events_in_window               AS events_in_window,
      base.premium_value_sum              AS premium_value_sum,
      base.p95_value                      AS p95_value,
      coalesce(hc.peak_hour_count, 0)     AS peak_hour_count
    FROM (
      SELECT
        e.doc_id                            AS doc_id,
        count()                             AS events_in_window,
        sumIf(e.value, u.tier = 'premium')  AS premium_value_sum,
        quantileExact(0.95)(e.value)        AS p95_value
      FROM events AS e
      LEFT JOIN users AS u ON e.user_id = u.user_id
      WHERE e.doc_id IN {ids:Array(Int64)}
        AND e.ts >= {start:DateTime}
        AND e.ts <  {end:DateTime}
      GROUP BY e.doc_id
    ) AS base
    LEFT JOIN (
      SELECT doc_id, max(cnt) AS peak_hour_count
      FROM (
        SELECT doc_id,
               toStartOfHour(ts) AS hour_bucket,
               count()           AS cnt
        FROM events
        WHERE doc_id IN {ids:Array(Int64)}
          AND ts >= {start:DateTime}
          AND ts <  {end:DateTime}
        GROUP BY doc_id, hour_bucket
      )
      GROUP BY doc_id
    ) AS hc ON base.doc_id = hc.doc_id
    """

    result = client.query(
        enrichment_sql,
        parameters={
            "ids": cand_list,
            "start": window_start,
            "end": window_end,
        },
    )

    columns = result.column_names
    enrichment = {}
    for row in result.result_rows:
        d = dict(zip(columns, row))
        enrichment[int(d["doc_id"])] = d

    # ---- 4. Fusion & ordering -------------------------------------------
    output = []
    for doc_id in candidate_ids:
        vd = vector_distances.get(doc_id, 0.0)
        enr = enrichment.get(doc_id, {})

        events_in_window = int(enr.get("events_in_window", 0))
        premium_value_sum = float(enr.get("premium_value_sum", 0.0))
        p95_value = float(enr.get("p95_value", 0.0))
        peak_hour_count = int(enr.get("peak_hour_count", 0))

        score = round(premium_value_sum / (1.0 + vd), 6)

        output.append(
            {
                "doc_id": int(doc_id),
                "events_in_window": events_in_window,
                "premium_value_sum": premium_value_sum,
                "p95_value": p95_value,
                "peak_hour_count": peak_hour_count,
                "vector_distance": vd,
                "score": score,
            }
        )

    # Order by score descending, then doc_id ascending.
    output.sort(key=lambda x: (-x["score"], x["doc_id"]))
    return output[:top]


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Two-tier retrieval + OLAP bridge (LanceDB + ClickHouse)"
    )
    parser.add_argument(
        "--query-file",
        required=True,
        help="Path to the JSON query file.",
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Path to write the JSON result file.",
    )
    args = parser.parse_args()

    with open(args.query_file, "r") as f:
        query = json.load(f)

    results = run_pipeline(query)

    with open(args.output, "w") as f:
        json.dump(results, f, indent=2)

    print(f"Wrote {len(results)} results to {args.output}")


if __name__ == "__main__":
    main()