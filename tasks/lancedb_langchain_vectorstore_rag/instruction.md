# LangChain + LanceDB Retrieval Layer

## Background
You are building the retrieval layer of a fully offline Retrieval-Augmented Generation (RAG) system. Documents are indexed into a local LanceDB vector store through LangChain's `LanceDB` vector store integration (`langchain_community.vectorstores.LanceDB`) and exposed as LangChain retrievers. There is no LLM and no network access: the whole pipeline runs locally against the filesystem.

The environment is prepared for you at the project path and already has the required packages installed. Do **not** attempt to install packages or reach the network; everything must work completely offline.

## Requirements
Implement a Python module that:
1. Builds a local LanceDB-backed LangChain vector store and ingests the provided document corpus, preserving each document's metadata.
2. Exposes the store as a LangChain retriever that supports top-k similarity search and an optional metadata filter.
3. Supports metadata pre-filtering, where the filter is a LanceDB SQL predicate string that must be applied **before** the vector search so that results are drawn only from rows matching the predicate.
4. Supports Maximal Marginal Relevance (MMR) retrieval with caller-supplied `k`, `fetch_k`, and `lambda_mult`.
5. Returns retrieved document identifiers in exact ranked order.

## Implementation Hints
- Project path: `/home/user/rag`
- Installed and pinned (offline): `lancedb==0.25.2`, `langchain-community==0.3.27`, `langchain-core==0.3.75`. Your solution MUST work with these exact versions.
- Provided files (DO NOT modify them):
  - `/home/user/rag/local_embeddings.py` — defines a deterministic, offline LangChain `Embeddings` subclass named `HashEmbeddings` (embedding dimension = 64). You MUST use this class as the embedding model; do not substitute any other embedding provider and do not perform any model download.
  - `/home/user/rag/corpus.json` — a JSON array of document objects, each with the keys `doc_id` (string), `text` (string), `source` (string), `section` (string), and `timestamp` (integer).
- Deliverable: a module `/home/user/rag/solution.py` that can be imported as `solution` (i.e. importable when the current working directory is `/home/user/rag`).
- Persistence and data model:
  - The LanceDB database directory MUST be `/home/user/rag/lancedb` and the table name MUST be `documents`.
  - Every corpus document MUST be ingested exactly once. Each stored record's text content MUST equal the corpus `text`, and its metadata MUST contain the keys `doc_id`, `source`, `section`, and `timestamp` carrying the corpus values. The `doc_id` MUST be recoverable from any retrieved LangChain `Document` returned by your retriever/functions.
- The module MUST expose exactly these callables:
  - `build_index()` — (re)creates the `documents` table at `/home/user/rag/lancedb` from `corpus.json` and returns the LangChain `LanceDB` vector store object. Calling it more than once MUST leave exactly one full copy of the corpus in the table (no duplicates).
  - `get_retriever(search_type, search_kwargs)` — returns a LangChain retriever (a `BaseRetriever`) over the `documents` table configured with the given `search_type` (`"similarity"` or `"mmr"`) and `search_kwargs` dict; invoking it MUST return LangChain `Document` objects whose metadata carries `doc_id`.
  - `retrieve(query, k, where=None)` — similarity search. `query` is a string, `k` an int, and `where` is either `None` or a LanceDB SQL predicate string (e.g. referencing metadata fields). When `where` is provided it MUST be applied as a pre-filter (before the vector search). Returns a `list[str]` of `doc_id` values ordered from most similar to least similar, length at most `k`.
  - `retrieve_mmr(query, k, fetch_k, lambda_mult, where=None)` — MMR search returning a `list[str]` of `doc_id` values in the order the MMR algorithm selects them, using the supplied `k`, `fetch_k`, and `lambda_mult`, and honoring the optional `where` metadata filter.
- Determinism: retrieval results MUST be deterministic and identical across processes and repeated calls (the provided embeddings are deterministic; do not introduce randomness).

