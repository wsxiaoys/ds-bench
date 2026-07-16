import os
import sys
import re
import json
import hashlib
import numpy as np
import pika
import lancedb
import pyarrow as pa

def compute_embedding(text: str) -> list:
    # 1. Lowercase the text and extract tokens matching [a-z0-9]+
    text_lower = text.lower()
    tokens = re.findall(r'[a-z0-9]+', text_lower)
    
    # 2. Start with a zero vector of length 64
    vector = np.zeros(64, dtype=np.float32)
    
    # 3. Add 1.0 to vector[idx] for each token
    for token in tokens:
        idx = int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16) % 64
        vector[idx] += 1.0
        
    # 4. L2-normalize the vector
    norm = np.linalg.norm(vector)
    if norm > 0:
        vector = vector / norm
        
    return vector.tolist()

def parse_and_validate_message(body_bytes: bytes):
    try:
        body_str = body_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return None, False
    
    try:
        data = json.loads(body_str)
    except json.JSONDecodeError:
        return None, False
        
    if not isinstance(data, dict):
        return None, False
        
    doc_id = data.get("id")
    text = data.get("text")
    
    if not isinstance(doc_id, str) or not doc_id:
        return None, False
        
    if not isinstance(text, str) or not text:
        return None, False
        
    return {"id": doc_id, "text": text}, True

def check_id_exists_in_lancedb(table, doc_id: str) -> bool:
    try:
        escaped_id = doc_id.replace("'", "''")
        res = table.search().where(f"id = '{escaped_id}'").to_arrow()
        return len(res) > 0
    except Exception as e:
        sys.stderr.write(f"Error checking ID existence: {e}\n")
        return False

def get_next_batch_index(log_path: str) -> int:
    if not os.path.exists(log_path):
        return 0
    try:
        with open(log_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            if not lines:
                return 0
            for line in reversed(lines):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if isinstance(data, dict) and "batch_index" in data:
                        return int(data["batch_index"]) + 1
                except Exception:
                    continue
            return 0
    except Exception:
        return 0

def append_commit_log(log_path: str, batch_index: int, ids: list):
    line = json.dumps({"batch_index": batch_index, "ids": ids})
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(line + "\n")

written_count = 0

def commit_batch(table, log_path, batch_index, docs, ids, tags, channel):
    global written_count
    if not docs:
        return batch_index
    
    try:
        # 1. Write durably to LanceDB
        table.add(docs)
        
        # 2. Append to commits.log
        append_commit_log(log_path, batch_index, ids)
        
        # 3. Acknowledge all delivery tags in the batch
        for tag in tags:
            channel.basic_ack(delivery_tag=tag)
            
        written_count += len(docs)
        sys.stderr.write(f"Successfully committed batch {batch_index} with {len(docs)} documents.\n")
        return batch_index + 1
    except Exception as e:
        sys.stderr.write(f"Error committing batch {batch_index}: {e}\n")
        raise e

def main():
    # Ensure directories exist
    os.makedirs("/home/user/project/data/lancedb", exist_ok=True)
    
    # Connect to LanceDB
    db = lancedb.connect("/home/user/project/data/lancedb")
    
    # Define schema
    schema = pa.schema([
        pa.field("id", pa.string()),
        pa.field("text", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), 64))
    ])
    
    # Create or open table
    table = db.create_table("documents", schema=schema, exist_ok=True)
    
    # Read batch size from environment variable
    batch_size = int(os.environ.get("INGEST_BATCH_SIZE", 16))
    
    # Connect to RabbitMQ
    credentials = pika.PlainCredentials("guest", "guest")
    parameters = pika.ConnectionParameters(
        host="localhost",
        port=5672,
        virtual_host="/",
        credentials=credentials
    )
    connection = pika.BlockingConnection(parameters)
    channel = connection.channel()
    
    # Declare topology idempotently
    channel.exchange_declare(
        exchange="documents.dlx",
        exchange_type="fanout",
        durable=True
    )
    
    channel.queue_declare(
        queue="documents",
        durable=True,
        arguments={
            "x-queue-type": "quorum",
            "x-dead-letter-exchange": "documents.dlx"
        }
    )
    
    channel.queue_declare(
        queue="documents.dlq",
        durable=True,
        arguments={
            "x-queue-type": "quorum"
        }
    )
    
    channel.queue_bind(
        queue="documents.dlq",
        exchange="documents.dlx",
        routing_key=""
    )
    
    # Initialize state
    skipped_duplicates_count = 0
    dead_lettered_count = 0
    in_run_seen_set = set()
    
    current_batch_docs = []
    current_batch_ids = []
    current_batch_delivery_tags = []
    
    log_path = "/home/user/project/data/commits.log"
    next_batch_idx = get_next_batch_index(log_path)
    
    # Consume loop
    try:
        while True:
            method_frame, header_frame, body = channel.basic_get(queue="documents", auto_ack=False)
            if method_frame is None:
                break
                
            delivery_tag = method_frame.delivery_tag
            
            # Validate message
            doc, is_valid = parse_and_validate_message(body)
            if not is_valid:
                # Poison message!
                channel.basic_nack(delivery_tag=delivery_tag, requeue=False)
                dead_lettered_count += 1
                continue
                
            doc_id = doc["id"]
            text = doc["text"]
            
            # Check if duplicate
            if doc_id in in_run_seen_set:
                if doc_id in current_batch_ids:
                    current_batch_delivery_tags.append(delivery_tag)
                else:
                    channel.basic_ack(delivery_tag=delivery_tag)
                skipped_duplicates_count += 1
            else:
                # Check LanceDB
                if check_id_exists_in_lancedb(table, doc_id):
                    in_run_seen_set.add(doc_id)
                    channel.basic_ack(delivery_tag=delivery_tag)
                    skipped_duplicates_count += 1
                else:
                    in_run_seen_set.add(doc_id)
                    current_batch_docs.append({
                        "id": doc_id,
                        "text": text,
                        "vector": compute_embedding(text)
                    })
                    current_batch_ids.append(doc_id)
                    current_batch_delivery_tags.append(delivery_tag)
                    
            # Commit batch if batch size reached
            if len(current_batch_docs) >= batch_size:
                next_batch_idx = commit_batch(
                    table=table,
                    log_path=log_path,
                    batch_index=next_batch_idx,
                    docs=current_batch_docs,
                    ids=current_batch_ids,
                    tags=current_batch_delivery_tags,
                    channel=channel
                )
                current_batch_docs = []
                current_batch_ids = []
                current_batch_delivery_tags = []
                
        # Flush any remaining docs
        if current_batch_docs:
            next_batch_idx = commit_batch(
                table=table,
                log_path=log_path,
                batch_index=next_batch_idx,
                docs=current_batch_docs,
                ids=current_batch_ids,
                tags=current_batch_delivery_tags,
                channel=channel
            )
            
    finally:
        try:
            connection.close()
        except Exception:
            pass
            
    # Print the required stdout summary
    print(f"INGEST_DONE written={written_count} skipped_duplicates={skipped_duplicates_count} dead_lettered={dead_lettered_count}")

if __name__ == "__main__":
    main()
