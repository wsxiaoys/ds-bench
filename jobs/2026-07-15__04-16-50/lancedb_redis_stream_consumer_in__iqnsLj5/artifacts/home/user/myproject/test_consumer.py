#!/usr/bin/env python3
import os
import shutil
import subprocess
import sys
import numpy as np
import redis
import lancedb
import pyarrow as pa

def main():
    # Configuration
    os.environ["REDIS_HOST"] = "127.0.0.1"
    os.environ["REDIS_PORT"] = "6379"
    os.environ["STREAM_KEY"] = "test_stream"
    os.environ["GROUP_NAME"] = "test_group"
    os.environ["CONSUMER_NAME"] = "test_consumer"
    os.environ["LANCEDB_DIR"] = "/tmp/test_lancedb_dir"
    os.environ["TABLE_NAME"] = "test_table"
    os.environ["BATCH_SIZE"] = "5"
    os.environ["VECTOR_DIM"] = "4"

    # Clean up from previous runs
    r = redis.Redis(host="127.0.0.1", port=6379)
    r.flushall()
    if os.path.exists("/tmp/test_lancedb_dir"):
        shutil.rmtree("/tmp/test_lancedb_dir")

    print("--- TEST 1: Standard Ingest ---")
    # Generate 12 entries
    for i in range(12):
        vec = np.array([float(i), float(i+1), float(i+2), float(i+3)], dtype='<f4')
        r.xadd("test_stream", {
            "id": f"doc_{i}",
            "text": f"text_{i}",
            "vector": vec.tobytes()
        })

    # Run the consumer
    proc = subprocess.run(
        ["python3", "run_consumer.py"],
        capture_output=True,
        text=True
    )
    print("STDOUT:", proc.stdout.strip())
    print("STDERR:", proc.stderr.strip())

    assert proc.returncode == 0, "Consumer exited with non-zero status"
    assert proc.stdout.strip() == "DONE ingested=12 reclaimed=0", f"Unexpected stdout: {proc.stdout.strip()}"

    # Verify LanceDB table contents
    db = lancedb.connect("/tmp/test_lancedb_dir")
    table = db.open_table("test_table")
    arrow_tbl = table.to_arrow()
    print("LanceDB rows count:", len(arrow_tbl))
    assert len(arrow_tbl) == 12, f"Expected 12 rows in LanceDB, got {len(arrow_tbl)}"

    # Check vector values of doc_5
    df = arrow_tbl.to_pandas()
    doc_5_row = df[df["id"] == "doc_5"].iloc[0]
    print("doc_5 vector:", doc_5_row["vector"])
    np.testing.assert_array_almost_equal(doc_5_row["vector"], [5.0, 6.0, 7.0, 8.0])

    print("--- TEST 2: Reclaim/Recovery ---")
    # We will push 3 new entries
    for i in range(12, 15):
        vec = np.array([float(i), float(i+1), float(i+2), float(i+3)], dtype='<f4')
        r.xadd("test_stream", {
            "id": f"doc_{i}",
            "text": f"text_{i}",
            "vector": vec.tobytes()
        })

    # Read them using XREADGROUP to put them into PEL, but do NOT acknowledge them!
    # This simulates a consumer that fetched them but crashed before committing/acknowledging.
    # Note: we must use the same group and consumer name
    read_res = r.xreadgroup("test_group", "test_consumer", {"test_stream": ">"}, count=3)
    print("Simulated crash: fetched but did not acknowledge:", len(read_res[0][1]))
    assert len(read_res[0][1]) == 3

    # Now run the consumer. It should reclaim these 3 entries from PEL, upsert them,
    # and acknowledge them. Since there are no other new entries, it should then exit.
    proc = subprocess.run(
        ["python3", "run_consumer.py"],
        capture_output=True,
        text=True
    )
    print("STDOUT:", proc.stdout.strip())
    print("STDERR:", proc.stderr.strip())

    assert proc.returncode == 0
    assert proc.stdout.strip() == "DONE ingested=3 reclaimed=3", f"Unexpected stdout: {proc.stdout.strip()}"

    # Verify LanceDB has 15 rows now
    table = db.open_table("test_table")
    arrow_tbl = table.to_arrow()
    print("LanceDB rows count after recovery:", len(arrow_tbl))
    assert len(arrow_tbl) == 15, f"Expected 15 rows in LanceDB, got {len(arrow_tbl)}"

    print("--- TEST 3: Idempotency (Upsert) ---")
    # Let's push some duplicate entries (doc_14 with updated text, and doc_15 as new)
    vec_14_updated = np.array([140.0, 141.0, 142.0, 143.0], dtype='<f4')
    r.xadd("test_stream", {
        "id": "doc_14",
        "text": "text_14_updated",
        "vector": vec_14_updated.tobytes()
    })

    vec_15 = np.array([15.0, 16.0, 17.0, 18.0], dtype='<f4')
    r.xadd("test_stream", {
        "id": "doc_15",
        "text": "text_15",
        "vector": vec_15.tobytes()
    })

    # Run the consumer
    proc = subprocess.run(
        ["python3", "run_consumer.py"],
        capture_output=True,
        text=True
    )
    print("STDOUT:", proc.stdout.strip())
    print("STDERR:", proc.stderr.strip())

    assert proc.returncode == 0
    assert proc.stdout.strip() == "DONE ingested=2 reclaimed=0", f"Unexpected stdout: {proc.stdout.strip()}"

    # Verify LanceDB has 16 rows now (doc_14 was updated, doc_15 was inserted)
    table = db.open_table("test_table")
    arrow_tbl = table.to_arrow()
    print("LanceDB rows count after upsert:", len(arrow_tbl))
    assert len(arrow_tbl) == 16, f"Expected 16 rows in LanceDB, got {len(arrow_tbl)}"

    # Check updated doc_14
    df = arrow_tbl.to_pandas()
    doc_14_row = df[df["id"] == "doc_14"].iloc[0]
    print("doc_14 text:", doc_14_row["text"])
    print("doc_14 vector:", doc_14_row["vector"])
    assert doc_14_row["text"] == "text_14_updated"
    np.testing.assert_array_almost_equal(doc_14_row["vector"], [140.0, 141.0, 142.0, 143.0])

    print("--- ALL TESTS PASSED! ---")

if __name__ == "__main__":
    main()
