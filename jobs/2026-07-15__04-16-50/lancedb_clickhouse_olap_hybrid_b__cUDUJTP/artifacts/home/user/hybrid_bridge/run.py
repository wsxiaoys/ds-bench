#!/usr/bin/env python3
import argparse
import json
import hashlib
import re
import numpy as np
import lancedb
import clickhouse_connect

def embed_query(text):
    # 1. Lowercase the text and extract tokens with the regex [a-z0-9]+.
    tokens = re.findall(r'[a-z0-9]+', text.lower())
    # 2. Start from a 32-dimensional zero vector.
    vector = np.zeros(32, dtype=np.float32)
    # 3. For each token, compute idx = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16) % 32 and add 1.0 to vector[idx].
    for token in tokens:
        idx = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16) % 32
        vector[idx] += 1.0
    # 4. L2-normalize the vector (leave it all-zeros if the norm is 0).
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
    # 5. The vector dtype MUST be float32.
    return vector

def main():
    parser = argparse.ArgumentParser(description="Two-Tier Retrieval + OLAP Bridge (LanceDB + ClickHouse)")
    parser.path = "/home/user/hybrid_bridge/run.py"
    parser.add_argument("--query-file", required=True, help="Path to JSON query file")
    parser.add_argument("--output", required=True, help="Path to write JSON result file")
    args = parser.parse_args()

    # Read query file
    with open(args.query_file, 'r', encoding='utf-8') as f:
        query_data = json.load(f)

    query_text = query_data["text"]
    window_start = query_data["window_start"]
    window_end = query_data["window_end"]
    top = query_data["top"]

    # 1. Recall (LanceDB FTS)
    db = lancedb.connect('/home/user/hybrid_bridge/data/lancedb')
    tbl = db.open_table('documents')

    # Retrieve all matches with a large limit
    fts_results = tbl.search(query_text).limit(1000).to_list()
    candidate_ids = list(set(int(r['id']) for r in fts_results))

    if not candidate_ids:
        # Write empty result
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump([], f)
        return

    # 2. Vector distance (LanceDB)
    query_vector = embed_query(query_text)
    candidate_ids_str = ",".join(map(str, candidate_ids))

    # Perform vector search on candidate IDs to get _distance
    dist_results = tbl.search(query_vector).where(f"id IN ({candidate_ids_str})").limit(len(candidate_ids)).to_list()
    id_to_distance = {int(r['id']): float(r['_distance']) for r in dist_results}

    # 3. Enrichment (ClickHouse)
    client = clickhouse_connect.get_client(host='localhost', port=8123, username='default', password='')

    ch_query = f"""
    WITH main_metrics AS (
        SELECT
            e.doc_id,
            count() as events_in_window,
            sumIf(e.value, u.tier = 'premium') as premium_value_sum,
            quantileExact(0.95)(e.value) as p95_value
        FROM events e
        LEFT JOIN users u ON e.user_id = u.user_id
        WHERE e.doc_id IN ({candidate_ids_str}) AND e.ts >= '{window_start}' AND e.ts < '{window_end}'
        GROUP BY e.doc_id
    ),
    hourly_counts AS (
        SELECT
            doc_id,
            toStartOfHour(ts) as hour,
            count() as hourly_count
        FROM events
        WHERE doc_id IN ({candidate_ids_str}) AND ts >= '{window_start}' AND ts < '{window_end}'
        GROUP BY doc_id, hour
    ),
    peak_hours AS (
        SELECT
            doc_id,
            max(hourly_count) as peak_hour_count
        FROM hourly_counts
        GROUP BY doc_id
    )
    SELECT
        m.doc_id,
        m.events_in_window,
        m.premium_value_sum,
        m.p95_value,
        p.peak_hour_count
    FROM main_metrics m
    LEFT JOIN peak_hours p ON m.doc_id = p.doc_id
    """

    ch_res = client.query(ch_query)
    ch_results = {}
    for row in ch_res.result_rows:
        doc_id = int(row[0])
        ch_results[doc_id] = {
            'events_in_window': int(row[1]),
            'premium_value_sum': float(row[2]),
            'p95_value': float(row[3]),
            'peak_hour_count': int(row[4])
        }

    # 4. Fusion & ordering
    fused_results = []
    for doc_id in candidate_ids:
        # Get distance
        vector_distance = id_to_distance.get(doc_id, 0.0)

        # Get ClickHouse metrics
        metrics = ch_results.get(doc_id, {
            'events_in_window': 0,
            'premium_value_sum': 0.0,
            'p95_value': 0.0,
            'peak_hour_count': 0
        })

        premium_value_sum = metrics['premium_value_sum']
        score = round(premium_value_sum / (1.0 + vector_distance), 6)

        fused_results.append({
            "doc_id": doc_id,
            "events_in_window": metrics['events_in_window'],
            "premium_value_sum": premium_value_sum,
            "p95_value": metrics['p95_value'],
            "peak_hour_count": metrics['peak_hour_count'],
            "vector_distance": vector_distance,
            "score": score
        })

    # Sort: score descending, doc_id ascending
    sorted_results = sorted(fused_results, key=lambda x: (-x['score'], x['doc_id']))

    # Keep top
    top_results = sorted_results[:top]

    # Write output
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(top_results, f, indent=2)

if __name__ == "__main__":
    main()
