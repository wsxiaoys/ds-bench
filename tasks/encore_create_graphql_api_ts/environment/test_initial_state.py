import shutil

def test_encore_binary_available():
    assert shutil.which("encore") is not None, "encore binary not found in PATH."

def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."

def test_npm_binary_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."
