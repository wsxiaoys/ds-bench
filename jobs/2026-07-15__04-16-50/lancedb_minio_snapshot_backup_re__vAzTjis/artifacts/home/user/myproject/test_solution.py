import os
import sys
import shutil
import lancedb
import pandas as pd
import pytest

# Ensure our solution module is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from solution import backup, restore

def test_backup_and_restore():
    original_path = "/tmp/test_original.lance"
    restored_path = "/tmp/test_restored.lance"
    
    # Clean up previous runs
    for path in [original_path, restored_path]:
        if os.path.exists(path):
            shutil.rmtree(path)
            
    # 1. Create original table with history
    db = lancedb.connect("/tmp")
    # Note: LanceDB connect creates tables as <name>.lance
    table = db.create_table("test_original", data=[
        {"vector": [1.0, 1.0], "id": 1, "val": "one"},
        {"vector": [2.0, 2.0], "id": 2, "val": "two"}
    ])
    
    # Version 2: Add rows
    table.add([
        {"vector": [3.0, 3.0], "id": 3, "val": "three"},
        {"vector": [4.0, 4.0], "id": 4, "val": "four"}
    ])
    
    # Version 3: Delete a row
    table.delete("id = 2")
    
    # Version 4: Update a row (using merge_insert or update if supported, let's use update or add)
    # Let's add more rows to make a 4th version
    table.add([
        {"vector": [5.0, 5.0], "id": 5, "val": "five"}
    ])
    
    # Capture original state and history
    original_versions = table.list_versions()
    print("Original versions:")
    for v in original_versions:
        print(v)
        
    # Capture row counts for each version
    original_version_row_counts = {}
    for v_info in original_versions:
        v = v_info['version']
        table.checkout(v)
        original_version_row_counts[v] = len(table.to_pandas())
        
    # Checkout latest to be clean
    table.checkout_latest()
    original_latest_df = table.to_pandas().sort_values(by="id").reset_index(drop=True)
    
    # 2. Run backup
    s3_uri = "s3://lance-backup/test-table"
    print(f"Backing up {original_path} to {s3_uri}...")
    backup(original_path, s3_uri)
    print("Backup complete.")
    
    # 3. Run restore
    print(f"Restoring from {s3_uri} to {restored_path}...")
    restore(s3_uri, restored_path)
    print("Restore complete.")
    
    # 4. Verify restored table
    restored_db = lancedb.connect("/tmp")
    restored_table = restored_db.open_table("test_restored")
    
    # Verify latest data matches
    restored_latest_df = restored_table.to_pandas().sort_values(by="id").reset_index(drop=True)
    pd.testing.assert_frame_equal(original_latest_df, restored_latest_df)
    print("Latest data verification passed!")
    
    # Verify version history and per-version row counts
    restored_versions = restored_table.list_versions()
    assert len(restored_versions) == len(original_versions), "Version history length mismatch"
    
    for v_info in restored_versions:
        v = v_info['version']
        restored_table.checkout(v)
        restored_count = len(restored_table.to_pandas())
        assert restored_count == original_version_row_counts[v], f"Row count mismatch for version {v}"
        
    print("Version history and per-version row count verification passed!")
    
    # 5. Verify restore fails cleanly for non-existent prefix
    non_existent_uri = "s3://lance-backup/non-existent-prefix"
    failed_restore_path = "/tmp/failed_restore.lance"
    
    if os.path.exists(failed_restore_path):
        shutil.rmtree(failed_restore_path)
        
    try:
        restore(non_existent_uri, failed_restore_path)
        assert False, "Should have raised FileNotFoundError for non-existent prefix"
    except FileNotFoundError as e:
        print("Successfully raised FileNotFoundError for non-existent prefix.")
        assert not os.path.exists(failed_restore_path), "Failed restore path should not exist on failure"
        
    # Clean up
    for path in [original_path, restored_path, failed_restore_path]:
        if os.path.exists(path):
            shutil.rmtree(path)
            
    print("All tests passed successfully!")

if __name__ == "__main__":
    test_backup_and_restore()
