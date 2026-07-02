# Markdown Docs Repo Indexer with LanceDB

## Background
A small documentation repository has been baked into this environment at `/app/docs/`. It contains six Markdown files, each with a single top-level `# Title` and several `## Section` sub-headers. Build a tiny semantic indexer that walks the repo, splits every file into per-section chunks, embeds each chunk with **OpenAI** embeddings, and persists them into a **LanceDB** table. Then expose a `search(query, k)` Python API so users can ask natural-language questions and get back the most relevant sections.

The indexer must work end-to-end against real services — no mocks of OpenAI, no mocks of LanceDB, and no local model inference.

## Requirements
- Walk `/app/docs/` recursively and find every `.md` file.
- For each Markdown file, parse it and split it into one row per `## section`. Each row must remember:
  - `repo_path` — the path of the source file *relative to `/app/docs/`* (e.g. `auth-guide.md`).
  - `doc_title` — the text of the single top-level `# Title` in that file (without the leading `#`).
  - `section_title` — the text of the `## Section` header (without the leading `##`).
  - `content` — the text of that section (the body lines under the `##` header, up to the next `##` or end of file).
  - `embedding` — the OpenAI embedding vector for `content` (you may concatenate the section title with the content before embedding if you prefer).
- Compute embeddings using the **real OpenAI Embeddings API** with the `text-embedding-3-small` model. Credentials are available in `OPENAI_API_KEY` (and `OPENAI_BASE_URL` if set).
- Persist the rows into a LanceDB table under `/home/user/myproject/lancedb/`.
- Expose a function `search(query: str, k: int) -> list[dict]` in `/home/user/myproject/indexer.py` that:
  - Embeds the `query` with the same OpenAI embedding model used during indexing.
  - Returns the top-`k` most relevant sections, ordered from most to least relevant.
  - Each result dict must contain the keys `repo_path` (str), `doc_title` (str), `section_title` (str), and `score` (float).

## Implementation Hints
- You may use any Markdown parser you like — `markdown-it-py` is preinstalled, but a small regex or `python-markdown` is also fine. The corpus is plain CommonMark with `#` and `##` headers only.
- Use the official `openai` Python client to embed text.
- Use LanceDB's standard Python API (`lancedb.connect`, `create_table` / `open_table`, `table.search`) for storage and retrieval.
- Persist the table under `/home/user/myproject/lancedb/` so the verifier can re-open the same connection.
- To avoid collisions between concurrent runs, append the value of the `/logs/artifacts/run-id` to your table name (e.g. `docs_sections_<run-id>`). The verifier reads the same env var and opens the same table.
- Running `python3 /home/user/myproject/indexer.py` (or whichever script you choose to drive ingestion) must execute the indexing process and produce/populate the LanceDB table.
- Make indexing idempotent: when the script is re-run with the same `/logs/artifacts/run-id`, it should not error out and should leave the table queryable.

