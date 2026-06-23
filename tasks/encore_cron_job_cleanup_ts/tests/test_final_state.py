import os
import re
import requests
import pytest

def get_run_id():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, "ZEALT_RUN_ID environment variable is not set."
    return run_id

def get_app_id():
    run_id = get_run_id()
    app_file_path = f"/home/user/cron-app-{run_id}/encore.app"
    assert os.path.isfile(app_file_path), f"encore.app not found at {app_file_path}"
    
    with open(app_file_path, "r") as f:
        content = f.read()
        
    match = re.search(r'"id"\s*:\s*"([^"]+)"', content)
    assert match, "Could not extract app ID from encore.app"
    return match.group(1)

def get_base_url():
    app_id = get_app_id()
    return f"https://staging-{app_id}.encr.app"

def test_cron_job_cleanup():
    base_url = get_base_url()
    
    # 1. Create Stale Record
    response = requests.post(f"{base_url}/records", json={
        "data": "stale_record",
        "created_at": "2020-01-01T00:00:00Z"
    })
    assert response.status_code == 200, f"Failed to create stale record: {response.text}"
    stale_data = response.json()
    assert "id" in stale_data, "Response missing 'id' for stale record"
    stale_id = stale_data["id"]
    
    # 2. Create Fresh Record
    response = requests.post(f"{base_url}/records", json={
        "data": "fresh_record"
    })
    assert response.status_code == 200, f"Failed to create fresh record: {response.text}"
    fresh_data = response.json()
    assert "id" in fresh_data, "Response missing 'id' for fresh record"
    fresh_id = fresh_data["id"]
    
    # 3. Verify Records Exist
    response = requests.get(f"{base_url}/records")
    assert response.status_code == 200, f"Failed to get records: {response.text}"
    records = response.json()
    assert isinstance(records, list), "Expected GET /records to return a list"
    
    record_ids = [r.get("id") for r in records]
    assert stale_id in record_ids, f"Stale record ID {stale_id} not found in records"
    assert fresh_id in record_ids, f"Fresh record ID {fresh_id} not found in records"
    
    # 4. Trigger Cleanup
    response = requests.post(f"{base_url}/cleanup")
    assert response.status_code == 200, f"Failed to trigger cleanup: {response.text}"
    cleanup_data = response.json()
    # We might expect deleted_count to be at least 1, but we don't strictly assert the exact number 
    # in case there were other stale records, but let's assert it completed successfully.
    
    # 5. Verify Cleanup Result
    response = requests.get(f"{base_url}/records")
    assert response.status_code == 200, f"Failed to get records after cleanup: {response.text}"
    records_after = response.json()
    assert isinstance(records_after, list), "Expected GET /records to return a list"
    
    record_ids_after = [r.get("id") for r in records_after]
    assert stale_id not in record_ids_after, f"Stale record ID {stale_id} was not deleted by cleanup"
    assert fresh_id in record_ids_after, f"Fresh record ID {fresh_id} was incorrectly deleted by cleanup"
