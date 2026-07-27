import os
import shutil
import time
import urllib.request
import urllib.error

import pytest

PROJECT_DIR = "/home/user/scheduling_lab"
API_URL = "http://127.0.0.1:4200/api"


def test_prefect_importable():
    import importlib

    module = importlib.import_module("prefect")
    assert module is not None, "The 'prefect' package could not be imported."


def test_prefect_cli_available():
    assert shutil.which("prefect") is not None, "The 'prefect' CLI was not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_prefect_server_api_reachable():
    health_url = f"{API_URL}/health"
    last_error = None
    for _ in range(60):
        try:
            with urllib.request.urlopen(health_url, timeout=5) as response:
                if response.status == 200:
                    return
        except (urllib.error.URLError, ConnectionError, OSError) as exc:
            last_error = exc
        time.sleep(2)
    pytest.fail(
        f"Local Prefect server API at {health_url} was not reachable within the timeout. "
        f"Last error: {last_error}"
    )
