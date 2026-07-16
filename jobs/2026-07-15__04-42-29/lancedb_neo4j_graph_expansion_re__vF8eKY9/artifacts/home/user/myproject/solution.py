"""
Graph-Augmented Retrieval: LanceDB Vector Seeds + Neo4j Multi-Hop Expansion.

Implements graph_expansion_search(query_vector, num_seeds, max_hops, top_k)
which fuses cosine vector similarity with graph proximity for ranked retrieval.
"""

from __future__ import annotations

import math
from collections import deque
from typing import Sequence

import lancedb
import numpy as np
from neo4j import GraphDatabase

# ---------------------------------------------------------------------------
# Configuration constants
# ---------------------------------------------------------------------------

LANCEDB_URI = "/app/lancedb"
NEO4J_URI = "bolt://localhost:7687"

DECAY = 0.5   # graph_proximity(n) = DECAY ** hop_distance(n)
ALPHA = 0.6   # fused_score = ALPHA * vector_similarity + (1-ALPHA) * graph_proximity


# ---------------------------------------------------------------------------
# Helper: cosine similarity
# ---------------------------------------------------------------------------

def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Return the cosine similarity between two 1-D float vectors.

    Returns 0.0 when either vector is the zero vector to avoid division by zero.
    """
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def graph_expansion_search(
    query_vector: Sequence[float],
    num_seeds: int,
    max_hops: int,
    top_k: int,
) -> list[dict]:
    """Fused vector + graph-proximity retrieval.

    Parameters
    ----------
    query_vector:
        A length-32 sequence of floats representing the query embedding.
    num_seeds:
        Number of top vector-search results to use as graph traversal seeds.
    max_hops:
        Maximum directed-hop distance from any seed to include in results.
        Seeds themselves are at hop distance 0.
    top_k:
        Number of results to return, ordered by fused_score descending
        (ties broken by id ascending).

    Returns
    -------
    list[dict]
        Each element has keys: id (int), name (str), vector_similarity (float),
        hop_distance (int), graph_proximity (float), fused_score (float).
    """
    query_vec = np.array(query_vector, dtype=np.float32)

    # ------------------------------------------------------------------
    # Stage 1: vector search in LanceDB to obtain seed entity ids
    # ------------------------------------------------------------------
    db = lancedb.connect(LANCEDB_URI)
    table = db.open_table("nodes")

    # Fetch all rows so we can compute exact cosine similarity ourselves
    # (avoids any ambiguity about the distance metric used internally).
    all_rows = table.to_pandas()  # columns: id, name, vector

    # Compute cosine similarity for every node – we need this for scoring anyway
    all_ids = all_rows["id"].tolist()
    all_names = all_rows["name"].tolist()
    all_vectors = np.array(all_rows["vector"].tolist(), dtype=np.float32)

    cos_sims: dict[int, float] = {}
    stored_vecs: dict[int, np.ndarray] = {}
    for idx, node_id in enumerate(all_ids):
        vec = all_vectors[idx]
        cos_sims[node_id] = _cosine_similarity(query_vec, vec)
        stored_vecs[node_id] = vec

    id_to_name: dict[int, str] = {nid: nm for nid, nm in zip(all_ids, all_names)}

    # Select seeds = num_seeds nodes with highest cosine similarity
    # Tie-break by id ascending (stable, deterministic)
    ranked_by_sim = sorted(
        all_ids,
        key=lambda nid: (-cos_sims[nid], nid),
    )
    seed_ids: list[int] = ranked_by_sim[:num_seeds]

    # ------------------------------------------------------------------
    # Stage 2: BFS expansion in Neo4j from seeds along RELATED_TO edges
    # ------------------------------------------------------------------
    driver = GraphDatabase.driver(NEO4J_URI, auth=None)
    try:
        hop_distances: dict[int, int] = {}

        # Seeds are at hop distance 0
        for sid in seed_ids:
            hop_distances[sid] = 0

        if max_hops > 0:
            # BFS layer by layer using Cypher for each frontier
            frontier: set[int] = set(seed_ids)
            visited: set[int] = set(seed_ids)

            for hop in range(1, max_hops + 1):
                if not frontier:
                    break

                # Find all direct successors of the current frontier that
                # haven't been visited yet
                with driver.session() as session:
                    result = session.run(
                        """
                        UNWIND $frontier AS src_id
                        MATCH (:Entity {id: src_id})-[:RELATED_TO]->(nb:Entity)
                        WHERE NOT nb.id IN $visited
                        RETURN DISTINCT nb.id AS id
                        """,
                        frontier=list(frontier),
                        visited=list(visited),
                    )
                    next_frontier: set[int] = {record["id"] for record in result}

                for nid in next_frontier:
                    hop_distances[nid] = hop
                    visited.add(nid)

                frontier = next_frontier
    finally:
        driver.close()

    # ------------------------------------------------------------------
    # Stage 3: fuse scores and rank
    # ------------------------------------------------------------------
    candidates: list[dict] = []
    for node_id, hop_dist in hop_distances.items():
        vec_sim = cos_sims.get(node_id)
        if vec_sim is None:
            # Fallback: node exists in graph but not LanceDB (shouldn't happen
            # given the problem spec, but guard defensively)
            vec_sim = 0.0

        graph_prox = DECAY ** hop_dist
        fused = ALPHA * vec_sim + (1 - ALPHA) * graph_prox

        candidates.append(
            {
                "id": int(node_id),
                "name": id_to_name.get(node_id, ""),
                "vector_similarity": float(vec_sim),
                "hop_distance": int(hop_dist),
                "graph_proximity": float(graph_prox),
                "fused_score": float(fused),
            }
        )

    # Sort: fused_score descending, then id ascending (deterministic tie-break)
    candidates.sort(key=lambda x: (-x["fused_score"], x["id"]))

    return candidates[:top_k]
