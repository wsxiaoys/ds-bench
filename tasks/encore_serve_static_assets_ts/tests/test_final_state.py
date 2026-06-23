import os
import re
import requests
import pytest

PROJECT_DIR = "/home/user/myproject"
ENCORE_APP_FILE = os.path.join(PROJECT_DIR, "encore.app")

def test_encore_app_file_exists():
    """Verify that the encore.app file exists."""
    assert os.path.isfile(ENCORE_APP_FILE), f"encore.app not found at {ENCORE_APP_FILE}"

def get_app_id():
    """Helper to extract app ID from encore.app."""
    with open(ENCORE_APP_FILE, "r") as f:
        content = f.read()
    match = re.search(r'"id"\s*:\s*"([^"]+)"', content)
    assert match is not None, "Could not find 'id' in encore.app"
    return match.group(1)

def test_static_html_served():
    """Verify that the static HTML is served and contains 'Hello Static World'."""
    app_id = get_app_id()
    
    # Try the root endpoint first
    url_root = f"https://staging-{app_id}.encr.app/"
    response_root = requests.get(url_root)
    
    # If root doesn't contain it, try /index.html
    if response_root.status_code == 200 and "Hello Static World" in response_root.text:
        return
        
    url_index = f"https://staging-{app_id}.encr.app/index.html"
    response_index = requests.get(url_index)
    assert response_index.status_code == 200 and "Hello Static World" in response_index.text, \
        f"Neither {url_root} nor {url_index} returned the expected HTML containing 'Hello Static World'. Response root: {response_root.status_code}, Response index: {response_index.status_code}"

def test_static_css_served():
    """Verify that style.css is served with a 200 OK status."""
    app_id = get_app_id()
    url = f"https://staging-{app_id}.encr.app/style.css"
    response = requests.get(url)
    assert response.status_code == 200, f"Expected 200 OK for {url}, got {response.status_code}"
