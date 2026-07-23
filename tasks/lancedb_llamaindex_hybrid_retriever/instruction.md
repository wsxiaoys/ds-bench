# Offline LlamaIndex + LanceDB Hybrid Retriever with Metadata Filters

## Background
You are building the retrieval layer of a fully offline Retrieval-Augmented Generation service. It must use LlamaIndex on top of a **LanceDB** vector store (`llama-index-vector-stores-lancedb`) persisted on the local filesystem. The whole pipeline runs in a sandbox with **no network access**: there is no OpenAI/HuggingFace/Cohere key, no model downloads, and no cloud storage. Any attempt to reach the network (including LlamaIndex's default embedding or LLM) will fail the task.

A fixed document corpus is provided at `/home/user/project/data/corpus.json`. It is a JSON array of records, each with the string keys `id` and `text` and the metadata fields `category` (string) and `year` (integer).

## Requirements
- Build a LlamaIndex retrieval pipeline backed by a `LanceDBVectorStore` stored on the local filesystem.
- Ingest every record from the corpus as an index node. Each node's identifier MUST equal the record's `id`, and each node MUST carry `category` and `year` as filterable metadata.
- Retrieval MUST be **hybrid** (combine dense vector similarity with full-text/keyword search); a full-text index over the node text is required. Fuse the vector and full-text result lists using **Reciprocal Rank Fusion (RRF)** with its default fusion constant.
- Retrieval MUST support LlamaIndex `MetadataFilters` (exact-match and numeric range conditions combined with AND) applied through the retriever, so that only nodes whose metadata satisfy the filter can be returned.
- All embeddings MUST be produced by a deterministic, purely local embedding function (no network, no pretrained model). Use exactly this algorithm for both documents and queries so results are reproducible:
  - Embedding dimension is **32**.
  - Lowercase the text and extract tokens matching the regular expression `[a-z0-9]+`.
  - Start from a length-32 zero vector. For each token, compute `idx = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16) % 32` and add `1.0` to position `idx`.
  - L2-normalize the vector; if the norm is `0`, leave it as all zeros.
- LlamaIndex must be configured so that no remote LLM or remote embedding model is ever resolved or called.

## Implementation Hints
- Project path: /home/user/project
- Input corpus: /home/user/project/data/corpus.json (already present; do not modify it).
- Deliverable module: /home/user/project/hybrid_pipeline.py
- The module MUST expose a callable `retrieve(query, filters=None, top_k=5)` where:
  - `query` is a `str`.
  - `filters` is either `None` or a `llama_index.core.vector_stores.MetadataFilters` instance.
  - `top_k` is an `int` upper bound on the number of results.
  - It returns a Python `list` of `dict`, each dict having exactly the keys `id` (str, the node id) and `text` (str, the node text), ordered from most to least relevant according to the hybrid RRF ranking, and containing at most `top_k` items.
- Importing `hybrid_pipeline` and calling `retrieve(...)` MUST fully build (or reuse) the index and run a real query against the LanceDB store; it must not require any additional setup call by the caller.
- The vector store data must be written under the project directory (local filesystem only).

