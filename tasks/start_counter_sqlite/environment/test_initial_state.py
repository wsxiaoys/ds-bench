import os
import shutil
import socket

import pytest

PROJECT_DIR = "/home/user/myproject"
PORT = 47329


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_npx_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_project_dir_empty_or_no_sqlite_yet():
    # The agent is expected to scaffold the project from scratch; the directory
    # must not already contain a populated SQLite database. We do not assert it
    # is fully empty (the executor may have a .gitkeep or similar), but we do
    # assert no pre-existing *.db / *.sqlite / *.sqlite3 file is shipped.
    for root, dirs, files in os.walk(PROJECT_DIR):
        # Skip node_modules if it somehow exists.
        if "node_modules" in dirs:
            dirs.remove("node_modules")
        for fname in files:
            lower = fname.lower()
            assert not (
                lower.endswith(".db")
                or lower.endswith(".sqlite")
                or lower.endswith(".sqlite3")
            ), f"Unexpected pre-existing SQLite file: {os.path.join(root, fname)}"


def test_target_port_is_free():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1.0)
    try:
        with pytest.raises(Exception):
            s.connect(("127.0.0.1", PORT))
    finally:
        s.close()


def test_target_port_bindable():
    # Confirm we can bind the chosen port at the start of the task.
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        s.bind(("127.0.0.1", PORT))
    except OSError as exc:
        pytest.fail(
            f"Expected port {PORT} to be free and bindable at task start, "
            f"but got: {exc}"
        )
    finally:
        s.close()
