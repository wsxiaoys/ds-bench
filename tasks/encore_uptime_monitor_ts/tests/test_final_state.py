import os
import re
import time
import requests
import pytest

APP_DIR = "/home/user/uptime"

@pytest.fixture(scope="session")
def base_url():
    encore_app_path = os.path.join(APP_DIR, "encore.app")
    assert os.path.isfile(encore_app_path), f"encore.app not found at {encore_app_path}"
    
    with open(encore_app_path, "r") as f:
        content = f.read()
    
    match = re.search(r'"id"\s*:\s*"([^\"]+)"', content)
    assert match, "Could not extract app id from encore.app"
    
    app_id = match.group(1)
    url = f"https://staging-{app_id}.encr.app"
    
    # Simple wait for the app to be responsive
    for _ in range(30):
        try:
            # We don't care about the status code here, just that it doesn't connection error
            requests.get(url, timeout=5)
            break
        except requests.exceptions.RequestException:
            time.sleep(2)
            
    return url

def test_add_site_and_trigger_check(base_url):
    # Add a site
    site_url = f"{base_url}/site"
    payload = {"url": "https://example.com"}
    response = requests.post(site_url, json=payload, timeout=10)
    
    assert response.status_code in [200, 201], f"Expected status 200 or 201 for POST /site, got {response.status_code}"
    
    data = response.json()
    assert "url" in data, f"Expected 'url' in response, got {data}"
    assert data["url"] == "https://example.com", f"Expected url to be 'https://example.com', got {data['url']}"
    assert "id" in data, f"Expected 'id' in response, got {data}"
    
    site_id = data["id"]
    
    # Trigger check
    check_url = f"{base_url}/check"
    check_response = requests.post(check_url, timeout=10)
    assert check_response.status_code in [200, 202], f"Expected status 200 or 202 for POST /check, got {check_response.status_code}"
    
    # Wait for Pub/Sub processing
    time.sleep(15)
    
    # Verify status update
    get_response = requests.get(site_url, timeout=10)
    assert get_response.status_code == 200, f"Expected status 200 for GET /site, got {get_response.status_code}"
    
    get_data = get_response.json()
    assert "sites" in get_data, f"Expected 'sites' in response, got {get_data}"
    
    sites = get_data["sites"]
    target_site = next((s for s in sites if s.get("id") == site_id), None)
    
    assert target_site is not None, f"Site with id {site_id} not found in response: {sites}"
    assert target_site.get("is_up") is True, f"Expected site is_up to be True, got {target_site.get('is_up')}"
