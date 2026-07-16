#!/usr/bin/env python3
import os
import sys
import json
import hashlib
from bson import json_util
from pymongo import MongoClient
import lancedb
import pyarrow as pa

# Paths
PROJECT_DIR = "/home/user/project"
LANCEDB_DIR = os.path.join(PROJECT_DIR, "lancedb")
RESUME_TOKEN_PATH = os.path.join(PROJECT_DIR, "resume_token.json")

def compute_embedding(text: str) -> list[float]:
    """
    Computes an 8-dimensional float32 vector embedding for the given text.
    - Takes SHA-256 digest of UTF-8 bytes of text.
    - Takes first 8 bytes of digest.
    - Returns vector where component i = byte[i] / 255.0.
    """
    if text is None:
        text = ""
    digest = hashlib.sha256(text.encode('utf-8')).digest()
    first_8_bytes = digest[:8]
    return [float(b) / 255.0 for b in first_8_bytes]

def main():
    # Ensure project directory exists
    os.makedirs(PROJECT_DIR, exist_ok=True)

    # 1. Load saved resume token if it exists
    resume_token = None
    if os.path.exists(RESUME_TOKEN_PATH):
        try:
            with open(RESUME_TOKEN_PATH, "r") as f:
                token_str = f.read().strip()
                if token_str:
                    resume_token = json_util.loads(token_str)
                    print(f"Loaded resume token from {RESUME_TOKEN_PATH}", flush=True)
        except Exception as e:
            print(f"Warning: Failed to load resume token: {e}. Will start a fresh stream.", flush=True)

    # 2. Connect to MongoDB
    mongo_uri = os.environ.get("MONGO_URI", "mongodb://localhost:27017/?replicaSet=rs0")
    print(f"Connecting to MongoDB at {mongo_uri}...", flush=True)
    try:
        mongo_client = MongoClient(mongo_uri)
        db = mongo_client["cdc"]
        coll = db["documents"]
    except Exception as e:
        print(f"Error: Failed to connect to MongoDB: {e}", file=sys.stderr, flush=True)
        sys.exit(1)

    # 3. Open Change Stream
    print("Opening MongoDB change stream...", flush=True)
    stream = None
    try:
        if resume_token:
            try:
                stream = coll.watch(resume_after=resume_token, full_document='updateLookup')
                print("Successfully resumed change stream using saved token.", flush=True)
            except Exception as e:
                print(f"Warning: Failed to resume change stream: {e}. Starting fresh.", flush=True)
                stream = coll.watch(full_document='updateLookup')
        else:
            print("No saved resume token. Starting a fresh change stream.", flush=True)
            stream = coll.watch(full_document='updateLookup')
    except Exception as e:
        print(f"Error: Failed to open change stream: {e}", file=sys.stderr, flush=True)
        sys.exit(1)

    # 4. Non-blocking drain of change stream events
    print("Draining available change events...", flush=True)
    events = []
    try:
        while True:
            event = stream.try_next()
            if event is None:
                break
            events.append(event)
    except Exception as e:
        print(f"Error while reading from change stream: {e}", file=sys.stderr, flush=True)
        stream.close()
        sys.exit(1)

    print(f"Retrieved {len(events)} change events.", flush=True)

    # 5. Initialize/Connect to LanceDB
    try:
        os.makedirs(LANCEDB_DIR, exist_ok=True)
        ldb = lancedb.connect(LANCEDB_DIR)
        
        # Define exact schema required
        schema = pa.schema([
            pa.field("id", pa.string(), nullable=False),
            pa.field("text", pa.string(), nullable=True),
            pa.field("category", pa.string(), nullable=True),
            pa.field("vector", pa.list_(pa.float32(), 8), nullable=False)
        ])
        
        table_name = "documents"
        if table_name in ldb.list_tables().tables:
            table = ldb.open_table(table_name)
        else:
            table = ldb.create_table(table_name, schema=schema)
    except Exception as e:
        print(f"Error: Failed to connect or initialize LanceDB: {e}", file=sys.stderr, flush=True)
        stream.close()
        sys.exit(1)

    # 6. Process and aggregate changes per document ID
    doc_changes = {}
    for event in events:
        op_type = event.get("operationType")
        doc_id = event.get("documentKey", {}).get("_id")
        if not doc_id:
            continue
        
        doc_id = str(doc_id)

        if op_type in ("insert", "update", "replace"):
            full_doc = event.get("fullDocument")
            if full_doc is None:
                print(f"Warning: Event of type '{op_type}' is missing fullDocument. Skipping.", flush=True)
                continue
            
            text = full_doc.get("text", "")
            category = full_doc.get("category", "")
            if text is None:
                text = ""
            if category is None:
                category = ""
            
            # Recompute vector embedding
            vector = compute_embedding(text)
            
            doc_changes[doc_id] = {
                "op": "upsert",
                "id": doc_id,
                "text": text,
                "category": category,
                "vector": vector
            }
        elif op_type == "delete":
            doc_changes[doc_id] = {
                "op": "delete",
                "id": doc_id
            }

    # 7. Apply aggregated changes to LanceDB
    upserts = [change for change in doc_changes.values() if change["op"] == "upsert"]
    deletes = [change for change in doc_changes.values() if change["op"] == "delete"]

    try:
        # Apply Deletes first (or after, order doesn't matter since IDs are disjoint)
        if deletes:
            escaped_ids = [d["id"].replace("'", "''") for d in deletes]
            id_list_str = ", ".join(f"'{eid}'" for eid in escaped_ids)
            where_clause = f"id IN ({id_list_str})"
            table.delete(where_clause)
            print(f"Deleted {len(deletes)} documents from LanceDB.", flush=True)

        # Apply Upserts
        if upserts:
            data_to_upsert = [
                {
                    "id": u["id"],
                    "text": u["text"],
                    "category": u["category"],
                    "vector": u["vector"]
                }
                for u in upserts
            ]
            table.merge_insert("id") \
                 .when_matched_update_all() \
                 .when_not_matched_insert_all() \
                 .execute(data_to_upsert)
            print(f"Upserted {len(upserts)} documents into LanceDB.", flush=True)

    except Exception as e:
        print(f"Error: Failed to apply changes to LanceDB: {e}", file=sys.stderr, flush=True)
        stream.close()
        sys.exit(1)

    # 8. Always persist the latest resume token
    try:
        final_token = stream.resume_token
        if final_token:
            token_str = json_util.dumps(final_token)
            with open(RESUME_TOKEN_PATH, "w") as f:
                f.write(token_str)
            print(f"Successfully saved current resume token to {RESUME_TOKEN_PATH}", flush=True)
        else:
            print("Warning: No resume token available from change stream.", flush=True)
    except Exception as e:
        print(f"Error: Failed to save resume token: {e}", file=sys.stderr, flush=True)

    # Clean up
    stream.close()
    print("Synchronization run completed successfully.", flush=True)

if __name__ == "__main__":
    main()
