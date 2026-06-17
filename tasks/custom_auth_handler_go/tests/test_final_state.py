import os
import re
import requests
import pytest

LOG_FILE = "/home/user/myproject/output.log"

@pytest.fixture(scope="session")
def app_id():
    assert os.path.isfile(LOG_FILE), f"Log file not found at {LOG_FILE}"
    with open(LOG_FILE, "r") as f:
        content = f.read()
    
    match = re.search(r"App ID:\s*(\S+)", content)
    assert match is not None, "Could not find 'App ID: <app_id>' in the output log."
    return match.group(1)

def test_unauthenticated_access(app_id):
    url = f"https://staging-{app_id}.encr.app/dashboard"
    response = requests.get(url)
    assert response.status_code == 401, f"Expected 401 Unauthorized for unauthenticated access, got {response.status_code}. Response: {response.text}"

def test_invalid_token_access(app_id):
    url = f"https://staging-{app_id}.encr.app/dashboard"
    headers = {"Authorization": "Bearer invalid-token"}
    response = requests.get(url, headers=headers)
    assert response.status_code == 401, f"Expected 401 Unauthorized for invalid token, got {response.status_code}. Response: {response.text}"

def test_valid_token_access(app_id):
    url = f"https://staging-{app_id}.encr.app/dashboard"
    headers = {"Authorization": "Bearer secret-token"}
    response = requests.get(url, headers=headers)
    assert response.status_code == 200, f"Expected 200 OK for valid token, got {response.status_code}. Response: {response.text}"
    
    data = response.json()
    expected_message = "Hello user-123, you are an admin"
    assert "message" in data, "Response JSON does not contain 'message' field."
    assert data["message"] == expected_message, f"Expected message '{expected_message}', got '{data['message']}'"
