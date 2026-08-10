import os
import json
import asyncio
import nats
import lancedb
import pyarrow as pa

async def run_indexer(max_messages=None):
    # Read environment variables
    nats_url = os.environ.get("NATS_URL", "nats://127.0.0.1:4222")
    js_stream = os.environ.get("JS_STREAM")
    js_subject = os.environ.get("JS_SUBJECT")
    js_durable = os.environ.get("JS_DURABLE")
    lancedb_path = os.environ.get("LANCEDB_PATH")
    index_batch_size_str = os.environ.get("INDEX_BATCH_SIZE", "100")
    zealt_run_id = os.environ.get("ZEALT_RUN_ID")

    # Fallbacks for manual/local testing
    if not js_stream:
        js_stream = "test-stream"
    if not js_subject:
        js_subject = "test-subject"
    if not js_durable:
        js_durable = "test-durable"
    if not lancedb_path:
        lancedb_path = "/tmp/lancedb_test"
    if not zealt_run_id:
        zealt_run_id = "test_run_id"

    try:
        index_batch_size = int(index_batch_size_str)
    except ValueError:
        index_batch_size = 100

    if max_messages is not None and max_messages <= 0:
        return {"committed": 0}

    # Connect to NATS
    nc = await nats.connect(nats_url)
    try:
        js = nc.jetstream()

        # Create/update stream if it doesn't exist
        try:
            await js.add_stream(name=js_stream, subjects=[js_subject])
        except Exception:
            pass

        # Create/bind durable consumer if it doesn't exist
        try:
            await js.add_consumer(
                stream=js_stream,
                config=nats.js.api.ConsumerConfig(
                    durable_name=js_durable,
                    ack_policy=nats.js.api.AckPolicy.EXPLICIT,
                    deliver_policy=nats.js.api.DeliverPolicy.ALL,
                )
            )
        except Exception:
            pass

        # Bind to the pull subscription
        sub = await js.pull_subscribe(
            subject=js_subject,
            durable=js_durable,
            stream=js_stream
        )

        # Check consumer info to see if there are any pending/unacknowledged messages.
        # If both are 0, we can return early with 0 committed messages.
        try:
            info = await sub.consumer_info()
            if info.num_pending == 0 and info.num_ack_pending == 0:
                return {"committed": 0}
        except Exception:
            # If consumer_info fails for some reason, we can proceed with fetching
            pass

        # Connect to LanceDB
        db = lancedb.connect(lancedb_path)
        schema = pa.schema([
            pa.field("id", pa.int64(), nullable=False),
            pa.field("text", pa.string(), nullable=False),
            pa.field("vector", pa.list_(pa.float32(), 32), nullable=False)
        ])
        
        table_name = f"documents_{zealt_run_id}"
        table = db.create_table(table_name, schema=schema, exist_ok=True)

        total_committed = 0

        while True:
            if max_messages is not None:
                remaining = max_messages - total_committed
                if remaining <= 0:
                    break
                current_batch_size = min(index_batch_size, remaining)
            else:
                current_batch_size = index_batch_size

            try:
                # Fetch messages with a reasonable timeout
                msgs = await sub.fetch(batch=current_batch_size, timeout=1.0)
            except nats.errors.TimeoutError:
                break
            except Exception as e:
                # If there's any other error, propagate or break
                raise e

            if not msgs:
                break

            # Process and deduplicate messages by ID in this batch
            doc_map = {}
            msg_map = {}

            for msg in msgs:
                try:
                    data = json.loads(msg.data.decode("utf-8"))
                    doc_id = int(data["id"])
                    text = str(data["text"])
                    vector = [float(x) for x in data["vector"]]
                    if len(vector) != 32:
                        raise ValueError("Vector must have exactly 32 elements")

                    doc_dict = {
                        "id": doc_id,
                        "text": text,
                        "vector": vector
                    }

                    # Keep the latest message for this doc_id
                    doc_map[doc_id] = doc_dict
                    if doc_id not in msg_map:
                        msg_map[doc_id] = []
                    msg_map[doc_id].append(msg)
                except Exception as parse_err:
                    print(f"Error parsing message: {parse_err}")
                    # Acknowledge immediately if malformed to avoid infinite retries
                    await msg.ack()

            if doc_map:
                documents = list(doc_map.values())
                table_data = pa.Table.from_pylist(documents, schema=schema)

                # Commit to LanceDB (Upsert by matching ID)
                (table.merge_insert("id")
                 .when_matched_update_all()
                 .when_not_matched_insert_all()
                 .execute(table_data))

                # Acknowledge all successfully processed messages in this batch
                for doc_id in doc_map:
                    for msg in msg_map[doc_id]:
                        await msg.ack()

                total_committed += sum(len(msgs) for msgs in msg_map.values())

        return {"committed": total_committed}

    finally:
        await nc.close()
