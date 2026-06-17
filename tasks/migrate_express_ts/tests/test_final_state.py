import os
import re
import requests
import pytest

APP_ID_LOG = "/home/user/helloworld/app_id.log"

def get_app_id():
    assert os.path.isfile(APP_ID_LOG), f"Log file {APP_ID_LOG} does not exist."
    with open(APP_ID_LOG, "r") as f:
        content = f.read()
    
    match = re.search(r"App ID:\s*([^\s]+)", content)
    assert match is not None, f"Could not extract App ID from {APP_ID_LOG}. Content: {content}"
    return match.group(1)

def test_app_id_log_exists():
    """Verify that the log file exists and contains the App ID."""
    get_app_id()

def test_greet_alice():
    """Verify the deployed endpoint returns the correct greeting for Alice."""
    app_id = get_app_id()
    url = f"https://staging-{app_id}.encr.app/greet/Alice"
    
    response = requests.get(url)
    assert response.status_code == 200, f"Expected status 200 for {url}, got {response.status_code}. Response: {response.text}"
    
    data = response.json()
    assert data.get("message") == "Hello, Alice!", f"Expected message 'Hello, Alice!', got: {data.get('message')}"

def test_greet_bob():
    """Verify the deployed endpoint returns the correct greeting for Bob."""
    app_id = get_app_id()
    url = f"https://staging-{app_id}.encr.app/greet/Bob"
    
    response = requests.get(url)
    assert response.status_code == 200, f"Expected status 200 for {url}, got {response.status_code}. Response: {response.text}"
    
    data = response.json()
    assert data.get("message") == "Hello, Bob!", f"Expected message 'Hello, Bob!', got: {data.get('message')}"
