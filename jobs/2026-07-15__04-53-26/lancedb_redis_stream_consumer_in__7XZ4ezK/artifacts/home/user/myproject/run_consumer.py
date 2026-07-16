#!/usr/bin/env python3
"""Durable Redis Stream -> LanceDB ingest consumer.

Reads embedding messages from a Redis Stream using a consumer group,
commits them durably to a LanceDB table via idempotent merge_insert on the
business `id`, acknowledges the stream entries only after the commit
succeeds, and recovers from a simulated crash by reclaiming any
previously-delivered but un-acknowledged entries on startup.
"""

from __future__ import annotations

import os
import sys

import numpy as np
import redis
from redis.exceptions import ResponseError

import lancedb


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

def _env_str(name: str, default: str | None) -> str:
    val = os.environ.get(name, default)
    if val is None or val == "":
        print(f"Missing required environment variable: {name}", file=sys.stderr)
        sys.exit(2)
    return val


def load_config() -> dict:
    return {
        "redis_host": os.environ.get("REDIS_HOST", "127.0.0.1"),
        "redis_port": int(os.environ.get("REDIS_PORT", "6379")),
        "stream_key": _env_str("STREAM_KEY", None),
        "group_name": _env_str("GROUP_NAME", None),
        "consumer_name": _env_str("CONSUMER_NAME", None),
        "lancedb_dir": _env_str("LANCEDB_DIR", None),
        "table_name": _env_str("TABLE_NAME", None),
        "batch_size": int(os.environ.get("BATCH_SIZE", "50")),
        "vector_dim": int(os.environ.get("VECTOR_DIM", "32")),
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_text(value) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8")
    return value


def _entry_to_row(fields: dict, vector_dim: int) -> dict:
    """Decode a single Redis stream entry into a LanceDB row dict.

    The entry's `id` and `text` fields are UTF-8 strings; the `vector` field
    is the raw bytes of a little-endian float32 numpy array of length
    ``vector_dim`` (as produced by ``ndarray.astype('<f4').tobytes()``).
    """
    raw_id = fields.get(b"id", fields.get("id"))
    raw_text = fields.get(b"text", fields.get("text"))
    raw_vec = fields.get(b"vector", fields.get("vector"))

    if raw_vec is None:
        raise ValueError("entry missing required field 'vector'")
    if raw_id is None:
        raise ValueError("entry missing required field 'id'")
    if raw_text is None:
        raise ValueError("entry missing required field 'text'")

    vec = np.frombuffer(raw_vec, dtype="<f4")
    if vec.shape[0] != vector_dim:
        raise ValueError(
            f"vector length mismatch: expected {vector_dim}, got {vec.shape[0]}"
        )

    return {
        "id": _to_text(raw_id),
        "text": _to_text(raw_text),
        "vector": vec.tolist(),
    }


def _normalize_cursor(cursor) -> str:
    if isinstance(cursor, bytes):
        return cursor.decode("utf-8")
    return str(cursor)


# ---------------------------------------------------------------------------
# Consumer
# ---------------------------------------------------------------------------

def run() -> int:
    cfg = load_config()

    stream_key = cfg["stream_key"]
    group_name = cfg["group_name"]
    consumer_name = cfg["consumer_name"]
    table_name = cfg["table_name"]
    lancedb_dir = cfg["lancedb_dir"]
    batch_size = cfg["batch_size"]
    vector_dim = cfg["vector_dim"]

    # ---- Redis connection ----
    r = redis.Redis(
        host=cfg["redis_host"],
        port=cfg["redis_port"],
        decode_responses=False,
    )
    r.ping()

    # ---- Ensure consumer group exists (idempotent) ----
    try:
        # id="0" means the group starts at the beginning of the stream so
        # already-existing entries are visible during recovery.
        r.xgroup_create(stream_key, group_name, id="0", mkstream=True)
    except ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise

    # ---- LanceDB connection ----
    db = lancedb.connect(lancedb_dir)
    existing = set(db.table_names())
    if table_name in existing:
        table = db.open_table(table_name)
    else:
        table = None  # lazily created from the first batch below

    # ---- Counters ----
    ingested_total = 0
    reclaimed_total = 0

    def process_batch(entries: list) -> int:
        """Commit a batch to LanceDB, then ACK to Redis.

        The LanceDB commit is what makes the operation durable; only after
        it succeeds do we acknowledge the stream entries, so that a crash
        mid-batch leaves the entries pending in Redis for redelivery.
        ``merge_insert`` keyed on ``id`` ensures the redelivered entries
        overwrite their existing row rather than duplicating it.
        """
        nonlocal table
        if not entries:
            return 0

        rows = [_entry_to_row(fields, vector_dim) for _, fields in entries]

        if table is None:
            # First batch ever — create the table from these rows so the
            # schema (id: string, text: string, vector: fixed_size_list<float32>[N])
            # is established up front.
            table = db.create_table(table_name, data=rows, mode="create")
        else:
            (
                table.merge_insert("id")
                .when_matched_update_all()
                .when_not_matched_insert_all()
                .execute(rows)
            )

        msg_ids = [msg_id for msg_id, _ in entries]
        r.xack(stream_key, group_name, *msg_ids)
        return len(entries)

    # =====================================================================
    # Phase 1: Recovery — reclaim any entries that were delivered to this
    # group/consumer but never acknowledged (e.g. because of a crash).
    # We use XAUTOCLAIM starting from 0-0 with min_idle_time=0 so that a
    # just-crashed batch is picked up immediately, regardless of which
    # consumer in the group originally received it.
    # =====================================================================
    next_id = "0-0"
    while True:
        result = r.xautoclaim(
            stream_key,
            group_name,
            consumer_name,
            min_idle_time=0,
            start_id=next_id,
            count=batch_size,
        )
        # redis-py returns [next_cursor, claimed_messages, deleted_ids]
        cursor, claimed, _deleted = result
        if claimed:
            n = process_batch(claimed)
            ingested_total += n
            reclaimed_total += n
        if _normalize_cursor(cursor) == "0-0":
            break
        next_id = _normalize_cursor(cursor)

    # =====================================================================
    # Phase 2: Drain — read any new entries delivered to this consumer,
    # commit them to LanceDB, ACK them, and exit when the stream yields
    # no more new entries. Non-blocking reads guarantee a clean drain.
    # =====================================================================
    while True:
        response = r.xreadgroup(
            group_name,
            consumer_name,
            {stream_key: ">"},
            count=batch_size,
            block=None,
        )
        # Empty / None response means there are no more new entries.
        if not response:
            break
        # response shape: [(b'stream_key', [(b'msg_id', {b'field': b'val', ...}), ...])]
        try:
            entries = response[0][1]
        except (IndexError, TypeError):
            break
        if not entries:
            break
        ingested_total += process_batch(entries)

    print(f"DONE ingested={ingested_total} reclaimed={reclaimed_total}")
    return 0


if __name__ == "__main__":
    sys.exit(run())
