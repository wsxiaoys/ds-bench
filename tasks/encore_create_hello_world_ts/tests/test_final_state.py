import os
import re
import requests

LOG_FILE = "/home/user/myproject/output.log"

def test_log_file_exists():
    assert os.path.isfile(LOG_FILE), f"Log file not found at {LOG_FILE}"

def get_base_url():
    with open(LOG_FILE, "r") as f:
        content = f.read()
    match = re.search(r"Base URL:\s*(https?://\S+)", content)
    assert match is not None, f"Could not find 'Base URL: <url>' in {LOG_FILE}"
    return match.group(1).rstrip("/")

def test_hello_world_endpoint():
    base_url = get_base_url()
    url = f"{base_url}/hello/world"
    response = requests.get(url)
    assert response.status_code == 200, f"Expected status 200 for {url}, got {response.status_code}"
    
    data = response.json()
    assert "message" in data, f"Expected 'message' field in response, got {data}"
    assert data["message"] == "Hello world!", f"Expected 'Hello world!', got {data['message']}"

def test_hello_encore_endpoint():
    base_url = get_base_url()
    url = f"{base_url}/hello/encore"
    response = requests.get(url)
    assert response.status_code == 200, f"Expected status 200 for {url}, got {response.status_code}"
    
    data = response.json()
    assert "message" in data, f"Expected 'message' field in response, got {data}"
    assert data["message"] == "Hello encore!", f"Expected 'Hello encore!', got {data['message']}"
