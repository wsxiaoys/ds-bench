# CSV Bulk Loader CLI for LanceDB

## Background
A data team needs a small, reusable command-line tool that ingests CSV files into a [LanceDB](https://docs.lancedb.com/) table, embedding a designated text column via the OpenAI `text-embedding-3-small` endpoint, and then exposes a semantic search subcommand for retrieving top-k matches.

The environment already contains a deterministic, pre-generated dataset at `/home/user/articles.csv` with around 5000 rows and the columns `id,title,body,category,published`. Your job is to build the CLI that loads that data into LanceDB and searches it.

## Requirements
- Implement a single Python script at `/home/user/loader_project/loader.py` exposing the following subcommands:
  - `ingest`: reads a CSV file, splits it into batches of size N, embeds the chosen text column using the OpenAI `text-embedding-3-small` model, and writes all rows (with their embeddings) to a LanceDB table.
    - CLI Command: `python3 loader.py ingest --csv <csv_path> --table <table_name> --text-col <column_name> --batch-size <int>`
  - `search`: embeds a query string with the same OpenAI model, runs a vector search against an existing LanceDB table, and prints the top-k results as a single JSON object to standard output.
    - CLI Command: `python3 loader.py search --table <table_name> --query <query_string> --k <int>`
- Both commands must exit with status 0 on success.
- All embeddings MUST be produced by real OpenAI API calls; no local models, no mock vectors.
- Run-id isolation: ingest/search MUST work against whatever table name the verifier passes via `--table`. The verifier will pass a name suffixed with the current `/logs/artifacts/run-id` so that concurrent test runs do not collide.
- The LanceDB database must live at `/home/user/loader_project/lance_db`. All tables are created inside that directory.
- Ingestion MUST preserve every CSV row exactly once (no de-duplication, no row drops). Row count in the LanceDB table after ingest MUST equal the row count of the CSV (excluding the header).
- After `ingest`, the table MUST contain at minimum the columns `id`, `title`, `body`, `category`, `published`, plus one vector column suitable for `text-embedding-3-small` (1536 dimensions).
- The `search` command MUST print a single JSON object to stdout and NOTHING else (logs may go to stderr). The output JSON MUST follow this exact structure:
  ```json
  {
    "query": "<the query string passed via --query>",
    "k": <int>,
    "results": [
      {
        "id": <int>,
        "title": "<string>",
        "category": "<string>",
        "published": "<string>",
        "score": <float>
      }
    ]
  }
  ```
  The `results` array MUST have length `min(k, table_row_count)` and be ordered from best to worst match. The `score` field may be either a distance or a similarity (any monotonic ordering) but must be a finite number.

## Implementation Hints
- Read the OpenAI key from the `OPENAI_API_KEY` environment variable.
- Use `lancedb.connect(...)` for the database connection and `db.create_table(...)` (with overwrite-on-rerun semantics) to create the embedded table.
- Batch your OpenAI embedding calls; sending one row per HTTP call against 5000 rows will be both slow and rate-limited.
- Decide how you want to store the CSV columns alongside the embedding vector (Arrow / Pydantic / list-of-dicts are all fine). The verifier only requires that the schema preserves `id`, `title`, `body`, `category`, `published`, and that the embedding column can be searched with `table.search(query_vector)`.
- For `search`, run a vector search via `table.search(query_vector).limit(k)` and serialize the resulting rows (without the raw embedding vector) into JSON.

