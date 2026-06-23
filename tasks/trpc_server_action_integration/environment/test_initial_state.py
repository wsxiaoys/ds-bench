import os
import shutil
import pytest

def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."

def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_npx_binary_available():
    assert shutil.which("npx") is not None, "npx binary not found in PATH."

def test_project_dir_does_not_exist():
    # The agent is expected to create this directory
    assert not os.path.exists("/home/user/project"), "Project directory should not exist initially."
