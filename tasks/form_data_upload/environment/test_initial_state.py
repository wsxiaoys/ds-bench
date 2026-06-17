import os
import shutil

def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."

def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_home_user_exists():
    assert os.path.isdir("/home/user"), "/home/user directory does not exist."
