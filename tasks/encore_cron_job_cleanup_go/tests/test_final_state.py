import os
import re
import pytest
import requests

PROJECT_DIR = "/home/user/cleanup-app"

@pytest.fixture(scope="session")
def base_url():
    encore_app_path = os.path.join(PROJECT_DIR, "encore.app")
    assert os.path.isfile(encore_app_path), f"encore.app not found at {encore_app_path}"
    
    with open(encore_app_path, "r") as f:
        content = f.read()
    
    match = re.search(r'"id"\s*:\s*"([^"]+)"', content)
    assert match is not None, "Could not find app ID in encore.app"
    
    app_id = match.group(1)
    return f"https://staging-{app_id}.encr.app"

def test_insert_stale_record(base_url):
    url = f"{base_url}/records"
    payload = {
        "id": "stale-1",
        "data": "old data",
        "created_at": "2020-01-01T00:00:00Z"
    }
    response = requests.post(url, json=payload, timeout=10)
    assert response.status_code == 200, f"Failed to insert stale record. Status: {response.status_code}, Body: {response.text}"

def test_insert_fresh_record(base_url):
    url = f"{base_url}/records"
    payload = {
        "id": "fresh-1",
        "data": "new data",
        "created_at": "2099-01-01T00:00:00Z"
    }
    response = requests.post(url, json=payload, timeout=10)
    assert response.status_code == 200, f"Failed to insert fresh record. Status: {response.status_code}, Body: {response.text}"

def test_trigger_cleanup(base_url):
    url = f"{base_url}/cleanup"
    response = requests.post(url, timeout=10)
    assert response.status_code == 200, f"Failed to trigger cleanup. Status: {response.status_code}, Body: {response.text}"

def test_verify_deletion(base_url):
    url = f"{base_url}/records"
    response = requests.get(url, timeout=10)
    assert response.status_code == 200, f"Failed to get records. Status: {response.status_code}, Body: {response.text}"
    
    assert "fresh-1" in response.text, f"Fresh record 'fresh-1' should exist but was not found in: {response.text}"
    assert "stale-1" not in response.text, f"Stale record 'stale-1' should have been deleted but was found in: {response.text}"
