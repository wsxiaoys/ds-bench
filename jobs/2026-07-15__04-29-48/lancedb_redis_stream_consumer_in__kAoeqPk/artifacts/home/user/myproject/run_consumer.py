#!/usr/bin/env python3
"""Durable Redis Stream -> LanceDB ingest consumer.

Reads embedding messages from a Redis Stream using a consumer group
(`XREADGROUP`) and writes them into a LanceDB table with exactly-once
effect via an idempotent upsert keyed on the business `id`.

Crash-safety is provided by only acknowledging (`XACK`) a batch *after*
the LanceDB commit for that batch has succeeded. On startup, any
previously-delivered-but-un-acknowledged messages for this group/consumer
are reclaimed via `XAUTOCLAIM` (starting from `0-0` with a zero
minimum-idle-time) and reprocessed, so a crash mid-batch loses nothing.

The script is rerunnable: keep consuming until the stream yields no new
entries, then exit with status 0 and print a single final summary line.
"""

import os
import sys

import numpy as np
import pyarrow as pa
import redis
import lancedb


def get_config():
    """Read all configuration from environment variables."""
    return {
        "redis_host": os.environ.get("REDIS_HOST", "127.0.0.1"),
        "redis_port": int(os.environ.get("REDIS_PORT", "6379")),
        "stream_key": os.environ.get("STREAM_KEY", "embeddings"),
        "group_name": os.environ.get("GROUP_NAME", "ingest_group"),
        "consumer_name": os.environ.get("CONSUMER_NAME", "consumer-1"),
        "lancedb_dir": os.environ.get("LANCEDB_DIR", "./lancedb"),
        "table_name": os.environ.get("TABLE_NAME", "embeddings"),
        "batch_size": int(os.environ.get("BATCH_SIZE", "50")),
        "vector_dim": int(os.environ.get("VECTOR_DIM", "32")),
    }


def decode_entry(entry_id, fields, vector_dim):
    """Decode a single Redis Stream entry into a LanceDB row dict.

    Each entry has exactly three fields: `id` (UTF-8 business id), `vector`
    (raw bytes of a little-endian float32 numpy array of length VECTOR_DIM),
    and `text` (UTF-8 text).
    """
    # Fields come back as bytes when decode_responses=False.
    def _str(v):
        if isinstance(v, bytes):
            return v.decode("utf-8")
        return v

    raw_vector = fields[b"vector"] if b"vector" in fields else fields["vector"]
    vector = np.frombuffer(raw_vector, dtype="<f4")
    # Ensure the vector has the expected length; pad/trim defensively.
    if vector.size != vector_dim:
        raise ValueError(
            f"vector length mismatch for id={_str(fields.get(b'id', fields.get('id')))}: "
            f"got {vector.size}, expected {vector_dim}"
        )
    return {
        "id": _str(fields[b"id"] if b"id" in fields else fields["id"]),
        "text": _str(fields[b"text"] if b"text" in fields else fields["text"]),
        "vector": vector.tolist(),
    }


def ensure_group(r, stream_key, group_name):
    """Ensure the consumer group exists, creating the stream if needed.

    Ignores the BUSYGROUP error raised when the group already exists.
    """
    try:
        # Start at "0" so the first creation picks up all entries already
        # present in the stream (a drain consumer). If the group already
        # exists, BUSYGROUP is ignored and the existing position is kept.
        r.xgroup_create(stream_key, group_name, id="0", mkstream=True)
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" in str(e):
            return
        raise


def open_or_create_table(cfg):
    """Open the LanceDB table if it exists, otherwise create it with the
    fixed schema (id string, text string, vector fixed-size float32 list)."""
    db = lancedb.connect(cfg["lancedb_dir"])
    table_name = cfg["table_name"]
    existing = set(db.table_names())
    if table_name in existing:
        return db.open_table(table_name)

    schema = pa.schema(
        [
            pa.field("id", pa.string()),
            pa.field("text", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), cfg["vector_dim"])),
        ]
    )
    return db.create_table(table_name, schema=schema)


def upsert_rows(table, rows):
    """Idempotent upsert keyed on `id`: update matched rows, insert unmatched.

    This guarantees exactly-once effect for re-delivered messages.
    """
    if not rows:
        return
    (
        table.merge_insert("id")
        .when_matched_update_all()
        .when_not_matched_insert_all()
        .execute(rows)
    )


def ack_ids(r, stream_key, group_name, entry_ids):
    """Acknowledge a list of stream entry ids."""
    if not entry_ids:
        return
    r.xack(stream_key, group_name, *entry_ids)


def reclaim_pending(r, cfg, table, vector_dim):
    """Recover previously-delivered-but-un-acknowledged messages via XAUTOCLAIM.

    Claims start from `0-0` with a zero minimum-idle-time so a just-crashed
    batch is picked up immediately. Each claimed batch is committed to
    LanceDB before being acknowledged.

    Returns the number of reclaimed entries processed.
    """
    stream_key = cfg["stream_key"]
    group_name = cfg["group_name"]
    consumer_name = cfg["consumer_name"]
    batch_size = cfg["batch_size"]

    reclaimed = 0
    start_id = b"0-0"

    while True:
        # XAUTOCLAIM signature: (name, groupname, consumername, min_idle_time,
        #                        start_id, count)
        # Returns: [next_start_id, [(entry_id, {fields...}), ...], [deleted_ids...]]
        next_id, claimed, _deleted = r.xautoclaim(
            stream_key,
            group_name,
            consumer_name,
            min_idle_time=0,
            start_id=start_id,
            count=batch_size,
        )

        if claimed:
            rows = []
            entry_ids = []
            for entry_id, fields in claimed:
                rows.append(decode_entry(entry_id, fields, vector_dim))
                entry_ids.append(entry_id)

            # Commit to LanceDB first (at-least-once), then ack.
            upsert_rows(table, rows)
            ack_ids(r, stream_key, group_name, entry_ids)
            reclaimed += len(rows)

        # Continue reclaiming from where the server told us to, until there
        # is nothing more to claim.
        if not claimed:
            # No messages claimed in this round. If the server returned the
            # terminal `0-0` cursor the PEL is fully drained.
            nid = next_id
            if isinstance(nid, bytes):
                nid = nid.decode("utf-8")
            if nid == "0-0":
                break
            # Otherwise advance the cursor and try again.
            start_id = next_id
            continue

        start_id = next_id

    return reclaimed


def drain_new(r, cfg, table, vector_dim):
    """Read new stream entries via XREADGROUP until the stream is empty.

    Returns the number of new entries committed this run.
    """
    stream_key = cfg["stream_key"]
    group_name = cfg["group_name"]
    consumer_name = cfg["consumer_name"]
    batch_size = cfg["batch_size"]

    ingested_new = 0

    while True:
        # Non-blocking read: `>` returns only entries never delivered to any
        # consumer in the group. Returns immediately with whatever is
        # available, so we can detect an empty stream and exit.
        resp = r.xreadgroup(
            group_name,
            consumer_name,
            {stream_key: ">"},
            count=batch_size,
        )

        if not resp:
            # No new entries available -> stream drained.
            break

        # resp is a list of [stream_name, [(entry_id, {fields}), ...]]
        for _stream_name, entries in resp:
            rows = []
            entry_ids = []
            for entry_id, fields in entries:
                rows.append(decode_entry(entry_id, fields, vector_dim))
                entry_ids.append(entry_id)

            upsert_rows(table, rows)
            ack_ids(r, stream_key, group_name, entry_ids)
            ingested_new += len(rows)

    return ingested_new


def main():
    cfg = get_config()
    vector_dim = cfg["vector_dim"]

    r = redis.Redis(host=cfg["redis_host"], port=cfg["redis_port"], decode_responses=False)

    ensure_group(r, cfg["stream_key"], cfg["group_name"])

    table = open_or_create_table(cfg)

    # 1) Recover any messages left pending from a previous crash.
    reclaimed = reclaim_pending(r, cfg, table, vector_dim)

    # 2) Drain newly-available messages.
    ingested_new = drain_new(r, cfg, table, vector_dim)

    # `ingested` is the total committed this run, including reclaimed ones.
    ingested = ingested_new + reclaimed

    print(f"DONE ingested={ingested} reclaimed={reclaimed}")
    sys.exit(0)


if __name__ == "__main__":
    main()