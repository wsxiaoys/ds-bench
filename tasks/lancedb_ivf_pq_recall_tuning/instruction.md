# Tune an IVF_PQ ANN Index for a Recall Target with LanceDB

## Background
A retrieval service stores a large corpus of precomputed 128-dimensional `float32` embedding vectors in a local LanceDB (OSS, Python) database. Brute-force (exhaustive) search is too slow at this scale, so the service must serve queries through an approximate-nearest-neighbor (ANN) index. Your job is to build such an index, tune it so it meets a strict recall requirement measured against exact ground truth, persist the tuned configuration, and expose a reusable search interface.

The environment is fully offline. No network access, no external embedding/model APIs, and no cloud storage are available or permitted. Everything runs against the local filesystem.

- LanceDB Python package version: `lancedb==0.34.0`.
- Project path: `/home/user/recall_tuning`

## Provided data (already present in the environment, do not modify)
- `/home/user/recall_tuning/data/base_vectors.npy` — a NumPy array of shape `(60000, 128)`, dtype `float32`. These are the corpus vectors to index.
- `/home/user/recall_tuning/data/query_vectors.npy` — a NumPy array of shape `(1000, 128)`, dtype `float32`. This is the held-out query set.

## Requirements
Build and persist all of the following inside `/home/user/recall_tuning`.

1. A LanceDB database directory at `/home/user/recall_tuning/lancedb` containing a table named `vectors` with exactly two columns:
   - `id`: 64-bit integer equal to the 0-based row index of the vector within `base_vectors.npy` (row `i` has `id == i`).
   - `vector`: fixed-size list of 32-bit floats with dimension `128`, equal to the corresponding row of `base_vectors.npy`.
   The table must contain all `60000` rows.
2. An ANN vector index of type `IVF_PQ` built on the `vector` column using the `l2` (Euclidean) distance metric. The index must cover all `60000` rows (no unindexed rows remain).
3. A JSON report file at `/home/user/recall_tuning/report.json` that is a single JSON object with EXACTLY these keys:
   - `index_type`: the string `"IVF_PQ"`.
   - `metric`: the string `"l2"`.
   - `num_partitions`: integer, the IVF partition count used to build the index.
   - `num_sub_vectors`: integer, the PQ sub-vector count used to build the index; it must evenly divide `128`.
   - `nprobes`: integer, the query-time number of partitions probed used by your search interface.
   - `refine_factor`: integer `>= 1`, the query-time refine factor used by your search interface (use `1` if you apply no extra refinement).
   - `recall_at_10`: float in `[0, 1]`, the recall@10 your tuned ANN search achieves over the ENTIRE query set, measured against exact ground truth. This value must be `>= 0.90`.
   - `num_base_vectors`: integer, equal to `60000`.
   - `num_query_vectors`: integer, equal to `1000`.
4. A Python module at `/home/user/recall_tuning/tuned_search.py` exposing a top-level function with this exact signature:
   `def search(query_vector, k=10) -> list[int]`
   - `query_vector` is a sequence (Python list or 1-D NumPy array) of `128` floats.
   - It returns a Python list of the `id` values (plain Python ints) of the approximate `k` nearest neighbors under `l2` distance, ordered nearest first, of length exactly `k`.
   - It must open the persisted `vectors` table and answer via the `IVF_PQ` ANN index using the tuned `nprobes` and `refine_factor` from your report — it must NOT perform an exhaustive/flat (index-bypassing) scan.
   - Importing the module and calling `search` must work in a fresh Python process without rebuilding the table or the index (all persisted state is read from disk).

## Definition of recall@10 (this is exactly what is measured)
For a single query, let `T` be the set of `id`s of its 10 exact nearest neighbors by `l2` distance over all base vectors, and let `A` be the set of `id`s returned by `search(query, k=10)`. The per-query recall is `|A ∩ T| / 10`. The reported `recall_at_10` is the mean of the per-query recall across all `1000` queries.

## Implementation Hints
- Project path: `/home/user/recall_tuning`
- All artifacts (`lancedb/`, `report.json`, `tuned_search.py`) must live directly under the project path at the exact paths given above.
- The index must be genuinely approximate: choose `num_partitions` and `num_sub_vectors` appropriate for `60000` rows of dimension `128`, then tune query-time parameters until the recall target is met. `num_sub_vectors` must evenly divide `128`.
- Everything must run offline against the local filesystem only.

