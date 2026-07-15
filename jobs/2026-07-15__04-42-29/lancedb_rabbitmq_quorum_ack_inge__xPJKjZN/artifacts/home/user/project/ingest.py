"""
RabbitMQ -> LanceDB ingestion worker.

Drains the `documents` quorum queue, deduplicates by document id,
embeds text with a deterministic 64-dim float32 embedding, and
writes rows in batches to a LanceDB table.  Poison messages are
dead-lettered (nack, requeue=False).  Exits when the queue is empty.

Usage:
    python3 ingest.py
Environment:
    INGEST_BATCH_SIZE  – rows per LanceDB write batch (default 16)
"""

import hashlib
import json
import os
import sys
import warnings

import numpy as np
import pyarrow as pa
import pika
import lancedb

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
RABBITMQ_HOST = "localhost"
RABBITMQ_PORT = 5672
RABBITMQ_VHOST = "/"
RABBITMQ_USER = "guest"
RABBITMQ_PASS = "guest"

MAIN_QUEUE = "documents"
DLX_EXCHANGE = "documents.dlx"
DLQ_QUEUE = "documents.dlq"

LANCEDB_DIR = "/home/user/project/data/lancedb"
TABLE_NAME = "documents"
COMMITS_LOG = "/home/user/project/data/commits.log"

BATCH_SIZE = int(os.environ.get("INGEST_BATCH_SIZE", "16"))

# ---------------------------------------------------------------------------
# Deterministic 64-dim embedding
# ---------------------------------------------------------------------------
_TOKEN_RE = __import__("re").compile(r"[a-z0-9]+")


def embed(text: str) -> np.ndarray:
    """Deterministic 64-dim float32 embedding (spec §Deterministic embedding)."""
    tokens = _TOKEN_RE.findall(text.lower())
    vec = np.zeros(64, dtype=np.float64)
    for token in tokens:
        idx = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16) % 64
        vec[idx] += 1.0
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec /= norm
    return vec.astype(np.float32)


# ---------------------------------------------------------------------------
# LanceDB helpers
# ---------------------------------------------------------------------------
_SCHEMA = pa.schema([
    pa.field("id", pa.string()),
    pa.field("text", pa.string()),
    pa.field("vector", pa.list_(pa.float32(), 64)),
])


def open_or_create_table(db: lancedb.DBConnection) -> lancedb.table.Table:
    """Open the documents table, creating it (empty) if it does not exist."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        existing = db.table_names()
    if TABLE_NAME in existing:
        return db.open_table(TABLE_NAME)
    # Create with an empty PyArrow table so the schema is set correctly.
    empty = pa.table(
        {
            "id": pa.array([], type=pa.string()),
            "text": pa.array([], type=pa.string()),
            "vector": pa.array([], type=pa.list_(pa.float32(), 64)),
        },
        schema=_SCHEMA,
    )
    return db.create_table(TABLE_NAME, data=empty, schema=_SCHEMA)


def load_existing_ids(table: lancedb.table.Table) -> set:
    """Return the set of all ids already stored in LanceDB."""
    try:
        arrow_tbl = table.to_arrow()
        return set(arrow_tbl.column("id").to_pylist())
    except Exception:
        return set()


# ---------------------------------------------------------------------------
# Commits log helpers
# ---------------------------------------------------------------------------
def read_next_batch_index() -> int:
    """Return the next batch_index value (0 on fresh file, max+1 otherwise)."""
    if not os.path.exists(COMMITS_LOG):
        return 0
    max_idx = -1
    try:
        with open(COMMITS_LOG, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                    max_idx = max(max_idx, int(obj["batch_index"]))
                except Exception:
                    pass
    except OSError:
        pass
    return max_idx + 1


def append_commit(batch_index: int, ids: list[str]) -> None:
    """Append one JSON line to the commits log."""
    record = json.dumps({"batch_index": batch_index, "ids": ids}, ensure_ascii=False)
    with open(COMMITS_LOG, "a", encoding="utf-8") as fh:
        fh.write(record + "\n")


# ---------------------------------------------------------------------------
# Poison-message validation
# ---------------------------------------------------------------------------
def parse_document(body: bytes):
    """
    Return (doc_dict, None) on success or (None, reason_str) for poison msgs.
    A valid document is a JSON object with non-empty string `id` and `text`.
    """
    try:
        text = body.decode("utf-8")
    except (UnicodeDecodeError, AttributeError):
        return None, "not valid UTF-8"

    try:
        doc = json.loads(text)
    except json.JSONDecodeError:
        return None, "not valid JSON"

    if not isinstance(doc, dict):
        return None, "JSON value is not an object"

    doc_id = doc.get("id")
    if not isinstance(doc_id, str) or not doc_id:
        return None, "missing or empty string 'id'"

    doc_text = doc.get("text")
    if not isinstance(doc_text, str) or not doc_text:
        return None, "missing or empty string 'text'"

    return doc, None


# ---------------------------------------------------------------------------
# RabbitMQ topology
# ---------------------------------------------------------------------------
def declare_topology(channel: pika.adapters.blocking_connection.BlockingChannel) -> None:
    """Idempotently declare the exchange, queues and binding."""
    # Dead-letter exchange (fanout, durable)
    channel.exchange_declare(
        exchange=DLX_EXCHANGE,
        exchange_type="fanout",
        durable=True,
    )

    # Main quorum queue with DLX configured
    channel.queue_declare(
        queue=MAIN_QUEUE,
        durable=True,
        arguments={
            "x-queue-type": "quorum",
            "x-dead-letter-exchange": DLX_EXCHANGE,
        },
    )

    # Dead-letter quorum queue
    channel.queue_declare(
        queue=DLQ_QUEUE,
        durable=True,
        arguments={
            "x-queue-type": "quorum",
        },
    )

    # Bind DLQ to DLX (fanout – routing key ignored)
    channel.queue_bind(
        queue=DLQ_QUEUE,
        exchange=DLX_EXCHANGE,
    )


# ---------------------------------------------------------------------------
# Main ingestion logic
# ---------------------------------------------------------------------------
def run() -> None:
    # --- LanceDB setup -------------------------------------------------
    db = lancedb.connect(LANCEDB_DIR)
    table = open_or_create_table(db)
    existing_ids: set = load_existing_ids(table)
    seen_this_run: set = set()   # in-run dedup for within-batch duplicates

    # --- RabbitMQ setup ------------------------------------------------
    credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
    params = pika.ConnectionParameters(
        host=RABBITMQ_HOST,
        port=RABBITMQ_PORT,
        virtual_host=RABBITMQ_VHOST,
        credentials=credentials,
    )
    connection = pika.BlockingConnection(params)
    channel = connection.channel()
    channel.basic_qos(prefetch_count=BATCH_SIZE)

    declare_topology(channel)

    # --- Counters & batch state ----------------------------------------
    written_total = 0
    skipped_dup = 0
    dead_lettered = 0

    batch_buffer: list[dict] = []          # pending rows (each has id/text/vector)
    pending_ack_tags: list[int] = []       # delivery tags for rows in batch_buffer
    pending_dup_tags: list[int] = []       # delivery tags for duplicates (ack after batch)
    next_batch_index = read_next_batch_index()

    # --- Drain loop ----------------------------------------------------
    while True:
        method, properties, body = channel.basic_get(queue=MAIN_QUEUE, auto_ack=False)
        if method is None:
            # Queue is empty – flush whatever remains
            break

        doc, poison_reason = parse_document(body)

        if poison_reason is not None:
            # Dead-letter the poison message immediately
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            dead_lettered += 1
            continue

        doc_id: str = doc["id"]
        doc_text: str = doc["text"]

        # Dedup check: already in LanceDB or seen earlier this run?
        if doc_id in existing_ids or doc_id in seen_this_run:
            # Acknowledge duplicate right away (no value in holding it)
            channel.basic_ack(delivery_tag=method.delivery_tag)
            skipped_dup += 1
            continue

        # New document – buffer it
        seen_this_run.add(doc_id)
        vector = embed(doc_text)
        batch_buffer.append({"id": doc_id, "text": doc_text, "vector": vector})
        pending_ack_tags.append(method.delivery_tag)

        # Flush when batch is full
        if len(batch_buffer) >= BATCH_SIZE:
            _flush_batch(
                table,
                batch_buffer,
                pending_ack_tags,
                channel,
                next_batch_index,
            )
            written_total += len(batch_buffer)
            next_batch_index += 1
            batch_buffer = []
            pending_ack_tags = []

    # Flush any partial final batch
    if batch_buffer:
        _flush_batch(
            table,
            batch_buffer,
            pending_ack_tags,
            channel,
            next_batch_index,
        )
        written_total += len(batch_buffer)

    connection.close()

    # --- Summary line --------------------------------------------------
    print(
        f"INGEST_DONE written={written_total} "
        f"skipped_duplicates={skipped_dup} "
        f"dead_lettered={dead_lettered}"
    )


def _flush_batch(
    table: lancedb.table.Table,
    rows: list[dict],
    delivery_tags: list[int],
    channel: pika.adapters.blocking_connection.BlockingChannel,
    batch_index: int,
) -> None:
    """
    Write *rows* to LanceDB, append to the commits log, then ack all delivery
    tags.  The ack is sent only after the durable write has succeeded.
    """
    ids = [r["id"] for r in rows]
    vectors = [r["vector"].tolist() for r in rows]
    texts = [r["text"] for r in rows]

    pa_batch = pa.table(
        {
            "id": pa.array(ids, type=pa.string()),
            "text": pa.array(texts, type=pa.string()),
            "vector": pa.array(vectors, type=pa.list_(pa.float32(), 64)),
        },
        schema=_SCHEMA,
    )
    table.add(pa_batch)

    # Append commit log entry
    append_commit(batch_index, ids)

    # Acknowledge all messages in this batch
    for tag in delivery_tags:
        channel.basic_ack(delivery_tag=tag)


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    run()
