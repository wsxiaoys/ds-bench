# Fully-Offline Local RAG Index over Docling Chunks

## Background
You must build a two-command command-line application that turns a folder of PDF documents into a locally-queryable Retrieval-Augmented-Generation (RAG) index, using **Docling** (pinned to **docling v2.107.0**) for all document conversion and chunking. The pipeline converts each PDF into a structured document, splits it into heading-aware, context-enriched chunks, persists those chunks (with their provenance) into a single on-disk index file, and later answers free-text queries by returning the most relevant chunks together with exactly where they came from.

The container is **fully offline**: there is no internet access at any point while you solve the task or while it is evaluated. Docling's default AI models are already pre-baked into the image and Docling is preconfigured to load them from local disk, so document conversion works offline out of the box. Any component that reaches out to the network (for example, downloading a tokenizer or an embedding model) will fail — the retrieval must be implemented so that indexing and querying run entirely from local resources and produce **deterministic** results on repeated runs.

## Requirements
- Provide a single program with two subcommands, `index` and `query`.
- `index` converts **every** `*.pdf` file in a documents directory with Docling, chunks each converted document into heading-aware, context-enriched chunks (each chunk's text must be the heading-contextualized serialization, i.e. the section-heading path is prepended to the chunk body), and stores every chunk in a single on-disk index file. For each chunk you must persist: the chunk text, the source document (its file name), the page number the chunk's content originates from, and the hierarchical heading path.
- Tables must be chunked such that a chunk covering a table row also carries that table's column/header context (so the row remains self-describing).
- `query` loads the on-disk index and returns the top-K chunks most relevant to a query string, scored by a **local, deterministic** relevance measure (no external embedding service, no model download). Higher score means more relevant.
- Re-running `index` on the same documents into the same index file is **idempotent**: it must not create duplicate chunks (the stored chunk set must be identical to a single run).

## Implementation Hints
- Project path: /home/user/project
- The program entrypoint is /home/user/project/main.py, invoked as `python main.py <subcommand> [options]` with the current working directory set to /home/user/project.
- Required version: docling v2.107.0. The environment is fully offline; do not attempt any network download at index or query time.
- A corpus of input PDFs is provided at /home/user/project/corpus, but the documents directory is always passed explicitly via the `--docs` option (do not hard-code it).

- `index` subcommand:
  - Invocation: `python main.py index --docs <DOCS_DIR> --index <INDEX_PATH>`
  - Converts and chunks every `*.pdf` directly inside `<DOCS_DIR>` and writes the index to `<INDEX_PATH>`.
  - On success it prints to stdout a single JSON object with exactly the keys `documents` (integer count of PDFs indexed) and `chunks` (integer total number of chunks stored), and exits with code 0.

- On-disk index format (`<INDEX_PATH>`): a **SQLite database file** containing a table named `chunks` with (at least) these columns:
  - `chunk_id` INTEGER PRIMARY KEY
  - `source` TEXT — the source PDF's base file name, e.g. `finance.pdf`
  - `page` INTEGER — the 1-based page number the chunk's content originates from
  - `heading_path` TEXT — a JSON-encoded array of strings giving the ordered heading path for the chunk (an empty array `[]` when the chunk has no headings)
  - `text` TEXT — the heading-contextualized chunk text

- `query` subcommand:
  - Invocation: `python main.py query --index <INDEX_PATH> --query <QUERY_STRING> --top-k <K>`
  - Loads `<INDEX_PATH>` and prints to stdout a single JSON array of at most `K` result objects, ordered by descending score. Each result object must have exactly these keys: `text` (string, the stored chunk text), `source` (string, the source PDF base file name), `page` (integer, 1-based), `heading_path` (array of strings), and `score` (number). When two chunks have equal score, order them by ascending `chunk_id`. Exits with code 0 on success.

- Error handling (exit codes):
  - Missing or malformed arguments (unknown subcommand, missing required option, or `--top-k` less than 1): exit code 2.
  - `index` when `<DOCS_DIR>` does not exist or contains no `*.pdf` files: exit code 3.
  - `query` when `<INDEX_PATH>` does not exist: exit code 4.

