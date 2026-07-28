import lancedb
import numpy as np
import time
import warnings
warnings.filterwarnings("ignore")

print("Loading data...")
query_vectors = np.load("/home/user/recall_tuning/data/query_vectors.npy")
ground_truth = np.load("/home/user/recall_tuning/data/ground_truth.npy")

db = lancedb.connect("/home/user/recall_tuning/lancedb")
table = db["vectors"]

def evaluate_recall(nprobes, refine_factor):
    matched = 0
    total = 0
    start_time = time.time()
    for i, q in enumerate(query_vectors):
        results = table.search(q).metric("l2").select(["id", "_distance"]).nprobes(nprobes).refine_factor(refine_factor).limit(10).to_arrow()
        ann_ids = results["id"].to_pylist()
        gt_ids = ground_truth[i]
        matched += len(set(ann_ids).intersection(set(gt_ids)))
        total += 10
    
    recall = matched / total
    print(f"nprobes={nprobes}, refine_factor={refine_factor} -> Recall@10: {recall:.4f} (took {time.time() - start_time:.2f}s)")
    return recall

# Test some values
evaluate_recall(nprobes=1, refine_factor=1)
evaluate_recall(nprobes=10, refine_factor=1)
evaluate_recall(nprobes=20, refine_factor=1)
evaluate_recall(nprobes=32, refine_factor=1)
evaluate_recall(nprobes=10, refine_factor=5)
