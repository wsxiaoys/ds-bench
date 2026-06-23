import os
import re
import requests
import pytest

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="session")
def app_id():
    encore_app_path = os.path.join(PROJECT_DIR, "encore.app")
    assert os.path.isfile(encore_app_path), f"encore.app not found at {encore_app_path}"
    
    with open(encore_app_path, "r") as f:
        content = f.read()
    
    match = re.search(r'"id"\s*:\s*"([^"]+)"', content)
    assert match is not None, "Could not extract app ID from encore.app"
    return match.group(1)

def test_user_service(app_id):
    url = f"https://staging-{app_id}.encr.app/user/123"
    response = requests.get(url)
    assert response.status_code == 200, f"Expected status 200 from {url}, got {response.status_code}"
    
    data = response.json()
    assert "id" in data, "Response JSON missing 'id' field"
    assert "name" in data, "Response JSON missing 'name' field"
    assert str(data["id"]) == "123", f"Expected id '123', got {data['id']}"

def test_order_service(app_id):
    url = f"https://staging-{app_id}.encr.app/order/456"
    response = requests.get(url)
    assert response.status_code == 200, f"Expected status 200 from {url}, got {response.status_code}"
    
    data = response.json()
    assert "id" in data, "Response JSON missing 'id' field"
    assert "user_id" in data, "Response JSON missing 'user_id' field"
    assert "user_name" in data, "Response JSON missing 'user_name' field"
    assert str(data["id"]) == "456", f"Expected order id '456', got {data['id']}"
