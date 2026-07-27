# Offline BM25 Retrieval Index over a Docling-Parsed Document

## Background
Build a fully offline lexical retrieval pipeline over a structured document. A multi-section PDF report (containing a table) is provided in the environment. Using the Docling library (`docling` v2.107.0, pre-installed), convert the PDF into its structured document model, segment it into structurally-aligned chunks, enrich every chunk with its hierarchical heading path, build a classical BM25 index over the contextualized chunks, and expose a query interface that returns the best-matching chunks for a set of provided test queries.

## Requirements
- Convert the provided PDF into Docling's structured document model and segment it into chunks that follow the document's own structure (one chunk per detected structural element; do NOT invent arbitrary fixed-size text windows).
- Enrich every chunk with its hierarchical heading path (the ordered list of section headings in scope for that chunk), and make the retrieval index incorporate this heading context so that a query which matches only a section's heading still retrieves that section's chunk.
- Preserve the table: the table's cell content must appear verbatim inside a chunk's `text`.
- Build a classical BM25 lexical index over the contextualized chunks and persist it to disk as a reusable artifact.
- Provide a query interface that returns the top-k chunks (with their BM25 relevance scores) for a query, ranked from most to least relevant.
- Evaluate the provided seeded test queries and emit their ranked results.

## Implementation Hints
- Project path: /home/user/project
- Input PDF: /home/user/project/assets/report.pdf
- Seeded queries: /home/user/project/assets/queries.json — a JSON array of objects, each with the keys `query_id` (string) and `query` (string).
- The environment is FULLY OFFLINE: there is NO network access at build, solve, or verify time. Your solution MUST NOT download any model, tokenizer, or dataset; MUST NOT contact any external service, API, or vector database; and MUST NOT use neural or embedding-based similarity — retrieval must be purely lexical. Rely only on components that operate offline inside this image.
- top-k value: 5 (use 5 wherever a top-k is required, unless a smaller k is explicitly requested on the command line).

- Build command: `python3 main.py --build`
  - Converts the PDF, produces the chunk stream in document order, and writes two artifacts:
    - `/home/user/project/output/chunks.json`: a JSON array of chunk objects in document order. Each object MUST include at least these keys:
      - `chunk_id` (integer): 0-based position of the chunk in document order (first chunk is `0`, incrementing by 1 with no gaps).
      - `heading_path` (array of strings): the ordered hierarchical section headings in scope for the chunk (may be empty only for content that precedes every heading).
      - `page_nos` (array of integers): the 1-based source page number(s) the chunk originates from, sorted ascending, without duplicates; never empty.
      - `text` (string): the chunk's textual content.
      - `term_count` (integer greater than 0): the number of lexical terms/tokens in the chunk after your own tokenization.
    - `/home/user/project/output/bm25_index.idx`: a persisted, non-empty index artifact that your query interface can reload from disk. Any file format is acceptable.

- Query command: `python3 main.py --query "<text>" [--top-k <k>]`
  - Loads the persisted index from disk (this MUST work in a process that did not itself build the index) and prints to stdout a single JSON array of at most k objects (default k = 5), each with exactly the keys:
    - `chunk_id` (integer): referencing a `chunk_id` present in chunks.json.
    - `score` (number): the BM25 score of that chunk for the query.
  - The array MUST be ordered by descending `score` (a non-increasing sequence); the first element is the single best match. Print nothing else to stdout except this JSON array.

- Seeded-run command: `python3 main.py --run-queries`
  - Loads the persisted index, evaluates every query in `assets/queries.json` with top-k = 5, and writes `/home/user/project/output/query_results.json`: a JSON object mapping each `query_id` (string) to an array (ranked by descending `score`, length at most 5) of objects with exactly the keys `chunk_id` (integer) and `score` (number).
  - The document content is written so that each seeded query has one unambiguous best answer; for every seeded query, the top-1 result (the `chunk_id` with the highest score) MUST be the chunk that actually contains the answer to that query.

