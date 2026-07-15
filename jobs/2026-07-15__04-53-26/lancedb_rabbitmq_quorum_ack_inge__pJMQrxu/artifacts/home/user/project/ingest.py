#!/usr/bin/env python3
"""RabbitMQ -> LanceDB ingestion worker.

Consumes documents from a durable quorum queue, embeds them with a deterministic
local embedding, deduplicates by id, writes batches to LanceDB, and dead-letters
poison messages via a configured dead-letter exchange.

Usage:
    python3 ingest.py

Drains all currently-available messages, then exits. Rerunnable.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from typing import List, Optional, Set

import lancedb
import numpy as np
import pika
import pyarrow as pa


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

RABBIT_HOST = "localhost"
RABBIT_PORT = 5672
RABBIT_VHOST = "/"
RABBIT_USER = "guest"
RABBIT_PASS = "guest"

MAIN_QUEUE = "documents"
DLX_EXCHANGE = "documents.dlx"
DLQ_QUEUE = "documents.dlq"

PROJECT_DIR = "/home/user/project"
DATA_DIR = os.path.join(PROJECT_DIR, "data")
LANCEDB_DIR = os.path.join(DATA_DIR, "lancedb")
TABLE_NAME = "documents"
COMMITS_LOG = os.path.join(DATA_DIR, "commits.log")

EMBED_DIM = 64
TOKEN_RE = re.compile(r"[a-z0-9]+")


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------

def embed_text(text: str) -> np.ndarray:
    """Deterministic 64-dim L2-normalized bag-of-md5-hashed-tokens embedding."""
    vec = np.zeros(EMBED_DIM, dtype=np.float32)
    lowered = text.lower()
    for token in TOKEN_RE.findall(lowered):
        idx = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16) % EMBED_DIM
        vec[idx] += 1.0
    norm = float(np.linalg.norm(vec))
    if norm > 0:
        vec = vec / norm
    return vec


# ---------------------------------------------------------------------------
# Broker topology
# ---------------------------------------------------------------------------

def declare_topology(channel: "pika.adapters.blocking_connection.BlockingChannel") -> None:
    """Idempotently declare the DLX, main queue, and DLQ."""
    # Dead-letter exchange (fanout, durable).
    channel.exchange_declare(
        exchange=DLX_EXCHANGE,
        exchange_type="fanout",
        durable=True,
    )

    # Main quorum queue, with DLX configured so nacked messages are dead-lettered.
    channel.queue_declare(
        queue=MAIN_QUEUE,
        durable=True,
        arguments={
            "x-queue-type": "quorum",
            "x-dead-letter-exchange": DLX_EXCHANGE,
        },
    )

    # Dead-letter quorum queue, bound to the DLX.
    channel.queue_declare(
        queue=DLQ_QUEUE,
        durable=True,
        arguments={"x-queue-type": "quorum"},
    )
    channel.queue_bind(queue=DLQ_QUEUE, exchange=DLX_EXCHANGE)


# ---------------------------------------------------------------------------
# Message parsing
# ---------------------------------------------------------------------------

def parse_document(body: bytes) -> Optional[dict]:
    """Return the parsed document on success, or None if the message is poison."""
    if not isinstance(body, (bytes, bytearray)):
        return None
    try:
        text = body.decode("utf-8")
    except (UnicodeDecodeError, AttributeError):
        return None
    try:
        obj = json.loads(text)
    except (ValueError,):
        return None
    if not isinstance(obj, dict):
        return None
    doc_id = obj.get("id")
    doc_text = obj.get("text")
    if not isinstance(doc_id, str) or len(doc_id) == 0:
        return None
    if not isinstance(doc_text, str) or len(doc_text) == 0:
        return None
    return {"id": doc_id, "text": doc_text}


# ---------------------------------------------------------------------------
# LanceDB helpers
# ---------------------------------------------------------------------------

def _documents_schema() -> pa.Schema:
    return pa.schema(
        [
            pa.field("id", pa.string(), nullable=False),
            pa.field("text", pa.string(), nullable=False),
            pa.field("vector", pa.list_(pa.float32(), EMBED_DIM), nullable=False),
        ]
    )


def _existing_table_names(db: lancedb.DBConnection) -> set:
    """Return a set of existing table names, robust to list_tables() return shape."""
    try:
        result = db.list_tables()
    except Exception:
        return set()
    # Newer lancedb returns a ListTablesResponse pydantic model with a .tables field.
    tables_attr = getattr(result, "tables", None)
    if tables_attr is not None:
        return {str(t) for t in tables_attr}
    # Older versions may return a plain iterable of names.
    try:
        return {str(t) for t in result}
    except TypeError:
        return set()


def open_or_create_table(db: lancedb.DBConnection):
    """Open the documents table, creating it with the expected schema if absent."""
    if TABLE_NAME in _existing_table_names(db):
        return db.open_table(TABLE_NAME)
    return db.create_table(TABLE_NAME, schema=_documents_schema())


def load_existing_ids(table) -> Set[str]:
    """Return the set of document ids already persisted in LanceDB."""
    try:
        df = table.to_pandas()
    except Exception:
        return set()
    if df is None or df.empty or "id" not in df.columns:
        return set()
    return {str(x) for x in df["id"].tolist()}


def write_batch(table, ids: List[str], texts: List[str]) -> None:
    """Write a single batch to the LanceDB table."""
    vectors = np.stack([embed_text(t) for t in texts]).astype(np.float32)
    id_arr = pa.array(ids, type=pa.string())
    text_arr = pa.array(texts, type=pa.string())
    vec_arr = pa.array(
        [v.tolist() for v in vectors],
        type=pa.list_(pa.float32(), EMBED_DIM),
    )
    pa_table = pa.table(
        {"id": id_arr, "text": text_arr, "vector": vec_arr},
        schema=_documents_schema(),
    )
    table.add(pa_table)


# ---------------------------------------------------------------------------
# Commit log
# ---------------------------------------------------------------------------

def next_batch_index(log_path: str) -> int:
    """Return the next batch_index, based on the highest existing one in the log."""
    if not os.path.exists(log_path):
        return 0
    last = -1
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except ValueError:
                    continue
                idx = obj.get("batch_index")
                if isinstance(idx, int) and idx > last:
                    last = idx
    except OSError:
        return 0
    return last + 1


def append_commit_line(log_fh, batch_index: int, ids: List[str]) -> None:
    """Append a single JSON line for the committed batch, fsynced to disk."""
    line = json.dumps({"batch_index": batch_index, "ids": list(ids)})
    log_fh.write(line + "\n")
    log_fh.flush()
    os.fsync(log_fh.fileno())


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> int:
    batch_size = int(os.environ.get("INGEST_BATCH_SIZE", "16"))
    if batch_size <= 0:
        batch_size = 16

    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(LANCEDB_DIR, exist_ok=True)

    # Connect to LanceDB and open/create the documents table.
    db = lancedb.connect(LANCEDB_DIR)
    table = open_or_create_table(db)

    # Hydrate the dedup set from previously-persisted rows.
    seen_ids: Set[str] = load_existing_ids(table)

    # Open the commit log in append mode and decide the starting batch_index.
    log_fh = open(COMMITS_LOG, "a", encoding="utf-8")
    batch_index = next_batch_index(COMMITS_LOG)

    # Connect to RabbitMQ.
    params = pika.ConnectionParameters(
        host=RABBIT_HOST,
        port=RABBIT_PORT,
        virtual_host=RABBIT_VHOST,
        credentials=pika.PlainCredentials(RABBIT_USER, RABBIT_PASS),
    )
    connection = pika.BlockingConnection(params)
    try:
        channel = connection.channel()
        declare_topology(channel)
        # Prefetch up to one full batch so we can pipeline a little, but not so
        # much that we hold huge amounts of unacked messages.
        channel.basic_qos(prefetch_count=batch_size)

        buffer_ids: List[str] = []
        buffer_texts: List[str] = []
        buffer_tags: List[int] = []
        written = 0
        skipped = 0
        dead_lettered = 0

        def flush() -> None:
            nonlocal written, batch_index
            if not buffer_ids:
                return
            n = len(buffer_ids)
            # 1) Durably write the batch to LanceDB.
            write_batch(table, list(buffer_ids), list(buffer_texts))
            # 2) Append the commit log line and fsync it.
            append_commit_line(log_fh, batch_index, buffer_ids)
            batch_index += 1
            written += n
            # 3) Only now ack the messages in this batch.
            for tag in buffer_tags:
                channel.basic_ack(delivery_tag=tag)
            buffer_ids.clear()
            buffer_texts.clear()
            buffer_tags.clear()

        # Drain all currently-available messages, then exit.
        while True:
            method, _properties, body = channel.basic_get(
                queue=MAIN_QUEUE, auto_ack=False
            )
            if method is None:
                # No more messages available right now -- drained.
                break

            parsed = parse_document(body)
            if parsed is None:
                # Poison message: reject without requeue so it dead-letters.
                channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
                dead_lettered += 1
                continue

            doc_id = parsed["id"]
            if doc_id in seen_ids:
                # Duplicate id -- skip storage but ack so the broker drops it.
                channel.basic_ack(delivery_tag=method.delivery_tag)
                skipped += 1
                continue

            seen_ids.add(doc_id)
            buffer_ids.append(doc_id)
            buffer_texts.append(parsed["text"])
            buffer_tags.append(method.delivery_tag)

            if len(buffer_ids) >= batch_size:
                flush()

        # Flush any partial final batch.
        flush()
    finally:
        try:
            connection.close()
        except Exception:
            pass
        try:
            log_fh.close()
        except Exception:
            pass

    print(
        f"INGEST_DONE written={written} "
        f"skipped_duplicates={skipped} "
        f"dead_lettered={dead_lettered}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())