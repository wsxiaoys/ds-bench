import os
import re
import requests
import pytest

LOG_FILE = "/home/user/myapp/deploy.log"

def test_deploy_log_exists():
    assert os.path.isfile(LOG_FILE), f"Deploy log not found at {LOG_FILE}"

def get_app_id():
    with open(LOG_FILE, "r") as f:
        content = f.read()
    match = re.search(r"App ID:\s*([^\s]+)", content)
    assert match is not None, f"Could not find 'App ID: <app-id>' in {LOG_FILE}"
    return match.group(1)

def test_user_endpoint():
    app_id = get_app_id()
    url = f"https://staging-{app_id}.encr.app/user/1"
    response = requests.get(url)
    assert response.status_code == 200, f"Expected status 200 from {url}, got {response.status_code}"
    
    data = response.json()
    assert data.get("id") == 1, f"Expected user id 1, got {data.get('id')}"
    assert data.get("name") == "Alice", f"Expected user name 'Alice', got {data.get('name')}"

def test_order_endpoint():
    app_id = get_app_id()
    url = f"https://staging-{app_id}.encr.app/order/100"
    response = requests.get(url)
    assert response.status_code == 200, f"Expected status 200 from {url}, got {response.status_code}"
    
    data = response.json()
    assert data.get("orderId") == 100, f"Expected orderId 100, got {data.get('orderId')}"
    assert data.get("userId") == 1, f"Expected userId 1, got {data.get('userId')}"
    assert data.get("userName") == "Alice", f"Expected userName 'Alice', got {data.get('userName')}"
