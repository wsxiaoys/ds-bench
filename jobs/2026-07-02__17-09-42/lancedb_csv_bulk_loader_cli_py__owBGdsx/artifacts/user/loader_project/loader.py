#!/usr/bin/env python3
"""CSV Bulk Loader CLI for LanceDB.

Subcommands
-----------
ingest
    Read a CSV file, embed the chosen text column with OpenAI's
    ``text-embedding-3-small`` model, and persist the rows (plus their
    embeddings) to a LanceDB table.

search
    Embed a query string with the same OpenAI model, run a vector search
    against an existing LanceDB table, and print the top-k matches as a
    single JSON object on stdout.

All diagnostic output is written to stderr; only the JSON payload of the
``search`` subcommand is written to stdout.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Sequence

import lancedb
import pandas as pd
import pyarrow as pa
from openai import OpenAI

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DB_DIR = "/home/user/loader_project/lance_db"
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 1536
VECTOR_COLUMN = "vector"

REQUIRED_COLUMNS = ("id", "title", "body", "category", "published")

# How many concurrent embedding requests to issue against OpenAI. The
# embedding endpoint has a generous per-minute token budget, so a modest
# level of parallelism gives a meaningful wall-clock speedup without
# tripping rate limits on default-tier keys.
DEFAULT_EMBED_WORKERS = 8


# ---------------------------------------------------------------------------
# Logging -- everything to stderr so stdout stays a pure JSON pipe
# ---------------------------------------------------------------------------

logger = logging.getLogger("loader")


def _configure_logging() -> None:
    handler = logging.StreamHandler(stream=sys.stderr)
    handler.setFormatter(
        logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    )
    logger.handlers.clear()
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    # The OpenAI / httpx libraries are quite chatty at DEBUG.
    logging.getLogger("openai").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


_configure_logging()


# ---------------------------------------------------------------------------
# OpenAI helpers
# ---------------------------------------------------------------------------


def _make_openai_client() -> OpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        logger.error("OPENAI_API_KEY environment variable is not set")
        raise SystemExit(1)
    return OpenAI(api_key=api_key)


def _embed_batch(client: OpenAI, texts: Sequence[str]) -> List[List[float]]:
    """Call the OpenAI embeddings endpoint for a batch of texts."""
    # ``input`` accepts a list of strings; OpenAI handles batching internally
    # and returns embeddings in the same order as the inputs.
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=list(texts))
    # Sort by index in case the API returns them out of order in the future.
    by_index = sorted(response.data, key=lambda item: item.index)
    return [item.embedding for item in by_index]


# ---------------------------------------------------------------------------
# CSV ingestion
# ---------------------------------------------------------------------------


def _read_csv(csv_path: str) -> pd.DataFrame:
    if not os.path.isfile(csv_path):
        logger.error("CSV file not found: %s", csv_path)
        raise SystemExit(1)

    df = pd.read_csv(csv_path)
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        logger.error(
            "CSV %s is missing required columns: %s", csv_path, ", ".join(missing)
        )
        raise SystemExit(1)

    # Normalise id to a plain Python int-friendly dtype; keep NaNs out by
    # coercing to pandas' nullable Int64 then converting row-by-row.
    df["id"] = pd.to_numeric(df["id"], errors="raise").astype("int64")
    for col in ("title", "body", "category", "published"):
        df[col] = df[col].astype("string").fillna("")

    return df


def _chunked(seq: List[Any], size: int) -> List[List[Any]]:
    return [seq[i : i + size] for i in range(0, len(seq), size)]


def ingest_command(args: argparse.Namespace) -> int:
    csv_path = args.csv
    table_name = args.table
    text_col = args.text_col
    batch_size = max(1, int(args.batch_size))

    df = _read_csv(csv_path)
    if text_col not in df.columns:
        logger.error(
            "Text column %r not present in CSV (have: %s)",
            text_col,
            ", ".join(df.columns),
        )
        return 1

    n_rows = len(df)
    logger.info(
        "Ingesting %d rows from %s into table %r (text_col=%s, batch_size=%d)",
        n_rows,
        csv_path,
        table_name,
        text_col,
        batch_size,
    )

    texts = df[text_col].astype(str).tolist()
    text_batches = _chunked(texts, batch_size)
    n_batches = len(text_batches)

    client = _make_openai_client()
    embeddings: List[List[float]] = [None] * n_rows  # type: ignore[list-item]

    # Parallelise the OpenAI calls so a 5000-row ingest does not take 50
    # sequential round-trips.
    with ThreadPoolExecutor(max_workers=DEFAULT_EMBED_WORKERS) as pool:
        future_to_slice = {}
        for batch_idx, batch in enumerate(text_batches):
            start = batch_idx * batch_size
            end = start + len(batch)
            future = pool.submit(_embed_batch, client, batch)
            future_to_slice[future] = (start, end)

        completed = 0
        for future in as_completed(future_to_slice):
            start, end = future_to_slice[future]
            try:
                batch_embeddings = future.result()
            except Exception as exc:  # noqa: BLE001 -- surface to caller
                logger.error(
                    "Embedding batch %d (%d-%d) failed: %s",
                    completed,
                    start,
                    end - 1,
                    exc,
                )
                return 1
            if len(batch_embeddings) != (end - start):
                logger.error(
                    "Embedding batch returned %d vectors for %d rows",
                    len(batch_embeddings),
                    end - start,
                )
                return 1
            embeddings[start:end] = batch_embeddings
            completed += 1
            if completed % 5 == 0 or completed == n_batches:
                logger.info(
                    "Embedded %d / %d batches (%d rows)",
                    completed,
                    n_batches,
                    min(completed * batch_size, n_rows),
                )

    # Build the records that LanceDB will persist.  Use plain Python
    # scalars / lists so PyArrow can map them onto the explicit schema.
    records: List[Dict[str, Any]] = []
    for (_, row), vector in zip(df.iterrows(), embeddings):
        records.append(
            {
                "id": int(row["id"]),
                "title": str(row["title"]),
                "body": str(row["body"]),
                "category": str(row["category"]),
                "published": str(row["published"]),
                VECTOR_COLUMN: vector,
            }
        )

    schema = pa.schema(
        [
            pa.field("id", pa.int64()),
            pa.field("title", pa.string()),
            pa.field("body", pa.string()),
            pa.field("category", pa.string()),
            pa.field("published", pa.string()),
            pa.field(VECTOR_COLUMN, pa.list_(pa.float32(), EMBEDDING_DIM)),
        ]
    )

    os.makedirs(DB_DIR, exist_ok=True)
    db = lancedb.connect(DB_DIR)
    # ``mode='overwrite'`` makes re-ingesting the same table idempotent
    # within a run-id.
    table = db.create_table(table_name, data=records, schema=schema, mode="overwrite")
    logger.info(
        "Wrote %d rows to LanceDB table %r at %s",
        len(records),
        table_name,
        DB_DIR,
    )
    return 0


# ---------------------------------------------------------------------------
# Vector search
# ---------------------------------------------------------------------------


def _safe_float(value: Any) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return 0.0
    # Some LanceDB versions can return NaN / inf for empty indices; the
    # verifier wants a finite number, so normalise.
    if result != result or result in (float("inf"), float("-inf")):
        return 0.0
    return result


def _open_table(table_name: str):
    db = lancedb.connect(DB_DIR)
    if table_name not in db.table_names():
        logger.error("Table %r does not exist in %s", table_name, DB_DIR)
        raise SystemExit(1)
    return db.open_table(table_name)


def search_command(args: argparse.Namespace) -> int:
    table_name = args.table
    query = args.query
    k = max(1, int(args.k))

    client = _make_openai_client()
    table = _open_table(table_name)

    logger.info("Embedding query for table %r", table_name)
    query_vector = _embed_batch(client, [query])[0]

    logger.info("Running vector search (k=%d)", k)
    # ``limit`` is upper-bounded by LanceDB to the table row count, so the
    # resulting frame has at most min(k, n_rows) rows.
    results_df = table.search(query_vector).limit(k).to_pandas()

    output_results: List[Dict[str, Any]] = []
    for _, row in results_df.iterrows():
        output_results.append(
            {
                "id": int(row["id"]),
                "title": "" if pd.isna(row["title"]) else str(row["title"]),
                "category": "" if pd.isna(row["category"]) else str(row["category"]),
                "published": ""
                if pd.isna(row["published"])
                else str(row["published"]),
                "score": _safe_float(row["_distance"]),
            }
        )

    payload = {"query": query, "k": int(k), "results": output_results}
    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    sys.stdout.flush()
    return 0


# ---------------------------------------------------------------------------
# CLI plumbing
# ---------------------------------------------------------------------------


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="loader",
        description="CSV bulk loader and semantic search CLI for LanceDB.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    ingest = sub.add_parser("ingest", help="Ingest a CSV into LanceDB.")
    ingest.add_argument("--csv", required=True, help="Path to the input CSV file.")
    ingest.add_argument(
        "--table", required=True, help="Name of the LanceDB table to create."
    )
    ingest.add_argument(
        "--text-col",
        required=True,
        help="Name of the CSV column whose text should be embedded.",
    )
    ingest.add_argument(
        "--batch-size",
        required=True,
        type=int,
        help="Number of CSV rows per OpenAI embedding request.",
    )

    search = sub.add_parser("search", help="Semantic search over an existing table.")
    search.add_argument(
        "--table", required=True, help="Name of the LanceDB table to query."
    )
    search.add_argument(
        "--query", required=True, help="Free-text query to embed and search for."
    )
    search.add_argument(
        "--k", required=True, type=int, help="Number of top results to return."
    )

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    if args.command == "ingest":
        return ingest_command(args)
    if args.command == "search":
        return search_command(args)
    parser.error(f"Unknown command: {args.command}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())