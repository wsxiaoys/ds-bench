import shutil

def test_encore_cli_available():
    assert shutil.which("encore") is not None, "encore CLI not found in PATH."

def test_node_available():
    assert shutil.which("node") is not None, "node not found in PATH."
