"""
MongoDB Change Stream -> LanceDB CDC Synchronizer
==================================================
Tails the change stream of `cdc.documents` and keeps a LanceDB table in sync.

Behaviour
---------
* Drain only: processes all events currently available, then exits.
* Upserts (insert / update / replace) are applied via LanceDB merge_insert.
* Deletes are applied via LanceDB table.delete(SQL filter).
* A SHA-256-based 8-dimensional float32 embedding is (re-)computed whenever
  a row is inserted or updated.
* The MongoDB resume token is persisted to resume_token.json after every run
  so the next invocation continues from exactly this point.
"""

from __future__ import annotations

import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any

import lancedb
import pyarrow as pa
import pymongo
from pymongo import MongoClient

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MONGO_URI: str = os.environ.get(
    "MONGO_URI", "mongodb://localhost:27017/?replicaSet=rs0"
)
DB_NAME = "cdc"
COLLECTION_NAME = "documents"

PROJECT_DIR = Path(__file__).parent.resolve()
LANCEDB_DIR = PROJECT_DIR / "lancedb"
RESUME_TOKEN_PATH = PROJECT_DIR / "resume_token.json"

LANCE_TABLE = "documents"
VECTOR_DIM = 8

# ---------------------------------------------------------------------------
# LanceDB schema
# ---------------------------------------------------------------------------
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
def compute_embedding(text: str) -> list[float]:
    """
    SHA-256 of the UTF-8 bytes of *text*.
    Take the first 8 bytes of the digest.
    Return an 8-dimensional float32 vector: component i = byte[i] / 255.0
    """
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    return [digest[i] / 255.0 for i in range(VECTOR_DIM)]


# ---------------------------------------------------------------------------
# Resume-token helpers
# ---------------------------------------------------------------------------
def load_resume_token() -> dict[str, Any] | None:
    if RESUME_TOKEN_PATH.exists():
        try:
            data = json.loads(RESUME_TOKEN_PATH.read_text())
            if data:
                return data
        except (json.JSONDecodeError, OSError):
            pass
    return None


def save_resume_token(token: dict[str, Any] | None) -> None:
    RESUME_TOKEN_PATH.write_text(json.dumps(token or {}))


# ---------------------------------------------------------------------------
# LanceDB helpers
# ---------------------------------------------------------------------------
def open_or_create_table(db: lancedb.DBConnection) -> lancedb.table.Table:
    """Return the LanceDB table, creating it (empty) if it does not exist."""
    try:
        return db.open_table(LANCE_TABLE)
    except Exception:
        pass
    # Table does not exist yet — create it with an empty batch so the schema
    # is established correctly.
    empty = pa.table(
        {
            "id": pa.array([], type=pa.string()),
            "text": pa.array([], type=pa.string()),
            "category": pa.array([], type=pa.string()),
            "vector": pa.array(
                [], type=pa.list_(pa.float32(), VECTOR_DIM)
            ),
        }
    )
    return db.create_table(LANCE_TABLE, empty, schema=SCHEMA)


def mongo_doc_to_row(doc: dict[str, Any]) -> dict[str, Any]:
    """Convert a MongoDB document to a LanceDB row dict."""
    text = doc.get("text", "")
    return {
        "id": str(doc["_id"]),
        "text": text,
        "category": doc.get("category", ""),
        "vector": compute_embedding(text),
    }


def upsert_row(table: lancedb.table.Table, row: dict[str, Any]) -> None:
    """Upsert a single *row* into *table*, matching on the `id` column."""
    batch = pa.table(
        {
            "id": pa.array([row["id"]], type=pa.string()),
            "text": pa.array([row["text"]], type=pa.string()),
            "category": pa.array([row["category"]], type=pa.string()),
            "vector": pa.array(
                [row["vector"]],
                type=pa.list_(pa.float32(), VECTOR_DIM),
            ),
        }
    )
    (
        table.merge_insert("id")
        .when_matched_update_all()
        .when_not_matched_insert_all()
        .execute(batch)
    )


def delete_row(table: lancedb.table.Table, doc_id: str) -> None:
    """Delete the row with the given *doc_id* from *table*."""
    # Single-quote the id, escaping any embedded single-quotes.
    safe_id = doc_id.replace("'", "''")
    table.delete(f"id = '{safe_id}'")


# ---------------------------------------------------------------------------
# Main drain loop
# ---------------------------------------------------------------------------
def run() -> None:
    # -- MongoDB connection --------------------------------------------------
    client: MongoClient = MongoClient(MONGO_URI)
    collection = client[DB_NAME][COLLECTION_NAME]

    # -- LanceDB connection --------------------------------------------------
    LANCEDB_DIR.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(LANCEDB_DIR))
    table = open_or_create_table(db)

    # -- Resume token --------------------------------------------------------
    resume_token = load_resume_token()

    # -- Open change stream --------------------------------------------------
    # full_document="updateLookup" ensures that update events carry the full
    # post-update document, not just the diff.
    stream_kwargs: dict[str, Any] = {
        "full_document": "updateLookup",
    }
    if resume_token:
        stream_kwargs["resume_after"] = resume_token

    # Track the most-recent resume token seen during this session.
    last_token: dict[str, Any] | None = resume_token

    try:
        with collection.watch(**stream_kwargs) as stream:
            # Drain: iterate only while events are already buffered.
            # try_next() returns None immediately when no event is available.
            while True:
                try:
                    event = stream.try_next()
                except pymongo.errors.PyMongoError as exc:
                    print(f"[ERROR] Change stream error: {exc}", file=sys.stderr)
                    break

                if event is None:
                    # No more events available right now → we're done.
                    break

                # Always capture the latest resume token before processing,
                # so a crash after apply still has a safe resume point.
                last_token = stream.resume_token

                op = event.get("operationType")

                if op in ("insert", "update", "replace"):
                    doc = event.get("fullDocument")
                    if doc is None:
                        # Defensive: skip if document is unexpectedly absent.
                        continue
                    upsert_row(table, mongo_doc_to_row(doc))

                elif op == "delete":
                    doc_key = event.get("documentKey", {})
                    doc_id = str(doc_key.get("_id", ""))
                    if doc_id:
                        delete_row(table, doc_id)

                # Ignore drop, rename, invalidate, etc.

            # Persist the resume token so the next run starts from here.
            # Prefer the token we tracked event-by-event; fall back to
            # whatever the cursor reports after draining (which reflects the
            # current cluster time even when no events were received).
            final_token = last_token if last_token is not None else stream.resume_token
            if final_token is not None:
                save_resume_token(final_token)

    finally:
        client.close()


if __name__ == "__main__":
    run()
