import lancedb
import pyarrow as pa
import numpy as np
import time
import json

# 1. Load data
print("Loading data...")
base_vectors = np.load("/home/user/recall_tuning/data/base_vectors.npy")
query_vectors = np.load("/home/user/recall_tuning/data/query_vectors.npy")

# 2. Compute exact ground truth
print("Computing exact ground truth...")
start_gt = time.time()
ground_truth = []
for q in query_vectors:
    # Compute exact L2 distance squared
    diff = base_vectors - q
    dist_sq = np.sum(diff**2, axis=1)
    # Get top 10 nearest indices using argpartition
    idx = np.argpartition(dist_sq, 10)[:10]
    # Sort them to get the exact top 10 nearest
    idx = idx[np.argsort(dist_sq[idx])]
    ground_truth.append(list(idx))
print(f"Exact ground truth computed in {time.time() - start_gt:.2f} seconds.")

# 3. Connect to LanceDB
db = lancedb.connect("/home/user/recall_tuning/lancedb")
table = db["vectors"]

def evaluate_recall(nprobes, refine_factor):
    matched = 0
    total = 0
    for i, q in enumerate(query_vectors):
        # Query
        results = table.search(q).metric("l2").select(["id"]).nprobes(nprobes).refine_factor(refine_factor).limit(10).to_arrow()
        ann_ids = results["id"].to_pylist()
        
        # Calculate recall
        gt_ids = ground_truth[i]
        matched += len(set(ann_ids).intersection(set(gt_ids)))
        total += 10
    
    recall = matched / total
    return recall

# Let's try building an index with num_partitions=128, num_sub_vectors=16
print("Building index IVF_PQ with num_partitions=128, num_sub_vectors=16...")
start_idx = time.time()
table.create_index(
    metric="l2",
    vector_column_name="vector",
    num_partitions=128,
    num_sub_vectors=16,
    index_type="IVF_PQ",
    replace=True
)
print(f"Index built in {time.time() - start_idx:.2f} seconds.")

# Sweep nprobes and refine_factor
print("Sweeping nprobes and refine_factor...")
for nprobes in [1, 2, 4, 8, 16, 32, 64, 128]:
    for refine_factor in [1, 2, 4, 8, 10]:
        recall = evaluate_recall(nprobes, refine_factor)
        print(f"nprobes={nprobes:3d}, refine_factor={refine_factor:2d} -> Recall@10: {recall:.4f}")
        if recall >= 0.90:
            print(">>> Recall target met! <<<")
