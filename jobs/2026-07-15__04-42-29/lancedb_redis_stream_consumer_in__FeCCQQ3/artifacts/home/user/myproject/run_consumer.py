"""
Durable Redis Stream → LanceDB ingest consumer.

Design
------
1. Ensure the consumer group exists (MKSTREAM so the stream is auto-created).
2. RECOVER: Drain the pending-entries-list (PEL) via XAUTOCLAIM from "0-0"
   with min-idle-time=0.  This picks up any message that was delivered to
   *any* consumer in the group but never acknowledged, including those left
   behind by a previous crash.
3. INGEST new entries via XREADGROUP (">" sentinel) in batches of BATCH_SIZE.
4. For every batch (whether recovered or new):
       a. Decode each entry's fields.
       b. Upsert the batch into LanceDB (merge_insert keyed on "id").
       c. XACK all message IDs in the batch — only after the LanceDB commit.
5. When both the PEL and the live stream are exhausted, print the final
   summary line and exit 0.

Exactly-once effect
-------------------
Redis gives at-least-once delivery (a crash before XACK re-delivers the
message).  LanceDB idempotency is achieved via merge_insert / when_matched_
update_all / when_not_matched_insert_all keyed on the business "id" field, so
re-processing a re-delivered message overwrites rather than duplicates the row.

Environment variables
---------------------
REDIS_HOST      default 127.0.0.1
REDIS_PORT      default 6379
STREAM_KEY      (required)
GROUP_NAME      (required)
CONSUMER_NAME   (required)
LANCEDB_DIR     (required)  filesystem path passed to lancedb.connect()
TABLE_NAME      (required)
BATCH_SIZE      default 50
VECTOR_DIM      default 32
"""

from __future__ import annotations

import os
import sys

import lancedb
import numpy as np
import pyarrow as pa
import redis
from redis.exceptions import ResponseError

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

REDIS_HOST    = os.environ.get("REDIS_HOST", "127.0.0.1")
REDIS_PORT    = int(os.environ.get("REDIS_PORT", "6379"))
STREAM_KEY    = os.environ["STREAM_KEY"]
GROUP_NAME    = os.environ["GROUP_NAME"]
CONSUMER_NAME = os.environ["CONSUMER_NAME"]
LANCEDB_DIR   = os.environ["LANCEDB_DIR"]
TABLE_NAME    = os.environ["TABLE_NAME"]
BATCH_SIZE    = int(os.environ.get("BATCH_SIZE", "50"))
VECTOR_DIM    = int(os.environ.get("VECTOR_DIM", "32"))

# ---------------------------------------------------------------------------
# LanceDB helpers
# ---------------------------------------------------------------------------

# Fixed schema used for both table creation and every batch write.
_SCHEMA = pa.schema([
    pa.field("id",     pa.string()),
    pa.field("text",   pa.string()),
    pa.field("vector", pa.list_(pa.float32(), VECTOR_DIM)),
])


def _open_or_create_table(db: lancedb.LanceDBConnection) -> lancedb.table.LanceTable:
    """Open the LanceDB table, creating it (empty) if it does not exist."""
    existing = db.table_names()
    if TABLE_NAME in existing:
        return db.open_table(TABLE_NAME)
    return db.create_table(TABLE_NAME, schema=_SCHEMA)


def _upsert_batch(table: lancedb.table.LanceTable, rows: list[dict]) -> None:
    """
    Idempotent upsert of *rows* into *table*, keyed on the "id" column.

    - Rows whose "id" already exists are overwritten (when_matched_update_all).
    - Rows whose "id" is new are inserted (when_not_matched_insert_all).
    """
    ids     = [r["id"]     for r in rows]
    texts   = [r["text"]   for r in rows]
    vectors = [r["vector"] for r in rows]  # each is a list[float] of length VECTOR_DIM

    batch = pa.table(
        {"id": ids, "text": texts, "vector": vectors},
        schema=_SCHEMA,
    )

    (
        table.merge_insert("id")
             .when_matched_update_all()
             .when_not_matched_insert_all()
             .execute(batch)
    )


# ---------------------------------------------------------------------------
# Redis / stream entry helpers
# ---------------------------------------------------------------------------

def _ensure_group(r: redis.Redis) -> None:
    """Create the consumer group, ignoring the error if it already exists."""
    try:
        # id="0" means the group will receive all messages already in the stream.
        # MKSTREAM creates the stream key if it does not yet exist.
        r.xgroup_create(STREAM_KEY, GROUP_NAME, id="0", mkstream=True)
    except ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


def _decode_entry(fields: dict) -> dict:
    """
    Decode a raw Redis stream entry's field-value map.

    Redis-py returns field names and values as bytes when decode_responses=False
    (our default so we can handle the binary vector payload without an extra
    encoding round-trip).
    """
    entry_id  = fields[b"id"].decode("utf-8")
    text      = fields[b"text"].decode("utf-8")
    raw_vec   = fields[b"vector"]                          # raw little-endian float32 bytes
    vector    = np.frombuffer(raw_vec, dtype="<f4").tolist()
    return {"id": entry_id, "text": text, "vector": vector}


def _process_batch(
    r:     redis.Redis,
    table: lancedb.table.LanceTable,
    messages: list[tuple[bytes, dict]],  # [(stream_id, fields), ...]
) -> int:
    """Decode, upsert to LanceDB, then XACK.  Returns the number of entries committed."""
    rows       = [_decode_entry(fields) for _, fields in messages]
    stream_ids = [sid for sid, _ in messages]

    _upsert_batch(table, rows)           # commit to LanceDB first …
    r.xack(STREAM_KEY, GROUP_NAME, *stream_ids)  # … then remove from PEL

    return len(rows)


# ---------------------------------------------------------------------------
# Pending-entry recovery (crash safety)
# ---------------------------------------------------------------------------

def _recover_pending(
    r:     redis.Redis,
    table: lancedb.table.LanceTable,
) -> int:
    """
    Claim and reprocess all pending (delivered-but-not-acked) entries for this
    consumer group, regardless of which consumer originally received them.

    Uses XAUTOCLAIM with min-idle-time=0 so even a just-crashed batch is
    reclaimed immediately.  Iterates using the returned cursor until the
    stream signals "0-0" (no more pending entries).

    Returns the total number of recovered entries committed.
    """
    reclaimed = 0
    cursor    = "0-0"

    while True:
        # xautoclaim returns [next_cursor, [(stream_id, fields), ...], [deleted_ids]]
        result = r.xautoclaim(
            STREAM_KEY,
            GROUP_NAME,
            CONSUMER_NAME,
            min_idle_time=0,    # reclaim immediately, regardless of idle age
            start_id=cursor,
            count=BATCH_SIZE,
        )
        next_cursor: bytes          = result[0]
        claimed_messages: list      = result[1]
        # result[2] is a list of stream IDs that were in the PEL but whose
        # backing stream entry was deleted — we can safely ignore them.

        if claimed_messages:
            reclaimed += _process_batch(r, table, claimed_messages)

        # When XAUTOCLAIM has scanned the whole PEL it returns b"0-0".
        if next_cursor in (b"0-0", "0-0"):
            break
        cursor = next_cursor

    return reclaimed


# ---------------------------------------------------------------------------
# Live consumption of new entries
# ---------------------------------------------------------------------------

def _consume_new(
    r:     redis.Redis,
    table: lancedb.table.LanceTable,
) -> int:
    """
    Read and process new (never-before-delivered) stream entries via XREADGROUP
    using the ">" special ID, which means "give me only entries not yet
    delivered to any consumer in this group".

    Loops until the stream is empty for this group (no new entries), then
    returns the total number of entries committed.
    """
    ingested = 0

    while True:
        # XREADGROUP with ">" delivers new, undelivered entries.
        # block=None means non-blocking (no BLOCK argument sent to Redis);
        # block=0 would mean "block indefinitely", which we do NOT want.
        response = r.xreadgroup(
            GROUP_NAME,
            CONSUMER_NAME,
            {STREAM_KEY: ">"},
            count=BATCH_SIZE,
            block=None,
        )

        # response is None or [] when the stream has no new entries.
        if not response:
            break

        # response: [(stream_key_bytes, [(stream_id, fields), ...])]
        for _stream_key, messages in response:
            if not messages:
                # An empty message list means the stream is currently drained.
                return ingested
            ingested += _process_batch(r, table, messages)

    return ingested


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    # --- Connect to Redis (binary-safe, no decode_responses) ---
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT)

    # --- Connect to / create LanceDB table ---
    db    = lancedb.connect(LANCEDB_DIR)
    table = _open_or_create_table(db)

    # --- Ensure consumer group exists ---
    _ensure_group(r)

    # --- Phase 1: recover any un-acked entries left by a previous crash ---
    reclaimed = _recover_pending(r, table)

    # --- Phase 2: consume all currently available new entries ---
    new_ingested = _consume_new(r, table)

    ingested = reclaimed + new_ingested

    # Final summary line (machine-parseable for test harnesses)
    print(f"DONE ingested={ingested} reclaimed={reclaimed}")
    sys.exit(0)


if __name__ == "__main__":
    main()
