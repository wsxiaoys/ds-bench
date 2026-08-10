import numpy as np
import time

print("Loading data...")
base_vectors = np.load("/home/user/recall_tuning/data/base_vectors.npy")
query_vectors = np.load("/home/user/recall_tuning/data/query_vectors.npy")

print("Computing exact ground truth...")
start_gt = time.time()
ground_truth = []
for q in query_vectors:
    diff = base_vectors - q
    dist_sq = np.sum(diff**2, axis=1)
    idx = np.argpartition(dist_sq, 10)[:10]
    idx = idx[np.argsort(dist_sq[idx])]
    ground_truth.append(idx)

ground_truth = np.array(ground_truth)
np.save("/home/user/recall_tuning/data/ground_truth.npy", ground_truth)
print(f"Exact ground truth computed and saved in {time.time() - start_gt:.2f} seconds. Shape: {ground_truth.shape}")
