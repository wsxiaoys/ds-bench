import os
import re
import requests
import pytest

PROJECT_DIR = "/home/user/customauth"

@pytest.fixture(scope="session")
def app_id():
    encore_app_path = os.path.join(PROJECT_DIR, "encore.app")
    assert os.path.isfile(encore_app_path), f"encore.app not found at {encore_app_path}"
    
    with open(encore_app_path, "r") as f:
        content = f.read()
        
    match = re.search(r'"id"\s*:\s*"([^\"]+)"', content)
    assert match is not None, "Could not extract app ID from encore.app"
    return match.group(1)

@pytest.fixture(scope="session")
def base_url(app_id):
    return f"https://staging-{app_id}.encr.app"

def test_missing_token(base_url):
    url = f"{base_url}/dashboard"
    response = requests.get(url)
    assert response.status_code == 401, f"Expected 401 for missing token, got {response.status_code}"

def test_invalid_token(base_url):
    url = f"{base_url}/dashboard"
    headers = {"Authorization": "Bearer wrong-token"}
    response = requests.get(url, headers=headers)
    assert response.status_code == 401, f"Expected 401 for invalid token, got {response.status_code}"

def test_valid_token(base_url):
    url = f"{base_url}/dashboard"
    headers = {"Authorization": "Bearer secret-token"}
    response = requests.get(url, headers=headers)
    assert response.status_code == 200, f"Expected 200 for valid token, got {response.status_code}"
    
    data = response.json()
    expected_message = "Welcome to the dashboard, user-123!"
    assert data.get("message") == expected_message, f"Expected message '{expected_message}', got '{data.get('message')}'"
