import os
import re
import requests
import pytest

PROJECT_DIR = "/home/user/myproject"

def get_app_id():
    app_file = os.path.join(PROJECT_DIR, "encore.app")
    assert os.path.isfile(app_file), f"{app_file} does not exist. Did the app initialize successfully?"
    
    with open(app_file, "r") as f:
        content = f.read()
        
    match = re.search(r'"id"\s*:\s*"([^"]+)"', content)
    assert match is not None, "Could not find 'id' in encore.app"
    return match.group(1)

def test_encore_app_file_exists():
    app_id = get_app_id()
    assert len(app_id) > 0, "App ID is empty"

def test_hello_endpoint():
    app_id = get_app_id()
    url = f"https://staging-{app_id}.encr.app/hello/world"
    
    try:
        response = requests.get(url, timeout=10)
    except requests.RequestException as e:
        pytest.fail(f"Failed to connect to {url}: {e}")
        
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}. Response: {response.text}"
    
    try:
        data = response.json()
    except ValueError:
        pytest.fail(f"Response is not valid JSON: {response.text}")
        
    assert data.get("message") == "Hello, world!", f"Expected message 'Hello, world!', got {data.get('message')}"

def test_ping_endpoint():
    app_id = get_app_id()
    url = f"https://staging-{app_id}.encr.app/ping"
    
    try:
        response = requests.get(url, timeout=10)
    except requests.RequestException as e:
        pytest.fail(f"Failed to connect to {url}: {e}")
        
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}. Response: {response.text}"
    
    try:
        data = response.json()
    except ValueError:
        pytest.fail(f"Response is not valid JSON: {response.text}")
        
    assert data.get("message") == "pong", f"Expected message 'pong', got {data.get('message')}"
