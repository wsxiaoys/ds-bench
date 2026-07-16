import os
import sys
import time
import grpc
import lancedb

# Set up environment variables for testing
os.environ["ZEALT_RUN_ID"] = "test_run_123"
os.environ["LANCEDB_PATH"] = "/home/user/myproject/lance_data"

import client

def run_tests():
    print("Starting tests...")
    
    # 1. Verify table is created and empty
    db = lancedb.connect("/home/user/myproject/lance_data")
    table_name = "vectors_test_run_123"
    tbl = db.open_table(table_name)
    print(f"Table '{table_name}' exists. Current version: {tbl.version}")
    initial_count = len(tbl.to_pandas())
    assert initial_count == 0, f"Expected table to be empty on startup, got {initial_count} rows."
    print("Verified: Table is empty on startup.")

    # 2. Test successful ingestion of 150 records (1 batch of 100, 1 remainder batch of 50)
    print("\nTesting successful ingestion of 150 records...")
    records = []
    for i in range(150):
        # Let's make vector values distinct so we can search them
        val = float(i) / 150.0
        records.append({
            "id": i,
            "vector": [val] * 16,
            "metadata": f"record_{i}"
        })
        
    summary = client.ingest_vectors(records)
    print("Ingest summary:", summary)
    assert summary["received"] == 150, f"Expected 150 received, got {summary['received']}"
    assert summary["written"] == 150, f"Expected 150 written, got {summary['written']}"
    assert summary["batches"] == 2, f"Expected 2 batches, got {summary['batches']}"
    
    # Verify rows in LanceDB
    tbl = db.open_table(table_name)
    rows_count = len(tbl.to_pandas())
    assert rows_count == 150, f"Expected 150 rows in DB, got {rows_count}"
    print("Verified: 150 records successfully ingested and written in 2 batches.")

    # 3. Test Search
    print("\nTesting nearest-neighbor search...")
    # Query vector close to record 75 (val = 75/150 = 0.5)
    query_vector = [0.5] * 16
    k = 5
    results = client.search(query_vector, k)
    print(f"Search results for query near 0.5 (k={k}):")
    for r in results:
        print(r)
        
    assert len(results) == k, f"Expected {k} results, got {len(results)}"
    # The closest record should be record 75
    assert results[0]["id"] == 75, f"Expected closest record to be 75, got {results[0]['id']}"
    # Check that distances are strictly ascending
    distances = [r["distance"] for r in results]
    assert distances == sorted(distances), f"Distances are not in ascending order: {distances}"
    print("Verified: Search works, is sorted by ascending distance, and returns correct nearest neighbors.")

    # 4. Test validation and rollback (no partial write)
    print("\nTesting validation and rollback on dimension mismatch...")
    # Let's prepare 50 more records, but record 25 has an invalid dimension of 15
    bad_records = []
    for i in range(150, 200):
        val = float(i) / 150.0
        vec = [val] * 16
        if i == 175: # 25th record in this batch
            vec = [val] * 15 # Invalid dimension!
        bad_records.append({
            "id": i,
            "vector": vec,
            "metadata": f"record_{i}"
        })
        
    try:
        client.ingest_vectors(bad_records)
        raise AssertionError("Expected ingest_vectors to raise grpc.RpcError for invalid dimension, but it succeeded.")
    except grpc.RpcError as e:
        assert e.code() == grpc.StatusCode.INVALID_ARGUMENT, f"Expected INVALID_ARGUMENT, got {e.code()}"
        print(f"Successfully caught expected gRPC error: {e.details()}")
        
    # Verify that NO records from this batch were committed to the database
    tbl = db.open_table(table_name)
    rows_count = len(tbl.to_pandas())
    assert rows_count == 150, f"Expected table to still have exactly 150 rows, but it has {rows_count} rows. Rollback failed!"
    print("Verified: Rollback successful. No partial writes from the failed RPC were left in the table.")

    print("\nAll tests passed successfully!")

if __name__ == "__main__":
    run_tests()
