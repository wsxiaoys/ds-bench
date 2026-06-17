import os
import json
import pytest

PROJECT_DIR = "/home/user/project"
OPENAPI_FILE = os.path.join(PROJECT_DIR, "openapi.json")

def test_openapi_file_exists():
    assert os.path.isfile(OPENAPI_FILE), f"openapi.json not found at {OPENAPI_FILE}."

def test_openapi_valid_json():
    with open(OPENAPI_FILE, "r") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError as e:
            pytest.fail(f"openapi.json is not valid JSON: {e}")
    assert isinstance(data, dict), "openapi.json should contain a JSON object."

def test_openapi_version():
    with open(OPENAPI_FILE, "r") as f:
        data = json.load(f)

    assert "openapi" in data, "Missing 'openapi' field in openapi.json."
    assert data["openapi"].startswith("3.1"), f"Expected openapi version starting with '3.1', got '{data['openapi']}'."

def test_openapi_info():
    with open(OPENAPI_FILE, "r") as f:
        data = json.load(f)

    assert "info" in data, "Missing 'info' object in openapi.json."
    assert data["info"].get("title") == "My API", f"Expected title 'My API', got '{data['info'].get('title')}'."
    assert data["info"].get("version") == "1.0.0", f"Expected version '1.0.0', got '{data['info'].get('version')}'."

def test_openapi_paths():
    with open(OPENAPI_FILE, "r") as f:
        data = json.load(f)

    assert "paths" in data, "Missing 'paths' object in openapi.json."
    assert "/hello" in data["paths"], "Expected endpoint '/hello' in paths."
    assert "get" in data["paths"]["/hello"], "Expected 'get' method for '/hello' endpoint."