#!/usr/bin/env python3
import os
import sys
import numpy as np
import pyarrow as pa
import lancedb
import redis

def main():
    # 1. Read and validate environment variables
    redis_host = os.environ.get("REDIS_HOST", "127.0.0.1")
    redis_port_str = os.environ.get("REDIS_PORT", "6379")
    try:
        redis_port = int(redis_port_str)
    except ValueError:
        print(f"Error: REDIS_PORT must be an integer, got {redis_port_str}", file=sys.stderr)
        sys.exit(1)

    stream_key = os.environ.get("STREAM_KEY")
    group_name = os.environ.get("GROUP_NAME")
    consumer_name = os.environ.get("CONSUMER_NAME")
    lancedb_dir = os.environ.get("LANCEDB_DIR")
    table_name = os.environ.get("TABLE_NAME")

    missing = []
    if not stream_key: missing.append("STREAM_KEY")
    if not group_name: missing.append("GROUP_NAME")
    if not consumer_name: missing.append("CONSUMER_NAME")
    if not lancedb_dir: missing.append("LANCEDB_DIR")
    if not table_name: missing.append("TABLE_NAME")

    if missing:
        print(f"Error: Missing environment variables: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    batch_size_str = os.environ.get("BATCH_SIZE", "50")
    try:
        batch_size = int(batch_size_str)
    except ValueError:
        print(f"Error: BATCH_SIZE must be an integer, got {batch_size_str}", file=sys.stderr)
        sys.exit(1)

    vector_dim_str = os.environ.get("VECTOR_DIM", "32")
    try:
        vector_dim = int(vector_dim_str)
    except ValueError:
        print(f"Error: VECTOR_DIM must be an integer, got {vector_dim_str}", file=sys.stderr)
        sys.exit(1)

    # 2. Connect to Redis
    try:
        r = redis.Redis(host=redis_host, port=redis_port)
        # Ping to verify connection
        r.ping()
    except Exception as e:
        print(f"Error connecting to Redis: {e}", file=sys.stderr)
        sys.exit(1)

    # 3. Create consumer group if it doesn't exist
    try:
        r.xgroup_create(name=stream_key, groupname=group_name, id='0', mkstream=True)
    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" not in str(e):
            print(f"Error creating consumer group: {e}", file=sys.stderr)
            sys.exit(1)

    # 4. Connect to LanceDB and ensure the table exists
    try:
        os.makedirs(lancedb_dir, exist_ok=True)
        db = lancedb.connect(lancedb_dir)
        
        # Schema definition:
        schema = pa.schema([
            pa.field("id", pa.string(), nullable=False),
            pa.field("text", pa.string(), nullable=False),
            pa.field("vector", pa.list_(pa.float32(), vector_dim), nullable=False)
        ])

        if table_name not in db.table_names():
            table = db.create_table(table_name, schema=schema)
        else:
            table = db.open_table(table_name)
    except Exception as e:
        print(f"Error setting up LanceDB table: {e}", file=sys.stderr)
        sys.exit(1)

    reclaimed_total = 0
    ingested_total = 0

    # 5. Recovery loop: Reclaim previously-delivered but un-acknowledged messages
    start_id = '0-0'
    while True:
        try:
            res = r.xautoclaim(
                name=stream_key,
                groupname=group_name,
                consumername=consumer_name,
                min_idle_time=0,
                start_id=start_id,
                count=batch_size
            )
        except Exception as e:
            print(f"Error during XAUTOCLAIM: {e}", file=sys.stderr)
            sys.exit(1)

        next_start_id, entries, deleted_ids = res

        if entries:
            entry_ids = []
            dict_list = []
            for entry_id, fields in entries:
                id_val = fields.get(b'id') or fields.get('id')
                text_val = fields.get(b'text') or fields.get('text')
                vector_val = fields.get(b'vector') or fields.get('vector')

                if id_val is None or text_val is None or vector_val is None:
                    # Skip or handle malformed messages
                    continue

                id_str = id_val.decode('utf-8') if isinstance(id_val, bytes) else id_val
                text_str = text_val.decode('utf-8') if isinstance(text_val, bytes) else text_val

                try:
                    vec_np = np.frombuffer(vector_val, dtype='<f4')
                    vec_list = vec_np.tolist()
                except Exception as e:
                    print(f"Error parsing vector bytes for entry {entry_id}: {e}", file=sys.stderr)
                    continue

                if len(vec_list) != vector_dim:
                    print(f"Error: Vector dimension mismatch for entry {entry_id}. Expected {vector_dim}, got {len(vec_list)}", file=sys.stderr)
                    continue

                dict_list.append({'id': id_str, 'text': text_str, 'vector': vec_list})
                entry_ids.append(entry_id)

            if dict_list:
                try:
                    arrow_table = pa.Table.from_pylist(dict_list, schema=schema)
                    table.merge_insert("id") \
                         .when_matched_update_all() \
                         .when_not_matched_insert_all() \
                         .execute(arrow_table)
                except Exception as e:
                    print(f"Error upserting reclaimed batch into LanceDB: {e}", file=sys.stderr)
                    sys.exit(1)

                try:
                    r.xack(stream_key, group_name, *entry_ids)
                except Exception as e:
                    print(f"Error acknowledging reclaimed batch in Redis: {e}", file=sys.stderr)
                    sys.exit(1)

                reclaimed_total += len(dict_list)
                ingested_total += len(dict_list)

        start_id = next_start_id
        if start_id == b'0-0' or start_id == '0-0':
            break

    # 6. Main consumption loop: Read new entries until stream yields no new entries
    while True:
        try:
            res = r.xreadgroup(
                groupname=group_name,
                consumername=consumer_name,
                streams={stream_key: '>'},
                count=batch_size
            )
        except Exception as e:
            print(f"Error during XREADGROUP: {e}", file=sys.stderr)
            sys.exit(1)

        if not res:
            break

        entries = []
        for s_name, stream_entries in res:
            for entry_id, fields in stream_entries:
                entries.append((entry_id, fields))

        if not entries:
            break

        entry_ids = []
        dict_list = []
        for entry_id, fields in entries:
            id_val = fields.get(b'id') or fields.get('id')
            text_val = fields.get(b'text') or fields.get('text')
            vector_val = fields.get(b'vector') or fields.get('vector')

            if id_val is None or text_val is None or vector_val is None:
                continue

            id_str = id_val.decode('utf-8') if isinstance(id_val, bytes) else id_val
            text_str = text_val.decode('utf-8') if isinstance(text_val, bytes) else text_val

            try:
                vec_np = np.frombuffer(vector_val, dtype='<f4')
                vec_list = vec_np.tolist()
            except Exception as e:
                print(f"Error parsing vector bytes for entry {entry_id}: {e}", file=sys.stderr)
                continue

            if len(vec_list) != vector_dim:
                print(f"Error: Vector dimension mismatch for entry {entry_id}. Expected {vector_dim}, got {len(vec_list)}", file=sys.stderr)
                continue

            dict_list.append({'id': id_str, 'text': text_str, 'vector': vec_list})
            entry_ids.append(entry_id)

        if dict_list:
            try:
                arrow_table = pa.Table.from_pylist(dict_list, schema=schema)
                table.merge_insert("id") \
                     .when_matched_update_all() \
                     .when_not_matched_insert_all() \
                     .execute(arrow_table)
            except Exception as e:
                print(f"Error upserting new batch into LanceDB: {e}", file=sys.stderr)
                sys.exit(1)

            try:
                r.xack(stream_key, group_name, *entry_ids)
            except Exception as e:
                print(f"Error acknowledging new batch in Redis: {e}", file=sys.stderr)
                sys.exit(1)

            ingested_total += len(dict_list)

    # 7. Print exactly one final line to stdout
    print(f"DONE ingested={ingested_total} reclaimed={reclaimed_total}")

if __name__ == "__main__":
    main()
