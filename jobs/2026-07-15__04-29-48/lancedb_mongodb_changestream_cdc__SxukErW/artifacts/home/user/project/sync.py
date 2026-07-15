#!/usr/bin/env python3
"""
MongoDB Change Stream -> LanceDB CDC Synchronizer.

Tails the MongoDB change stream for the ``cdc.documents`` collection and
incrementally applies inserts, updates, replacements and deletes to a LanceDB
table so that the LanceDB table stays in sync with MongoDB.

A MongoDB resume token is persisted to ``resume_token.json`` after every run so
that a restart resumes exactly where the previous run stopped.

The command processes only the change events that are currently available and
then exits (non-blocking drain). It takes no arguments and is safely
re-runnable.
"""

import hashlib
import json
import os

import numpy as np
import pyarrow as pa
import lancedb
import pymongo

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_DIR = "/home/user/project"
LANCEDB_DIR = os.path.join(PROJECT_DIR, "lancedb")
RESUME_TOKEN_PATH = os.path.join(PROJECT_DIR, "resume_token.json")
TABLE_NAME = "documents"

MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/?replicaSet=rs0")
MONGO_DB = "cdc"
MONGO_COLL = "documents"

VECTOR_DIM = 8

# LanceDB table schema: id, text, category, vector (fixed-size list of 8 float32)
SCHEMA = pa.schema(
    [
        pa.field("id", pa.string()),
        pa.field("text", pa.string()),
        pa.field("category", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), VECTOR_DIM)),
    ]
)


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------
def compute_embedding(text: str) -> np.ndarray:
    """Compute the 8-dim float32 embedding for ``text``.

    Take the SHA-256 digest of the UTF-8 bytes of ``text``, take the first 8
    bytes of that digest, and produce the 8-dimensional float32 vector whose
    component ``i`` equals ``byte[i] / 255.0``.
    """
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return np.array(
        [digest[i] / 255.0 for i in range(VECTOR_DIM)], dtype=np.float32
    )


# ---------------------------------------------------------------------------
# LanceDB helpers
# ---------------------------------------------------------------------------
def get_or_create_table():
    """Open the LanceDB table, creating it (with the exact schema) if absent."""
    db = lancedb.connect(LANCEDB_DIR)
    existing = set(db.list_tables().tables)
    if TABLE_NAME in existing:
        return db.open_table(TABLE_NAME)
    return db.create_table(TABLE_NAME, schema=SCHEMA)


def _to_arrow_table(rows):
    """Build a pyarrow Table with the exact schema from a list of row dicts.

    ``rows`` is a list of dicts with keys ``id``, ``text``, ``category`` and
    ``vector`` (a numpy float32 array of length 8). The ``vector`` column is
    built as a fixed-size list of 8 float32 values so it matches the table
    schema exactly.
    """
    ids = pa.array([r["id"] for r in rows], type=pa.string())
    texts = pa.array([r["text"] for r in rows], type=pa.string())
    categories = pa.array([r["category"] for r in rows], type=pa.string())

    # Flatten all vector components into a single float32 array and view it as
    # a fixed-size list of length VECTOR_DIM.
    flat = np.concatenate([np.asarray(r["vector"], dtype=np.float32) for r in rows])
    vectors = pa.FixedSizeListArray.from_arrays(
        pa.array(flat, type=pa.float32()), VECTOR_DIM
    )

    return pa.Table.from_arrays([ids, texts, categories, vectors], schema=SCHEMA)


def upsert_rows(table, rows):
    """Upsert rows into LanceDB keyed by the ``id`` column."""
    if not rows:
        return
    data = _to_arrow_table(rows)
    (
        table.merge_insert(on="id")
        .when_matched_update_all()
        .when_not_matched_insert_all()
        .execute(data)
    )


def _sql_escape(value: str) -> str:
    """Escape a string literal for use in a LanceDB SQL filter."""
    return value.replace("'", "''")


def delete_rows(table, doc_ids):
    """Remove rows from LanceDB whose ``id`` is in ``doc_ids``."""
    if not doc_ids:
        return
    # Use an IN list so all deletes happen in one operation. Deletion is
    # idempotent: missing ids simply match nothing.
    quoted = ", ".join("'{}'".format(_sql_escape(d)) for d in doc_ids)
    table.delete("id IN ({})".format(quoted))


# ---------------------------------------------------------------------------
# Resume token persistence
# ---------------------------------------------------------------------------
def load_resume_token():
    """Return the saved resume token dict, or None if none exists."""
    if os.path.exists(RESUME_TOKEN_PATH):
        with open(RESUME_TOKEN_PATH, "r") as f:
            return json.load(f)
    return None


def save_resume_token(token):
    """Persist the resume token to disk as JSON."""
    with open(RESUME_TOKEN_PATH, "w") as f:
        json.dump(token, f)


# ---------------------------------------------------------------------------
# Change stream handling
# ---------------------------------------------------------------------------
UPSERT_OPS = {"insert", "update", "replace"}


def make_row(doc):
    """Build a LanceDB row dict from a MongoDB full document."""
    text = doc.get("text", "")
    if text is None:
        text = ""
    text = str(text)
    return {
        "id": str(doc["_id"]),
        "text": text,
        "category": str(doc.get("category", "")),
        "vector": compute_embedding(text),
    }


def drain(stream, table):
    """Drain all currently-available change events from ``stream`` into LanceDB.

    Events are applied strictly in the order they are received. Consecutive
    events of the same kind are batched for efficiency; the batch is flushed
    whenever the operation kind changes so that interleaved upserts and deletes
    of the same id produce the correct final state (e.g. insert-then-delete
    yields no row, while delete-then-insert yields a row).

    Within a batch of upserts, duplicate ids are collapsed to the last value
    (last-wins), which is the correct final state for that id and also avoids
    creating duplicate rows in LanceDB.
    """
    pending_upserts = {}  # id -> row dict (insertion-ordered; last wins)
    pending_deletes = []  # list of doc ids (order preserved, dups harmless)

    def flush_upserts():
        if pending_upserts:
            upsert_rows(table, list(pending_upserts.values()))
            pending_upserts.clear()

    def flush_deletes():
        if pending_deletes:
            delete_rows(table, pending_deletes)
            pending_deletes.clear()

    while True:
        event = stream.try_next()  # non-blocking: None when no event available
        if event is None:
            break

        op = event.get("operationType")

        if op in UPSERT_OPS:
            # Flush any pending deletes so upserts/deletes stay in order.
            flush_deletes()
            doc = event.get("fullDocument")
            if doc is None:
                # With updateLookup the full document should be present. If it
                # is somehow missing (e.g. document vanished), skip this event.
                continue
            row = make_row(doc)
            pending_upserts[row["id"]] = row

        elif op == "delete":
            # Flush any pending upserts so upserts/deletes stay in order.
            flush_upserts()
            doc_key = event.get("documentKey", {})
            doc_id = doc_key.get("_id")
            if doc_id is None:
                continue
            pending_deletes.append(str(doc_id))

        else:
            # Other event types (invalidate, drop, dropDatabase, rename, etc.)
            # are not relevant to row-level sync. Flush pending work so the
            # relative ordering of applied operations is preserved, then skip.
            flush_upserts()
            flush_deletes()
            continue

    # Flush any remaining batched operations.
    flush_upserts()
    flush_deletes()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    table = get_or_create_table()

    client = pymongo.MongoClient(MONGO_URI)
    coll = client[MONGO_DB][MONGO_COLL]

    resume_token = load_resume_token()
    if resume_token is not None:
        stream = coll.watch(
            full_document="updateLookup", resume_after=resume_token
        )
    else:
        stream = coll.watch(full_document="updateLookup")

    try:
        drain(stream, table)
        # Persist the resume position after EVERY run, even when zero events
        # were processed, so the next run continues from exactly this point.
        save_resume_token(stream.resume_token)
    finally:
        stream.close()
        client.close()


if __name__ == "__main__":
    main()