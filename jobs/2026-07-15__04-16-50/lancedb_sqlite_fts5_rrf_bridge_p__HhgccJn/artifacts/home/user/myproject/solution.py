import os
import json
import sqlite3
import re
import lancedb

def search(query, query_vector, k, keyword_weight, title_weight=1.0, body_weight=1.0):
    """
    Hybrid search combining SQLite FTS5 BM25 and LanceDB vector search.
    
    Parameters:
    - query (str): the keyword query issued to the SQLite FTS5 store via MATCH.
    - query_vector (list[float]): the semantic query embedding issued to LanceDB.
    - k (int): number of fused results to return.
    - keyword_weight (float in [0, 1]): blend factor between the keyword store and the vector store.
    - title_weight (float): per-column BM25 weight for title.
    - body_weight (float): per-column BM25 weight for body.
    
    Returns:
    - list[dict]: top k fused results, each dict having exactly 'id' and 'score' keys.
    """
    config_path = "/app/data/config.json"
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Config file not found at {config_path}")
        
    with open(config_path, "r") as f:
        config = json.load(f)
        
    sqlite_path = config["sqlite_path"]
    lancedb_uri = config["lancedb_uri"]
    table_name = config["table_name"]
    distance_metric = config["distance_metric"]
    rrf_k = config["rrf_k"]
    
    # Pull a generous candidate pool of at least 50 ranked candidates from each store.
    candidate_limit = 100
    
    # 1. Retrieve keyword candidates from SQLite FTS5
    bm25_ids = []
    if query and query.strip():
        try:
            conn = sqlite3.connect(sqlite_path)
            try:
                # ORDER BY bm25(...) returns more-negative values first, which is correct (most relevant).
                # We also order by rowid as a tie-breaker for deterministic candidate selection.
                sql = (
                    f"SELECT rowid FROM {table_name} WHERE {table_name} MATCH ? "
                    f"ORDER BY bm25({table_name}, {float(title_weight)}, {float(body_weight)}), rowid LIMIT {candidate_limit}"
                )
                cursor = conn.execute(sql, (query,))
                bm25_ids = [int(row[0]) for row in cursor.fetchall()]
            finally:
                conn.close()
        except sqlite3.OperationalError:
            # Fallback: sanitize the query to avoid FTS5 syntax errors
            sanitized = re.sub(r'[^\w\s]', ' ', query)
            sanitized = " ".join(sanitized.split())
            if sanitized:
                try:
                    conn = sqlite3.connect(sqlite_path)
                    try:
                        sql = (
                            f"SELECT rowid FROM {table_name} WHERE {table_name} MATCH ? "
                            f"ORDER BY bm25({table_name}, {float(title_weight)}, {float(body_weight)}), rowid LIMIT {candidate_limit}"
                        )
                        cursor = conn.execute(sql, (sanitized,))
                        bm25_ids = [int(row[0]) for row in cursor.fetchall()]
                    finally:
                        conn.close()
                except sqlite3.OperationalError:
                    bm25_ids = []
            else:
                bm25_ids = []
                
    # 2. Retrieve vector candidates from LanceDB
    vector_ids = []
    if query_vector is not None and len(query_vector) > 0:
        db = lancedb.connect(lancedb_uri)
        tbl = db.open_table(table_name)
        res = tbl.search(query_vector).distance_type(distance_metric).limit(candidate_limit).to_list()
        # Sort by distance ascending, then by id ascending to ensure deterministic candidate ordering
        res.sort(key=lambda r: (r["_distance"], int(r["id"])))
        vector_ids = [int(r["id"]) for r in res]
        
    # 3. Fuse using weighted Reciprocal Rank Fusion (RRF)
    # Ranks are 1-based
    bm25_ranks = {doc_id: idx + 1 for idx, doc_id in enumerate(bm25_ids)}
    vector_ranks = {doc_id: idx + 1 for idx, doc_id in enumerate(vector_ids)}
    
    all_candidates = set(bm25_ids) | set(vector_ids)
    
    fused_results = []
    for doc_id in all_candidates:
        score = 0.0
        if doc_id in bm25_ranks:
            score += keyword_weight * (1.0 / (rrf_k + bm25_ranks[doc_id]))
        if doc_id in vector_ranks:
            score += (1.0 - keyword_weight) * (1.0 / (rrf_k + vector_ranks[doc_id]))
            
        fused_results.append({
            "id": doc_id,
            "score": score
        })
        
    # Rank the fused candidates by fused_score descending, breaking ties by document id ascending
    fused_results.sort(key=lambda x: (-x["score"], x["id"]))
    
    # Return top k
    return fused_results[:k]
