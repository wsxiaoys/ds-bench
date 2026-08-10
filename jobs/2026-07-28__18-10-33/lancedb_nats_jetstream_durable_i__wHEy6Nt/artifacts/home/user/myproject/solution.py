"""
Durable exactly-once-effect indexer.

Consumes documents from a NATS JetStream stream via a durable pull consumer
and upserts them into a LanceDB table, keyed by document `id`, so that
redelivered / duplicate messages never create duplicate rows.

The public entry point is the async coroutine `run_indexer(max_messages=None)`.
Each call:
  * opens its own NATS connection (simulating an independent worker run /
    restart),
  * ensures the JetStream stream and durable pull consumer exist (creating
    them on first use, binding to them on subsequent runs so consumer
    position is resumed from the server),
  * fetches messages in batches, committing each batch to LanceDB via
    `merge_insert("id")` (matched -> update, not matched -> insert) *before*
    acknowledging the messages in that batch,
  * stops once `max_messages` messages have been committed+acked (if given),
    or once no more messages are currently available,
  * closes the NATS connection and returns {"committed": <int>}.
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Optional

import nats
import nats.errors
import nats.js.errors
import pyarrow as pa
from nats.js import api as js_api

import lancedb

VECTOR_DIM = 32

# Errors that mean "no messages currently available" when calling fetch().
_FETCH_EMPTY_ERRORS = (
    nats.errors.TimeoutError,
    nats.js.errors.FetchTimeoutError,
    asyncio.TimeoutError,
)


def _schema() -> pa.Schema:
    return pa.schema(
        [
            pa.field("id", pa.int64()),
            pa.field("text", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), VECTOR_DIM)),
        ]
    )


def _open_table(db_path: str, table_name: str):
    db = lancedb.connect(db_path)
    return db.create_table(table_name, schema=_schema(), exist_ok=True)


def _rows_to_arrow(rows: list[dict[str, Any]]) -> pa.Table:
    ids = [int(r["id"]) for r in rows]
    texts = [str(r["text"]) for r in rows]
    vectors = [[float(x) for x in r["vector"]] for r in rows]
    return pa.table(
        {
            "id": pa.array(ids, type=pa.int64()),
            "text": pa.array(texts, type=pa.string()),
            "vector": pa.array(vectors, type=pa.list_(pa.float32(), VECTOR_DIM)),
        },
        schema=_schema(),
    )


async def _ensure_stream(js, stream: str, subject: str) -> None:
    try:
        await js.add_stream(name=stream, subjects=[subject])
    except Exception:
        # Stream likely already exists (race / prior run). Make sure it's
        # really there; otherwise, re-raise the original problem.
        await js.stream_info(stream)


async def run_indexer(max_messages: Optional[int] = None) -> dict[str, int]:
    nats_url = os.environ["NATS_URL"]
    stream = os.environ["JS_STREAM"]
    subject = os.environ["JS_SUBJECT"]
    durable = os.environ["JS_DURABLE"]
    lancedb_path = os.environ["LANCEDB_PATH"]
    batch_size_cfg = max(1, int(os.environ.get("INDEX_BATCH_SIZE", "10")))
    run_id = os.environ["ZEALT_RUN_ID"]
    table_name = f"documents_{run_id}"

    nc = await nats.connect(nats_url)
    committed = 0
    try:
        js = nc.jetstream()

        await _ensure_stream(js, stream, subject)

        # Creates the durable pull consumer on first call, binds to the
        # existing one (resuming from its stored ack floor) on later calls.
        sub = await js.pull_subscribe(
            subject,
            durable=durable,
            stream=stream,
            config=js_api.ConsumerConfig(
                ack_policy=js_api.AckPolicy.EXPLICIT,
                deliver_policy=js_api.DeliverPolicy.ALL,
            ),
        )

        table = _open_table(lancedb_path, table_name)

        while True:
            if max_messages is not None:
                remaining = max_messages - committed
                if remaining <= 0:
                    break
                batch = min(batch_size_cfg, remaining)
            else:
                batch = batch_size_cfg

            try:
                msgs = await sub.fetch(batch, timeout=2)
            except _FETCH_EMPTY_ERRORS:
                break

            if not msgs:
                break

            rows: list[dict[str, Any]] = []
            for m in msgs:
                payload = json.loads(m.data.decode("utf-8"))
                rows.append(
                    {
                        "id": payload["id"],
                        "text": payload["text"],
                        "vector": payload["vector"],
                    }
                )

            # De-duplicate within the batch itself (keep the last copy),
            # so a merge_insert never sees the same id twice in one call.
            deduped: dict[int, dict[str, Any]] = {}
            for r in rows:
                deduped[int(r["id"])] = r
            data = _rows_to_arrow(list(deduped.values()))

            # Commit to LanceDB *before* acking, so a crash between commit
            # and ack simply results in (harmless, idempotent) redelivery.
            (
                table.merge_insert("id")
                .when_matched_update_all()
                .when_not_matched_insert_all()
                .execute(data)
            )

            for m in msgs:
                await m.ack()

            committed += len(msgs)

            if max_messages is not None and committed >= max_messages:
                break
    finally:
        await nc.close()

    return {"committed": committed}
