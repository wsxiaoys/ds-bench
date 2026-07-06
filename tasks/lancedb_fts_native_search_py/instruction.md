# Native (Non-Tantivy) Full-Text Search with LanceDB

## Background
You are building a small keyword search prototype on top of LanceDB. The corpus is a collection of short articles about vector search, columnar formats, and information retrieval. You must use LanceDB's native (Lance-based) full-text search implementation — not the legacy Tantivy backend — to index the `body` column and run two BM25 queries.

## Requirements
- Connect to LanceDB at `/home/user/db`.
- Create (or recreate) a table named `articles` with this exact column layout:
  - `id` — `int64`
  - `title` — `string`
  - `body` — `string`
  - `vector` — `fixed_size_list<float32>[4]` (the values must come from `numpy.random.default_rng(1)`; the vector column is present for schema completeness but is not used by FTS).
- Seed the table with at least 20 rows of varied article content. Each row's `body` should be distinct enough that the two FTS queries below resolve to a single unambiguous top result. Specifically, the canonical answer for `"vector database"` must have `id=1`, and the canonical answer for `"lance format"` must have `id=2`.
- Build a native FTS index on the `body` column using the Lance-native backend (i.e. `use_tantivy=False`). The index must be (re)created idempotently each run.
- Run two full-text queries (`query_type="fts"`) using the values `"vector database"` and `"lance format"`. For each query, capture the top 3 results.
- Write the combined results to `/home/user/output/fts_results.json` as a valid JSON object containing exactly the keys `"query_1"` (for `"vector database"`) and `"query_2"` (for `"lance format"`). Each value must be a list of up to 3 result objects, ordered by descending relevance (highest `_score` first), each with at least the keys `id` (int), `title` (string), and `_score` (number).

## Implementation Hints
- Use the synchronous Python client: `import lancedb` and `lancedb.connect(uri)`.
- Build the table schema with `pyarrow` (e.g. `pa.schema([...])`) so the vector column is `pa.list_(pa.float32(), 4)`.
- Use `table.create_fts_index("body", use_tantivy=False, replace=True)` to build the native FTS index.
- Query with `table.search(query, query_type="fts").limit(3).to_list()`; each result dict will include the matched row plus a `_score` field.
- Make sure `/home/user/output/` exists before writing the JSON file.

