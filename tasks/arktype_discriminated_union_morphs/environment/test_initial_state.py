import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_npx_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected project directory {PROJECT_DIR} to exist before the task starts."
    )


def test_project_directory_initially_empty():
    # The task instructs the executor to create src/schema.ts, broken.ts, and
    # package.json themselves; none of these should exist in the initial state.
    assert not os.path.exists(os.path.join(PROJECT_DIR, "src", "schema.ts")), (
        "src/schema.ts should not exist in the initial state; the executor must create it."
    )
    assert not os.path.exists(os.path.join(PROJECT_DIR, "broken.ts")), (
        "broken.ts should not exist in the initial state; the executor must create it."
    )
    assert not os.path.exists(os.path.join(PROJECT_DIR, "package.json")), (
        "package.json should not exist in the initial state; the executor must create it."
    )
