#!/usr/bin/env python3
"""
RabbitMQ -> LanceDB Ingestion Worker

Consumes documents from a durable quorum queue using manual acknowledgement,
deduplicates by document id, embeds text with a deterministic local embedding,
and stores rows durably in a LanceDB table in batches.  Poison messages are
dead-lettered.  The worker drains all currently-available messages then exits.
"""

import hashlib
import json
import os
import re
import sys

import numpy as np
import pyarrow as pa
import lancedb
import pika

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

RABBITMQ_HOST = "localhost"
RABBITMQ_PORT = 5672
RABBITMQ_VHOST = "/"
RABBITMQ_USER = "guest"
RABBITMQ_PASS = "guest"

PROJECT_DIR = "/home/user/project"
DATA_DIR = os.path.join(PROJECT_DIR, "data")
LANCEDB_DIR = os.path.join(DATA_DIR, "lancedb")
COMMITS_LOG = os.path.join(DATA_DIR, "commits.log")
TABLE_NAME = "documents"

QUEUE_NAME = "documents"
DLX_NAME = "documents.dlx"
DLQ_NAME = "documents.dlq"

VECTOR_DIM = 64


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_batch_size():
    """Read batch size from INGEST_BATCH_SIZE env var (default 16, min 1)."""
    try:
        size = int(os.environ.get("INGEST_BATCH_SIZE", "16"))
    except (TypeError, ValueError):
        size = 16
    return max(1, size)


def embed(text):
    """
    Deterministic 64-dim float32 embedding.

    1. Lowercase the text and extract tokens matching [a-z0-9]+.
    2. Start with a zero vector of length 64.
    3. For each token compute idx = md5(token) % 64 and add 1.0 to vector[idx].
    4. L2-normalize if the norm is greater than 0.
    """
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    vector = np.zeros(VECTOR_DIM, dtype=np.float32)
    for token in tokens:
        idx = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16) % VECTOR_DIM
        vector[idx] += 1.0
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
    return vector


# ---------------------------------------------------------------------------
# Broker topology
# ---------------------------------------------------------------------------

def setup_broker(channel):
    """Declare the DLX, DLQ, and main queue idempotently."""
    # Dead-letter exchange (fanout, durable)
    channel.exchange_declare(
        exchange=DLX_NAME,
        exchange_type="fanout",
        durable=True,
    )

    # Dead-letter queue (durable, quorum)
    channel.queue_declare(
        queue=DLQ_NAME,
        durable=True,
        arguments={"x-queue-type": "quorum"},
    )

    # Bind DLQ to DLX (fanout — routing key is ignored)
    channel.queue_bind(exchange=DLX_NAME, queue=DLQ_NAME)

    # Main queue (durable, quorum, dead-letter to DLX)
    channel.queue_declare(
        queue=QUEUE_NAME,
        durable=True,
        arguments={
            "x-queue-type": "quorum",
            "x-dead-letter-exchange": DLX_NAME,
        },
    )


# ---------------------------------------------------------------------------
# LanceDB helpers
# ---------------------------------------------------------------------------

def setup_lancedb():
    """Connect to LanceDB and create/open the documents table."""
    os.makedirs(LANCEDB_DIR, exist_ok=True)
    db = lancedb.connect(LANCEDB_DIR)

    schema = pa.schema([
        pa.field("id", pa.string()),
        pa.field("text", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), VECTOR_DIM)),
    ])

    try:
        existing = db.list_tables().tables
    except Exception:
        existing = db.table_names()
    if TABLE_NAME in existing:
        tbl = db.open_table(TABLE_NAME)
    else:
        tbl = db.create_table(TABLE_NAME, schema=schema)

    return db, tbl


def load_existing_ids(tbl):
    """Return a set of all document ids already stored in LanceDB."""
    if tbl.count_rows() == 0:
        return set()
    data = tbl.to_arrow()
    return set(data["id"].to_pylist())


# ---------------------------------------------------------------------------
# Commit log helpers
# ---------------------------------------------------------------------------

def get_next_batch_index():
    """Return the next batch_index for the commit log (0 on fresh file)."""
    if not os.path.exists(COMMITS_LOG):
        return 0
    with open(COMMITS_LOG, "r", encoding="utf-8") as f:
        return sum(1 for line in f if line.strip())


def append_commit_log(batch_index, ids):
    """Append one JSON line to the commit log after a durable write."""
    entry = {"batch_index": batch_index, "ids": ids}
    with open(COMMITS_LOG, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


# ---------------------------------------------------------------------------
# Batch write
# ---------------------------------------------------------------------------

def write_batch(tbl, batch, batch_index):
    """
    Durably write a batch of documents to LanceDB, then record the commit.

    Each element of *batch* is a tuple:
        (delivery_tag, doc_id, doc_text, vector)
    """
    rows = [
        {
            "id": doc_id,
            "text": doc_text,
            "vector": vector.tolist(),
        }
        for (_, doc_id, doc_text, vector) in batch
    ]
    tbl.add(rows)

    ids = [doc_id for (_, doc_id, _, _) in batch]
    append_commit_log(batch_index, ids)


# ---------------------------------------------------------------------------
# Message validation
# ---------------------------------------------------------------------------

def parse_document(body):
    """
    Attempt to parse *body* as a valid document.

    Returns (True, doc)  if the body is a valid document.
    Returns (False, None) if the body is a poison message.
    """
    # Must be valid UTF-8 JSON
    try:
        decoded = body.decode("utf-8")
        doc = json.loads(decoded)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError):
        return False, None

    # Must be a JSON object
    if not isinstance(doc, dict):
        return False, None

    # Must have non-empty string id
    doc_id = doc.get("id")
    if not isinstance(doc_id, str) or not doc_id:
        return False, None

    # Must have non-empty string text
    doc_text = doc.get("text")
    if not isinstance(doc_text, str) or not doc_text:
        return False, None

    return True, doc


# ---------------------------------------------------------------------------
# Main ingestion loop
# ---------------------------------------------------------------------------

def main():
    batch_size = get_batch_size()
    os.makedirs(DATA_DIR, exist_ok=True)

    # --- LanceDB setup ---
    _db, tbl = setup_lancedb()
    seen_ids = load_existing_ids(tbl)
    batch_index = get_next_batch_index()

    # --- RabbitMQ setup ---
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(
            host=RABBITMQ_HOST,
            port=RABBITMQ_PORT,
            virtual_host=RABBITMQ_VHOST,
            credentials=credentials,
        )
    )
    channel = connection.channel()
    setup_broker(channel)

    written = 0
    skipped = 0
    dead_lettered = 0

    # Each batch element: (delivery_tag, doc_id, doc_text, vector)
    batch = []

    try:
        while True:
            method, _properties, body = channel.basic_get(
                queue=QUEUE_NAME, auto_ack=False
            )

            # No more messages available — done draining.
            if method is None:
                break

            delivery_tag = method.delivery_tag

            # --- Validate ---
            is_valid, doc = parse_document(body)
            if not is_valid:
                # Poison message: dead-letter it, never write to LanceDB.
                channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
                dead_lettered += 1
                continue

            doc_id = doc["id"]
            doc_text = doc["text"]

            # --- Deduplicate ---
            if doc_id in seen_ids:
                channel.basic_ack(delivery_tag=delivery_tag)
                skipped += 1
                continue

            # --- New document: embed and buffer ---
            vector = embed(doc_text)
            batch.append((delivery_tag, doc_id, doc_text, vector))
            seen_ids.add(doc_id)

            # --- Flush full batch ---
            if len(batch) >= batch_size:
                write_batch(tbl, batch, batch_index)
                for tag, _, _, _ in batch:
                    channel.basic_ack(delivery_tag=tag)
                written += len(batch)
                batch_index += 1
                batch = []

        # --- Flush partial final batch ---
        if batch:
            write_batch(tbl, batch, batch_index)
            for tag, _, _, _ in batch:
                channel.basic_ack(delivery_tag=tag)
            written += len(batch)
            batch_index += 1
            batch = []

    finally:
        connection.close()

    # --- Summary ---
    print(
        f"INGEST_DONE written={written} "
        f"skipped_duplicates={skipped} "
        f"dead_lettered={dead_lettered}"
    )


if __name__ == "__main__":
    main()