import os
import socket
import requests
import pytest
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/project"
BASE_URL = "http://localhost:3000"

@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["node", "index.js"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 60
        terminate_on_interrupt = True

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", 3000)) == 0

    xprocess.ensure(Starter.name, Starter)
    yield
    info = xprocess.getinfo(Starter.name)
    info.terminate()

def test_assign_role_insert(start_app):
    url = f"{BASE_URL}/roles"
    payload = {"userId": 1, "roleId": 100, "assignedBy": "admin1"}
    response = requests.post(url, json=payload)
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}. Body: {response.text}"
    data = response.json()
    assert data.get("userId") == 1, "Expected userId to be 1"
    assert data.get("roleId") == 100, "Expected roleId to be 100"
    assert data.get("assignedBy") == "admin1", "Expected assignedBy to be 'admin1'"
    assert data.get("isActive") is True, "Expected isActive to be true"

def test_retrieve_role(start_app):
    url = f"{BASE_URL}/roles/1/100"
    response = requests.get(url)
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}. Body: {response.text}"
    data = response.json()
    assert data.get("userId") == 1, "Expected userId to be 1"
    assert data.get("roleId") == 100, "Expected roleId to be 100"
    assert data.get("assignedBy") == "admin1", "Expected assignedBy to be 'admin1'"
    assert data.get("isActive") is True, "Expected isActive to be true"

def test_assign_role_upsert(start_app):
    url = f"{BASE_URL}/roles"
    payload = {"userId": 1, "roleId": 100, "assignedBy": "superadmin"}
    response = requests.post(url, json=payload)
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}. Body: {response.text}"
    data = response.json()
    assert data.get("userId") == 1, "Expected userId to be 1"
    assert data.get("roleId") == 100, "Expected roleId to be 100"
    assert data.get("assignedBy") == "superadmin", "Expected assignedBy to be 'superadmin'"
    assert data.get("isActive") is True, "Expected isActive to be true"

def test_retrieve_updated_role(start_app):
    url = f"{BASE_URL}/roles/1/100"
    response = requests.get(url)
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}. Body: {response.text}"
    data = response.json()
    assert data.get("userId") == 1, "Expected userId to be 1"
    assert data.get("roleId") == 100, "Expected roleId to be 100"
    assert data.get("assignedBy") == "superadmin", "Expected assignedBy to be 'superadmin'"
    assert data.get("isActive") is True, "Expected isActive to be true"

def test_not_found(start_app):
    url = f"{BASE_URL}/roles/99/99"
    response = requests.get(url)
    assert response.status_code == 404, f"Expected status 404, got {response.status_code}. Body: {response.text}"
