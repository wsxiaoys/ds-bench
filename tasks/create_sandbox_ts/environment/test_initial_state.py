import os
import shutil


PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, (
        "node binary not found in PATH; Node.js is required to run the Daytona TS SDK."
    )


def test_npm_available():
    assert shutil.which("npm") is not None, (
        "npm binary not found in PATH; npm is required to install @daytonaio/sdk."
    )


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist before the task starts."
    )


def test_daytona_api_key_set():
    api_key = os.environ.get("DAYTONA_API_KEY")
    assert api_key is not None and api_key.strip() != "", (
        "DAYTONA_API_KEY environment variable must be set for the task to authenticate "
        "with the Daytona SaaS API."
    )
