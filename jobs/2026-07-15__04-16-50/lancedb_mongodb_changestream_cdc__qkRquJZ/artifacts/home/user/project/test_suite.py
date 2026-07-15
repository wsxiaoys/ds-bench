#!/usr/bin/env python3
import os
import subprocess
import shutil
from pymongo import MongoClient
import lancedb
import pyarrow as pa
from bson import json_util

def run_sync():
    # Run sync.py
    res = subprocess.run(["python3", "sync.py"], cwd="/home/user/project", capture_output=True, text=True)
    print("STDOUT:")
    print(res.stdout)
    if res.stderr:
        print("STDERR:")
        print(res.stderr)
    assert res.returncode == 0, f"sync.py failed with exit code {res.returncode}"

def main():
    # Connect to MongoDB
    client = MongoClient("mongodb://localhost:27017/?replicaSet=rs0")
    db = client["cdc"]
    coll = db["documents"]
    
    # Clear existing data in MongoDB
    coll.delete_many({})
    
    # Clear LanceDB if exists
    ldb_path = "/home/user/project/lancedb"
    if os.path.exists(ldb_path):
        shutil.rmtree(ldb_path)
    
    # Clear resume token if exists
    token_path = "/home/user/project/resume_token.json"
    if os.path.exists(token_path):
        os.remove(token_path)
        
    print("--- Scenario 1: Run sync on empty database ---")
    run_sync()
    
    # Verify resume token is created
    assert os.path.exists(token_path), "Resume token file was not created"
    with open(token_path, "r") as f:
        token_data = json_util.loads(f.read())
        print("Created resume token:", token_data)
        
    # Verify LanceDB table is created and empty
    ldb = lancedb.connect(ldb_path)
    assert "documents" in ldb.list_tables().tables
    table = ldb.open_table("documents")
    assert table.count_rows() == 0, f"Expected 0 rows, got {table.count_rows()}"
    print("Scenario 1 passed!")
    
    print("\n--- Scenario 2: Insert documents ---")
    coll.insert_one({"_id": "doc1", "text": "hello world", "category": "news"})
    coll.insert_one({"_id": "doc2", "text": "lance db is cool", "category": "tech"})
    
    run_sync()
    
    # Verify rows in LanceDB
    table = ldb.open_table("documents")
    assert table.count_rows() == 2, f"Expected 2 rows, got {table.count_rows()}"
    row1 = table.to_arrow().filter(pa.compute.equal(table.to_arrow()["id"], "doc1")).to_pydict()
    assert row1["text"][0] == "hello world"
    assert row1["category"][0] == "news"
    print("Doc1 vector:", row1["vector"][0])
    print("Scenario 2 passed!")
    
    print("\n--- Scenario 3: Update and Replace documents ---")
    coll.update_one({"_id": "doc1"}, {"$set": {"text": "hello update"}})
    coll.replace_one({"_id": "doc2"}, {"_id": "doc2", "text": "lance db is fast", "category": "tech"})
    
    run_sync()
    
    # Verify rows in LanceDB
    table = ldb.open_table("documents")
    assert table.count_rows() == 2
    row1 = table.to_arrow().filter(pa.compute.equal(table.to_arrow()["id"], "doc1")).to_pydict()
    assert row1["text"][0] == "hello update"
    
    row2 = table.to_arrow().filter(pa.compute.equal(table.to_arrow()["id"], "doc2")).to_pydict()
    assert row2["text"][0] == "lance db is fast"
    print("Scenario 3 passed!")
    
    print("\n--- Scenario 4: Delete documents ---")
    coll.delete_one({"_id": "doc1"})
    
    run_sync()
    
    # Verify row is deleted
    table = ldb.open_table("documents")
    assert table.count_rows() == 1
    ids = table.to_arrow()["id"].to_pylist()
    assert "doc1" not in ids
    assert "doc2" in ids
    print("Scenario 4 passed!")
    
    print("\n--- Scenario 5: Sequence of operations on same ID ---")
    # For doc3: insert -> update -> delete
    # For doc4: insert
    coll.insert_one({"_id": "doc3", "text": "temporary", "category": "temp"})
    coll.update_one({"_id": "doc3"}, {"$set": {"text": "temporary update"}})
    coll.delete_one({"_id": "doc3"})
    coll.insert_one({"_id": "doc4", "text": "new doc", "category": "new"})
    
    run_sync()
    
    # Verify doc3 does not exist, doc4 exists
    table = ldb.open_table("documents")
    ids = table.to_arrow()["id"].to_pylist()
    assert "doc3" not in ids
    assert "doc4" in ids
    print("Scenario 5 passed!")
    
    print("\n--- Scenario 6: Re-run sync with no changes ---")
    # Running it again should be a no-op and not modify anything
    run_sync()
    table = ldb.open_table("documents")
    assert table.count_rows() == 2
    print("Scenario 6 passed!")
    
    print("\nAll tests passed successfully!")

if __name__ == "__main__":
    main()
