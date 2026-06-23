import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_python3_available():
    assert shutil.which("python3") is not None, "python3 binary not found in PATH (needed by the verifier to parse output.log)."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_daytona_api_key_present():
    api_key = os.environ.get("DAYTONA_API_KEY")
    assert api_key is not None and api_key != "", "DAYTONA_API_KEY environment variable is not set."
