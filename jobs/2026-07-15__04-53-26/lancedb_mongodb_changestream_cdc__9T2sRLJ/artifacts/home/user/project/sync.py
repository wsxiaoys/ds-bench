#!/usr/bin/env python3
"""
MongoDB -> LanceDB CDC synchronizer.

Tails the change stream of the `cdc.documents` collection in MongoDB, applies
each event in order to a LanceDB table called `documents`, and persists a
resume token to disk so a subsequent run picks up exactly where the previous
one stopped.

The script is non-blocking: it drains whatever events are currently available
on the change stream and then exits. It can be re-run safely: doing so when
there are no new events leaves the LanceDB table unchanged and writes a fresh
resume token.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import lancedb
import pyarrow as pa
import pymongo
from pymongo.collection import Collection

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

PROJECT_DIR = Path("/home/user/project")
LANCEDB_DIR = PROJECT_DIR / "lancedb"
TABLE_NAME = "documents"
RESUME_TOKEN_FILE = PROJECT_DIR / "resume_token.json"

DB_NAME = "cdc"
COLLECTION_NAME = "documents"

EMBEDDING_DIM = 8
RESUME_TOKEN_KEY = "_data"  # the key MongoDB uses inside the resume token dict


# ---------------------------------------------------------------------------
# Embedding
# ---------------------------------------------------------------------------

def embed_text(text: str) -> List[float]:
    """Return the 8-dim float32 embedding for ``text``.

    The embedding is defined as: take the SHA-256 of the UTF-8 bytes of the
    text, take the first 8 bytes of the digest, and produce the 8-dim
    float32 vector whose component ``i`` equals ``byte[i] / 255.0``.
    """
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    first_eight = digest[:EMBEDDING_DIM]
    return [b / 255.0 for b in first_eight]


# ---------------------------------------------------------------------------
# Resume token (de)serialization
# ---------------------------------------------------------------------------

def load_resume_token(path: Path) -> Optional[Dict[str, Any]]:
    """Load a resume token from ``path`` if one is present, else ``None``."""
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(data, dict):
        return None
    token = data.get("resume_token")
    if not isinstance(token, dict):
        return None
    # Must carry at least the standard ``_data`` field that pymongo populates.
    if RESUME_TOKEN_KEY not in token:
        return None
    return token


def save_resume_token(path: Path, token: Optional[Dict[str, Any]]) -> None:
    """Persist ``token`` to ``path`` atomically."""
    payload = {"resume_token": token} if token is not None else {"resume_token": None}
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh)
    os.replace(tmp, path)


# ---------------------------------------------------------------------------
# LanceDB helpers
# ---------------------------------------------------------------------------

LANCE_SCHEMA = pa.schema(
    [
        ("id", pa.string()),
        ("text", pa.string()),
        ("category", pa.string()),
        ("vector", pa.list_(pa.float32(), EMBEDDING_DIM)),
    ]
)


def open_table(db: lancedb.LanceDBConnection):
    """Return the documents table, creating it (empty) on first use."""
    existing = db.list_tables()
    # ``list_tables`` returns a response object; normalise to a plain list.
    if hasattr(existing, "tables"):
        existing = existing.tables
    if TABLE_NAME in existing:
        return db.open_table(TABLE_NAME)
    return db.create_table(TABLE_NAME, schema=LANCE_SCHEMA, mode="create")


def apply_upsert(table, doc: Dict[str, Any]) -> None:
    """Upsert ``doc`` (a MongoDB fullDocument) into ``table``."""
    text = doc.get("text", "")
    category = doc.get("category", "")
    row = {
        "id": doc["_id"],
        "text": text,
        "category": category,
        "vector": embed_text(text),
    }
    (
        table.merge_insert("id")
        .when_matched_update_all()
        .when_not_matched_insert_all()
        .execute([row])
    )


def apply_delete(table, doc_id: str) -> None:
    """Delete the row keyed by ``doc_id`` from ``table``."""
    # Quote the id to make the filter safe regardless of id contents.
    safe_id = doc_id.replace("'", "''")
    table.delete(f"id = '{safe_id}'")


# ---------------------------------------------------------------------------
# Change stream draining
# ---------------------------------------------------------------------------

def _doc_id_from_event(event: Dict[str, Any]) -> str:
    """Extract the document _id from a change event's documentKey."""
    key = event.get("documentKey") or {}
    return key.get("_id")


def _full_document(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Return the full document from an event, if present.

    For insert / replace / updateLookup-enabled update events, the field
    ``fullDocument`` carries the latest committed state of the document.
    """
    return event.get("fullDocument")


def drain_change_stream(coll: Collection, resume_token: Optional[Dict[str, Any]], table) -> None:
    """Open a change stream and apply events to ``table`` until the stream is empty.

    The change stream is opened in non-blocking mode (``try_next``) so that we
    exit as soon as the server has no more events buffered for us, rather
    than waiting for new events to arrive.
    """
    kwargs: Dict[str, Any] = {"full_document": "updateLookup"}
    if resume_token is not None:
        kwargs["resume_after"] = resume_token

    with coll.watch(**kwargs) as stream:
        # Non-blocking drain: keep pulling events while they are available.
        while True:
            event = stream.try_next()
            if event is None:
                break

            op = event.get("operationType")
            if op in ("insert", "update", "replace"):
                doc = _full_document(event)
                if doc is not None:
                    apply_upsert(table, doc)
            elif op == "delete":
                doc_id = _doc_id_from_event(event)
                if doc_id is not None:
                    apply_delete(table, doc_id)
            else:
                # Drop unknown event types (e.g. invalidate, drop) without
                # failing. The resume token still advances below.
                pass

            # Persist resume token after EVERY event so a crash mid-drain
            # can resume from the next position.
            token = stream.resume_token or event.get("_id")
            if token is not None:
                save_resume_token(RESUME_TOKEN_FILE, token)

        # No more events buffered: write the current position so the next run
        # starts from exactly here.
        token = stream.resume_token
        if token is not None:
            save_resume_token(RESUME_TOKEN_FILE, token)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/?replicaSet=rs0")
    client = pymongo.MongoClient(mongo_uri)
    coll = client[DB_NAME][COLLECTION_NAME]

    resume_token = load_resume_token(RESUME_TOKEN_FILE)

    LANCEDB_DIR.mkdir(parents=True, exist_ok=True)
    db = lancedb.connect(str(LANCEDB_DIR))
    table = open_table(db)

    try:
        drain_change_stream(coll, resume_token, table)
    finally:
        client.close()


if __name__ == "__main__":
    main()
