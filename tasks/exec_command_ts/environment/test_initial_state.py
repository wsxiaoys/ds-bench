import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_node_binary_available():
    assert shutil.which("node") is not None, (
        "node binary not found in PATH; the task requires a Node.js runtime."
    )


def test_npm_binary_available():
    assert shutil.which("npm") is not None, (
        "npm binary not found in PATH; the task requires npm to install @daytona/sdk."
    )


def test_output_log_not_present_yet():
    log_path = os.path.join(PROJECT_DIR, "output.log")
    assert not os.path.exists(log_path), (
        f"output.log should not exist before the task runs, found: {log_path}"
    )
