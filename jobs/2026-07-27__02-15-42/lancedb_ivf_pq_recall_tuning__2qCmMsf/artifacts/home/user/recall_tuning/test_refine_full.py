import lancedb
import numpy as np
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
    for i, q in enumerate(query_vectors):
        results = table.search(q).metric("l2").select(["id", "_distance"]).nprobes(nprobes).refine_factor(refine_factor).limit(10).to_arrow()
        ann_ids = results["id"].to_pylist()
        gt_ids = ground_truth[i]
        matched += len(set(ann_ids).intersection(set(gt_ids)))
        total += 10
    
    recall = matched / total
    print(f"FULL QUERY SET: nprobes={nprobes:3d}, refine_factor={refine_factor:3d} -> Recall@10: {recall:.4f}")
    return recall

evaluate_recall(1, 20)
evaluate_recall(2, 20)
evaluate_recall(1, 25)
evaluate_recall(2, 25)
