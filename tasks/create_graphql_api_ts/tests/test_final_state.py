import os
import re
import requests
import pytest

PROJECT_DIR = "/home/user/graphql-api"
APP_FILE = os.path.join(PROJECT_DIR, "encore.app")

def get_app_id():
    assert os.path.isfile(APP_FILE), f"encore.app file not found at {APP_FILE}"
    with open(APP_FILE, "r") as f:
        content = f.read()
    
    match = re.search(r'"id"\s*:\s*"([^"]+)"', content)
    assert match is not None, "Could not find app ID in encore.app"
    return match.group(1)

def test_graphql_query_without_name():
    app_id = get_app_id()
    url = f"https://staging-{app_id}.encr.app/graphql"
    
    payload = {
        "query": "query { hello }"
    }
    response = requests.post(url, json=payload)
    
    assert response.status_code == 200, f"Expected HTTP 200, got {response.status_code}. Response: {response.text}"
    data = response.json()
    
    assert "data" in data, f"Expected 'data' in response JSON, got {data}"
    assert "hello" in data["data"], f"Expected 'hello' in response data, got {data['data']}"
    assert data["data"]["hello"] == "Hello, World!", f"Expected 'Hello, World!', got {data['data']['hello']}"

def test_graphql_query_with_name():
    app_id = get_app_id()
    url = f"https://staging-{app_id}.encr.app/graphql"
    
    payload = {
        "query": "query { hello(name: \"Alice\") }"
    }
    response = requests.post(url, json=payload)
    
    assert response.status_code == 200, f"Expected HTTP 200, got {response.status_code}. Response: {response.text}"
    data = response.json()
    
    assert "data" in data, f"Expected 'data' in response JSON, got {data}"
    assert "hello" in data["data"], f"Expected 'hello' in response data, got {data['data']}"
    assert data["data"]["hello"] == "Hello, Alice!", f"Expected 'Hello, Alice!', got {data['data']['hello']}"
