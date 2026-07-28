"""
Tune query-time ANN parameters (nprobes, refine_factor) against exact
ground-truth recall@10, then persist tuned_search.py + report.json.
"""

import json
import os
import time

import numpy as np
import lancedb

PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(PROJECT_DIR, "data")
DB_PATH = os.path.join(PROJECT_DIR, "lancedb")
REPORT_PATH = os.path.join(PROJECT_DIR, "report.json")

BASE_VECTORS_PATH = os.path.join(DATA_DIR, "base_vectors.npy")
QUERY_VECTORS_PATH = os.path.join(DATA_DIR, "query_vectors.npy")

NUM_PARTITIONS = 256
NUM_SUB_VECTORS = 32
K = 10
TARGET_RECALL = 0.90


def compute_ground_truth(base: np.ndarray, queries: np.ndarray, k: int) -> np.ndarray:
    """Exact top-k neighbor ids (by L2) for every query, shape (nq, k)."""
    base64 = base.astype(np.float64)
    base_sq = np.sum(base64 * base64, axis=1)  # (N,)
    gt = np.empty((queries.shape[0], k), dtype=np.int64)
    batch = 50
    for start in range(0, queries.shape[0], batch):
        end = min(start + batch, queries.shape[0])
        q = queries[start:end].astype(np.float64)
        q_sq = np.sum(q * q, axis=1)[:, None]  # (b,1)
        # squared L2 distance = |q|^2 + |b|^2 - 2 q.b
        dists = q_sq + base_sq[None, :] - 2.0 * (q @ base64.T)
        idx = np.argpartition(dists, k, axis=1)[:, :k]
        # sort the k candidates by actual distance
        for i in range(idx.shape[0]):
            row_idx = idx[i]
            row_dist = dists[i, row_idx]
            order = np.argsort(row_dist)
            gt[start + i] = row_idx[order]
    return gt


def recall_at_k(ann_ids: np.ndarray, gt_ids: np.ndarray, k: int) -> float:
    total = 0.0
    for a, t in zip(ann_ids, gt_ids):
        total += len(set(a[:k].tolist()) & set(t[:k].tolist())) / k
    return total / len(gt_ids)


def ann_search_all(table, queries: np.ndarray, k: int, nprobes: int, refine_factor: int):
    results = np.empty((queries.shape[0], k), dtype=np.int64)
    for i in range(queries.shape[0]):
        q = queries[i]
        builder = (
            table.search(q, vector_column_name="vector")
            .metric("l2")
            .nprobes(nprobes)
            .select(["id"])
            .limit(k)
        )
        if refine_factor and refine_factor > 1:
            builder = builder.refine_factor(refine_factor)
        res = builder.to_list()
        ids = [r["id"] for r in res]
        # pad if fewer than k (shouldn't normally happen)
        while len(ids) < k:
            ids.append(-1)
        results[i] = ids[:k]
    return results


def main():
    base = np.load(BASE_VECTORS_PATH)
    queries = np.load(QUERY_VECTORS_PATH)
    assert base.shape == (60000, 128)
    assert queries.shape == (1000, 128)

    print("Computing exact ground truth ...")
    t0 = time.time()
    gt = compute_ground_truth(base, queries, K)
    print(f"Ground truth computed in {time.time()-t0:.1f}s")

    db = lancedb.connect(DB_PATH)
    table = db.open_table("vectors")

    candidates = [
        (nprobes, refine)
        for nprobes in [20, 40, 80, 150, 256]
        for refine in [1, 3, 10]
    ]

    best = None
    for nprobes, refine in candidates:
        t0 = time.time()
        ann_ids = ann_search_all(table, queries, K, nprobes, refine)
        recall = recall_at_k(ann_ids, gt, K)
        elapsed = time.time() - t0
        print(
            f"nprobes={nprobes:4d} refine_factor={refine:3d} "
            f"recall@10={recall:.4f} ({elapsed:.1f}s)"
        )
        if recall >= TARGET_RECALL:
            best = (nprobes, refine, recall)
            break

    if best is None:
        raise RuntimeError("Failed to reach target recall with candidate grid")

    nprobes, refine_factor, recall = best
    print(f"Chosen: nprobes={nprobes}, refine_factor={refine_factor}, recall={recall:.4f}")

    report = {
        "index_type": "IVF_PQ",
        "metric": "l2",
        "num_partitions": NUM_PARTITIONS,
        "num_sub_vectors": NUM_SUB_VECTORS,
        "nprobes": int(nprobes),
        "refine_factor": int(refine_factor),
        "recall_at_10": float(recall),
        "num_base_vectors": 60000,
        "num_query_vectors": 1000,
    }

    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)

    print(f"Wrote {REPORT_PATH}")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
