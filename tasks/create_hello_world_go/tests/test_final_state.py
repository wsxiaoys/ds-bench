import os
import re
import requests
import pytest

def get_run_id():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, "ZEALT_RUN_ID environment variable is not set"
    return run_id

def get_app_id(run_id):
    app_file = f"/home/user/helloworld-{run_id}/encore.app"
    assert os.path.isfile(app_file), f"encore.app not found at {app_file}"
    
    with open(app_file, "r") as f:
        content = f.read()
        
    match = re.search(r'"id"\s*:\s*"([^"]+)"', content)
    assert match, f"Could not extract app ID from {app_file}"
    return match.group(1)

def test_hello_world_endpoint():
    run_id = get_run_id()
    app_id = get_app_id(run_id)
    
    url = f"https://staging-{app_id}.encr.app/hello/world"
    response = requests.get(url)
    
    assert response.status_code == 200, f"Expected status 200, got {response.status_code} from {url}"
    assert "Hello, world!" in response.text, f"Expected 'Hello, world!' in response, got: {response.text}"

def test_hello_encore_endpoint():
    run_id = get_run_id()
    app_id = get_app_id(run_id)
    
    url = f"https://staging-{app_id}.encr.app/hello/encore"
    response = requests.get(url)
    
    assert response.status_code == 200, f"Expected status 200, got {response.status_code} from {url}"
    assert "Hello, encore!" in response.text, f"Expected 'Hello, encore!' in response, got: {response.text}"
