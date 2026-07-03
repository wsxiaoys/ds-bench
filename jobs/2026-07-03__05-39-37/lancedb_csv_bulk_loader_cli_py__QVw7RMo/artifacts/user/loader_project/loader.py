#!/usr/bin/env python3
"""CSV Bulk Loader CLI for LanceDB.

Subcommands:
  ingest  - Read a CSV, embed a text column with OpenAI text-embedding-3-small,
            and write all rows (with embeddings) to a LanceDB table.
  search  - Embed a query, run a vector search, and print top-k results as JSON.
"""

import argparse
import json
import logging
import os
import sys
import math
import urllib.request
import urllib.error
from typing import List, Dict, Any

import pandas as pd
import lancedb

# All user-facing/diagnostic messages go to stderr so that `search` stdout
# contains *only* the JSON result object.
logging.basicConfig(
    stream=sys.stderr,
    level=os.environ.get("LOADER_LOG_LEVEL", "INFO"),
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("loader")

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
DB_PATH = "/home/user/loader_project/lance_db"
VECTOR_COLUMN = "vector"
# OpenAI embeddings API accepts at most 2048 input strings per request.
OPENAI_MAX_INPUTS_PER_CALL = 2048


def _require_api_key() -> str:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        log.error("OPENAI_API_KEY environment variable is not set.")
        sys.exit(1)
    return api_key


def _embed_texts(texts: List[str]) -> List[List[float]]:
    """Embed a list of texts using the OpenAI text-embedding-3-small model.

    Uses the OpenAI REST API directly via the standard library (urllib) to
    avoid dependency-version conflicts between the `openai` SDK and `httpx`.
    The list is chunked to respect the OpenAI per-request input limit so that
    large batches never exceed the API cap. Returns embeddings in the same
    order as the input texts.
    """
    if not texts:
        return []
    api_key = _require_api_key()
    url = os.environ.get("OPENAI_BASE_URL", "REDACTED") + "/embeddings"
    all_embeddings: List[List[float]] = []
    for start in range(0, len(texts), OPENAI_MAX_INPUTS_PER_CALL):
        chunk = texts[start : start + OPENAI_MAX_INPUTS_PER_CALL]
        # Replace any None / non-string with empty string to keep API happy.
        clean_chunk = ["" if t is None else str(t) for t in chunk]
        log.info(
            "Requesting embeddings for %d texts (offset %d/%d)",
            len(clean_chunk),
            start,
            len(texts),
        )
        payload = json.dumps({"model": EMBEDDING_MODEL, "input": clean_chunk}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        body = _http_request_with_retry(req)
        data = json.loads(body)
        # The API returns embeddings in the same order as the input list,
        # but sort by index defensively.
        items = sorted(data["data"], key=lambda d: d["index"])
        chunk_embeddings = [d["embedding"] for d in items]
        if len(chunk_embeddings) != len(clean_chunk):
            raise RuntimeError(
                f"Embedding count mismatch: got {len(chunk_embeddings)}, "
                f"expected {len(clean_chunk)}"
            )
        all_embeddings.extend(chunk_embeddings)
    return all_embeddings


def _http_request_with_retry(req: urllib.request.Request, max_retries: int = 4) -> bytes:
    """Execute an HTTP request with simple exponential-backoff retry on
    transient errors (rate limits / server errors)."""
    import time

    last_exc = None
    for attempt in range(max_retries):
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            last_exc = exc
            retryable = exc.code in (429, 500, 502, 503, 504)
            if not retryable:
                # Read body for diagnostics.
                try:
                    detail = exc.read().decode("utf-8", "replace")
                except Exception:
                    detail = ""
                log.error("OpenAI API error %d: %s", exc.code, detail)
                raise
            wait = min(2 ** attempt, 30)
            log.warning(
                "OpenAI API returned %d (attempt %d/%d); retrying in %ds",
                exc.code,
                attempt + 1,
                max_retries,
                wait,
            )
            time.sleep(wait)
        except (urllib.error.URLError, TimeoutError) as exc:
            last_exc = exc
            wait = min(2 ** attempt, 30)
            log.warning(
                "Network error (attempt %d/%d): %s; retrying in %ds",
                attempt + 1,
                max_retries,
                exc,
                wait,
            )
            time.sleep(wait)
    raise RuntimeError(f"Request failed after {max_retries} attempts: {last_exc}")


def cmd_ingest(args: argparse.Namespace) -> int:
    csv_path: str = args.csv
    table_name: str = args.table
    text_col: str = args.text_col
    batch_size: int = args.batch_size

    if batch_size < 1:
        log.error("--batch-size must be >= 1")
        return 1

    if not os.path.exists(csv_path):
        log.error("CSV file not found: %s", csv_path)
        return 1

    log.info("Reading CSV: %s", csv_path)
    # pandas handles \\r\\n line endings transparently.
    df = pd.read_csv(csv_path, dtype=str)
    # Keep id as integer where possible; fall back to string.
    try:
        df["id"] = df["id"].astype(int)
    except (ValueError, TypeError):
        log.warning("Could not cast 'id' column to int; keeping as string.")

    if text_col not in df.columns:
        log.error("Text column '%s' not found in CSV. Columns: %s", text_col, list(df.columns))
        return 1

    required_cols = ["id", "title", "body", "category", "published"]
    for col in required_cols:
        if col not in df.columns:
            log.error("Required column '%s' missing from CSV. Columns: %s", col, list(df.columns))
            return 1

    total_rows = len(df)
    log.info("CSV contains %d data rows", total_rows)

    # Build the full list of records with embeddings, batched by batch_size.
    records: List[Dict[str, Any]] = []
    num_batches = math.ceil(total_rows / batch_size)
    for b_idx in range(num_batches):
        start = b_idx * batch_size
        end = min(start + batch_size, total_rows)
        batch_df = df.iloc[start:end]
        texts = batch_df[text_col].fillna("").tolist()
        log.info("Embedding batch %d/%d (rows %d-%d)", b_idx + 1, num_batches, start, end - 1)
        embeddings = _embed_texts(texts)
        if len(embeddings) != len(batch_df):
            log.error(
                "Embedding count mismatch: got %d, expected %d", len(embeddings), len(batch_df)
            )
            return 1
        for (_, row), emb in zip(batch_df.iterrows(), embeddings):
            rec = {
                "id": int(row["id"]) if _is_int_like(row["id"]) else str(row["id"]),
                "title": "" if pd.isna(row["title"]) else str(row["title"]),
                "body": "" if pd.isna(row["body"]) else str(row["body"]),
                "category": "" if pd.isna(row["category"]) else str(row["category"]),
                "published": "" if pd.isna(row["published"]) else str(row["published"]),
                VECTOR_COLUMN: emb,
            }
            records.append(rec)

    if len(records) != total_rows:
        log.error("Row count mismatch after processing: %d != %d", len(records), total_rows)
        return 1

    log.info("Connecting to LanceDB at %s", DB_PATH)
    os.makedirs(DB_PATH, exist_ok=True)
    db = lancedb.connect(DB_PATH)

    log.info("Creating/overwriting table '%s' with %d rows", table_name, len(records))
    # overwrite-on-rerun semantics.
    db.create_table(table_name, records, mode="overwrite")
    log.info("Ingest complete: %d rows written to table '%s'", len(records), table_name)
    return 0


def _is_int_like(value: Any) -> bool:
    try:
        int(value)
        return True
    except (ValueError, TypeError):
        return False


def cmd_search(args: argparse.Namespace) -> int:
    table_name: str = args.table
    query: str = args.query
    k: int = args.k

    if k < 1:
        log.error("--k must be >= 1")
        return 1

    log.info("Embedding query: %r", query)
    query_vector = _embed_texts([query])[0]

    log.info("Connecting to LanceDB at %s", DB_PATH)
    db = lancedb.connect(DB_PATH)
    try:
        tbl = db.open_table(table_name)
    except Exception as exc:
        log.error("Could not open table '%s': %s", table_name, exc)
        return 1

    table_row_count = tbl.count_rows()
    log.info("Table '%s' has %d rows", table_name, table_row_count)
    effective_k = min(k, table_row_count)

    if effective_k == 0:
        result = {"query": query, "k": k, "results": []}
        print(json.dumps(result))
        return 0

    log.info("Running vector search for top-%d", effective_k)
    rows = (
        tbl.search(query_vector, vector_column_name=VECTOR_COLUMN)
        .limit(effective_k)
        .to_list()
    )

    results = []
    for r in rows:
        score = r.get("_distance")
        if score is None:
            # Fallback: try other common distance/similarity keys.
            score = r.get("score", r.get("_similarity", 0.0))
        results.append(
            {
                "id": int(r["id"]) if _is_int_like(r.get("id")) else r.get("id"),
                "title": str(r.get("title", "")),
                "category": str(r.get("category", "")),
                "published": str(r.get("published", "")),
                "score": float(score),
            }
        )

    output = {"query": query, "k": k, "results": results}
    print(json.dumps(output))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="loader.py",
        description="CSV Bulk Loader CLI for LanceDB with OpenAI embeddings.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_ingest = sub.add_parser("ingest", help="Ingest a CSV into a LanceDB table.")
    p_ingest.add_argument("--csv", required=True, help="Path to the CSV file.")
    p_ingest.add_argument("--table", required=True, help="Name of the LanceDB table.")
    p_ingest.add_argument(
        "--text-col", required=True, dest="text_col", help="Column to embed."
    )
    p_ingest.add_argument(
        "--batch-size", required=True, type=int, dest="batch_size", help="Embedding batch size."
    )
    p_ingest.set_defaults(func=cmd_ingest)

    p_search = sub.add_parser("search", help="Semantic search over a LanceDB table.")
    p_search.add_argument("--table", required=True, help="Name of the LanceDB table.")
    p_search.add_argument("--query", required=True, help="Query string.")
    p_search.add_argument("--k", required=True, type=int, help="Number of results.")
    p_search.set_defaults(func=cmd_search)

    return parser


def main(argv: List[str] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except SystemExit:
        raise
    except Exception as exc:
        log.exception("Unhandled error: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())